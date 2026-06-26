import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

// TDX API 金鑰透過 Firebase Secret Manager 安全儲存
const TDX_CLIENT_ID = defineSecret("TDX_CLIENT_ID");
const TDX_CLIENT_SECRET = defineSecret("TDX_CLIENT_SECRET");

const TDX_API_BASE = "https://tdx.transportdata.tw/api/basic";
const TDX_TOKEN_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";

// 記憶體內快取 Token（Function 實例存活期間有效）
let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * 取得 TDX OAuth Token，帶快取機制
 */
async function getTdxToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TDX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TDX Token 取得失敗 (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("TDX Token 回傳格式錯誤");
  }

  cachedToken = data.access_token;
  // 提早 2 分鐘過期，避免邊界情況
  tokenExpiry = Date.now() + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000;
  return cachedToken;
}

/**
 * TDX API 代理 Cloud Function
 *
 * 路由格式：/api/tdx/<path>
 * 例如：/api/tdx/v3/Rail/TRA/DailyTrainTimetable/OD/...
 *
 * 前端直接呼叫此 Function，後端再呼叫 TDX，避免 CORS 問題與金鑰外洩。
 */
export const tdxProxy = onRequest(
  {
    secrets: [TDX_CLIENT_ID, TDX_CLIENT_SECRET],
    cors: true,        // 允許前端跨域呼叫
    region: "asia-east1", // 台灣最近的區域
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    // 只允許 GET
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const clientId = TDX_CLIENT_ID.value();
      const clientSecret = TDX_CLIENT_SECRET.value();

      if (!clientId || !clientSecret) {
        res.status(503).json({ error: "TDX API 金鑰尚未設定" });
        return;
      }

      const token = await getTdxToken(clientId, clientSecret);

      // 從 URL 取出要代理的路徑
      // req.path 會是 /tdxProxy/<tdxPath> 在直接呼叫時
      // 透過 Hosting rewrite 後 path 為 /api/tdx/<tdxPath>
      // 取出 path 中 /api/tdx/ 之後的部分
      const rawPath = req.path.replace(/^\/+/, "");
      // rawPath 例：v2/Rail/THSR/Station 或 v3/Rail/TRA/Station
      const separator = rawPath.includes("?") || req.query ? "?" : "?";
      
      // 轉送 query string，但去掉前端傳來的 $format（我們自己加）
      const queryParams = new URLSearchParams();
      for (const [key, val] of Object.entries(req.query)) {
        if (key !== "$format") {
          queryParams.append(key, String(val));
        }
      }
      queryParams.set("$format", "JSON");

      const tdxUrl = `${TDX_API_BASE}/${rawPath}${separator}${queryParams.toString()}`;
      logger.info("TDX proxy →", tdxUrl);

      const tdxResponse = await fetch(tdxUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!tdxResponse.ok) {
        const errText = await tdxResponse.text();
        logger.warn("TDX API error", tdxResponse.status, errText.slice(0, 200));
        res.status(tdxResponse.status).json({
          error: `TDX API 查詢失敗 (${tdxResponse.status})`,
        });
        return;
      }

      const data = await tdxResponse.json();

      // 設定快取標頭（減少重複查詢）
      res.set("Cache-Control", "public, max-age=60, s-maxage=60");
      res.set("Content-Type", "application/json; charset=utf-8");
      res.status(200).json(data);
    } catch (err) {
      logger.error("TDX proxy error:", err);
      const message = err instanceof Error ? err.message : "未知錯誤";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * 停班停課資訊 Cloud Function
 * 抓取人事行政總處網站並解析為 JSON 回傳
 */
export const suspension = onRequest(
  {
    cors: true,
    region: "asia-east1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const response = await fetch("https://www.dgpa.gov.tw/typh/daily/nds.html");
      if (!response.ok) {
        throw new Error(`Failed to fetch DGPA page (${response.status})`);
      }
      const html = await response.text();

      // 提取更新時間
      const updateTimeMatch = html.match(/更新時間：\s*([\d\/\:\s]+)/);
      const updateTime = updateTimeMatch ? updateTimeMatch[1].trim() : "";

      // 提取表格列
      const rowRegex = /<tr[^>]*>\s*<td[^>]*headers=['"]?city_Name['"]?[^>]*>\s*<font[^>]*>([\s\S]*?)<\/font>\s*<\/td>\s*<td[^>]*headers=['"]?StopWorkSchool_Info['"]?[^>]*>\s*<font[^>]*>([\s\S]*?)<\/font>\s*<\/td>\s*<\/tr>/gi;

      let match;
      const items: { city: string; status: string }[] = [];
      while ((match = rowRegex.exec(html)) !== null) {
        const city = match[1].replace(/<[^>]+>/g, "").trim();
        const status = match[2].replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
        if (city && status) {
          items.push({ city, status });
        }
      }

      // 快取 5 分鐘
      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
      res.set("Content-Type", "application/json; charset=utf-8");
      res.status(200).json({ updateTime, items });
    } catch (err) {
      logger.error("Suspension fetch error:", err);
      const message = err instanceof Error ? err.message : "未知錯誤";
      res.status(500).json({ error: message });
    }
  }
);

