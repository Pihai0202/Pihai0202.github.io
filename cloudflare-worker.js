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

// ─── CPBL 即時比分快取 ────────────────────────────────────────────────────────
let cachedCpblResponse = null;
let cpblCacheExpiry = 0;

const CPBL_PLAYER_MAP = {
  "0000007782": "威戈神", "0000007789": "麥斯威尼", "0000002274": "黃子鵬", "0000001260": "郭俊麟",
  "0000006833": "陳宇宏", "0000007049": "林暉盛", "0000006848": "林詔恩", "0000007053": "艾士特",
  "0000007303": "黃子豪", "0000006237": "林子崴", "0000007778": "喬登", "0000005731": "布雷克",
  "0000007074": "曾家輝", "0000007290": "張宥謙", "0000005541": "郭郁政", "0000007228": "鈴木駿輔",
  "0000006295": "銳力獅", "0000007063": "周彥農", "0000006771": "陳正毅", "0000007804": "瑪帝斯",
  "0000004624": "陳克羿", "0000001603": "王維中", "0000005604": "勝騎士", "0000007299": "陳品宏",
  "0000007264": "魔神樂", "0000003608": "曾仁和", "0000005479": "江國豪", "0000007560": "菲力士",
  "0000001719": "胡智爲", "0000002679": "江承諺", "0000005572": "魏碩成", "0000007783": "阿部雄大",
  "0000000363": "陳仕朋", "0000006860": "劉家翔", "0000006749": "魔力藍", "0000007281": "游竣宥",
  "0000007787": "黎克", "0000007062": "威能帝", "0000006906": "艾璞樂", "0000007779": "蔣銲",
  "0000006739": "李東洺", "0000002345": "鄭浩均", "0000001412": "江少慶", "0000006507": "後勁",
  "0000007790": "魔爾曼", "0000000762": "伍鐸", "0000007570": "坎南", "0000007793": "榊原元稀",
  "0000006497": "鋼龍", "0000007597": "獅帝芬", "0000006006": "德保拉", "0000005151": "羅戈",
  "0000006555": "梅賽鍶", "0000000368": "游霆崴", "0000007276": "伍立辰", "0000006720": "邱駿威",
  "0000005912": "古林睿煬", "0000005741": "徐若熙", "0000005886": "陳韻文", "0000006078": "陳冠偉",
  "0000006322": "曾峻岳", "0000005872": "吳俊偉", "0000006013": "呂彥青", "0000005481": "陳柏豪",
  "0000006915": "哈瑪星", "0000007058": "猛登", "0000007055": "克迪", "0000007261": "銳歐",
  "0000007262": "富藍戈", "0000007559": "藍力", "0000007558": "杰戈", "0000007259": "魔鷹",
  "0000006845": "曾子祐", "0000005474": "王威晨", "0000005742": "江坤宇", "0000006016": "岳政華",
  "0000005486": "陳傑憲", "0000005749": "林安可", "0000005488": "蘇智傑", "0000006325": "吉力吉撈．鞏冠",
  "0000006082": "李凱威", "0000006084": "郭天信", "0000005869": "陳晨威", "0000005492": "林立",
  "0000006020": "張育成", "0000005477": "申皓瑋", "0000005484": "王正棠", "0000005482": "范國宸",
  "0000006018": "林凱威", "0000006834": "黃群", "0000006835": "王博玄", "0000006329": "杜家明"
};

function lookupCpblPlayer(name, acnt) {
  if (name && typeof name === "string" && name.trim()) {
    const clean = name.trim().replace(/\u200B/g, "");
    if (!/^\d+$/.test(clean) && clean !== "未登錄" && clean !== "待公告") {
      return clean;
    }
  }
  if (!acnt) return (typeof name === "string" ? name.trim() : "") || "";
  const str = String(acnt).trim();
  if (!str) return (typeof name === "string" ? name.trim() : "") || "";
  if (CPBL_PLAYER_MAP[str]) return CPBL_PLAYER_MAP[str];
  const padded = str.padStart(10, "0");
  if (CPBL_PLAYER_MAP[padded]) return CPBL_PLAYER_MAP[padded];
  const stripped = str.replace(/^0+/, "");
  if (CPBL_PLAYER_MAP[stripped]) return CPBL_PLAYER_MAP[stripped];
  return (typeof name === "string" ? name.trim() : "") || "";
}

async function handleCpblLiveScores() {
  const now = Date.now();
  if (cachedCpblResponse && now < cpblCacheExpiry) {
    return new Response(JSON.stringify(cachedCpblResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=20",
        ...corsHeaders,
      },
    });
  }

  try {
    const scheduleRes = await fetch("https://www.cpbl.com.tw/schedule", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await scheduleRes.text();
    const tokenMatch = html.match(/RequestVerificationToken:\s*'([^']+)'/);
    const token = tokenMatch ? tokenMatch[1] : "";

    const today = new Date();
    const twDate = new Date(today.getTime() + 8 * 3600 * 1000);
    const year = twDate.getUTCFullYear();
    const month = String(twDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(twDate.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}/${month}/${day}`;

    const setCookie = scheduleRes.headers.get("set-cookie") || "";
    const cookieHeader = setCookie.split(";")[0] || "";

    const formBody = new URLSearchParams({
      calendar: dateStr,
      location: "",
      kindCode: "A",
    });

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.cpbl.com.tw/schedule",
      "Origin": "https://www.cpbl.com.tw",
    };
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    if (token) headers["RequestVerificationToken"] = token;

    const postRes = await fetch("https://www.cpbl.com.tw/schedule/getgamedatas", {
      method: "POST",
      headers,
      body: formBody.toString(),
    });

    if (!postRes.ok) throw new Error(`CPBL API error: ${postRes.status}`);

    const data = await postRes.json();
    if (!data.Success) throw new Error("CPBL API returned Success=false");

    const games = JSON.parse(data.GameDatas || "[]");
    const parsedGames = games.map((g) => {
      const isPlayBall = g.IsPlayBall === "Y";
      const isGameStop = String(g.IsGameStop || "0") === "1";
      const winPitcher = lookupCpblPlayer(g.WinningPitcherName, g.WinningPitcherAcnt);
      const losePitcher = lookupCpblPlayer(g.LoserPitcherName, g.LoserPitcherAcnt);
      const closer = lookupCpblPlayer(g.CloserName, g.CloserAcnt);
      const mvp = lookupCpblPlayer(g.MvpName, g.MvpAcnt);
      const visitingPitcher = lookupCpblPlayer(g.VisitingPitcherName || g.VisitingFirstMover, g.VisitingPitcherAcnt);
      const homePitcher = lookupCpblPlayer(g.HomePitcherName || g.HomeFirstMover, g.HomePitcherAcnt);
      const gameEnd = String(g.GameDateTimeE || "").trim();
      const gameDuring = String(g.GameDuringTime || "").trim();

      let status = "scheduled";
      let statusText = "未開打";
      if (isGameStop) {
        status = "postponed";
        statusText = "延賽";
      } else if (gameEnd || gameDuring || (winPitcher && losePitcher)) {
        status = "finished";
        statusText = "已完賽";
      } else if (isPlayBall) {
        status = "live";
        statusText = "比賽中";
      } else if (winPitcher || mvp) {
        status = "finished";
        statusText = "已完賽";
      }

      return {
        game_no: String(g.GameSno || ""),
        date: (g.GameDateTimeS || "").substring(0, 10),
        visiting_team: (g.VisitingTeamName || "").replace(/\u200B/g, "").trim(),
        home_team: (g.HomeTeamName || "").replace(/\u200B/g, "").trim(),
        visiting_score: (status === "finished" || status === "live") ? (g.VisitingScore ?? "-") : "-",
        home_score: (status === "finished" || status === "live") ? (g.HomeScore ?? "-") : "-",
        visiting_pitcher: visitingPitcher,
        home_pitcher: homePitcher,
        winning_pitcher: winPitcher,
        losing_pitcher: losePitcher,
        closer: closer,
        mvp: mvp,
        status,
        status_text: statusText,
      };
    });

    const result = {
      updated_at: new Date().toISOString(),
      date: dateStr.replace(/\//g, "-"),
      games: parsedGames,
    };

    cachedCpblResponse = result;
    cpblCacheExpiry = Date.now() + 20 * 1000; // 20s cache

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=20",
        ...corsHeaders,
      },
    });
  } catch (err) {
    // 若直連 CPBL 失敗（例如防爬阻擋），從最新 GitHub Raw 快取回傳今日賽事最新狀態
    try {
      const fallbackRes = await fetch(`https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/concerts.json?t=${Date.now()}`, {
        headers: { "User-Agent": "Cloudflare-Worker", "Cache-Control": "no-cache" },
        cache: "no-store"
      });
      if (fallbackRes.ok) {
        const payload = await fallbackRes.json();
        const today = new Date();
        const twDate = new Date(today.getTime() + 8 * 3600 * 1000);
        const dateStr = twDate.toISOString().substring(0, 10);
        const todayCpbl = (payload.events || [])
          .filter((e) => e.source === "中華職棒" && (e.date === dateStr || !e.date) && e.game_score)
          .map((e) => ({
            game_no: String(e.id || "").replace(/[^0-9]/g, ""),
            date: e.date,
            visiting_team: e.game_score.visiting_team,
            home_team: e.game_score.home_team,
            visiting_score: e.game_score.visiting_score,
            home_score: e.game_score.home_score,
            visiting_pitcher: e.game_score.visiting_pitcher,
            home_pitcher: e.game_score.home_pitcher,
            winning_pitcher: e.game_score.winning_pitcher,
            losing_pitcher: e.game_score.losing_pitcher,
            closer: e.game_score.closer,
            mvp: e.game_score.mvp,
            status: e.game_score.status,
            status_text: e.game_score.status_text,
          }));

        return new Response(JSON.stringify({
          updated_at: new Date().toISOString(),
          date: dateStr,
          games: todayCpbl,
          fallback: true
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=15",
            ...corsHeaders,
          }
        });
      }
    } catch (_fallbackErr) {}

    return new Response(JSON.stringify({ error: err.message, games: [] }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }
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

    const url = new URL(request.url);

    // ── 支援 CPBL 即時比分端點 ───────────────────────────────────────────────
    if (url.pathname.startsWith("/api/cpbl") || url.pathname.startsWith("/cpbl")) {
      return await handleCpblLiveScores();
    }

    try {
      const { CLIENT_ID, TDX_CLIENT_ID, CLIENT_SECRET, TDX_CLIENT_SECRET } = env;
      // 同時支援兩種命名：CLIENT_ID 或 TDX_CLIENT_ID
      const clientId     = CLIENT_ID     ?? TDX_CLIENT_ID;
      const clientSecret = CLIENT_SECRET ?? TDX_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "請在 Worker 環境變數中設定 CLIENT_ID（或 TDX_CLIENT_ID）與 CLIENT_SECRET（或 TDX_CLIENT_SECRET）。" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // 解析請求路徑 → 建立 TDX 目標 URL
      let targetPath = url.pathname;
      if (targetPath.startsWith("/api/tdx")) targetPath = targetPath.substring(8);
      if (!targetPath.startsWith("/"))        targetPath = "/" + targetPath;

      const tdxUrl = new URL(`${TDX_API_BASE}${targetPath}`);
      // 只將 OData 參數（$ 開頭）轉發給 TDX，其餘參數（如 _t cache buster）只用於 KV 快取鍵，不轉發
      for (const [key, value] of url.searchParams) {
        if (key.startsWith("$") && key !== "$format") tdxUrl.searchParams.set(key, value);
      }
      tdxUrl.searchParams.set("$format", "JSON");

      // ── KV 快取讀取 ──────────────────────────────────────────────────────────
      // 使用完整原始 params（含 _t）作為快取鍵，讓前端可以透過改變 _t 的值繞過 KV 快取
      const kvKey = `tdx:${targetPath}:${url.searchParams.toString()}`.substring(0, 512);
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
        let finalTtl = kvTtl;
        const trimmed = responseText.trim();
        if (trimmed === "[]" || trimmed === "{}" || trimmed === '{"value":[]}' || trimmed === '{"value": []}') {
          finalTtl = 10; // 僅快取 10 秒，防止因查無資料或暫時性錯誤導致快取被污染一整小時
        }
        ctx.waitUntil(
          env.TDX_CACHE.put(kvKey, responseText, { expirationTtl: finalTtl }).catch(() => {})
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
