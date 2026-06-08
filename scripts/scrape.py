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


def fetch(url, as_json=False):
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=15) as r:
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

            date_str = parse_first_date(item["date"])
            if date_str and date_str < today_str():
                continue

            venue_id, venue_name = match_venue(name + " " + description)
            slug = re.sub(r"[^A-Za-z0-9_-]+", "-", url.rstrip("/").split("/")[-1]) or str(len(events))

            events.append({
                "id":         f"kktix-org-{slug}",
                "source":     "KKTIX",
                "name":       name,
                "venue_raw":  description[:120],
                "venue_id":   venue_id,
                "venue_name": venue_name,
                "city":       VENUE_CITY.get(venue_id, ""),
                "date":       date_str,
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

    blocks = re.findall(r'<div class="eventbl[^>]*>([\s\S]*?)</div>\s*</div>\s*</div>', html)
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
        date_str = parse_first_date(date_raw)
        
        # Venue
        venue_match = re.search(r'class=["\']text-small text-med-light["\'][^>]*>([\s\S]*?)</div>', b)
        venue_raw = unescape(re.sub(r'<[^>]*>', '', venue_match.group(1)).strip()) if venue_match else ""
        
        if date_str and date_str < today_str():
            continue
            
        ev_url = "https://tixcraft.com" + detail_path
        if ev_url in seen:
            continue
        seen.add(ev_url)
        
        venue_id, venue_name = match_venue(name + " " + venue_raw)
        
        events.append({
            "id":         f"tixcraft-{detail_path.split('/')[-1]}",
            "source":     "拓元售票",
            "name":       name,
            "venue_raw":  venue_raw,
            "venue_id":   venue_id,
            "venue_name": venue_name,
            "city":       VENUE_CITY.get(venue_id, ""),
            "date":       date_str,
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
            if not detail or (detail["date"] and detail["date"] < today_str()):
                continue

            eid = abs(hash(ev_url)) & 0xFFFFFF
            events.append({
                "id":         f"ibon-{eid}",
                "source":     "ibon售票",
                "name":       detail["name"],
                "venue_raw":  detail["venue_raw"],
                "venue_id":   detail["venue_id"],
                "venue_name": detail["venue_name"],
                "city":       VENUE_CITY.get(detail["venue_id"], ""),
                "date":       detail["date"],
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
            if not detail or (detail["date"] and detail["date"] < today_str()):
                continue

            eid = abs(hash(ev_url)) & 0xFFFFFF
            events.append({
                "id":         f"ticket-{eid}",
                "source":     "年代售票",
                "name":       detail["name"],
                "venue_raw":  detail["venue_raw"],
                "venue_id":   detail["venue_id"],
                "venue_name": detail["venue_name"],
                "city":       VENUE_CITY.get(detail["venue_id"], ""),
                "date":       detail["date"],
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

    date_str = ""
    m = re.search(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', html)
    if m:
        date_str = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

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
        "name": name, "date": date_str,
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
        date_str = parse_first_date(text)
        if date_str and date_str < today_str():
            continue

        venue_id, venue_name = match_venue(title + " " + text)
        platform = detect_platform(text)
        platform_url = PLATFORM_URLS.get(platform, url)

        events.append({
            "id": f"webbboxx-{abs(hash(title + date_str)) & 0xFFFFFF}",
            "source": "webbboxx 行事曆",
            "name": title,
            "venue_raw": text[:80],
            "venue_id": venue_id,
            "venue_name": venue_name,
            "city": VENUE_CITY.get(venue_id, ""),
            "date": date_str,
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

def merge_ticket_links(events):
    """
    If two events share a very similar name and date,
    merge their ticket_links instead of listing duplicates.
    """
    result = []
    index  = {}  # key -> position in result

    def normalize(s):
        return re.sub(r'[\s\-_【】「」（）()【】、，,!！]', '', s or '').lower()

    for ev in events:
        key = normalize(ev["name"]) + (ev["date"] or "")
        if key in index:
            # merge ticket links
            existing = result[index[key]]
            for lk in ev.get("ticket_links", []):
                matched = next((l for l in existing["ticket_links"] if l["platform"] == lk["platform"]), None)
                if matched:
                    # If existing url is generic homepage, but incoming is specific, overwrite it
                    if matched["url"] in ["https://tixcraft.com/", "https://tixcraft.com"] and lk["url"] not in ["https://tixcraft.com/", "https://tixcraft.com"]:
                        matched["url"] = lk["url"]
                else:
                    existing["ticket_links"].append(lk)
            # prefer image if missing
            if not existing["image"] and ev["image"]:
                existing["image"] = ev["image"]
            # prefer specific URL over generic homepage URL at top-level
            if existing["url"] in ["https://tixcraft.com/", "https://tixcraft.com"] and ev["url"] not in ["https://tixcraft.com/", "https://tixcraft.com"]:
                existing["url"] = ev["url"]
        else:
            index[key] = len(result)
            result.append(ev)

    return result


# ── 主程式 ─────────────────────────────────────────────────────────────────

def main():
    print("🎵 台灣演唱會爬蟲啟動", file=sys.stderr)

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
    all_events.extend(events)

    # 2. 拓元售票
    print("→ 爬取拓元售票 Tixcraft...", file=sys.stderr)
    events = scrape_tixcraft()
    print(f"  拓元得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 3. ibon 售票
    print("→ 爬取 ibon 售票...", file=sys.stderr)
    events = scrape_ibon()
    print(f"  ibon 得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 4. 年代售票
    print("→ 爬取年代售票...", file=sys.stderr)
    events = scrape_ticket()
    print(f"  年代得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 5. iNDIEVOX 售票
    print("→ 爬取 iNDIEVOX 售票...", file=sys.stderr)
    events = scrape_indievox()
    print(f"  iNDIEVOX 得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 6. Public calendar fallback
    print("→ 讀取公開演唱會行事曆 fallback...", file=sys.stderr)
    events = scrape_webbboxx_calendar()
    print(f"  行事曆得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 7. Manual exact links
    print("→ 合併手動補充活動...", file=sys.stderr)
    events = load_manual_events()
    print(f"  手動補充 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 合併同一活動的多平台售票連結
    all_events = merge_ticket_links(all_events)

    # Sort by date
    all_events.sort(key=lambda x: x["date"] or "9999")

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(all_events),
        "sources": ["KKTIX", "拓元售票", "ibon售票", "年代售票", "iNDIEVOX", "webbboxx 行事曆", "手動補充"],
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
