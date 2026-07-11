#!/usr/bin/env python3
"""
台灣天然災害停班停課爬蟲
來源：行政院人事行政總處
輸出：public/suspension.json
"""

import json
import re
import sys
import ssl
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
OUTPUT_PATH = PROJECT_ROOT / "public" / "suspension.json"

def fetch_html(url, timeout=12):
    req = Request(url, headers=HEADERS)
    try:
        # 建立不驗證憑證的 SSL context，避免 SSL: CERTIFICATE_VERIFY_FAILED 錯誤
        context = ssl._create_unverified_context()
        with urlopen(req, timeout=timeout, context=context) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ⚠ Fetch error {url}: {e}", file=sys.stderr)
        return None

def main():
    url = "https://www.dgpa.gov.tw/typh/daily/nds.html"
    print(f"→ Scrapes DGPA School/Work Suspension: {url}", file=sys.stderr)
    html = fetch_html(url)
    if not html:
        print("  ⚠ Failed to fetch DGPA html.", file=sys.stderr)
        sys.exit(1)

    # Extract update time
    update_time_match = re.search(r'更新時間：\s*([\d/: ]+)', html)
    update_time = update_time_match.group(1).strip() if update_time_match else ""

    # Parse rows
    row_regex = re.compile(
        r"<td[^>]*headers=['\"]?city_Name[^>]*>([\s\S]*?)</td>\s*"
        r"<td[^>]*>([\s\S]*?)</td>",
        re.IGNORECASE
    )

    items = []
    for match in row_regex.finditer(html):
        city = re.sub(r"<[^>]+>", "", match.group(1)).strip()
        status = re.sub(r"<[^>]+>", "", match.group(2)).strip()
        status = re.sub(r"\s+", " ", status)
        if city and status:
            items.append({
                "city": city,
                "status": status
            })

    output_data = {
        "updateTime": update_time,
        "items": items,
        "scrapedAt": datetime.now(timezone.utc).isoformat()
    }

    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Scraped successfully. Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
