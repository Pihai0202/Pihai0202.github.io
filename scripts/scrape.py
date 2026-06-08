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
    "Legacy TERA": "legacy-tera",
    "TICC": "ticc",
    "台北國際會議中心": "ticc",
    "臺北國際會議中心": "ticc",
    "MESSE TAOYUAN": "messe-taoyuan",
    "桃園陽光劇場": "taoyuan-sunlight-arena",
    "新北市工商展覽中心": "new-taipei-exhibition-hall",
    "花蓮縣立體育場": "hualien",
    "花蓮體育場": "hualien",
    "台東棒球場": "taitung",
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
}

# 售票網資訊
TICKET_PLATFORMS = {
    "kktix":    {"name": "KKTIX",    "color": "#e63946"},
    "tixcraft": {"name": "拓元售票",  "color": "#f4a261"},
    "ibon":     {"name": "ibon售票", "color": "#2ec4b6"},
    "ticket":   {"name": "年代售票",  "color": "#9b5de5"},
    "ticketplus": {"name": "TICKET PLUS", "color": "#00a6fb"},
    "webbboxx": {"name": "webbboxx 行事曆", "color": "#ffd166"},
    "manual": {"name": "手動補充", "color": "#06d6a0"},
}

PLATFORM_URLS = {
    "KKTIX": "https://kktix.com/",
    "拓元售票": "https://tixcraft.com/",
    "ibon售票": "https://tickets.ibon.com.tw/",
    "年代售票": "https://www.ticket.com.tw/",
    "TICKET PLUS": "https://ticketplus.com.tw/",
    "添翼售票": "https://www.indievox.com/",
}

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


# ── 拓元售票 Tixcraft ───────────────────────────────────────────────────────

def scrape_tixcraft():
    """Scrape Tixcraft (拓元) music/concert events."""
    events = []
    seen = set()

    # 拓元提供公開活動列表頁，依分類瀏覽
    pages = [
        "https://tixcraft.com/activity/game/tag/concert",
        "https://tixcraft.com/activity/game/tag/pop",
        "https://tixcraft.com/activity/game/tag/kpop",
    ]

    for page_url in pages:
        print(f"  Fetching {page_url}", file=sys.stderr)
        html = fetch(page_url)
        if not html:
            continue

        # 先嘗試 LD+JSON
        ld_matches = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL
        )
        for ld_raw in ld_matches:
            try:
                ld = json.loads(ld_raw)
                items = ld if isinstance(ld, list) else [ld]
                for item in items:
                    if item.get("@type") not in ("Event", "MusicEvent", "EntertainmentBusiness"):
                        continue
                    uid = item.get("url", "") or item.get("name", "")
                    if uid in seen:
                        continue
                    seen.add(uid)
                    _parse_ld_event(item, "tixcraft", events)
            except Exception:
                pass

        # HTML 卡片解析（拓元活動卡）
        # 格式：<a class="... " href="/activity/game/XXXX">
        card_links = re.findall(
            r'href=["\'](/activity/game/([A-Za-z0-9_-]+))["\']',
            html
        )
        names_raw  = re.findall(r'class="[^"]*title[^"]*"[^>]*>([^<]+)<', html)

        for (path, gid) in card_links:
            ev_url = "https://tixcraft.com" + path
            if ev_url in seen:
                continue
            seen.add(ev_url)

            # 抓活動詳細頁取得日期場館
            detail = _tixcraft_detail(ev_url)
            if not detail:
                continue
            if detail["date"] and detail["date"] < today_str():
                continue

            events.append({
                "id":         f"tixcraft-{gid}",
                "source":     "拓元售票",
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
                    {"platform": "tixcraft", "name": "拓元售票", "url": ev_url}
                ],
            })
            time.sleep(0.4)

        time.sleep(0.8)

    return events


def _tixcraft_detail(url):
    """Fetch Tixcraft event detail page and extract basic info."""
    html = fetch(url)
    if not html:
        return None

    name = ""
    m = re.search(r'<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)', html)
    if not m:
        m = re.search(r'<title>([^<|]+)', html)
    if m:
        name = m.group(1).strip()

    date_str = ""
    m = re.search(r'(\d{4})[/-](\d{2})[/-](\d{2})', html)
    if m:
        date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    venue_raw = ""
    m = re.search(r'(?:場地|地點|venue)[：:]\s*([^\n<]{2,50})', html)
    if m:
        venue_raw = m.group(1).strip()

    image = ""
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
    if m:
        image = m.group(1)

    price = ""
    m = re.search(r'(?:票價|price)[：:]\s*([^\n<]{2,40})', html)
    if m:
        price = m.group(1).strip()

    venue_id, venue_name = match_venue(name + " " + venue_raw)

    return {
        "name": name, "date": date_str,
        "venue_raw": venue_raw, "venue_id": venue_id, "venue_name": venue_name,
        "image": image, "price": price,
    }


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
                if not any(l["platform"] == lk["platform"] for l in existing["ticket_links"]):
                    existing["ticket_links"].append(lk)
            # prefer image if missing
            if not existing["image"] and ev["image"]:
                existing["image"] = ev["image"]
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

    # 5. Public calendar fallback
    print("→ 讀取公開演唱會行事曆 fallback...", file=sys.stderr)
    events = scrape_webbboxx_calendar()
    print(f"  行事曆得到 {len(events)} 筆", file=sys.stderr)
    all_events.extend(events)

    # 6. Manual exact links
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
        "sources": ["KKTIX", "拓元售票", "ibon售票", "年代售票", "webbboxx 行事曆", "手動補充"],
        "events": all_events,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\n✅ 共 {len(all_events)} 筆活動", file=sys.stderr)


if __name__ == "__main__":
    main()
