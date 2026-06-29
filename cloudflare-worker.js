/**
 * TDX API 代理服務 - Cloudflare Worker 版本
 *
 * 功能：
 * 1. 代理前端對 TDX API 的請求，解決 CORS 跨域問題並隱藏金鑰。
 * 2. Token 記憶體快取 + Singleton Lock：防止冷啟動時多個並行請求重複打 Token API。
 * 3. Cloudflare KV 回應快取：依照 API 類型設定不同快取時間，大幅減少對 TDX 的實際請求次數。
 *    - 車站清單：24 小時（幾乎不會變動）
 *    - 即時到站 / 公車 ETA：30 秒（即時資料）
 *    - 時刻表 / 公車路線：1 小時
 *    - 其他：5 分鐘
 * 4. Retry with Exponential Backoff：429 / 503 時自動等待後重試。
 *
 * 環境變數（Cloudflare Workers 控制台設定）：
 * - CLIENT_ID:     TDX Client ID
 * - CLIENT_SECRET: TDX Client Secret
 *
 * KV 綁定（Cloudflare Workers → Settings → Bindings）：
 * - Variable name: TDX_CACHE  →  綁定到你建立的 KV Namespace
 *   （若不設定，Worker 仍可正常運作，只是沒有 KV 快取）
 */

// ─── Token 快取（記憶體）────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;
let tokenFetchPromise = null; // Singleton lock，防止冷啟動時並行打 Token API

const TDX_TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const TDX_API_BASE  = "https://tdx.transportdata.tw/api/basic";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age":       "86400",
};

// ─── KV TTL 決策 ────────────────────────────────────────────────────────────────
/**
 * 根據 TDX API 路徑決定 KV 快取時間（秒）。
 * 回傳 0 表示不快取（對即時性要求極高的端點）。
 */
function getKvTtl(pathname) {
  // 車站清單：24 小時（極少變動）
  if (/\/Station\//.test(pathname))               return 86400;
  // 捷運即時到站：30 秒
  if (/\/LiveBoard\//.test(pathname))             return 30;
  // 公車即時 ETA：30 秒
  if (/EstimatedTimeOfArrival/.test(pathname))    return 30;
  // 高鐵每日時刻：1 小時
  if (/\/DailyTimetable\//.test(pathname))        return 3600;
  // 捷運時刻表：1 小時
  if (/\/StationTimeTable\//.test(pathname))      return 3600;
  // 公車路線站牌：1 小時
  if (/\/DisplayStopOfRoute\//.test(pathname))    return 3600;
  // 公車路線資訊：1 小時
  if (/\/Bus\/Route\//.test(pathname))            return 3600;
  // 預設：5 分鐘
  return 300;
}

// ─── 工具函式 ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch with Exponential Backoff（429 / 503 自動重試，最多 2 次） */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000; // 1s → 2s
        await sleep(waitMs);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  throw lastError ?? new Error("fetchWithRetry: 所有重試均失敗");
}

// ─── 主要 Handler ────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
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
      const { CLIENT_ID: clientId, CLIENT_SECRET: clientSecret } = env;
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "環境變數 CLIENT_ID 或 CLIENT_SECRET 尚未設定。" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // 解析請求路徑 → 建立 TDX 目標 URL
      const url = new URL(request.url);
      let targetPath = url.pathname;
      if (targetPath.startsWith("/api/tdx")) targetPath = targetPath.substring(8);
      if (!targetPath.startsWith("/"))        targetPath = "/" + targetPath;

      const tdxUrl = new URL(`${TDX_API_BASE}${targetPath}`);
      for (const [key, value] of url.searchParams) {
        if (key !== "cb" && key !== "$format") tdxUrl.searchParams.set(key, value);
      }
      tdxUrl.searchParams.set("$format", "JSON");

      // ── KV 快取讀取 ──────────────────────────────────────────────────────────
      const kvKey = `tdx:${targetPath}:${tdxUrl.searchParams.toString()}`.substring(0, 512);
      const kvTtl = getKvTtl(targetPath);

      if (env.TDX_CACHE && kvTtl > 0) {
        try {
          const cached = await env.TDX_CACHE.get(kvKey);
          if (cached) {
            return new Response(cached, {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "X-Cache": "HIT",   // 可在瀏覽器 DevTools 確認是否命中快取
                ...corsHeaders,
              },
            });
          }
        } catch (_kvErr) {
          // KV 讀取失敗不影響主流程，繼續向 TDX 請求
        }
      }

      // ── 取得 Token（帶 Singleton Lock）──────────────────────────────────────
      let token;
      try {
        token = await getTdxToken(clientId, clientSecret);
      } catch (tokenErr) {
        return new Response(
          JSON.stringify({ error: `取得 TDX 授權失敗: ${tokenErr.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // ── 呼叫 TDX API（帶自動重試）──────────────────────────────────────────
      const tdxResponse = await fetchWithRetry(tdxUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "Cloudflare-Worker-Proxy",
        },
      });

      if (!tdxResponse.ok) {
        const errText = await tdxResponse.text();
        const errorMsg = tdxResponse.status === 429
          ? "TDX API 請求過於頻繁（429），請稍待幾秒後再試"
          : `TDX API 查詢失敗 (${tdxResponse.status})`;
        return new Response(
          JSON.stringify({ error: errorMsg, detail: errText }),
          { status: tdxResponse.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const responseText = await tdxResponse.text();

      // ── KV 快取寫入（非同步，不阻塞回應）───────────────────────────────────
      if (env.TDX_CACHE && kvTtl > 0) {
        ctx.waitUntil(
          env.TDX_CACHE.put(kvKey, responseText, { expirationTtl: kvTtl }).catch(() => {})
        );
      }

      return new Response(responseText, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Cache": "MISS",
          "Cache-Control": `public, max-age=${Math.min(kvTtl, 60)}`,
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

// ─── Token 取得（Singleton Lock + 記憶體快取）──────────────────────────────────
async function getTdxToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;
  if (tokenFetchPromise) return tokenFetchPromise;

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
      if (!data.access_token) throw new Error("Token 回傳格式不正確");

      cachedToken = data.access_token;
      const expiresIn = data.expires_in ?? 3600;
      tokenExpiry = Date.now() + Math.max(60, expiresIn - 180) * 1000;
      return cachedToken;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}
