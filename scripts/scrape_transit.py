#!/usr/bin/env python3
"""
台灣大眾運輸即時營運狀態爬蟲
來源：台北捷運、高雄捷運、台中捷運、台灣高鐵、台灣鐵路
輸出：public/transit-status.json
"""

import json
import re
import ssl
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "public" / "transit-status.json"

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def fetch_html(url, timeout=12):
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ⚠ Fetch error {url}: {e}", file=sys.stderr)
        return None

# ── 1. 台北捷運 (TRTC) ────────────────────────────────────────────────────────
def scrape_trtc():
    # 台北捷運使用一個內嵌的 WebServiceStatus 頁面展示營運狀態燈號與文字
    url = "https://web.metro.taipei/pages2026/WebServiceStatus"
    print(f"→ Scrambling Taipei Metro (TRTC): {url}", file=sys.stderr)
    html = fetch_html(url)
    if not html:
        return None
    
    # 提取 <p class="realstatus__text">目前正常營運</p>
    match = re.search(r'class=["\']realstatus__text["\'][^>]*>([\s\S]*?)</p>', html, re.IGNORECASE)
    status_text = match.group(1).strip() if match else ""
    
    if not status_text:
        # Fallback search in entire page
        if "目前正常營運" in html or "正常營運" in html:
            status_text = "目前正常營運"
    
    if status_text:
        is_normal = "正常" in status_text
        return {
            "name": "台北捷運",
            "status": "🟢 營運正常" if is_normal else "🟡 營運調整中",
            "isNormal": is_normal,
            "detail": status_text if status_text else "全線正常營運。",
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
    return None

# ── 2. 高雄捷運 (KRTC) ────────────────────────────────────────────────────────
def scrape_krtc():
    # 高捷網頁首頁沒有即時燈號，但最新消息 (news) 與重要公告 (notice) 包含了重大營運調整（如颱風停駛、延誤等）
    url_news = "https://www.krtc.com.tw/Information/news"
    print(f"→ Scrambling Kaohsiung Metro (KRTC): {url_news}", file=sys.stderr)
    html = fetch_html(url_news)
    if not html:
        return None
    
    # 提取最新消息標題
    titles = re.findall(r'<h[34][^>]*>([\s\S]*?)</h[34]>', html, re.IGNORECASE)
    clean_titles = [re.sub(r'<[^>]*>', '', t).strip() for t in titles]
    
    # 檢查前 5 條最新消息是否包含關鍵字
    alert_keywords = ["停駛", "暫停營運", "營運中斷", "全線停駛", "延誤", "受阻"]
    active_alert = None
    for title in clean_titles[:5]:
        if any(kw in title for kw in alert_keywords):
            active_alert = title
            break
            
    is_normal = active_alert is None
    return {
        "name": "高雄捷運",
        "status": "🟢 營運正常" if is_normal else "🟡 營運調整中",
        "isNormal": is_normal,
        "detail": "目前全線營運正常。" if is_normal else active_alert,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

# ── 3. 台中捷運 (TMRT) ────────────────────────────────────────────────────────
def scrape_tmrt():
    url = "https://www.tmrt.com.tw/"
    print(f"→ Scrambling Taichung Metro (TMRT): {url}", file=sys.stderr)
    html = fetch_html(url)
    if not html:
        return None
    
    # 提取 ConfigValue":"全線正常營運（目前班距9分鐘）" 或是 "RunStatus"
    match = re.search(r'"RunStatus"\s*,\s*"ConfigValue"\s*:\s*"([^"]+)"', html)
    status_text = match.group(1).strip() if match else ""
    
    if not status_text:
        # Fallback to general search
        match_html = re.search(r'捷運營運狀態:\s*<!-- -->\s*([^<]+)', html)
        status_text = match_html.group(1).strip() if match_html else ""
        
    if not status_text:
        if "全線正常營運" in html or "正常營運" in html:
            status_text = "全線正常營運"
            
    if status_text:
        is_normal = "正常" in status_text or "良好" in status_text
        return {
            "name": "台中捷運",
            "status": "🟢 營運正常" if is_normal else "🟡 營運調整中",
            "isNormal": is_normal,
            "detail": status_text,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
    return None

# ── 4. 台灣高鐵 (THSR) ────────────────────────────────────────────────────────
def scrape_thsr():
    # 高鐵運行狀態在 iframe `/ArticleContent/f7f05113-cd27-4dd9-8edc-014f4e920212/index.html` 中
    url = "https://www.thsrc.com.tw/ArticleContent/f7f05113-cd27-4dd9-8edc-014f4e920212/index.html"
    print(f"→ Scrambling Taiwan High Speed Rail (THSR): {url}", file=sys.stderr)
    html = fetch_html(url)
    if not html:
        return None
    
    # 檢查是否含有 "全線正常營運" 或 "正常營運"
    is_normal = "全線正常營運" in html or "正常營運" in html or "營運正常" in html
    
    # 嘗試抓取特定狀態文字，如果有的話
    detail = "目前全線正常營運。"
    if not is_normal:
        # 搜尋一些異常相關的標示或文字
        detail = "偵測到班距調整或運行受阻，詳情請至高鐵官網查詢。"
        
    return {
        "name": "台灣高鐵",
        "status": "🟢 營運正常" if is_normal else "🟡 營運調整中",
        "isNormal": is_normal,
        "detail": detail,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

# ── 5. 台灣鐵路 (TRA) ─────────────────────────────────────────────────────────
def scrape_tra():
    # 臺鐵的運行阻礙公告頁
    url = "https://tip.railway.gov.tw/tra-tip-web/tip/tip007/tip711/blockList"
    print(f"→ Scrambling Taiwan Railway (TRA): {url}", file=sys.stderr)
    html = fetch_html(url)
    if not html:
        return None
    
    # 檢查是否含有 "全線正常運行"
    is_normal = "全線正常運行" in html or "正常營運" in html or "正常運行" in html
    
    detail = "目前各線列車正常運行。"
    if not is_normal:
        detail = "偵測到部分列車延誤或路線受阻，請點擊下方按鈕前往台鐵官網查看詳細通阻公告。"
        
    return {
        "name": "台灣鐵路",
        "status": "🟢 營運正常" if is_normal else "🟡 營運調整中",
        "isNormal": is_normal,
        "detail": detail,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

# ── 主程式 ─────────────────────────────────────────────────────────────────
def main():
    print("🚗 啟動大眾運輸即時狀態爬蟲", file=sys.stderr)
    
    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "statuses": {}
    }
    
    # Scrape each transit operator
    # Taipei Metro
    try:
        trtc = scrape_trtc()
        if trtc:
            output["statuses"]["trtc"] = trtc
    except Exception as e:
        print(f"  ⚠ Taipei Metro scrape failed: {e}", file=sys.stderr)
        
    # Kaohsiung Metro
    try:
        krtc = scrape_krtc()
        if krtc:
            output["statuses"]["krtc"] = krtc
    except Exception as e:
        print(f"  ⚠ Kaohsiung Metro scrape failed: {e}", file=sys.stderr)
        
    # Taichung Metro
    try:
        tmrt = scrape_tmrt()
        if tmrt:
            output["statuses"]["tmrt"] = tmrt
    except Exception as e:
        print(f"  ⚠ Taichung Metro scrape failed: {e}", file=sys.stderr)
        
    # Taiwan High Speed Rail
    try:
        thsr = scrape_thsr()
        if thsr:
            output["statuses"]["thsr"] = thsr
    except Exception as e:
        print(f"  ⚠ THSR scrape failed: {e}", file=sys.stderr)
        
    # Taiwan Railway
    try:
        tra = scrape_tra()
        if tra:
            output["statuses"]["tra"] = tra
    except Exception as e:
        print(f"  ⚠ Taiwan Railway scrape failed: {e}", file=sys.stderr)

    # If any transit has failed, insert precalculated default fallback
    fallbacks = {
        "trtc": {"name": "台北捷運", "status": "🟢 營運正常 (預估)", "isNormal": True, "detail": "全線正常營運。"},
        "krtc": {"name": "高雄捷運", "status": "🟢 營運正常 (預估)", "isNormal": True, "detail": "目前全線營運正常。"},
        "tmrt": {"name": "台中捷運", "status": "🟢 營運正常 (預估)", "isNormal": True, "detail": "全線正常營運。"},
        "thsr": {"name": "台灣高鐵", "status": "🟢 營運正常 (預估)", "isNormal": True, "detail": "目前全線正常營運。"},
        "tra": {"name": "台灣鐵路", "status": "🟢 營運正常 (預估)", "isNormal": True, "detail": "目前各線列車正常運行。"}
    }
    
    for key, val in fallbacks.items():
        if key not in output["statuses"]:
            val["updatedAt"] = datetime.now(timezone.utc).isoformat()
            output["statuses"][key] = val
            print(f"  ℹ Use fallback for {key}", file=sys.stderr)

    # Ensure output folder exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Save output
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        
    print(f"✅ 大眾運輸狀態更新完成，已儲存至 {OUTPUT_PATH}", file=sys.stderr)

if __name__ == "__main__":
    main()
