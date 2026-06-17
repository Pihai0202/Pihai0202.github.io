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
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from urllib.parse import urlencode, urljoin, quote
from html.parser import HTMLParser

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
}

# 售票網資訊
TICKET_PLATFORMS = {
    "kktix":    {"name": "KKTIX",    "color": "#e63946"},
    "tixcraft": {"name": "拓元售票",  "color": "#f4a261"},
    "ibon":     {"name": "ibon售票", "color": "#2ec4b6"},
    "ticket":   {"name": "年代售票",  "color": "#9b5de5"},
    "ticketplus": {"name": "TICKET PLUS", "color": "#00a6fb"},
    "webbboxx": {"name": "webbboxx 行事曆", "color": "#ffd166"},
    "indievox": {"name": "iNDIEVOX", "color": "#ff5a5f"},
    "manual": {"name": "手動補充", "color": "#06d6a0"},
    "cpbl": {"name": "中華職棒官方", "color": "#005a9c"},
}

PLATFORM_URLS = {
    "KKTIX": "https://kktix.com/",
    "拓元售票": "https://tixcraft.com/",
    "ibon售票": "https://tickets.ibon.com.tw/",
    "年代售票": "https://www.ticket.com.tw/",
    "TICKET PLUS": "https://ticketplus.com.tw/",
    "iNDIEVOX": "https://www.indievox.com/",
    "添翼售票": "https://www.indievox.com/",
}

KKTIX_ORGANIZER_URLS = [
    "https://globalmusic.kktix.cc/",
    "https://wve.kktix.cc/",
    "https://mediaspheretw.kktix.cc/",
    "https://jslive.kktix.cc/",
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

def fetch(url, as_json=False):
    req = Request(url, headers=HEADERS)
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
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


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

        items = data if isinstance(data, list) else data.get("events", [])
        print(f"  Got {len(items)} items", file=sys.stderr)

        for ev in items:
            eid = str(ev.get("id", ""))
            if eid in seen_ids:
                continue
            seen_ids.add(eid)

            name      = ev.get("name", "") or ev.get("title", "")
            venue_raw = ev.get("location", "") or ev.get("venue", "") or ev.get("address", "")
            start_at  = ev.get("start_at") or ev.get("starts_at") or ev.get("started_at", "")
            image     = (ev.get("cover_image_url") or ev.get("image_url") or
                         ev.get("logo_url") or "")
            slug      = ev.get("slug") or ev.get("url_name") or eid
            ev_url    = f"https://kktix.com/events/{slug}"
            price     = ev.get("price_description") or ev.get("price") or ""

            date_str = ""
            if start_at:
                try:
                    dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                    date_str = dt.strftime("%Y-%m-%d")
                except Exception:
                    date_str = str(start_at)[:10]

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
            slug = re.sub(r"[^A-Za-z0-9_-]+", "-", url.rstrip("/").split("/")[-1]) or str(len(events))

            for d in dates:
                if d < today_str():
                    continue
                events.append({
                    "id":         f"kktix-org-{slug}-{d}",
                    "source":     "KKTIX",
                    "name":       name,
                    "venue_raw":  description[:120],
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

def scrape_tixcraft():
    """Scrape Tixcraft (拓元) music/concert events from public /activity catalog."""
    events = []
    seen = set()

    url = "https://tixcraft.com/activity"
    print(f"  Fetching {url}", file=sys.stderr)
    html = fetch(url)
    if not html:
        return events

    parts = re.split(r'class=["\']eventbl', html)
    blocks = parts[1:]
    print(f"  Found {len(blocks)} blocks in Tixcraft", file=sys.stderr)

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
        
        ev_url = "https://tixcraft.com" + detail_path
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
    """Scrape ibon 售票 concert events."""
    events = []
    seen = set()

    # ibon 售票活動列表（演唱會分類）
    pages = [
        "https://tickets.ibon.com.tw/activity/category/concert",
        "https://tickets.ibon.com.tw/activity/category/pop",
    ]

    for page_url in pages:
        print(f"  Fetching {page_url}", file=sys.stderr)
        html = fetch(page_url)
        if not html:
            continue

        # 嘗試 LD+JSON
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
                    _parse_ld_event(item, "ibon", events)
            except Exception:
                pass

        # 卡片連結解析
        links = re.findall(r'href=["\']([^"\']+/activity/[A-Za-z0-9_-]+)["\']', html)
        for link in links:
            ev_url = link if link.startswith("http") else "https://tickets.ibon.com.tw" + link
            if ev_url in seen:
                continue
            seen.add(ev_url)

            detail = _generic_detail(ev_url, "ibon")
            if not detail or not detail.get("dates"):
                continue

            for d in detail["dates"]:
                if d < today_str():
                    continue
                eid = abs(hash(ev_url + d)) & 0xFFFFFF
                events.append({
                    "id":         f"ibon-{eid}",
                    "source":     "ibon售票",
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
                        {"platform": "ibon", "name": "ibon售票", "url": ev_url}
                    ],
                })
            time.sleep(0.4)

        time.sleep(0.8)

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

    # If no range found, fall back to matching discrete full dates (first 5 YYYY/MM/DD in the HTML)
    if not dates:
        full_dates = re.findall(r'(\d{4})[./-](\d{1,2})[./-](\d{1,2})', html)
        temp_set = set()
        for y, m_str, d_str in full_dates[:5]:
            try:
                dt = datetime(int(y), int(m_str), int(d_str))
                temp_set.add(dt.strftime("%Y-%m-%d"))
            except Exception:
                pass
        if temp_set:
            dates = sorted(list(temp_set))

    # Fallback to single date search
    if not dates:
        m = re.search(r'(\d{4})[./-](\d{1,2})[./-](\d{1,2})', html)
        if m:
            dates = [f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"]

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
    
    # Range pattern 1: YYYY/MM/DD ~ YYYY/MM/DD
    m = re.search(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text)
    if m:
        try:
            start_dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            end_dt = datetime(int(m.group(4)), int(m.group(5)), int(m.group(6)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                dates = []
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return dates
        except Exception:
            pass

    # Range pattern 2: YYYY/MM/DD ~ MM/DD (same year)
    m = re.search(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})[./-](\d{1,2})", text)
    if m:
        try:
            year = int(m.group(1))
            start_dt = datetime(year, int(m.group(2)), int(m.group(3)))
            end_dt = datetime(year, int(m.group(4)), int(m.group(5)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                dates = []
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return dates
        except Exception:
            pass

    # Range pattern 4: YYYY/MM/DD ~ DD (same month)
    m = re.search(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})(?!\d|[./])", text)
    if m:
        try:
            year = int(m.group(1))
            month = int(m.group(2))
            start_day = int(m.group(3))
            end_day = int(m.group(4))
            start_dt = datetime(year, month, start_day)
            end_dt = datetime(year, month, end_day)
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                dates = []
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return dates
        except Exception:
            pass

    # Range pattern 3: MM/DD ~ MM/DD (implicit current year)
    m = re.search(r"(?<!\d)(\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})[./-](\d{1,2})(?!\d)", text)
    if m:
        try:
            year = datetime.now(timezone.utc).year
            start_dt = datetime(year, int(m.group(1)), int(m.group(2)))
            end_dt = datetime(year, int(m.group(3)), int(m.group(4)))
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                dates = []
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return dates
        except Exception:
            pass

    # Range pattern 5: MM/DD ~ DD (same month, implicit current year)
    m = re.search(r"(?<!\d)(\d{1,2})[./-](\d{1,2})\s*(?:~|-|至|到)\s*(\d{1,2})(?!\d|[./])", text)
    if m:
        try:
            year = datetime.now(timezone.utc).year
            month = int(m.group(1))
            start_day = int(m.group(2))
            end_day = int(m.group(3))
            start_dt = datetime(year, month, start_day)
            end_dt = datetime(year, month, end_day)
            if start_dt <= end_dt and (end_dt - start_dt).days < 15:
                dates = []
                curr = start_dt
                while curr <= end_dt:
                    dates.append(curr.strftime("%Y-%m-%d"))
                    curr += timedelta(days=1)
                return dates
        except Exception:
            pass

    # 2. Extract discrete dates
    dates_set = set()
    # Match YYYY/MM/DD
    full_dates = re.findall(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})", text)
    for y, m_str, d_str in full_dates:
        try:
            dt = datetime(int(y), int(m_str), int(d_str))
            dates_set.add(dt.strftime("%Y-%m-%d"))
        except Exception:
            pass
            
    # Match MM/DD (fallback)
    if not dates_set:
        short_dates = re.findall(r"(?<!\d)(\d{1,2})[./-](\d{1,2})(?!\d)", text)
        year = datetime.now(timezone.utc).year
        for m_str, d_str in short_dates:
            try:
                dt = datetime(year, int(m_str), int(d_str))
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


def scrape_webbboxx_calendar():
    """Fallback source for a readable Taiwan concert calendar."""
    url = "https://webbboxx.com/calendar"
    html = fetch(url)
    if not html:
        return []

    blocks = re.split(r"<h3[^>]*>", html, flags=re.I)
    events = []

    for index, block in enumerate(blocks[1:], start=1):
        title_raw, _, rest = block.partition("</h3>")
        title = clean_text(title_raw)
        if not title:
            continue

        chunk = rest.split("<h3", 1)[0].split("<h2", 1)[0]
        text = clean_text(chunk)
        dates = parse_all_dates(text)
        if not dates:
            continue

        venue_id, venue_name = match_venue(title + " " + text)
        platform = detect_platform(text)
        platform_url = PLATFORM_URLS.get(platform, url)

        for d in dates:
            if d < today_str():
                continue
            events.append({
                "id": f"webbboxx-{abs(hash(title + d)) & 0xFFFFFF}",
                "source": "webbboxx 行事曆",
                "name": title,
                "venue_raw": text[:80],
                "venue_id": venue_id,
                "venue_name": venue_name,
                "city": VENUE_CITY.get(venue_id, ""),
                "date": d,
                "image": "",
                "url": platform_url,
                "price": "",
                "ticket_links": [
                    {"platform": "webbboxx", "name": "行事曆來源", "url": url},
                    {"platform": platform.lower().replace(" ", "-"), "name": platform, "url": platform_url},
                ],
            })

    return events


def scrape_indievox():
    """Scrape iNDIEVOX concert events."""
    events = []
    seen_urls = set()

    list_url = "https://www.indievox.com/activity/list"
    print("  Fetching iNDIEVOX activity list...", file=sys.stderr)
    html_content = fetch(list_url)
    if not html_content:
        return events

    # Get all event detail links or event IDs
    detail_links = re.findall(r'href=["\']([^"\']*/activity/detail/[26_ivA-Za-z0-9_-]+)["\']', html_content)
    unique_links = []
    for link in detail_links:
        full_url = urljoin(list_url, link)
        if full_url not in seen_urls:
            seen_urls.add(full_url)
            unique_links.append(full_url)

    print(f"  Found {len(unique_links)} iNDIEVOX activities. Fetching session details...", file=sys.stderr)
    
    for activity_url in unique_links:
        # Extract ID
        parts = activity_url.rstrip("/").split("/")
        if not parts:
            continue
        activity_id = parts[-1]
        
        game_url = f"https://www.indievox.com/activity/game/{activity_id}"
        game_html = fetch(game_url)
        if not game_html:
            continue
            
        # Extract name from title
        name_match = re.search(r'<h2 class="title activity-title">([\s\S]*?)</h2>', game_html)
        if not name_match:
            continue
        name = clean_text(name_match.group(1))
        
        # Extract image
        img_match = re.search(r'<div class="title-img">[\s\S]*?<img[^>]+src=["\']([^"\']+)["\']', game_html)
        image = img_match.group(1) if img_match else ""
        if not image:
            # Fallback image search
            img_match_fb = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', game_html)
            image = img_match_fb.group(1) if img_match_fb else ""

        # Extract sessions from the table
        rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', game_html)
        
        for row in rows:
            tds = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row)
            if len(tds) < 3:
                continue
            
            # First TD: Date & Time
            date_raw = clean_text(tds[0])
            # Third TD: Venue name
            venue_raw = clean_text(tds[2])
            
            # Format Date
            date_str = parse_first_date(date_raw)
            if not date_str:
                continue
            if date_str < today_str():
                continue
            
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
        "https://webbboxx.com",
        "https://webbboxx.com/calendar",
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
            is_existing_fallback = existing["source"] in ["webbboxx 行事曆", "手動補充"]
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
                if ev["image"]:
                    existing["image"] = ev["image"]
            else:
                # Otherwise, keep existing but prefer image or specific url if missing
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



def scrape_cpbl():
    """
    Scrape CPBL games schedule from cpbl.com.tw.
    """
    print("→ 爬取中華職棒 CPBL 賽程...", file=sys.stderr)
    events = []
    
    # 1. Fetch main page to get Verification Token and Cookies
    url = "https://www.cpbl.com.tw/schedule"
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=15) as response:
            html = response.read().decode('utf-8', errors='replace')
            cookie = response.info().get('Set-Cookie')
            
            # Find the anti-forgery token in the script
            tokens = re.findall(r"RequestVerificationToken:\s*'([^']+)'", html)
            if not tokens:
                print("  ⚠ 找不到 RequestVerificationToken，無法爬取 CPBL 賽程", file=sys.stderr)
                return []
            
            token = tokens[0]
    except Exception as e:
        print(f"  ⚠ 獲取 CPBL 賽程頁面失敗: {e}", file=sys.stderr)
        return []

    # 2. Make the POST request to getgamedatas
    current_year = datetime.now().year
    post_url = "https://www.cpbl.com.tw/schedule/getgamedatas"
    post_data = urlencode({
        "calendar": f"{current_year}/01/01",
        "location": "",
        "kindCode": "A"
    }).encode('utf-8')
    
    post_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "RequestVerificationToken": token
    }
    if cookie:
        c_vals = [c.split(';')[0] for c in cookie.split(',')]
        post_headers["Cookie"] = "; ".join(c_vals)
        
    post_req = Request(post_url, data=post_data, headers=post_headers)
    try:
        with urlopen(post_req, timeout=15) as post_resp:
            resp_str = post_resp.read().decode('utf-8', errors='replace')
            resp_json = json.loads(resp_str)
            if not resp_json.get("Success"):
                print("  ⚠ CPBL 賽程 API 回傳 Success=False", file=sys.stderr)
                return []
                
            games = json.loads(resp_json["GameDatas"])
            
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
                # Get Date and check if past
                # Format: "2026-03-28T17:06:00"
                start_dt = g.get("GameDateTimeS")
                if not start_dt:
                    continue
                date_str = start_dt[:10]
                if date_str < today_str():
                    continue
                
                # Extract Teams
                visiting = g.get("VisitingTeamName", "").strip()
                home = g.get("HomeTeamName", "").strip()
                if not visiting or not home:
                    continue
                
                visiting = visiting.replace("\u200b", "").strip()
                home = home.replace("\u200b", "").strip()
                
                game_no = g.get("GameSno", "")
                
                name = f"中華職棒例行賽：{visiting} vs {home}"
                
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
                        "url": "https://ticket.ibon.com.tw/ActivityInfo/Details/39455"
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
                    "ticket_links": ticket_links
                })
        print(f"  CPBL 賽程得到 {len(events)} 筆未來賽事", file=sys.stderr)
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

    # 2. 拓元售票
    print("→ 爬取拓元售票 Tixcraft...", file=sys.stderr)
    events = scrape_tixcraft()
    print(f"  拓元得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_tixcraft = [ev for ev in existing_events if ev.get("source") == "拓元售票" and ev.get("date", "") >= today_str()]
        if old_tixcraft:
            print(f"  ⚠ 拓元爬取為 0 筆，從舊檔案恢復 {len(old_tixcraft)} 筆未來活動", file=sys.stderr)
            events = old_tixcraft
    all_events.extend(events)

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

    # 6. Public calendar fallback
    print("→ 讀取公開演唱會行事曆 fallback...", file=sys.stderr)
    events = scrape_webbboxx_calendar()
    print(f"  行事曆得到 {len(events)} 筆", file=sys.stderr)
    if not events:
        old_cal = [ev for ev in existing_events if ev.get("source") == "webbboxx 行事曆" and ev.get("date", "") >= today_str()]
        if old_cal:
            print(f"  ⚠ 行事曆爬取為 0 筆，從舊檔案恢復 {len(old_cal)} 筆未來活動", file=sys.stderr)
            events = old_cal
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
    if not cpbl_events:
        old_cpbl = [ev for ev in existing_events if ev.get("source") == "中華職棒" and ev.get("date", "") >= today_str()]
        if old_cpbl:
            print(f"  ⚠ 中華職棒爬取為 0 筆，從舊檔案恢復 {len(old_cpbl)} 筆未來活動", file=sys.stderr)
            cpbl_events = old_cpbl
    all_events.extend(cpbl_events)

    # 優先解析通用售票 URL 為特定活動 URL
    resolve_generic_urls(all_events)

    # 合併同一活動的多平台售票連結
    all_events = merge_ticket_links(all_events)

    # Sort by date
    all_events.sort(key=lambda x: x["date"] or "9999")

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(all_events),
        "sources": ["KKTIX", "拓元售票", "ibon售票", "年代售票", "iNDIEVOX", "webbboxx 行事曆", "手動補充", "中華職棒"],
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
