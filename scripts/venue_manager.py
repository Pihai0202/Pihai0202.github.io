#!/usr/bin/env python3
"""
Venue Manager for Concert Crawler (Auto-sync & Auto-register with Firestore)
- Syncs known venues dynamically from Firebase Firestore.
- Performs fuzzy matching on venue names.
- Automatically geocodes and adds unknown venues to Firestore with coordinates ONLY when strictly validated.
"""

import re
import sys
import json
import time
import hashlib
import urllib.request
import urllib.parse
from datetime import datetime

FIRESTORE_PROJECT_ID = "concert-c399d"
FIRESTORE_BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIRESTORE_PROJECT_ID}/databases/(default)/documents"

# Taiwan Bounding Box for coordinate validation
TW_LAT_MIN, TW_LAT_MAX = 21.8, 26.4
TW_LON_MIN, TW_LON_MAX = 119.0, 122.5

# City extraction keywords
TAIWAN_CITIES = [
    ("台北", ["臺北", "台北", "Taipei", "taipei"]),
    ("新北", ["新北", "New Taipei", "板橋", "新莊", "三重", "中和", "永和", "汐止", "淡水", "林口", "新店", "土城", "蘆洲"]),
    ("桃園", ["桃園", "Taoyuan", "中壢", "龜山", "八德", "蘆竹", "大園", "平鎮"]),
    ("台中", ["臺中", "台中", "Taichung"]),
    ("台南", ["臺南", "台南", "Tainan"]),
    ("高雄", ["高雄", "Kaohsiung"]),
    ("基隆", ["基隆", "Keelung"]),
    ("新竹", ["新竹", "Hsinchu", "竹北"]),
    ("苗栗", ["苗栗", "Miaoli", "頭份", "竹南"]),
    ("彰化", ["彰化", "Changhua", "員林"]),
    ("南投", ["南投", "Nantou", "草屯", "埔里"]),
    ("雲林", ["雲林", "Yunlin", "斗六", "虎尾"]),
    ("嘉義", ["嘉義", "Chiayi"]),
    ("屏東", ["屏東", "Pingtung", "恆春", "潮州"]),
    ("宜蘭", ["宜蘭", "Yilan", "羅東", "礁溪"]),
    ("花蓮", ["花蓮", "Hualien"]),
    ("台東", ["臺東", "台東", "Taitung"]),
    ("澎湖", ["澎湖", "Penghu"]),
    ("金門", ["金門", "Kinmen"]),
    ("連江", ["連江", "馬祖", "Matsu"]),
]

# Blacklisted terms that indicate non-venues or event titles
IGNORED_TERMS = [
    "線上", "online", "待定", "tba", "tbd", "尚未公布", "各大影城", "影城", "直播",
    "依活動頁面為主", "請依活動頁面為主", "全台", "全省", "超商", "ibon", "7-eleven",
    "全家", "famimax", "博客來", "line", "zoom", "youtube", "meet",
    "演唱會", "音樂會", "巡迴", "見面會", "粉絲見面會", "公演", "加場",
    "台北場", "高雄場", "台中場", "售票", "開賣", "首演", "彩排", "工作坊", "講座",
    "入場券", "單人票", "雙人票", "早鳥票", "vip"
]

# Positive keywords that indicate a real venue / facility
VENUE_INDICATORS = [
    "館", "場", "中心", "house", "堂", "店", "特區", "園區", "廳", "劇場", "巨蛋",
    "live", "room", "studio", "hall", "arena", "dome", "center", "club", "bar",
    "space", "hub", "公園", "學校", "活動中心", "文創", "stage", "展演", "禮堂",
    "廣場", "基地", "倉庫", "體育館", "音樂廳", "音樂中心", "文化中心", "美術館", "博物館"
]

class VenueManager:
    def __init__(self):
        self.venues_by_id = {}
        self.venue_map = {}   # keyword -> venue_id
        self.venue_city = {}  # venue_id -> city
        self.geocode_cache = {}
        self.last_geocode_time = 0
        self.load_from_firestore()

    def load_from_firestore(self):
        """Fetch all venues from Firestore to populate in-memory lookup table."""
        url = f"{FIRESTORE_BASE_URL}/venues?pageSize=300"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ConcertBot/1.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                documents = data.get("documents", [])
                
                for doc in documents:
                    doc_name = doc.get("name", "")
                    vid = doc_name.split("/")[-1] if doc_name else ""
                    fields = doc.get("fields", {})
                    
                    name = fields.get("name", {}).get("stringValue", "")
                    city = fields.get("city", {}).get("stringValue", "")
                    addr = fields.get("address", {}).get("stringValue", "")
                    lat = fields.get("latitude", {}).get("doubleValue") or fields.get("latitude", {}).get("integerValue")
                    lon = fields.get("longitude", {}).get("doubleValue") or fields.get("longitude", {}).get("integerValue")
                    
                    if not vid or not name:
                        continue
                        
                    self.venues_by_id[vid] = {
                        "id": vid,
                        "name": name,
                        "city": city,
                        "address": addr,
                        "latitude": float(lat) if lat is not None else None,
                        "longitude": float(lon) if lon is not None else None,
                    }
                    self.venue_city[vid] = city
                    
                    # Register exact & normalized keywords
                    self.register_keyword(name, vid)
                    if "臺" in name:
                        self.register_keyword(name.replace("臺", "台"), vid)
                    if "台" in name:
                        self.register_keyword(name.replace("台", "臺"), vid)
                        
                print(f"[VenueManager] Successfully loaded {len(self.venues_by_id)} venues from Firestore.", file=sys.stderr)
        except Exception as e:
            print(f"[VenueManager] Warning: Failed to fetch venues from Firestore: {e}", file=sys.stderr)

    def register_keyword(self, keyword, vid):
        kw = keyword.strip()
        if kw and len(kw) >= 2:
            self.venue_map[kw] = vid

    def match_venue(self, text):
        """
        Fuzzy match known venue keywords in given text.
        Returns: (venue_id, venue_name, city) or (None, None, None)
        """
        if not text:
            return None, None, None

        # Try longest match first for accuracy
        for kw in sorted(self.venue_map.keys(), key=len, reverse=True):
            if kw in text:
                vid = self.venue_map[kw]
                venue_data = self.venues_by_id.get(vid, {})
                vname = venue_data.get("name", kw)
                city = venue_data.get("city") or self.venue_city.get(vid, "")
                return vid, vname, city

        return None, None, None

    def clean_venue_raw(self, raw_text):
        """
        Extract clean venue name and address from raw venue text.
        Returns (clean_name, address) or ("", "") if invalid.
        """
        if not raw_text:
            return "", ""

        text = raw_text.strip()
        # Remove HTML tags & markdown
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\[.*?\]", " ", text)

        # Extract address if contained in parentheses, e.g. "Corner Max (台北市大安區光復南路102號)"
        addr_match = re.search(r"[\(（]([^）\)]*(?:市|縣)[^）\)]*(?:路|街|大道|段)[^）\)]*)[\)）]", text)
        extracted_addr = addr_match.group(1).strip() if addr_match else ""

        # Remove bracketed text like 【...】, [...], 「...」, etc.
        clean = re.sub(r"【[^】]*】", " ", text)
        clean = re.sub(r"\[[^\]]*\]", " ", clean)
        clean = re.sub(r"[\(（][^）\)]*[\)）]", " ", clean)
        clean = re.sub(r"[「」『』《》〈〉]", " ", clean)

        # Remove noise prefixes
        clean = re.sub(r"^(地點|場地|演出地點|活動地點|場館|活動地址|地址)[：:\s]*", "", clean)
        # Remove dates / times e.g. "2025/05/20", "19:30"
        clean = re.sub(r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b", " ", clean)
        clean = re.sub(r"\b\d{1,2}[/-]\d{1,2}\b", " ", clean)
        clean = re.sub(r"\b\d{1,2}:\d{2}\b", " ", clean)
        clean = re.sub(r"\s+", " ", clean).strip()

        # If clean text has multiple lines or separators, take first segment
        if len(clean) > 30:
            parts = re.split(r"[\n\r/|／]", clean)
            if parts and len(parts[0].strip()) >= 2:
                clean = parts[0].strip()

        # Final sanity checks on candidate name
        if len(clean) < 3 or len(clean) > 35:
            return "", ""

        # Check blacklist
        clean_lower = clean.lower()
        if any(ign in clean_lower for ign in IGNORED_TERMS):
            return "", ""

        # Reject pure numbers/symbols or names starting with numbers
        if re.match(r"^[\d\W_]+$", clean) or re.match(r"^\d+[\s/-]", clean):
            return "", ""

        # Must have at least 2 Chinese characters OR at least one English word >= 3 chars
        chinese_count = len(re.findall(r"[\u4e00-\u9fa5]", clean))
        has_english_word = bool(re.search(r"[a-zA-Z]{3,}", clean))
        if chinese_count < 2 and not has_english_word:
            return "", ""

        # Must have a venue indicator OR a full Taiwan street address structure
        has_venue_kw = any(vk.lower() in clean_lower for vk in VENUE_INDICATORS)
        has_address_structure = bool(re.search(r"(?:市|縣).{1,5}(?:區|鄉|鎮|市).{1,10}(?:路|街|大道)", clean + " " + extracted_addr))

        if not (has_venue_kw or has_address_structure):
            return "", ""

        return clean, extracted_addr

    def extract_city(self, text):
        """Infer Taiwan city name from text."""
        for city_standard, aliases in TAIWAN_CITIES:
            for alias in aliases:
                if alias in text:
                    return city_standard
        return "台北"

    def geocode(self, name, address=""):
        """
        Query OpenStreetMap Nominatim with rate limiting.
        Returns: {lat, lon, address, city} or None
        """
        search_queries = []
        if address and len(address) >= 6:
            search_queries.append(address)
        if name:
            search_queries.append(f"{name} 台灣")
            search_queries.append(name)

        for query in search_queries:
            if query in self.geocode_cache:
                if self.geocode_cache[query]:
                    return self.geocode_cache[query]
                continue

            # Respect OSM Nominatim usage policy: min 1.1 sec between requests
            elapsed = time.time() - self.last_geocode_time
            if elapsed < 1.1:
                time.sleep(1.1 - elapsed)

            encoded = urllib.parse.quote(query)
            url = f"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1&countrycodes=tw"
            req = urllib.request.Request(url, headers={"User-Agent": "ConcertMapApp/1.0 (contact: concert-admin)"})

            try:
                self.last_geocode_time = time.time()
                with urllib.request.urlopen(req, timeout=8) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    if data and len(data) > 0:
                        item = data[0]
                        lat = float(item["lat"])
                        lon = float(item["lon"])
                        display_name = item.get("display_name", "")
                        osm_type = item.get("type", "")

                        # Reject results that are just arbitrary residential house numbers for a non-address query
                        if not address and osm_type in ("house", "yes", "unclassified") and len(name) < 4:
                            continue

                        # Verify Taiwan bounds
                        if TW_LAT_MIN <= lat <= TW_LAT_MAX and TW_LON_MIN <= lon <= TW_LON_MAX:
                            result = {
                                "latitude": lat,
                                "longitude": lon,
                                "address": display_name,
                                "city": self.extract_city(display_name + " " + query),
                            }
                            self.geocode_cache[query] = result
                            return result
            except Exception as e:
                print(f"[VenueManager] Geocoding error for '{query}': {e}", file=sys.stderr)

            self.geocode_cache[query] = None

        return None

    def auto_create_venue(self, venue_raw, context_text=""):
        """
        Geocode unknown venue and automatically create it in Firestore ONLY if strictly valid.
        Returns: (venue_id, venue_name, city) or (None, None, None)
        """
        clean_name, extracted_addr = self.clean_venue_raw(venue_raw)
        if not clean_name:
            return None, None, None

        # Double check match with clean name
        matched_id, matched_name, matched_city = self.match_venue(clean_name)
        if matched_id:
            return matched_id, matched_name, matched_city

        print(f"[VenueManager] 🔍 Validated new potential venue: '{clean_name}' (raw: '{venue_raw}')", file=sys.stderr)

        # Geocode
        geo = self.geocode(clean_name, extracted_addr)
        if not geo:
            print(f"[VenueManager] ⚠ Could not locate coordinates for '{clean_name}', skipping auto-creation.", file=sys.stderr)
            return None, None, None

        # Generate a clean, unique venue ID
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", clean_name.lower()).strip("-")
        if not slug or len(slug) < 3:
            h = hashlib.md5(clean_name.encode("utf-8")).hexdigest()[:8]
            slug = f"v-{h}"

        venue_id = slug
        city = geo.get("city") or self.extract_city(context_text + " " + clean_name)
        address = extracted_addr or geo.get("address", "")

        # Payload for Firestore REST API
        doc_payload = {
            "fields": {
                "id": {"stringValue": venue_id},
                "name": {"stringValue": clean_name},
                "city": {"stringValue": city},
                "address": {"stringValue": address},
                "latitude": {"doubleValue": geo["latitude"]},
                "longitude": {"doubleValue": geo["longitude"]},
                "capacity": {"stringValue": "未知"},
                "transit": {"stringValue": ""},
                "x": {"integerValue": "0"},
                "y": {"integerValue": "0"},
            }
        }

        # Save to Firestore via REST API
        save_url = f"{FIRESTORE_BASE_URL}/venues/{venue_id}"
        try:
            req = urllib.request.Request(
                save_url,
                data=json.dumps(doc_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH"
            )
            with urllib.request.urlopen(req, timeout=10) as res:
                print(f"[VenueManager] ✨ Successfully created new venue in Firestore: '{clean_name}' (ID: {venue_id}, City: {city}, Coords: {geo['latitude']:.4f}, {geo['longitude']:.4f})", file=sys.stderr)
        except Exception as e:
            print(f"[VenueManager] ⚠ Failed to write new venue '{venue_id}' to Firestore: {e}", file=sys.stderr)

        # Register in-memory
        self.venues_by_id[venue_id] = {
            "id": venue_id,
            "name": clean_name,
            "city": city,
            "address": address,
            "latitude": geo["latitude"],
            "longitude": geo["longitude"],
        }
        self.venue_city[venue_id] = city
        self.register_keyword(clean_name, venue_id)

        return venue_id, clean_name, city


# Global singleton instance
venue_manager = VenueManager()
