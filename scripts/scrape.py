#!/usr/bin/env python3
"""
台灣演唱會資訊爬蟲
來源：KKTIX、拓元售票 (Tixcraft)、ibon 售票、年代售票 (TICKET.COM.TW)
輸出：concerts.json
"""

import json
import re
import sys
import time
import ssl
from datetime import datetime, timezone, timedelta
from html import unescape
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from urllib.parse import urlencode, urljoin, quote
from html.parser import HTMLParser

try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False

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
    "Accept": "application/json, text/html, */*",
}

# ── 場館對應表 ──────────────────────────────────────────────────────────────
VENUE_MAP = {
    "台北大巨蛋": "taipei-dome",
    "臺北大巨蛋": "taipei-dome",
    "大巨蛋": "taipei-dome",
    "小巨蛋": "taipei-arena",
    "台北小巨蛋": "taipei-arena",
    "臺北小巨蛋": "taipei-arena",
    "南港展覽館": "nangang",
    "南港展覽": "nangang",
    "桃園國際棒球場": "taoyuan-arena",
    "桃園棒球場": "taoyuan-arena",
    "新竹棒球場": "hsinchu",
    "洲際棒球場": "taichung-dome",
    "台中洲際": "taichung-dome",
    "國家歌劇院": "taichung-venue",
    "歌劇院": "taichung-venue",
    "彰化縣立體育場": "changhua",
    "彰化體育場": "changhua",
    "台南市立棒球場": "tainan",
    "台南棒球場": "tainan",
    "高雄巨蛋": "kaohsiung-dome",
    "國立體育場": "kaohsiung-natl",
    "高雄國家體育場": "kaohsiung-natl",
    "高雄流行音樂中心": "kaohsiung-music-center",
    "臺北流行音樂中心": "taipei-music-center",
    "台北流行音樂中心": "taipei-music-center",
    "Zepp New Taipei": "zepp-new-taipei",
    "林口體育館": "linkou-arena",
    "天母體育館": "tianmu-arena",
    "Legacy Taipei": "legacy-taipei",
    "Legacy TERA": "taipei-music-center",  # Map to Taipei Music Center since it's located there
    "TICC": "ticc",
    "台北國際會議中心": "ticc",
    "臺北國際會議中心": "ticc",
    "MESSE TAOYUAN": "messe-taoyuan",
    "桃園陽光劇場": "taoyuan-sunlight-arena",
    "新北市工商展覽中心": "new-taipei-exhibition-hall",
    "花蓮縣立體育場": "hualien",
    "花蓮體育場": "hualien",
    "台東棒球場": "taitung",
    "The Wall Live House": "the-wall",
    "The Wall": "the-wall",
    "Legacy Taichung": "legacy-taichung",
    "後台 Backstage Live": "backstage-live",
    "後台": "backstage-live",
    "LIVE WAREHOUSE": "kaohsiung-music-center",  # Map to Kaohsiung Music Center
    "Live Warehouse": "kaohsiung-music-center",
    "SUB": "taipei-music-center",  # Map to Taipei Music Center (South Base)
    "天母棒球場": "tianmu",
    "新莊棒球場": "xinzhuang",
    "亞太國際棒球訓練中心成棒主球場": "asia-pacific-main",
    "亞太國際棒球訓練中心": "asia-pacific-main",
    "亞太棒球場": "asia-pacific-main",
    "亞太成棒主球場": "asia-pacific-main",
    "澄清湖棒球場": "chengcing-lake",
    "大巨蛋": "taipei-dome",
    "新莊": "xinzhuang",
    "天母": "tianmu",
    "洲際": "taichung-dome",
    "澄清湖": "chengcing-lake",
    "亞太主": "asia-pacific-main",
    "樂天桃園": "taoyuan-arena",
    "台東": "taitung",
    "花蓮": "hualien",
    "斗六棒球場": "douliou",
    "斗六": "douliou",
    "嘉義市棒球場": "chiayi",
    "嘉義市": "chiayi",
    "女巫店": "witch-house",
    "飄丿白鷺": "wild-egret",
    "漂丿白鷺": "wild-egret",
    "飄丿白鷺 Live House": "wild-egret",
    "漂丿白鷺 Live House": "wild-egret",
    "白鷺": "wild-egret",
    "TCRC Livehouse": "tcrc-livehouse",
    "TCRC": "tcrc-livehouse",
    "高雄 LIVE WAREHOUSE": "live-warehouse",
    "LIVE WAREHOUSE": "live-warehouse",
    "Live Warehouse": "live-warehouse",
}

VENUE_CITY = {
    "taipei-dome": "台北",
    "taipei-arena": "台北",
    "nangang": "台北",
    "taoyuan-arena": "桃園",
    "hsinchu": "新竹",
    "taichung-dome": "台中",
    "taichung-venue": "台中",
    "changhua": "彰化",
    "tainan": "台南",
    "kaohsiung-dome": "高雄",
    "kaohsiung-natl": "高雄",
    "kaohsiung-music-center": "高雄",
    "taipei-music-center": "台北",
    "zepp-new-taipei": "新北",
    "linkou-arena": "新北",
    "tianmu-arena": "台北",
    "legacy-taipei": "台北",
    "legacy-tera": "新北",
    "ticc": "台北",
    "messe-taoyuan": "桃園",
    "taoyuan-sunlight-arena": "桃園",
    "new-taipei-exhibition-hall": "新北",
    "hualien": "花蓮",
    "taitung": "台東",
    "the-wall": "台北",
    "legacy-taichung": "台中",
    "backstage-live": "高雄",
    "tianmu": "台北",
    "xinzhuang": "新北",
    "asia-pacific-main": "台南",
    "chengcing-lake": "高雄",
    "douliou": "雲林",
    "chiayi": "嘉義",
    "witch-house": "台北",
    "wild-egret": "台南",
    "tcrc-livehouse": "台南",
    "live-warehouse": "高雄",
}

# 售票網資訊
TICKET_PLATFORMS = {
    "kktix":    {"name": "KKTIX",    "color": "#e63946"},
    "tixcraft": {"name": "拓元售票",  "color": "#f4a261"},
    "ibon":     {"name": "ibon售票", "color": "#2ec4b6"},
    "kham":     {"name": "寬宏售票", "color": "#00b4d8"},
    "ticket":   {"name": "年代售票",  "color": "#9b5de5"},
    "ticketplus": {"name": "遠大售票", "color": "#00a6fb"},
    "indievox": {"name": "iNDIEVOX", "color": "#ff5a5f"},
    "manual": {"name": "手動補充", "color": "#06d6a0"},
    "cpbl": {"name": "中華職棒官方", "color": "#005a9c"},
}

PLATFORM_URLS = {
    "KKTIX": "https://kktix.com/",
    "拓元售票": "https://tixcraft.com/",
    "ibon售票": "https://ticket.ibon.com.tw/",
    "寬宏售票": "https://kham.com.tw/",
    "年代售票": "https://www.ticket.com.tw/",
    "遠大售票": "https://ticketplus.com.tw/",
    "iNDIEVOX": "https://www.indievox.com/",
    "添翼售票": "https://teamear.tixcraft.com/",
}

KKTIX_ORGANIZER_URLS = [
    "https://globalmusic.kktix.cc/",
    "https://wve.kktix.cc/",
    "https://mediaspheretw.kktix.cc/",
    "https://jslive.kktix.cc/",
    "https://superdome.kktix.cc/",
    "https://kklivetw.kktix.cc/",
    "https://imetw.kktix.cc/",
    "https://farglorycreative.kktix.cc/",
    "https://livenationtw.kktix.cc/",
    "https://amusetaiwan.kktix.cc/",
    "https://legacy.kktix.cc/",
    "https://warnermusictw.kktix.cc/",
    "https://umusic.kktix.cc/",
    "https://sonymusictw.kktix.cc/",
    "https://acrmedia.kktix.cc/",
    "https://windmusic.kktix.cc/",
    "https://onion.kktix.cc/",
]

CONCERT_KEYWORDS = (
    "演唱會",
    "音樂會",
    "巡迴",
    "演出",
    "公演",
    "concert",
    "fan concert",
    "fan meeting",
    "live",
    "showcase",
    "tour",
    "world tour",
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANUAL_EVENTS_PATH = PROJECT_ROOT / "public" / "manual-events.json"


# Create a customized SSL context to bypass Cloudflare TLS fingerprinting blocks
chrome_ssl_context = ssl.create_default_context()
chrome_ssl_context.set_ciphers(
    'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:'
    'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:'
    'ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:'
    'DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384'
)

def fetch(url, as_json=False, headers=None):
    req_headers = headers if headers is not None else HEADERS
    if HAS_CURL_CFFI:
        try:
            res = cffi_requests.get(url, headers=req_headers, impersonate='safari15_5', timeout=15)
            if res.status_code == 200:
                return res.json() if as_json else res.text
            else:
                print(f"  ⚠ fetch error {url}: HTTP Error {res.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠ curl_cffi fetch error {url}: {e}", file=sys.stderr)

    req = Request(url, headers=req_headers)
    try:
        with urlopen(req, context=chrome_ssl_context, timeout=15) as r:
            raw = r.read().decode("utf-8", errors="replace")
            if as_json:
                return json.loads(raw)
            return raw
    except Exception as e:
        print(f"  ⚠ fetch error {url}: {e}", file=sys.stderr)
        return None


def match_venue(text):
    """Return (venue_id, venue_name) or (None, None)"""
    for keyword, vid in VENUE_MAP.items():
        if keyword in (text or ""):
            return vid, keyword
    return None, None


def today_str():
    # Use Taiwan timezone (UTC+8) to prevent timezone mismatch in GitHub Actions (UTC)
    tz_taiwan = timezone(timedelta(hours=8))
    return datetime.now(tz_taiwan).strftime("%Y-%m-%d")


# ── KKTIX ──────────────────────────────────────────────────────────────────

def scrape_kktix():
    """Scrape KKTIX events via their internal JSON API."""
    events = []
    seen_ids = set()

    api_base = "https://kktix.com/events.json"
    params_list = [
        {"category": "music", "page": 1},
        {"category": "music", "page": 2},
        {"category": "music", "page": 3},
    ]

    for params in params_list:
        url = api_base + "?" + urlencode(params)
        print(f"  Fetching {url}", file=sys.stderr)
        data = fetch(url, as_json=True)
        if not data:
            continue

        items = data if isinstance(data, list) else (data.get("entry", []) or data.get("events", []))
        print(f"  Got {len(items)} items", file=sys.stderr)

        for ev in items:
            ev_url = ev.get("url") or ev.get("link") or ""
            eid = str(ev.get("id", "")) or (ev_url.rstrip("/").split("/")[-1] if ev_url else "")
            if not eid:
                continue
            if eid in seen_ids:
                continue
            seen_ids.add(eid)

            name = ev.get("name", "") or ev.get("title", "")
            venue_raw = ev.get("location", "") or ev.get("venue", "") or ev.get("address", "")
            start_at = ev.get("start_at") or ev.get("starts_at") or ev.get("published", "")
            image = (ev.get("cover_image_url") or ev.get("image_url") or ev.get("logo_url") or "")
            slug = ev.get("slug") or ev.get("url_name") or eid
            if not ev_url:
                ev_url = f"https://kktix.com/events/{slug}"
            price = ev.get("price_description") or ev.get("price") or ""

            content = ev.get("content", "")
            if not venue_raw and content:
                v_match = re.search(r'地點[：:\s]*([^/\n<]+)', content)
                if v_match:
                    venue_raw = v_match.group(1).strip()

            date_str = ""
            if not start_at and content:
                d_match = re.search(r'時間[：:\s]*(\d{4}[/-]\d{1,2}[/-]\d{1,2})', content)
                if d_match:
                    start_at = d_match.group(1)

            if start_at:
                try:
                    dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                    date_str = dt.strftime("%Y-%m-%d")
                except Exception:
                    date_str = str(start_at)[:10].replace("/", "-")

            if date_str and date_str < today_str():
                continue

            venue_id, venue_name = match_venue(name + " " + venue_raw)

            events.append({
                "id":         f"kktix-{eid}",
                "source":     "KKTIX",
                "name":       name,
                "venue_raw":  venue_raw,
                "venue_id":   venue_id,
                "venue_name": venue_name,
                "city":       VENUE_CITY.get(venue_id, ""),
                "date":       date_str,
                "image":      image,
                "url":        ev_url,
                "price":      str(price),
                "ticket_links": [
                    {"platform": "kktix", "name": "KKTIX", "url": ev_url}
                ],
            })

        time.sleep(0.5)

    return events


def scrape_kktix_html_fallback():
    """HTML fallback: parse KKTIX event listing pages."""
    events = []
    seen = set()

    pages = [
        "https://kktix.com/events?category=music",
        "https://kktix.com/events?category=music&page=2",
    ]

    for page_url in pages:
        html = fetch(page_url)
        if not html:
            continue

        ld_matches = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL
        )
        for ld_raw in ld_matches:
            try:
                ld = json.loads(ld_raw)
                items = ld if isinstance(ld, list) else [ld]
                for item in items:
                    if item.get("@type") not in ("Event", "MusicEvent"):
                        continue
                    uid = item.get("url", "") or item.get("name", "")
                    if uid in seen:
                        continue
                    seen.add(uid)

                    name      = item.get("name", "")
                    venue_obj = item.get("location", {}) or {}
                    venue_raw = venue_obj.get("name", "") if isinstance(venue_obj, dict) else str(venue_obj)
                    start_at  = item.get("startDate", "")
                    image_obj = item.get("image")
                    image     = (image_obj if isinstance(image_obj, str)
                                 else (image_obj[0] if isinstance(image_obj, list) else ""))
                    ev_url    = item.get("url", "")
                    offers    = item.get("offers", {})
                    price     = offers.get("price", "") if isinstance(offers, dict) else ""

                    date_str = str(start_at)[:10] if start_at else ""
                    if date_str and date_str < today_str():
                        continue

                    venue_id, venue_name = match_venue(name + " " + venue_raw)

                    events.append({
                        "id":         f"kktix-ld-{hash(uid) & 0xFFFFFF}",
                        "source":     "KKTIX",
                        "name":       name,
                        "venue_raw":  venue_raw,
                        "venue_id":   venue_id,
                        "venue_name": venue_name,
                        "city":       VENUE_CITY.get(venue_id, ""),
                        "date":       date_str,
                        "image":      image,
                        "url":        ev_url,
                        "price":      str(price),
                        "ticket_links": [
                            {"platform": "kktix", "name": "KKTIX", "url": ev_url}
                        ],
                    })
            except Exception as e:
                print(f"  LD+JSON parse error: {e}", file=sys.stderr)

        time.sleep(0.8)

    return events


def scrape_kktix_organizers():
    """Scrape public KKTIX organizer pages when the global event API is blocked."""
    events = []
    seen = set()

    for org_url in KKTIX_ORGANIZER_URLS:
        print(f"  Fetching KKTIX organizer {org_url}", file=sys.stderr)
        html = fetch(org_url)
        if not html:
            continue

        for item in _parse_kktix_organizer_events(html, org_url):
            url = item["url"]
            if url in seen:
                continue
            seen.add(url)

            name = item["name"]
            description = item["description"]
            if not is_concert_like(name + " " + description):
                continue

            dates = parse_all_dates(item["date"])
            if not dates:
                continue

            venue_id, venue_name = match_venue(name + " " + description)
            venue_raw = description[:120]
            skip_event = False

            if not venue_id:
                print(f"    Fetching KKTIX event detail for venue: {url}", file=sys.stderr)
                detail_html = fetch(url)
                if detail_html:
                    ld_matches = re.findall(
                        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                        detail_html, re.DOTALL
                    )
                    for ld_raw in ld_matches:
                        try:
                            ld = json.loads(ld_raw)
                            items = ld if isinstance(ld, list) else [ld]
                            for ld_item in items:
                                if ld_item.get("@type") in ("Event", "MusicEvent"):
                                    loc = ld_item.get("location", {})
                                    if isinstance(loc, dict):
                                        loc_name = loc.get("name", "")
                                        loc_addr = loc.get("address", "")
                                        if loc_name and "請依活動頁面為主" in loc_name:
                                            skip_event = True
                                            break
                                        if loc_name:
                                            v_id, v_name = match_venue(loc_name + " " + loc_addr)
                                            if v_id:
                                                venue_id, venue_name = v_id, v_name
                                                venue_raw = loc_name
                                                break
                                            else:
                                                venue_raw = loc_name
                            if skip_event or venue_id:
                                break
                        except Exception as e:
                            print(f"      Detail JSON-LD parse error: {e}", file=sys.stderr)
                time.sleep(0.3)

            if skip_event:
                print(f"    Skipping parent/placeholder event: {name}", file=sys.stderr)
                continue

            slug = re.sub(r"[^A-Za-z0-9_-]+", "-", url.rstrip("/").split("/")[-1]) or str(len(events))

            for d in dates:
                if d < today_str():
                    continue
                events.append({
                    "id":         f"kktix-org-{slug}-{d}",
                    "source":     "KKTIX",
                    "name":       name,
                    "venue_raw":  venue_raw,
                    "venue_id":   venue_id,
                    "venue_name": venue_name,
                    "city":       VENUE_CITY.get(venue_id, ""),
                    "date":       d,
                    "image":      item["image"],
                    "url":        url,
                    "price":      "",
                    "ticket_links": [
                        {"platform": "kktix", "name": "KKTIX", "url": url}
                    ],
                })

        time.sleep(0.5)

    return events


def _parse_kktix_organizer_events(html, base_url):
    """Return current event items from a KKTIX organizer listing page."""
    items_by_url = {}

    for block in re.findall(r'<li class="clearfix">(.*?)</li>', html, re.DOTALL):
        title_match = re.search(r'<h2>\s*<a href="([^"]+)">(.*?)</a>\s*</h2>', block, re.DOTALL)
        if not title_match:
            continue

        url = urljoin(base_url, title_match.group(1))
        name = clean_text(title_match.group(2))
        date_match = re.search(r'<span class="timezoneSuffix">(.*?)</span>', block, re.DOTALL)
        image_match = re.search(r'<img src="([^"]+)"', block, re.DOTALL)
        description_match = re.search(r'<div class="description">(.*?)</div>', block, re.DOTALL)

        items_by_url[url] = {
            "name": name,
            "url": url,
            "date": clean_text(date_match.group(1) if date_match else ""),
            "image": image_match.group(1) if image_match else "",
            "description": clean_text(description_match.group(1) if description_match else ""),
        }

    match = re.search(r"gon\.recent_events=(\[.*?\]);gon\.locale", html, re.DOTALL)
    if match:
        try:
            for event in json.loads(match.group(1)):
                url = urljoin(base_url, event.get("url", ""))
                if not url:
                    continue

                existing = items_by_url.get(url, {})
                items_by_url[url] = {
                    "name": clean_text(event.get("title") or existing.get("name", "")),
                    "url": url,
                    "date": str(event.get("start") or existing.get("date", "")),
                    "image": existing.get("image", ""),
                    "description": existing.get("description", ""),
                }
        except Exception as e:
            print(f"  KKTIX organizer JSON parse error: {e}", file=sys.stderr)

    return list(items_by_url.values())


def is_concert_like(text):
    haystack = (text or "").lower()
    return any(keyword.lower() in haystack for keyword in CONCERT_KEYWORDS)


# ── 拓元售票 Tixcraft ───────────────────────────────────────────────────────

def scrape_tixcraft(base_url="https://tixcraft.com"):
    """Scrape Tixcraft (拓元) music/concert events from public /activity catalog."""
    events = []
    seen = set()

    url = f"{base_url}/activity"
    print(f"  Fetching {url}", file=sys.stderr)
    html = fetch(url)
    if not html:
        return events

    parts = re.split(r'class=["\']eventbl', html)
    blocks = parts[1:]
    print(f"  Found {len(blocks)} blocks in {base_url}", file=sys.stderr)

    for b in blocks:
        # Image
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', b)
        image = img_match.group(1) if img_match else ""
        
        # Detail URL and Title
        title_match = re.search(r'<div class="text-bold[^>]*>\s*<a href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)</a>', b)
        if not title_match:
            continue
            
        detail_path = title_match.group(1)
        name = unescape(re.sub(r'<[^>]*>', '', title_match.group(2)).strip())
        
        # Date
        date_match = re.search(r'class=["\']text-small date["\'][^>]*>([\s\S]*?)</div>', b)
        date_raw = unescape(re.sub(r'<[^>]*>', '', date_match.group(1)).strip()) if date_match else ""
        dates = parse_all_dates(date_raw)
        
        # Venue
        venue_match = re.search(r'class=["\']text-small text-med-light["\'][^>]*>([\s\S]*?)</div>', b)
        venue_raw = unescape(re.sub(r'<[^>]*>', '', venue_match.group(1)).strip()) if venue_match else ""
        
        ev_url = base_url + detail_path
        if ev_url in seen:
            continue
        seen.add(ev_url)
        
        venue_id, venue_name = match_venue(name + " " + venue_raw)
        slug = detail_path.split('/')[-1]
        
        for d in dates:
            if d and d < today_str():
                continue
                
            events.append({
                "id":         f"tixcraft-{slug}-{d}",
                "source":     "拓元售票",
                "name":       name,
                "venue_raw":  venue_raw,
                "venue_id":   venue_id,
                "venue_name": venue_name,
                "city":       VENUE_CITY.get(venue_id, ""),
                "date":       d,
                "image":      image,
                "url":        ev_url,
                "price":      "",
                "ticket_links": [
                    {"platform": "tixcraft", "name": "拓元售票", "url": ev_url}
                ],
            })
        
    return events


def _parse_ld_event(item, platform, events_list):
    """Parse a JSON-LD Event item and append to events_list."""
    name = item.get("name", "")
    venue_obj = item.get("location", {}) or {}
    venue_raw = venue_obj.get("name", "") if isinstance(venue_obj, dict) else str(venue_obj)
    start_at  = item.get("startDate", "")
    image_obj = item.get("image")
    image     = (image_obj if isinstance(image_obj, str)
                 else (image_obj[0] if isinstance(image_obj, list) else ""))
    ev_url    = item.get("url", "")
    offers    = item.get("offers", {})
    price     = offers.get("price", "") if isinstance(offers, dict) else ""

    date_str = str(start_at)[:10] if start_at else ""
    if date_str and date_str < today_str():
        return

    venue_id, venue_name = match_venue(name + " " + venue_raw)
    platform_info = TICKET_PLATFORMS.get(platform, {"name": platform})

    events_list.append({
        "id":         f"{platform}-ld-{abs(hash(ev_url or name)) & 0xFFFFFF}",
        "source":     platform_info["name"],
        "name":       name,
        "venue_raw":  venue_raw,
        "venue_id":   venue_id,
        "venue_name": venue_name,
        "city":       VENUE_CITY.get(venue_id, ""),
        "date":       date_str,
        "image":      image,
        "url":        ev_url,
        "price":      str(price),
        "ticket_links": [
            {"platform": platform, "name": platform_info["name"], "url": ev_url}
        ],
    })


# ── ibon 售票 ───────────────────────────────────────────────────────────────

def scrape_ibon():
    """Scrape ibon 售票 concert events via direct REST API."""
    events = []
    seen = set()
    if not HAS_CURL_CFFI:
        print("  ⚠ curl_cffi 不可用，跳過 ibon API 爬取", file=sys.stderr)
        return events

    try:
        patterns = ["Concert", "Pop", "Music"]
        for pat in patterns:
            res = cffi_requests.post(
                'https://ticket.ibon.com.tw/api/ActivityInfo/GetIndexData',
                data={'pattern': pat},
                impersonate='safari15_5',
                timeout=15
            )
            if res.status_code != 200:
                continue
            
            data = res.json()
            items = data.get('Item', {}).get('List', [])
            for item in items:
                aid = item.get('ActivityID')
                aname = item.get('ActivityName')
                if not aid or not aname:
                    continue
                
                # Check for concert keywords
                if not any(k in aname.lower() for k in ["演唱會", "巡迴", "音樂會", "live", "concert", "show", "fan"]):
                    continue

                # Detail page URL
                ev_url = f"https://ticket.ibon.com.tw/ActivityInfo/Details/{aid}"

                # Fetch detail for image & price
                img_url = ""
                price_str = ""
                try:
                    dres = cffi_requests.post(
                        'https://ticket.ibon.com.tw/api/ActivityInfo/GetDetailData',
                        data={'id': str(aid)},
                        impersonate='safari15_5',
                        timeout=10
                    )
                    if dres.status_code == 200:
                        ditem = dres.json().get('Item', {})
                        img_url = ditem.get('ActivityImageURL', "")
                        price_str = ditem.get('ActivityLowPriceDes', "") or ditem.get('ActivityPrice', "")
                except Exception:
                    pass

                # Fetch sessions/games for exact venue and dates
                try:
                    gres = cffi_requests.post(
                        'https://ticket.ibon.com.tw/api/ActivityInfo/GetGameInfoList',
                        json={'id': aid, 'hasDeadline': True, 'SystemBrowseType': 1},
                        impersonate='safari15_5',
                        timeout=10
                    )
                    if gres.status_code == 200:
                        gitems = gres.json().get('Item', {}).get('GIHtmls', [])
                        for g in gitems:
                            venue_raw = g.get('VenueRegion', '')
                            vid, vname = match_venue(venue_raw or aname)
                            if not vid:
                                vid, vname = match_venue(aname)

                            date_match = re.search(r'(\d{4})[/\.-](\d{1,2})[/\.-](\d{1,2})', g.get('ShowSaleDate', ''))
                            if not date_match:
                                continue
                            date_str = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"
                            if date_str < today_str():
                                continue

                            unique_key = f"ibon-{aid}-{date_str}"
                            if unique_key in seen:
                                continue
                            seen.add(unique_key)

                            eid = abs(hash(ev_url + date_str)) & 0xFFFFFF
                            events.append({
                                "id":         f"ibon-{eid}",
                                "source":     "ibon售票",
                                "name":       aname,
                                "venue_raw":  venue_raw or (vname or "全台場館"),
                                "venue_id":   vid or "unknown",
                                "venue_name": vname or venue_raw or "全台場館",
                                "city":       VENUE_CITY.get(vid, ""),
                                "date":       date_str,
                                "image":      img_url,
                                "url":        ev_url,
                                "price":      price_str,
                                "ticket_links": [
                                    {"platform": "ibon", "name": "ibon售票", "url": ev_url}
                                ],
                            })
                except Exception:
                    pass

    except Exception as e:
        print(f"  ⚠ scrape_ibon error: {e}", file=sys.stderr)

    return events


# ── 寬宏售票 kham.com.tw ───────────────────────────────────────────────────

def scrape_kham():
    """Scrape 寬宏售票 (kham.com.tw) concert events."""
    events = []
    seen = set()
    if not HAS_CURL_CFFI:
        print("  ⚠ curl_cffi 不可用，跳過寬宏售票爬取", file=sys.stderr)
        return events

    category_urls = [
        "https://kham.com.tw/application/UTK01/UTK0101_06.aspx?TYPE=1&CATEGORY=98",  # 演唱會
        "https://kham.com.tw/application/UTK01/UTK0101_06.aspx?TYPE=1&CATEGORY=80",  # 音樂會
        "https://kham.com.tw/",
    ]

    detail_links = set()
    for cat_url in category_urls:
        try:
            r = cffi_requests.get(cat_url, impersonate='chrome', timeout=10)
            if r.status_code == 200:
                found = re.findall(r'UTK0201[^\x22\x27\s<>]+', r.text)
                for f in found:
                    clean_path = f.lstrip('./').lstrip('../')
                    detail_links.add('https://kham.com.tw/application/UTK02/' + clean_path)
        except Exception as e:
            print(f"  ⚠ 抓取寬宏分類頁失敗 {cat_url}: {e}", file=sys.stderr)

    for ev_url in detail_links:
        try:
            dr = cffi_requests.get(ev_url, impersonate='chrome', timeout=10)
            if dr.status_code != 200:
                continue
            ht = dr.text

            # 抓取活動名稱
            titles = re.findall(r'class=[\x22\x27][^\x22\x27]*title[^\x22\x27]*[\x22\x27][^>]*>(.*?)</div>', ht, re.DOTALL | re.IGNORECASE)
            name = titles[0].strip() if titles else ""
            if not name:
                og_titles = re.findall(r'<meta property=[\x22\x27]og:title[\x22\x27] content=[\x22\x27](.*?)[\x22\x27]', ht)
                name = og_titles[0].strip() if og_titles else ""
            if not name or name in ("寬宏售票系統", "節目資訊"):
                continue

            # 抓取圖片
            imgs = re.findall(r'src=[\x22\x27]([^\x22\x27]*UTK2401[^\x22\x27]*)[\x22\x27]', ht)
            img_url = imgs[0] if imgs else ""

            # 場館匹配
            vid, vname = match_venue(name)
            if not vid:
                vid, vname = match_venue(ht)

            # 抓取真實演出日期 (優先從 meta description 抽取，避免抓到取票/退票/開賣日期)
            valid_dates = []
            meta_descs = re.findall(r'<meta\s+(?:name|property)=[\x22\x27](?:og:)?description[\x22\x27]\s+content=[\x22\x27](.*?)[\x22\x27]', ht, re.IGNORECASE)
            for desc in meta_descs:
                cn_matches = re.findall(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?', desc)
                for y, m, d in cn_matches:
                    formatted_d = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
                    if formatted_d >= today_str() and formatted_d not in valid_dates:
                        valid_dates.append(formatted_d)
                slash_matches = re.findall(r'\b(\d{4})[/\.-](\d{1,2})[/\.-](\d{1,2})\b', desc)
                for y, m, d in slash_matches:
                    formatted_d = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
                    if formatted_d >= today_str() and formatted_d not in valid_dates:
                        valid_dates.append(formatted_d)

            if not valid_dates:
                # 備用：逐行搜尋，排除取票/退票/開賣/客服等提示行
                ignore_kw = ["開賣", "售票時間", "取票", "寄送", "退票", "截止", "訂購", "客服", "條款"]
                for line in ht.splitlines():
                    if any(kw in line for kw in ignore_kw):
                        continue
                    cn_matches = re.findall(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?', line)
                    for y, m, d in cn_matches:
                        formatted_d = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
                        if formatted_d >= today_str() and formatted_d not in valid_dates:
                            valid_dates.append(formatted_d)
                    slash_matches = re.findall(r'\b(\d{4})[/\.-](\d{1,2})[/\.-](\d{1,2})\b', line)
                    for y, m, d in slash_matches:
                        formatted_d = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
                        if formatted_d >= today_str() and formatted_d not in valid_dates:
                            valid_dates.append(formatted_d)

            if not valid_dates:
                continue

            for d in valid_dates:
                unique_key = f"kham-{name}-{d}"
                if unique_key in seen:
                    continue
                seen.add(unique_key)

                eid = abs(hash(ev_url + d)) & 0xFFFFFF
                events.append({
                    "id":         f"kham-{eid}",
                    "source":     "寬宏售票",
                    "name":       name,
                    "venue_raw":  vname or "全台場館",
                    "venue_id":   vid or "unknown",
                    "venue_name": vname or "全台場館",
                    "city":       VENUE_CITY.get(vid, ""),
                    "date":       d,
                    "image":      img_url,
                    "url":        ev_url,
                    "price":      "",
                    "ticket_links": [
                        {"platform": "kham", "name": "寬宏售票", "url": ev_url}
                    ],
                })
        except Exception:
            pass

    return events


# ── 年代售票 ticket.com.tw ──────────────────────────────────────────────────

def scrape_ticket():
    """Scrape 年代售票 (ticket.com.tw) concert events."""
    events = []
    seen = set()

    pages = [
        "https://www.ticket.com.tw/activityList.aspx?k=%E6%BC%94%E5%94%B1%E6%9C%83",  # 演唱會
        "https://www.ticket.com.tw/activityList.aspx?k=%E9%9F%B3%E6%A8%82",           # 音樂
    ]

    for page_url in pages:
        print(f"  Fetching {page_url}", file=sys.stderr)
        html = fetch(page_url)
        if not html:
            continue

        # LD+JSON
        for ld_raw in re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL
        ):
            try:
                ld = json.loads(ld_raw)
                for item in (ld if isinstance(ld, list) else [ld]):
                    if item.get("@type") not in ("Event", "MusicEvent"):
                        continue
                    uid = item.get("url", "") or item.get("name", "")
                    if uid in seen:
                        continue
                    seen.add(uid)
                    _parse_ld_event(item, "ticket", events)
            except Exception:
                pass

        # 活動連結
        links = re.findall(
            r'href=["\']([^"\']*activityDetails\.aspx\?[^"\']+)["\']', html
        )
        for link in links:
            ev_url = link if link.startswith("http") else "https://www.ticket.com.tw/" + link.lstrip("/")
            if ev_url in seen:
                continue
            seen.add(ev_url)

            detail = _generic_detail(ev_url, "ticket")
            if not detail or not detail.get("dates"):
                continue

            for d in detail["dates"]:
                if d < today_str():
                    continue
                eid = abs(hash(ev_url + d)) & 0xFFFFFF
                events.append({
                    "id":         f"ticket-{eid}",
                    "source":     "年代售票",
                    "name":       detail["name"],
                    "venue_raw":  detail["venue_raw"],
                    "venue_id":   detail["venue_id"],
                    "venue_name": detail["venue_name"],
                    "city":       VENUE_CITY.get(detail["venue_id"], ""),
                    "date":       d,
                    "image":      detail["image"],
                    "url":        ev_url,
                    "price":      detail["price"],
                    "ticket_links": [
                        {"platform": "ticket", "name": "年代售票", "url": ev_url}
                    ],
                })
            time.sleep(0.4)

        time.sleep(0.8)

    return events


def _generic_detail(url, platform):
    """Generic event detail scraper using og-tags + heuristics."""
    html = fetch(url)
    if not html:
        return None

    name = ""
    m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html)
    if m:
        name = m.group(1).strip()
    if not name:
        m = re.search(r'<title>([^<|]+)', html)
        if m:
            name = m.group(1).strip()

    image = ""
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
    if m:
        image = m.group(1)

    dates = []
    # Try to find a date range in the HTML: YYYY/MM/DD ~ YYYY/MM/DD or YYYY/MM/DD ~ MM/DD
    range_match = re.search(
        r'(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})',
        html
    )
    if range_match:
        g = range_match.groups()
        y1, m1, d1 = int(g[0]), int(g[1]), int(g[2])
        y2 = int(g[3]) if g[3] else y1
        m2, d2 = int(g[4]), int(g[5])
        try:
            start_dt = datetime(y1, m1, d1)
            end_dt = datetime(y2, m2, d2)
            from datetime import timedelta
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # If no range found, fall back to matching discrete dates using parse_all_dates on cleaned HTML
    if not dates:
        # Strip HTML tags and URLs to avoid false positives inside tags/attributes
        clean_html = re.sub(r'<[^>]+>', ' ', html)
        clean_html = re.sub(r'https?://[^\s]+', ' ', clean_html)
        dates = parse_all_dates(clean_html)

    venue_raw = ""
    m = re.search(r'(?:場地|地點|演出地點|venue)[：:\s]+([^\n<]{2,50})', html)
    if m:
        venue_raw = m.group(1).strip()

    price = ""
    m = re.search(r'(?:票價|售票|price)[：:\s]+([^\n<]{2,40})', html)
    if m:
        price = m.group(1).strip()

    venue_id, venue_name = match_venue(name + " " + venue_raw)

    return {
        "name": name, "dates": dates,
        "venue_raw": venue_raw, "venue_id": venue_id, "venue_name": venue_name,
        "image": image, "price": price,
    }


# ── 公開行事曆 fallback ─────────────────────────────────────────────────────

def clean_text(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_first_date(text):
    """Extract the first YYYY/MM/DD-ish date and normalize to YYYY-MM-DD."""
    if not text:
        return ""

    m = re.search(r"(20\d{2})[/-](\d{1,2})(?:[/-](\d{1,2}))?", text)
    if m:
        year, month, day = m.group(1), int(m.group(2)), int(m.group(3) or 1)
        return f"{year}-{month:02d}-{day:02d}"

    m = re.search(r"(\d{1,2})/(\d{1,2})", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        return f"{datetime.now(timezone.utc).year}-{month:02d}-{day:02d}"

    return ""


def parse_all_dates(text):
    """
    Extract all YYYY-MM-DD format dates from a text string, including date ranges
    like YYYY/MM/DD ~ YYYY/MM/DD or YYYY/MM/DD - MM/DD, or YYYY年MM月DD日.
    """
    if not text:
        return []

    # Clean the text a bit (remove week labels like (五), (六), （四）)
    text = re.sub(r'[\(\uff08][^\)\uff09]+[\)\uff09]', ' ', text)
    text = text.replace('年', '/').replace('月', '/').replace('日', ' ')
    
    from datetime import datetime, timedelta
    
    dates_set = set()
    
    # 1. Determine base year (look for any YYYY in the text)
    year_match = re.search(r'\b(20\d{2})\b', text)
    if year_match:
        base_year = int(year_match.group(1))
    else:
        base_year = datetime.now(timezone.utc).year

    # 2. Extract ranges
    # Range pattern 1: YYYY/MM/DD ~ YYYY/MM/DD
    for m in re.finditer(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text):
        try:
            start_dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            end_dt = datetime(int(m.group(4)), int(m.group(5)), int(m.group(6)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates_set.add(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # Range pattern 2: YYYY/MM/DD ~ MM/DD (same year)
    for m in re.finditer(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})[./-](\d{1,2})", text):
        try:
            year = int(m.group(1))
            start_dt = datetime(year, int(m.group(2)), int(m.group(3)))
            end_dt = datetime(year, int(m.group(4)), int(m.group(5)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates_set.add(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # Range pattern 4: YYYY/MM/DD ~ DD (same month)
    for m in re.finditer(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})(?!\d|[./])", text):
        try:
            year = int(m.group(1))
            month = int(m.group(2))
            start_day = int(m.group(3))
            end_day = int(m.group(4))
            start_dt = datetime(year, month, start_day)
            end_dt = datetime(year, month, end_day)
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates_set.add(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # Range pattern 3: MM/DD ~ MM/DD (implicit year)
    for m in re.finditer(r"(?<!\d)(\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})[./-](\d{1,2})(?!\d)", text):
        try:
            start_dt = datetime(base_year, int(m.group(1)), int(m.group(2)))
            end_dt = datetime(base_year, int(m.group(3)), int(m.group(4)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates_set.add(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # Range pattern 5: MM/DD ~ DD (same month, implicit year)
    for m in re.finditer(r"(?<!\d)(\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})(?!\d|[./])", text):
        try:
            month = int(m.group(1))
            start_day = int(m.group(2))
            end_day = int(m.group(3))
            start_dt = datetime(base_year, month, start_day)
            end_dt = datetime(base_year, month, end_day)
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                curr = start_dt
                while curr <= end_dt:
                    dates_set.add(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
        except Exception:
            pass

    # 3. Extract discrete full dates YYYY/MM/DD
    full_dates = re.findall(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text)
    first_full_month = None
    if full_dates:
        try:
            first_full_month = int(full_dates[0][1])
        except Exception:
            pass

    for y, m_str, d_str in full_dates:
        try:
            dt = datetime(int(y), int(m_str), int(d_str))
            dates_set.add(dt.strftime("%Y-%m-%d"))
        except Exception:
            pass

    # 4. Extract discrete short dates MM/DD
    short_dates = re.findall(r"(?<!\d)(\d{1,2})[./-](\d{1,2})(?!\d)", text)
    for m_str, d_str in short_dates:
        try:
            m = int(m_str)
            d = int(d_str)
            # Cross-year heuristic: if first full date month is 12 and this short date month is 1, it's next year
            yr = base_year
            if first_full_month == 12 and m == 1:
                yr = base_year + 1
            elif first_full_month == 1 and m == 12:
                yr = base_year - 1
            dt = datetime(yr, m, d)
            dates_set.add(dt.strftime("%Y-%m-%d"))
        except Exception:
            pass

    if dates_set:
        return sorted(list(dates_set))
        
    first = parse_first_date(text)
    return [first] if first else []


def detect_platform(text):
    for name in PLATFORM_URLS:
        if name in text:
            return name
    return "售票資訊"





def parse_indievox_cards(html, base_url):
    """Parse card structures directly from list or AJAX pages."""
    cards = []
    matches = list(re.finditer(r'href=["\']([^"\']*/activity/detail/([26_ivA-Za-z0-9_-]+))["\']', html))
    for match in matches:
        url = urljoin(base_url, match.group(1))
        act_id = match.group(2)
        
        # Look ahead in the HTML for the next 600 chars to find details
        chunk = html[match.end():match.end()+600]
        
        # Date
        date_match = re.search(r'<div class="date">([\s\S]*?)</div>', chunk)
        date_str = ""
        if date_match:
            ymd_match = re.search(r'\b\d{4}/\d{2}/\d{2}\b', date_match.group(1))
            if ymd_match:
                date_str = ymd_match.group(0).replace("/", "-")
                
        # Title
        title_match = re.search(r'<div class="multi_ellipsis">([\s\S]*?)</div>', chunk)
        title_str = ""
        if title_match:
            title_str = re.sub(r'<[^>]+>', ' ', title_match.group(1))
            title_str = ' '.join(title_str.split()).strip()
            
        # Image (use non-greedy matching to catch real src before onerror fallback)
        img_match = re.search(r'<img\s+[^>]*?src=["\'](https?://[^"\']+)["\']', chunk)
        if not img_match:
            img_match = re.search(r'<img\s+[^>]*?src=["\']([^"\']+)["\']', chunk)
        image = img_match.group(1) if img_match else ""
        if image and "no-image" in image:
            image = ""
        elif image and image.startswith("/"):
            image = urljoin(base_url, image)
            
        cards.append({
            "id": act_id,
            "url": url,
            "date": date_str,
            "title": title_str,
            "image": image
        })
    return cards


def scrape_indievox():
    """Scrape iNDIEVOX concert events."""
    events = []
    seen_urls = set()
    cards = []

    list_url = "https://www.indievox.com/activity/list"
    print("  Fetching iNDIEVOX activity list...", file=sys.stderr)
    html_content = fetch(list_url)
    if html_content:
        for card in parse_indievox_cards(html_content, list_url):
            if card["url"] not in seen_urls:
                seen_urls.add(card["url"])
                cards.append(card)

    # Fetch subsequent pages via AJAX
    tz_taiwan = timezone(timedelta(hours=8))
    today_slash = datetime.now(tz_taiwan).strftime("%Y/%m/%d")
    offset = 1
    consecutive_empty = 0
    while True:
        ajax_url = f"https://www.indievox.com/activity/get-more-game-list?type=card&offset={offset}&startDate={quote(today_slash)}&endDate="
        print(f"  Fetching iNDIEVOX activity list (AJAX offset {offset})...", file=sys.stderr)
        ajax_headers = HEADERS.copy()
        ajax_headers["X-Requested-With"] = "XMLHttpRequest"
        ajax_html = fetch(ajax_url, headers=ajax_headers)
        if not ajax_html:
            break
        page_cards = parse_indievox_cards(ajax_html, list_url)
        if not page_cards:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                break
        else:
            consecutive_empty = 0
            for card in page_cards:
                if card["url"] not in seen_urls:
                    seen_urls.add(card["url"])
                    cards.append(card)
        
        offset += 1
        time.sleep(0.3)
        if offset > 100:  # Safety limit
            break

    print(f"  Found {len(cards)} total unique iNDIEVOX activities. Fetching details...", file=sys.stderr)
    
    for card in cards:
        activity_url = card["url"]
        activity_id = card["id"]
        name = card["title"]
        image = card["image"]
        card_date = card["date"]
        
        game_url = f"https://www.indievox.com/activity/game/{activity_id}"
        game_html = fetch(game_url)
        
        sessions = []
        if game_html:
            # Extract sessions from the table
            rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', game_html)
            for row in rows:
                tds = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row)
                if len(tds) < 3:
                    continue
                
                date_raw = clean_text(tds[0])
                venue_raw = clean_text(tds[2])
                
                date_str = parse_first_date(date_raw)
                if not date_str:
                    continue
                if date_str < today_str():
                    continue
                sessions.append((date_str, venue_raw))

        # If no sessions are found on game page, fall back to card's date and find venue on the detail page
        if not sessions:
            if not card_date or card_date < today_str():
                continue
            
            detail_html = fetch(activity_url)
            venue_id, venue_name = None, None
            venue_raw = ""
            if detail_html:
                clean_detail_text = re.sub(r'<[^>]+>', ' ', detail_html)
                venue_id, venue_name = match_venue(name + " " + clean_detail_text)
                if venue_id:
                    for keyword, vid in VENUE_MAP.items():
                        if vid == venue_id and keyword in detail_html:
                            venue_raw = keyword
                            break
            
            if not venue_id:
                venue_id, venue_name = match_venue(name)
                if venue_id:
                    venue_raw = venue_name
            
            events.append({
                "id": f"indievox-{activity_id}-{card_date}",
                "source": "iNDIEVOX",
                "name": name,
                "venue_raw": venue_raw or venue_name or "",
                "venue_id": venue_id,
                "venue_name": venue_name,
                "city": VENUE_CITY.get(venue_id, ""),
                "date": card_date,
                "image": image,
                "url": activity_url,
                "price": "",
                "ticket_links": [
                    {"platform": "indievox", "name": "iNDIEVOX", "url": activity_url}
                ]
            })
        else:
            for date_str, venue_raw in sessions:
                venue_id, venue_name = match_venue(name + " " + venue_raw)
                events.append({
                    "id": f"indievox-{activity_id}-{date_str}",
                    "source": "iNDIEVOX",
                    "name": name,
                    "venue_raw": venue_raw,
                    "venue_id": venue_id,
                    "venue_name": venue_name,
                    "city": VENUE_CITY.get(venue_id, ""),
                    "date": date_str,
                    "image": image,
                    "url": activity_url,
                    "price": "",
                    "ticket_links": [
                        {"platform": "indievox", "name": "iNDIEVOX", "url": activity_url}
                    ]
                })
            
        time.sleep(0.3)
        
    return events


def scrape_ticketplus():
    """Scrape Ticket Plus (遠大售票) events via their S3 config API."""
    events = []

    url = "https://apis.ticketplus.com.tw/config/api/v1/getS3?path=main/mainEvents.json"
    print("  Fetching TicketPlus mainEvents...", file=sys.stderr)
    main_res = fetch(url, as_json=True)
    if not main_res:
        print("  ⚠ Failed to fetch TicketPlus mainEvents", file=sys.stderr)
        return []

    info = main_res.get("allEventMainPageInfo", {})

    active_eids = []
    for eid, ev in info.items():
        if ev.get("hidden"):
            continue
        end_date = ev.get("end_date") or ev.get("start_date") or ""
        if end_date and end_date >= today_str():
            # Skip "Japan" tickets
            if "japan" in ev.get("title", "").lower():
                continue
            active_eids.append(eid)

    print(f"  Found {len(active_eids)} active TicketPlus events. Fetching details...", file=sys.stderr)

    from concurrent.futures import ThreadPoolExecutor

    def get_event_data(eid):
        # Fetch sessions
        sessions_url = f"https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/{eid}/sessions.json"
        sessions_res = fetch(sessions_url, as_json=True)
        if not sessions_res:
            return None

        # Fetch products for prices
        products_url = f"https://apis.ticketplus.com.tw/config/api/v1/getS3?path=event/{eid}/products.json"
        products_res = fetch(products_url, as_json=True)
        price_str = ""
        if products_res:
            try:
                prices = [p.get("price") for p in products_res.get("products", []) if p.get("price") is not None]
                if prices:
                    min_p, max_p = min(prices), max(prices)
                    price_str = str(min_p) if min_p == max_p else f"{min_p} - {max_p}"
            except Exception:
                pass

        return {
            "sessions": sessions_res.get("sessions", []),
            "price": price_str
        }

    results = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        for eid, res in zip(active_eids, executor.map(get_event_data, active_eids)):
            if res:
                results[eid] = res

    print(f"  Successfully fetched data for {len(results)} TicketPlus events", file=sys.stderr)

    for eid, res in results.items():
        main_ev = info.get(eid, {})
        title = main_ev.get("title", "").strip()
        image = main_ev.get("picBigHomeThumbnail") or main_ev.get("picBigBanner") or ""

        # In case image is relative (though it's usually absolute)
        if image and image.startswith("/"):
            image = "https://static.ticketplus.com.tw" + image

        ev_url = f"https://ticketplus.com.tw/activity/{eid}"
        price = res["price"]

        for s in res["sessions"]:
            if s.get("hidden"):
                continue

            s_name = s.get("name", "").strip()
            # If session name is empty, fall back to event title
            name = s_name if s_name else title

            s_date = s.get("date", "").strip()
            # s_date is typically like "2026-08-15 ~ 2026-08-15"
            date_str = ""
            if s_date:
                date_str = s_date.split(" ~ ")[0].strip()

            if not date_str or date_str < today_str():
                continue

            s_loc = s.get("location", "").strip()
            s_addr = s.get("address", "").strip()
            venue_raw = f"{s_loc} {s_addr}".strip()

            venue_id, venue_name = match_venue(name + " " + venue_raw)

            events.append({
                "id": f"ticketplus-{eid}-{s.get('sessionId', '')}",
                "source": "遠大售票",
                "name": name,
                "venue_raw": venue_raw,
                "venue_id": venue_id,
                "venue_name": venue_name,
                "city": VENUE_CITY.get(venue_id, ""),
                "date": date_str,
                "image": image,
                "url": ev_url,
                "price": price,
                "artist": "",
                "category": "sport" if any(x in name.lower() for x in ["中華職棒", "棒球", "cpbl", "籃球", "p. league", "t1 league"]) else "concert",
                "ticket_links": [
                    {"platform": "ticketplus", "name": "遠大售票", "url": ev_url}
                ]
            })

    return events


def load_manual_events():
    """Load manually curated events that can carry exact ticket URLs."""
    if not MANUAL_EVENTS_PATH.exists():
        return []

    try:
        data = json.loads(MANUAL_EVENTS_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  ⚠ manual-events.json parse error: {e}", file=sys.stderr)
        return []

    items = data.get("events", data if isinstance(data, list) else [])
    events = []

    for index, item in enumerate(items):
        name = str(item.get("name") or item.get("title") or "").strip()
        if not name:
            continue

        venue_raw = str(item.get("venue_raw") or item.get("venue_name") or item.get("venue") or "")
        venue_id = item.get("venue_id")
        venue_name = item.get("venue_name")
        if not venue_id:
            venue_id, venue_name = match_venue(name + " " + venue_raw)

        url = str(item.get("url") or "").strip()
        platform = str(item.get("source") or item.get("platform") or "手動補充")
        ticket_links = item.get("ticket_links") or []
        if url and not ticket_links:
            ticket_links = [{"platform": "manual", "name": platform, "url": url}]

        events.append({
            "id": str(item.get("id") or f"manual-{index}-{abs(hash(name)) & 0xFFFFFF}"),
            "source": platform,
            "name": name,
            "venue_raw": venue_raw,
            "venue_id": venue_id,
            "venue_name": venue_name,
            "city": item.get("city") or VENUE_CITY.get(venue_id, ""),
            "date": str(item.get("date") or ""),
            "image": str(item.get("image") or ""),
            "url": url or PLATFORM_URLS.get(platform, ""),
            "price": str(item.get("price") or ""),
            "ticket_links": ticket_links,
        })

    return events


# ── 跨平台合併：同名活動加上多平台售票連結 ────────────────────────────────────

def is_specific_url(url):
    if not url:
        return False
    url_lower = url.lower().strip().rstrip("/")
    generic_urls = [
        "https://tixcraft.com",
        "https://tixcraft.com/activity",
        "https://kktix.com",
        "https://kktix.com/events",
        "https://tickets.ibon.com.tw",
        "https://tickets.ibon.com.tw/activity",
        "https://www.ticket.com.tw",
        "https://ticketplus.com.tw",
        "https://www.indievox.com",
        "https://www.cpbl.com.tw",
        "https://www.cpbl.com.tw/schedule",
        "https://tix.ctbcsports.com/brothers/utk0101_",
        "https://ticket.ibon.com.tw/activityinfo/details/39428",
        "https://guardians.fami.life/utk0101_",
        "https://ticket.tsghawks.com",
        "https://tix.wdragons.com/utk0101_",
        "https://ticket.ibon.com.tw/activityinfo/details/39455"
    ]
    return not any(url_lower == g or url_lower == g + "/" for g in generic_urls)

def resolve_generic_urls(events):
    """
    Find all events that have a specific ticket platform URL (Tixcraft, KKTIX, ibon, ticketplus, indievox),
    and use them to resolve any generic ticket platform URLs using fuzzy matching on event names.
    """
    specific_urls = {} # platform -> {normalized name -> specific url}
    
    platforms = ["tixcraft", "kktix", "ibon", "ticketplus", "indievox", "ticket"]
    for p in platforms:
        specific_urls[p] = {}

    def get_platform_key(url):
        if not url:
            return None
        url_lower = url.lower()
        if "tixcraft.com" in url_lower: return "tixcraft"
        if "kktix.com" in url_lower or "kktix.cc" in url_lower: return "kktix"
        if "ibon.com.tw" in url_lower: return "ibon"
        if "ticketplus.com.tw" in url_lower: return "ticketplus"
        if "indievox.com" in url_lower: return "indievox"
        if "ticket.com.tw" in url_lower: return "ticket"
        return None

    def normalize(s):
        s = re.sub(r'[\s\-_【】「”（）()、，,!！]', '', s or '').lower()
        s = re.sub(r'(台北站|高雄站|台中站|加場|加開|演唱會|音樂會|巡迴|live|tour)', '', s)
        return s

    # 1. Collect all specific URLs
    for ev in events:
        if ev.get("source") == "中華職棒":
            continue
        url = ev.get("url")
        if url and is_specific_url(url):
            pkey = get_platform_key(url)
            if pkey:
                specific_urls[pkey][normalize(ev["name"])] = url
        
        if ev.get("ticket_links"):
            for lk in ev["ticket_links"]:
                lk_url = lk.get("url")
                if lk_url and is_specific_url(lk_url):
                    pkey = get_platform_key(lk_url)
                    if pkey:
                        specific_urls[pkey][normalize(ev["name"])] = lk_url

    # 2. Resolve generic URLs
    for ev in events:
        if ev.get("source") == "中華職棒":
            continue
        main_url = ev.get("url")
        if main_url and not is_specific_url(main_url):
            pkey = get_platform_key(main_url)
            if pkey and specific_urls[pkey]:
                norm_name = normalize(ev["name"])
                matched_url = None
                if norm_name in specific_urls[pkey]:
                    matched_url = specific_urls[pkey][norm_name]
                else:
                    for key, url in specific_urls[pkey].items():
                        if key in norm_name or norm_name in key or (len(key) > 4 and norm_name[:5] == key[:5]):
                            matched_url = url
                            break
                if matched_url:
                    ev["url"] = matched_url

        if ev.get("ticket_links"):
            for lk in ev["ticket_links"]:
                lk_url = lk.get("url")
                if lk_url and not is_specific_url(lk_url):
                    pkey = get_platform_key(lk_url)
                    if pkey and specific_urls[pkey]:
                        norm_name = normalize(ev["name"])
                        matched_url = None
                        if norm_name in specific_urls[pkey]:
                            matched_url = specific_urls[pkey][norm_name]
                        else:
                            for key, url in specific_urls[pkey].items():
                                if key in norm_name or norm_name in key or (len(key) > 4 and norm_name[:5] == key[:5]):
                                    matched_url = url
                                    break
                        if matched_url:
                            lk["url"] = matched_url

def merge_ticket_links(events):
    """
    If two events share a specific ticket URL and date, or share a very similar name and date,
    merge their ticket_links instead of listing duplicates, prioritizing official sources.
    """
    result = []
    name_date_index = {}  # (normalized_name, date) -> index
    url_date_index = {}   # (specific_url, date) -> index

    def normalize(s):
        s = re.sub(r'[\(\（【\[].*?[\)\］】\]]', '', s or '')
        s = re.sub(r'(?:登記抽選|會員優先購票|一般開賣|加場|VIP PASS|VIP Upgrade|升級VIP|加購福利|加購|售票網|場次)', '', s)
        return re.sub(r'[\s\-_【】「」（）()【】、，,!！]', '', s or '').lower()

    def get_specific_urls(ev):
        if ev.get("source") == "中華職棒":
            return []
        urls = []
        if ev.get("url") and is_specific_url(ev["url"]):
            urls.append(ev["url"].strip().rstrip("/"))
        for lk in ev.get("ticket_links", []):
            if lk.get("url") and is_specific_url(lk["url"]):
                urls.append(lk["url"].strip().rstrip("/"))
        return list(set(urls))

    for ev in events:
        matched_idx = None
        ev_urls = get_specific_urls(ev)
        
        # 1. Match by specific URL + date first
        for url in ev_urls:
            url_date_key = (url, ev["date"] or "")
            if url_date_key in url_date_index:
                matched_idx = url_date_index[url_date_key]
                break

        # 2. Match by name + date second
        name_key = (normalize(ev["name"]), ev["date"] or "")
        if matched_idx is None:
            if name_key in name_date_index:
                matched_idx = name_date_index[name_key]

        if matched_idx is not None:
            existing = result[matched_idx]
            
            # Merge ticket links
            for lk in ev.get("ticket_links", []):
                matched_lk = next((l for l in existing["ticket_links"] if l["platform"] == lk["platform"]), None)
                if matched_lk:
                    if not is_specific_url(matched_lk["url"]) and is_specific_url(lk["url"]):
                        matched_lk["url"] = lk["url"]
                else:
                    existing["ticket_links"].append(lk)

            # Determine prioritization (official sources override webbboxx/manual/fallback sources)
            is_existing_fallback = existing["source"] == "手動補充"
            is_new_official = ev["source"] in ["KKTIX", "拓元售票", "ibon售票", "年代售票", "iNDIEVOX", "中華職棒"]
            
            if is_existing_fallback and is_new_official:
                # Official source details take priority
                existing["name"] = ev["name"]
                existing["source"] = ev["source"]
                existing["url"] = ev["url"]
                existing["venue_raw"] = ev["venue_raw"]
                existing["venue_id"] = ev["venue_id"]
                existing["venue_name"] = ev["venue_name"]
                existing["city"] = ev["city"]
                existing["price"] = ev["price"]
                if ev.get("game_score"):
                    existing["game_score"] = ev["game_score"]
                if ev.get("category"):
                    existing["category"] = ev["category"]
                if ev["image"]:
                    existing["image"] = ev["image"]
            else:
                # If either is CPBL, ensure source is marked as 中華職棒 and category as sport
                if ev.get("source") == "中華職棒":
                    existing["source"] = "中華職棒"
                    existing["category"] = "sport"
                    if ev.get("game_score"):
                        existing["game_score"] = ev["game_score"]
                if not existing.get("category") and ev.get("category"):
                    existing["category"] = ev["category"]
                if not existing["image"] and ev["image"]:
                    existing["image"] = ev["image"]
                if not is_specific_url(existing["url"]) and is_specific_url(ev["url"]):
                    existing["url"] = ev["url"]

            # Re-index specific URLs for the merged item
            new_urls = get_specific_urls(existing)
            for url in new_urls:
                url_date_index[(url, existing["date"] or "")] = matched_idx
        else:
            idx = len(result)
            result.append(ev)
            name_date_index[name_key] = idx
            for url in ev_urls:
                url_date_index[(url, ev["date"] or "")] = idx

    resolve_generic_urls(result)
    return result



CPBL_PLAYER_CACHE = {
    "0000007782": "威戈神", "0000007789": "麥斯威尼", "0000002274": "黃子鵬", "0000001260": "郭俊麟",
    "0000006833": "陳宇宏", "0000007049": "林暉盛", "0000006848": "林詔恩", "0000007053": "艾速特",
    "0000007303": "黃子豪", "0000006237": "林子崴", "0000007778": "喬登", "0000005731": "布雷克",
    "0000007074": "曾家輝", "0000007290": "張宥謙", "0000005541": "郭郁政", "0000007228": "鈴木駿輔",
    "0000006295": "銳力獅", "0000007063": "周彥農", "0000006771": "陳正毅", "0000007804": "瑪帝斯",
    "0000004624": "陳克羿", "0000001603": "王維中", "0000005604": "勝騎士", "0000007299": "陳品宏",
    "0000007264": "魔神龍", "0000003608": "曾仁和", "0000005479": "江國豪", "0000007560": "菲力士",
    "0000001719": "胡智爲", "0000002679": "江承諺", "0000005572": "魏碩成", "0000007783": "阿部雄大",
    "0000000363": "陳仕朋", "0000006860": "劉家翔", "0000006749": "魔力藍", "0000007281": "游竣宥",
    "0000007787": "黎克", "0000007062": "威能帝", "0000006906": "艾菩樂", "0000007779": "蔣銲",
    "0000006739": "李東洺", "0000002345": "鄭浩均", "0000001412": "江少慶", "0000006507": "後勁",
    "0000007790": "魔爾曼", "0000000762": "伍鐸", "0000007570": "坎南", "0000007793": "榊原元稀",
    "0000006497": "鋼龍", "0000007597": "獅帝芬", "0000006006": "德保拉", "0000005151": "羅戈",
    "0000006555": "梅賽鍶", "0000000368": "游霆崴", "0000007276": "伍立辰"
}

def get_cpbl_player_name(acnt):
    if not acnt:
        return ""
    acnt_str = str(acnt).strip()
    if not acnt_str:
        return ""
    if acnt_str in CPBL_PLAYER_CACHE:
        return CPBL_PLAYER_CACHE[acnt_str]
    try:
        res = cffi_requests.get(f"https://www.cpbl.com.tw/team/person?acnt={acnt_str}", impersonate="safari15_5", timeout=5)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "html.parser")
            for el in soup.select("div, span, h1, h2, h3"):
                txt = el.get_text(strip=True)
                m = re.match(r"^([\u4e00-\u9fa5A-Za-z·\.\-\s]+)\s*\d+$", txt)
                if m:
                    name = m.group(1).strip()
                    if name and name not in ["CPBL", "U-Lions", "Guardians", "Monkeys", "Hawks", "Dragons", "Brothers"]:
                        CPBL_PLAYER_CACHE[acnt_str] = name
                        return name
    except Exception:
        pass
    return ""

def scrape_cpbl():
    """
    Scrape CPBL games schedule from cpbl.com.tw using cffi_requests Session with retries.
    """
    print("→ 爬取中華職棒 CPBL 賽程...", file=sys.stderr)
    events = []
    
    impersonate_targets = ["safari15_5", "chrome120", "chrome110"]
    max_retries = 3
    games = None

    for attempt in range(max_retries):
        target = impersonate_targets[attempt % len(impersonate_targets)]
        try:
            session = cffi_requests.Session()
            res = session.get("https://www.cpbl.com.tw/schedule", impersonate=target, timeout=20)
            if res.status_code != 200:
                print(f"  ⚠ 獲取 CPBL 賽程頁面 HTTP 狀態碼非 200 (嘗試 {attempt+1}/{max_retries}): {res.status_code}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
                continue
                
            tokens = re.findall(r"RequestVerificationToken:\s*'([^']+)'", res.text)
            if not tokens:
                print(f"  ⚠ 找不到 RequestVerificationToken (嘗試 {attempt+1}/{max_retries})", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
                continue
                
            token = tokens[0]
            current_year = datetime.now().year
            
            post_res = session.post(
                "https://www.cpbl.com.tw/schedule/getgamedatas",
                data={
                    "calendar": f"{current_year}/01/01",
                    "location": "",
                    "kindCode": "A"
                },
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "RequestVerificationToken": token
                },
                impersonate=target,
                timeout=20
            )
            
            if post_res.status_code != 200:
                print(f"  ⚠ CPBL 賽程 API HTTP 狀態碼 (嘗試 {attempt+1}/{max_retries}): {post_res.status_code}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
                continue
                
            resp_json = post_res.json()
            if not resp_json.get("Success"):
                print(f"  ⚠ CPBL 賽程 API 回傳 Success=False (嘗試 {attempt+1}/{max_retries})", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
                continue
                
            games = json.loads(resp_json["GameDatas"])
            if games:
                break
        except Exception as e:
            print(f"  ⚠ CPBL 賽程爬取連線異常 (嘗試 {attempt+1}/{max_retries}): {e}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
            
    if not games:
        print("  ⚠ CPBL 重試失敗，將回傳空列表並使用備份賽事快取", file=sys.stderr)
        return []
        
    try:
        
        # Map FieldAbbe to our venue IDs
        field_mapping = {
            "大巨蛋": "taipei-dome",
            "新莊": "xinzhuang",
            "天母": "tianmu",
            "洲際": "taichung-dome",
            "澄清湖": "chengcing-lake",
            "亞太主": "asia-pacific-main",
            "樂天桃園": "taoyuan-arena",
            "台東": "taitung",
            "花蓮": "hualien",
            "斗六": "douliou",
            "嘉義市": "chiayi"
        }
        
        for g in games:
            start_dt = g.get("GameDateTimeS")
            if not start_dt:
                continue
            date_str = start_dt[:10]
            
            # Extract Teams
            visiting = g.get("VisitingTeamName", "").strip()
            home = g.get("HomeTeamName", "").strip()
            if not visiting or not home:
                continue
            
            visiting = visiting.replace("\u200b", "").strip()
            home = home.replace("\u200b", "").strip()
            
            game_no = g.get("GameSno", "")
            
            name = f"中華職棒例行賽 G{game_no}：{visiting} vs {home}"
            
            field_abbe = g.get("FieldAbbe", "").strip()
            venue_id = field_mapping.get(field_abbe)
            if not venue_id:
                # Fallback to general matching
                venue_id, _ = match_venue(field_abbe)
            
            if not venue_id:
                continue
            
            venue_names = {
                "taipei-dome": "台北大巨蛋",
                "xinzhuang": "新莊棒球場",
                "tianmu": "天母棒球場",
                "taichung-dome": "台中洲際棒球場",
                "chengcing-lake": "澄清湖棒球場",
                "asia-pacific-main": "亞太國際棒球訓練中心成棒主球場",
                "taoyuan-arena": "桃園國際棒球場",
                "taitung": "台東棒球場",
                "hualien": "花蓮縣立體育場",
                "douliou": "斗六棒球場",
                "chiayi": "嘉義市棒球場"
            }
            venue_name = venue_names.get(venue_id, field_abbe + "棒球場")
            
            # Image
            logo_path = g.get("HomeClubSmallImgPath", "")
            if logo_path:
                image_url = urljoin("https://www.cpbl.com.tw", logo_path)
            else:
                image_url = ""

            # Determine game score and status
            visiting_score = g.get("VisitingScore")
            home_score = g.get("HomeScore")
            is_play_ball = g.get("IsPlayBall", "N")
            is_game_stop = g.get("IsGameStop", "0")
            win_acnt = g.get("WinningPitcherAcnt") or ""
            lose_acnt = g.get("LoserPitcherAcnt") or ""
            mvp_acnt = g.get("MvpAcnt") or ""
            win_pitcher = g.get("WinningPitcherName") or get_cpbl_player_name(win_acnt)
            lose_pitcher = g.get("LoserPitcherName") or get_cpbl_player_name(lose_acnt)
            mvp = g.get("MvpName") or get_cpbl_player_name(mvp_acnt)
            v_acnt = g.get("VisitingPitcherAcnt") or g.get("VisitingFirstMover") or ""
            h_acnt = g.get("HomePitcherAcnt") or g.get("HomeFirstMover") or ""
            v_pitcher = g.get("VisitingPitcherName") or ""
            h_pitcher = g.get("HomePitcherName") or ""

            if not v_pitcher and date_str >= today_str():
                v_pitcher = get_cpbl_player_name(v_acnt)
            if not h_pitcher and date_str >= today_str():
                h_pitcher = get_cpbl_player_name(h_acnt)

            game_during = g.get("GameDuringTime") or ""
            game_end = g.get("GameDateTimeE")

            if is_game_stop == "1":
                status = "postponed"
                status_text = "因雨延賽"
            elif is_play_ball == "Y":
                status = "live"
                status_text = "比賽中"
            elif win_pitcher != "" or mvp != "" or game_during != "" or game_end or (visiting_score is not None and home_score is not None and (visiting_score > 0 or home_score > 0)):
                status = "finished"
                status_text = "已完賽"
            else:
                status = "scheduled"
                status_text = "未開打"

            game_score = {
                "visiting_team": visiting,
                "home_team": home,
                "visiting_score": visiting_score if status in ["finished", "live"] and visiting_score is not None else "-",
                "home_score": home_score if status in ["finished", "live"] and home_score is not None else "-",
                "visiting_pitcher": v_pitcher,
                "home_pitcher": h_pitcher,
                "status": status,
                "status_text": status_text,
                "mvp": mvp,
                "winning_pitcher": win_pitcher,
                "losing_pitcher": lose_pitcher
            }
            
            # Dynamic ticketing URL based on home team
            team_tickets = {
                "中信兄弟": {
                    "name": "中信兄弟售票網",
                    "url": "https://tix.ctbcsports.com/BROTHERS/UTK0101_"
                },
                "樂天桃猿": {
                    "name": "樂天桃猿售票網",
                    "url": "https://ticket.ibon.com.tw/ActivityInfo/Details/39428"
                },
                "富邦悍將": {
                    "name": "富邦悍將售票網",
                    "url": "https://guardians.fami.life/UTK0101_"
                },
                "台鋼雄鷹": {
                    "name": "台鋼雄鷹售票網",
                    "url": "https://ticket.tsghawks.com/"
                },
                "味全龍": {
                    "name": "味全龍售票網",
                    "url": "https://tix.wdragons.com/UTK0101_"
                },
                "統一": {
                    "name": "統一獅售票網",
                    "url": "https://ticket.ibon.com.tw/ActivityInfo/Details/39697"
                }
            }
            
            ticket_links = []
            # Find ticket URL for home team
            home_ticket = None
            for team_keyword, info in team_tickets.items():
                if team_keyword in home:
                    home_ticket = info
                    break
            
            if home_ticket:
                ticket_links.append({
                    "platform": "cpbl",
                    "name": home_ticket["name"],
                    "url": home_ticket["url"]
                })
            
            # Add default CPBL official schedule page as fallback
            ticket_links.append({
                "platform": "manual",
                "name": "中華職棒官方賽程",
                "url": "https://www.cpbl.com.tw/schedule"
            })
                
            events.append({
                "id": f"cpbl-{current_year}-{game_no}",
                "source": "中華職棒",
                "name": name,
                "venue_raw": field_abbe,
                "venue_id": venue_id,
                "venue_name": venue_name,
                "city": VENUE_CITY.get(venue_id, ""),
                "date": date_str,
                "image": image_url,
                "url": "https://www.cpbl.com.tw/schedule",
                "price": "依官網/主隊公告為準",
                "category": "sport",
                "game_score": game_score,
                "ticket_links": ticket_links
            })
        print(f"  CPBL 賽程得到 {len(events)} 筆賽事 (含過去與即時比分)", file=sys.stderr)
        return events
    except Exception as e:
        print(f"  ⚠ 爬取 CPBL 賽程失敗: {e}", file=sys.stderr)
        return []


# ── 主程式 ─────────────────────────────────────────────────────────────────

def main():
    print("🎵 台灣演唱會爬蟲啟動", file=sys.stderr)

    # Read existing concerts.json if it exists
    existing_events = []
    concerts_path = PROJECT_ROOT / "public" / "concerts.json"
    if concerts_path.exists():
        try:
            with open(concerts_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                if isinstance(old_data, dict) and isinstance(old_data.get("events"), list):
                    existing_events = old_data["events"]
        except Exception as e:
            print(f"  ⚠ 讀取現有 concerts.json 失敗: {e}", file=sys.stderr)

    all_events = []

    # 1. KKTIX
    print("→ 嘗試 KKTIX JSON API...", file=sys.stderr)
    events = scrape_kktix()
    print(f"  JSON API 得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        print("→ 改用 HTML fallback (LD+JSON)...", file=sys.stderr)
        events = scrape_kktix_html_fallback()
        print(f"  HTML fallback 得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        print("→ 改用 KKTIX 主辦單位公開頁 fallback...", file=sys.stderr)
        events = scrape_kktix_organizers()
        print(f"  KKTIX 主辦單位頁得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_kktix = [ev for ev in existing_events if ev.get("source") == "KKTIX" and ev.get("date", "") >= today_str()]
        if old_kktix:
            print(f"  ⚠ KKTIX 爬取為 0 筆，從舊檔案恢復 {len(old_kktix)} 筆未來活動", file=sys.stderr)
            events = old_kktix
    all_events.extend(events)

    # 2. 拓元售票 & 添翼售票
    print("→ 爬取拓元售票 Tixcraft...", file=sys.stderr)
    tixcraft_events = []
    try:
        tixcraft_events = scrape_tixcraft("https://tixcraft.com")
        print(f"  拓元得到 {len(tixcraft_events)} 筆", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠ 爬取拓元售票失敗: {e}", file=sys.stderr)

    if not tixcraft_events:
        old_tixcraft = [
            ev for ev in existing_events 
            if ev.get("source") == "拓元售票" 
            and "teamear.tixcraft.com" not in ev.get("url", "")
            and ev.get("date", "") >= today_str()
        ]
        if old_tixcraft:
            print(f"  ⚠ 拓元爬取為 0 筆，從舊檔案恢復 {len(old_tixcraft)} 筆未來活動", file=sys.stderr)
            tixcraft_events = old_tixcraft

    print("→ 爬取添翼售票 teamear.tixcraft...", file=sys.stderr)
    teamear_events = []
    try:
        teamear_events = scrape_tixcraft("https://teamear.tixcraft.com")
        print(f"  添翼得到 {len(teamear_events)} 筆", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠ 爬取添翼售票失敗: {e}", file=sys.stderr)

    if not teamear_events:
        old_teamear = [
            ev for ev in existing_events 
            if ev.get("source") == "拓元售票" 
            and "teamear.tixcraft.com" in ev.get("url", "")
            and ev.get("date", "") >= today_str()
        ]
        if old_teamear:
            print(f"  ⚠ 添翼爬取為 0 筆，從舊檔案恢復 {len(old_teamear)} 筆未來活動", file=sys.stderr)
            teamear_events = old_teamear

    all_events.extend(tixcraft_events)
    all_events.extend(teamear_events)

    # 3. ibon 售票
    print("→ 爬取 ibon 售票...", file=sys.stderr)
    events = scrape_ibon()
    print(f"  ibon 得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_ibon = [ev for ev in existing_events if ev.get("source") == "ibon售票" and ev.get("date", "") >= today_str()]
        if old_ibon:
            print(f"  ⚠ ibon 爬取為 0 筆，從舊檔案恢復 {len(old_ibon)} 筆未來活動", file=sys.stderr)
            events = old_ibon
    all_events.extend(events)

    # 4. 寬宏售票
    print("→ 爬取寬宏售票...", file=sys.stderr)
    events = scrape_kham()
    print(f"  寬宏售票得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_kham = [ev for ev in existing_events if ev.get("source") == "寬宏售票" and ev.get("date", "") >= today_str()]
        if old_kham:
            print(f"  ⚠ 寬宏爬取為 0 筆，從舊檔案恢復 {len(old_kham)} 筆未來活動", file=sys.stderr)
            events = old_kham
    all_events.extend(events)

    # 4. 年代售票
    print("→ 爬取年代售票...", file=sys.stderr)
    events = scrape_ticket()
    print(f"  年代得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_ticket = [ev for ev in existing_events if ev.get("source") == "年代售票" and ev.get("date", "") >= today_str()]
        if old_ticket:
            print(f"  ⚠ 年代爬取為 0 筆，從舊檔案恢復 {len(old_ticket)} 筆未來活動", file=sys.stderr)
            events = old_ticket
    all_events.extend(events)

    # 5. iNDIEVOX 售票
    print("→ 爬取 iNDIEVOX 售票...", file=sys.stderr)
    events = scrape_indievox()
    print(f"  iNDIEVOX 得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_indievox = [ev for ev in existing_events if ev.get("source") == "iNDIEVOX" and ev.get("date", "") >= today_str()]
        if old_indievox:
            print(f"  ⚠ iNDIEVOX 爬取為 0 筆，從舊檔案恢復 {len(old_indievox)} 筆未來活動", file=sys.stderr)
            events = old_indievox
    all_events.extend(events)

    # 6. 遠大售票
    print("→ 爬取遠大售票...", file=sys.stderr)
    try:
        events = scrape_ticketplus()
    except Exception as e:
        print(f"  ⚠ 爬取遠大售票失敗: {e}", file=sys.stderr)
        events = []
    print(f"  遠大得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_ticketplus = [ev for ev in existing_events if ev.get("source") == "遠大售票" and ev.get("date", "") >= today_str()]
        if old_ticketplus:
            print(f"  ⚠ 遠大爬取為 0 筆，從舊檔案恢復 {len(old_ticketplus)} 筆未來活動", file=sys.stderr)
            events = old_ticketplus
    all_events.extend(events)

    # 7. Manual exact links
    print("→ 合併手動補充活動...", file=sys.stderr)
    events = load_manual_events()
    print(f"  手動補充 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    try:
        cpbl_events = scrape_cpbl()
    except Exception as e:
        print(f"  ⚠ 爬取 CPBL 賽程失敗: {e}", file=sys.stderr)
        cpbl_events = []

    # Smart CPBL merge & preservation logic:
    # Build dictionary of existing CPBL games from concerts.json
    old_cpbl_dict = { ev["id"]: ev for ev in existing_events if ev.get("source") == "中華職棒" }
    
    if not cpbl_events:
        print(f"  ⚠ 中華職棒最新爬取為 0 筆，全數保留舊檔案中 {len(old_cpbl_dict)} 筆全季賽事資料", file=sys.stderr)
        cpbl_events = list(old_cpbl_dict.values())
    else:
        new_game_ids = set()
        for new_ev in cpbl_events:
            ev_id = new_ev["id"]
            new_game_ids.add(ev_id)
            old_ev = old_cpbl_dict.get(ev_id)
            if old_ev:
                # If new game score has missing pitcher names, preserve old pitcher names if available
                new_score = new_ev.get("game_score")
                old_score = old_ev.get("game_score")
                if new_score and old_score:
                    if not new_score.get("visiting_pitcher") and old_score.get("visiting_pitcher"):
                        new_score["visiting_pitcher"] = old_score["visiting_pitcher"]
                    if not new_score.get("home_pitcher") and old_score.get("home_pitcher"):
                        new_score["home_pitcher"] = old_score["home_pitcher"]
            old_cpbl_dict[ev_id] = new_ev
        
        cpbl_events = list(old_cpbl_dict.values())
        print(f"  ✅ 中華職棒賽程合併完成，共維持 {len(cpbl_events)} 筆賽事資料（最新更新 {len(new_game_ids)} 筆）", file=sys.stderr)

    all_events.extend(cpbl_events)

    # 過濾過期活動 (保留今日及未來的活動，並完整保留所有中華職棒歷史與未來賽事)
    all_events = [ev for ev in all_events if ev.get("date", "") >= today_str() or ev.get("source") == "中華職棒"]

    # 優先解析通用售票 URL 為特定活動 URL
    resolve_generic_urls(all_events)

    # 合併同一活動的多平台售票連結
    all_events = merge_ticket_links(all_events)

    # Sort by date
    all_events.sort(key=lambda x: x["date"] or "9999")

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(all_events),
        "sources": ["KKTIX", "拓元售票", "ibon售票", "年代售票", "iNDIEVOX", "遠大售票", "手動補充", "中華職棒"],
        "events": all_events,
    }

    # Write directly to public/concerts.json in UTF-8 to prevent shell encoding issues
    concerts_path = PROJECT_ROOT / "public" / "concerts.json"
    concerts_path.parent.mkdir(parents=True, exist_ok=True)
    with open(concerts_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\n✅ 共 {len(all_events)} 筆活動", file=sys.stderr)


if __name__ == "__main__":
    main()
