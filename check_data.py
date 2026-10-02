import json, urllib.request, sys

urls = {
    "GitHub Raw": "https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/concerts.json",
    "Firebase": "https://concert-c399d.web.app/concerts.json",
    "Local": None,
}

for label, url in urls.items():
    try:
        if url:
            req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        else:
            with open("public/concerts.json", encoding="utf-8") as f:
                data = json.load(f)
        
        games = [e for e in data.get("events", []) if e.get("source") == "中華職棒" and e.get("date") == "2026-10-02"]
        print(f"\n=== {label} (updated: {data.get('updated_at', 'N/A')}) ===")
        for g in games:
            gs = g.get("game_score", {})
            print(f"  {g['id']} | {gs.get('status')} | {gs.get('visiting_team')} {gs.get('visiting_score')} - {gs.get('home_score')} {gs.get('home_team')} | {gs.get('status_text')}")
        if not games:
            print("  (no CPBL games found for 2026-10-02)")
    except Exception as e:
        print(f"\n=== {label}: ERROR - {e} ===")
