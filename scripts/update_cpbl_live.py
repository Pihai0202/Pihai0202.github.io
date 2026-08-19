import json, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONCERTS_PATH = PROJECT_ROOT / "public" / "concerts.json"

CPBL_PLAYER_CACHE = {
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
}

def get_player_name(name, acnt):
    if name and isinstance(name, str) and name.strip():
        c = name.strip().replace("\u200b", "")
        if not c.isdigit() and c not in ("未登錄", "待公告"):
            return c
    if not acnt:
        return name.strip() if isinstance(name, str) else ""
    s = str(acnt).strip()
    if s in CPBL_PLAYER_CACHE: return CPBL_PLAYER_CACHE[s]
    pad = s.zfill(10)
    if pad in CPBL_PLAYER_CACHE: return CPBL_PLAYER_CACHE[pad]
    strip = s.lstrip("0")
    if strip in CPBL_PLAYER_CACHE: return CPBL_PLAYER_CACHE[strip]
    return name.strip() if isinstance(name, str) else ""

def update_live_scores():
    session = cffi_requests.Session()
    res = session.get("https://cpbl.com.tw/schedule", impersonate="safari15_5", timeout=15)
    tokens = re.findall(r"RequestVerificationToken:\s*'([^']+)'", res.text)
    if not tokens:
        print("No token found", file=sys.stderr)
        return False
    token = tokens[0]
    current_year = datetime.now().year
    
    post_res = session.post(
        "https://cpbl.com.tw/schedule/getgamedatas",
        data={"calendar": f"{current_year}/01/01", "location": "", "kindCode": "A"},
        headers={"X-Requested-With": "XMLHttpRequest", "RequestVerificationToken": token},
        impersonate="safari15_5",
        timeout=15
    )
    
    data = post_res.json()
    if not data.get("Success"):
        print("Success false", file=sys.stderr)
        return False
    
    games = json.loads(data["GameDatas"])
    if not CONCERTS_PATH.exists():
        return False
    
    with open(CONCERTS_PATH, "r", encoding="utf-8") as f:
        concert_data = json.load(f)
        
    events = concert_data.get("events", [])
    updated_count = 0
    
    for g in games:
        g_sno = str(g.get("GameSno") or "")
        g_date = (g.get("GameDateTimeS") or "")[:10]
        if not g_date:
            continue
        
        visiting = (g.get("VisitingTeamName") or "").strip().replace("\u200b", "")
        home = (g.get("HomeTeamName") or "").strip().replace("\u200b", "")
        is_play_ball = g.get("IsPlayBall") == "Y"
        is_game_stop = str(g.get("IsGameStop")) == "1"
        
        win_p = get_player_name(g.get("WinningPitcherName"), g.get("WinningPitcherAcnt"))
        lose_p = get_player_name(g.get("LoserPitcherName"), g.get("LoserPitcherAcnt"))
        closer_p = get_player_name(g.get("CloserName"), g.get("CloserAcnt"))
        mvp_p = get_player_name(g.get("MvpName"), g.get("MvpAcnt"))
        vis_p = get_player_name(g.get("VisitingPitcherName") or g.get("VisitingFirstMover"), g.get("VisitingPitcherAcnt"))
        home_p = get_player_name(g.get("HomePitcherName") or g.get("HomeFirstMover"), g.get("HomePitcherAcnt"))
        
        v_score = g.get("VisitingScore")
        h_score = g.get("HomeScore")
        
        during_str = (g.get("GameDuringTime") or "").strip()
        end_str = (g.get("GameDateTimeE") or "").strip()
        
        status = "scheduled"
        status_text = "未開打"
        if is_game_stop:
            status = "postponed"
            status_text = "延賽"
        elif end_str or during_str or (win_p and lose_p):
            status = "finished"
            status_text = "已完賽"
        elif is_play_ball:
            status = "live"
            status_text = "比賽中"
        elif win_p or mvp_p:
            status = "finished"
            status_text = "已完賽"
            
        vis_score_str = v_score if (status in ("finished", "live") and v_score is not None) else "-"
        home_score_str = h_score if (status in ("finished", "live") and h_score is not None) else "-"
        
        # Match against event in concerts.json
        for ev in events:
            if ev.get("source") == "中華職棒" and ev.get("date") == g_date:
                ev_name = ev.get("name", "")
                if visiting in ev_name and home in ev_name:
                    ev["game_score"] = {
                        "visiting_team": visiting,
                        "home_team": home,
                        "visiting_score": vis_score_str,
                        "home_score": home_score_str,
                        "visiting_pitcher": vis_p,
                        "home_pitcher": home_p,
                        "status": status,
                        "status_text": status_text,
                        "mvp": mvp_p,
                        "winning_pitcher": win_p,
                        "losing_pitcher": lose_p,
                        "closer": closer_p,
                    }
                    updated_count += 1
                    print(f"Updated: {ev_name} -> {status_text} {vis_score_str}:{home_score_str}", file=sys.stderr)
                    
    concert_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(CONCERTS_PATH, "w", encoding="utf-8") as f:
        json.dump(concert_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully updated {updated_count} CPBL games.", file=sys.stderr)
    return True

if __name__ == "__main__":
    update_live_scores()
