/**
 * TDX API 代理服務 - Cloudflare Worker 版本
 *
 * 功能：
 * 1. 代理前端對 TDX API 的請求，解決 CORS 跨域問題並隱藏金鑰。
 * 2. 實作記憶體 Token 快取，大幅減少對 TDX Token API 的呼叫，避免觸發 429 頻率限制。
 * 3. Token 請求序列化（singleton lock）：當多個並行請求同時到達冷啟動的 Worker，
 *    確保只有一個請求實際去取 Token，其餘等待同一個 Promise，避免重複打 Token API。
 * 4. 自動 Retry with Exponential Backoff：TDX 回傳 429 / 503 時自動等待後重試（最多 2 次）。
 *
 * 設定方式：
 * 請在 Cloudflare Workers 控制台設定環境變數：
 * - CLIENT_ID: 您的 TDX Client ID
 * - CLIENT_SECRET: 您的 TDX Client Secret
 */

// ─── Token 快取 ───────────────────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0; // Unix 毫秒時間戳記

// Singleton lock：防止冷啟動時多個並行請求同時打 Token API
let tokenFetchPromise = null;

const TDX_TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const TDX_API_BASE = "https://tdx.transportdata.tw/api/basic";

// CORS 預設回應標頭
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/** 睡眠指定毫秒 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 帶有 Exponential Backoff 的 fetch wrapper。
 * 遇到 429 / 503 時自動等待後重試，最多重試 maxRetries 次。
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 需要 retry 的狀態碼
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        // 嘗試讀取 Retry-After header（秒），否則用指數退避
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000; // 1s → 2s
        console.log(`[Worker] TDX 回傳 ${response.status}，等待 ${waitMs}ms 後第 ${attempt + 1} 次重試...`);
        await sleep(waitMs);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await sleep(waitMs);
      }
    }
  }
  throw lastError ?? new Error("fetchWithRetry: 所有重試均失敗");
}

// ─── 主要 Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // 處理 CORS 預檢請求 (Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const clientId = env.CLIENT_ID;
      const clientSecret = env.CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "Cloudflare Worker 環境變數 CLIENT_ID 或 CLIENT_SECRET 尚未設定。" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // 取得 Access Token（帶序列化快取機制，防止冷啟動時重複打 Token API）
      let token;
      try {
        token = await getTdxToken(clientId, clientSecret);
      } catch (tokenErr) {
        return new Response(
          JSON.stringify({ error: `取得 TDX 授權失敗: ${tokenErr.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const url = new URL(request.url);

      // 取得要代理的 TDX API 路徑
      let targetPath = url.pathname;
      if (targetPath.startsWith("/api/tdx")) {
        targetPath = targetPath.substring(8);
      }
      if (!targetPath.startsWith("/")) {
        targetPath = "/" + targetPath;
      }

      // 建立目標 TDX 請求網址
      const tdxUrl = new URL(`${TDX_API_BASE}${targetPath}`);

      // 複製所有查詢參數（排除 cb 與 $format）
      for (const [key, value] of url.searchParams) {
        if (key !== "cb" && key !== "$format") {
          tdxUrl.searchParams.set(key, value);
        }
      }
      tdxUrl.searchParams.set("$format", "JSON");

      // 呼叫 TDX API（帶自動重試）
      const tdxResponse = await fetchWithRetry(tdxUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "Cloudflare-Worker-Proxy",
        },
      });

      // 處理 TDX API 回傳錯誤
      if (!tdxResponse.ok) {
        const errText = await tdxResponse.text();
        // 對 429 提供更友善的錯誤訊息
        const errorMsg =
          tdxResponse.status === 429
            ? "TDX API 請求過於頻繁（429），請稍待幾秒後再試"
            : `TDX API 查詢失敗 (${tdxResponse.status})`;
        return new Response(
          JSON.stringify({ error: errorMsg, detail: errText }),
          {
            status: tdxResponse.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const data = await tdxResponse.json();

      // 回傳成功結果，Cache-Control 60 秒
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
          ...corsHeaders,
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `代理伺服器內部錯誤: ${err.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  },
};

// ─── Token 取得（序列化 + 快取）────────────────────────────────────────────────

/**
 * 取得 TDX Token。
 *
 * 利用 singleton Promise（tokenFetchPromise）確保同一時間只有一個請求去打
 * Token API，其餘並行請求等待同一個 Promise 回傳結果，徹底避免冷啟動時
 * 重複打 Token API 觸發 429。
 */
async function getTdxToken(clientId, clientSecret) {
  const now = Date.now();

  // 快取命中：直接回傳
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  // 若已有進行中的 token 請求（singleton lock），等待它完成
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  // 發起新的 token 請求，並鎖住 singleton
  tokenFetchPromise = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await fetch(TDX_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Token 取得失敗 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (!data.access_token) {
        throw new Error("Token 回傳格式不正確");
      }

      cachedToken = data.access_token;
      // 提早 3 分鐘過期，防止時間差造成的無效 Token
      const expiresIn = data.expires_in ?? 3600;
      tokenExpiry = Date.now() + Math.max(60, expiresIn - 180) * 1000;

      return cachedToken;
    } finally {
      // 無論成功或失敗，釋放 lock，讓下次呼叫能重新嘗試
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}
