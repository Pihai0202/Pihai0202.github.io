package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// ─── 原始 concerts.json 資料結構 ───────────────────────────────────────────────

type RawPayload struct {
	UpdatedAt string     `json:"updated_at"`
	Events    []RawEvent `json:"events"`
}

type TicketLink struct {
	Platform string `json:"platform"`
	Name     string `json:"name"`
	URL      string `json:"url"`
}

type RawEvent struct {
	ID          string       `json:"id"`
	Source      string       `json:"source"`
	Name        string       `json:"name"`
	Artist      string       `json:"artist"`
	VenueRaw    string       `json:"venue_raw"`
	VenueID     string       `json:"venue_id"`
	VenueName   string       `json:"venue_name"`
	City        string       `json:"city"`
	Date        string       `json:"date"`
	Image       string       `json:"image"`
	URL         string       `json:"url"`
	Price       string       `json:"price"`
	Category    string       `json:"category"`
	GameScore   *GameScore   `json:"game_score,omitempty"`
	TicketLinks []TicketLink `json:"ticket_links,omitempty"`
}

type GameScore struct {
	VisitingTeam  string `json:"visiting_team"`
	HomeTeam      string `json:"home_team"`
	VisitingScore any    `json:"visiting_score"`
	HomeScore     any    `json:"home_score"`
	Status        string `json:"status"`
	StatusText    string `json:"status_text"`
}

// ─── 公開 API 回傳的「今日演出票根卡片」JSON 結構 ─────────────────────────────────

type TicketStub struct {
	BadgeText string `json:"badge_text"` // 例如："今天"
	IsToday   bool   `json:"is_today"`   // true（前端可渲染發光圓點）
	Day       string `json:"day"`        // 例如："28"
	YearMonth string `json:"year_month"` // 例如："2026.10"
}

type CardTheme struct {
	Palette     string `json:"palette"`      // 預設主題名稱 (volcano, sage, ocean, rose, purple, custom)
	AccentColor string `json:"accent_color"` // 主題強調色 HEX (如 #ff9100)
	CardBgColor string `json:"card_bg"`      // 卡片底色 HEX (如 #141622)
}

type TicketCard struct {
	ID              string       `json:"id"`
	Subtitle        string       `json:"subtitle"`         // 卡片左上角強調色文字（歌手名稱 或 職棒對戰比分）
	SourceBadge     string       `json:"source_badge"`     // 卡片右上角灰色膠囊（如 "拓元售票"）
	Title           string       `json:"title"`            // 卡片主標題（活動名稱）
	Venue           string       `json:"venue"`            // 地標圖示旁的場館名稱
	VenueID         string       `json:"venue_id,omitempty"`
	City            string       `json:"city"`             // 城市
	Category        string       `json:"category"`         // "concert" 或 "sport"
	BackgroundImage string       `json:"background_image"` // 卡片背景海報圖
	URL             string       `json:"url"`              // 點擊卡片導向的售票連結
	Stub            TicketStub   `json:"stub"`             // 卡片右側虛線票根資訊
	TicketLinks     []TicketLink `json:"ticket_links,omitempty"`
}

type TodayResponse struct {
	Date      string       `json:"date"`
	UpdatedAt string       `json:"updated_at"`
	Theme     CardTheme    `json:"theme"`
	Count     int          `json:"count"`
	Cards     []TicketCard `json:"cards"`
}

// ─── 顏色主題解析（支援預設主題與任意自訂 HEX 色碼）───────────────────────────────

type ResolvedTheme struct {
	Palette   string
	AccentHex string
	AccentRGB string
	BgHex     string
}

var hexColorRegex = regexp.MustCompile(`^#?([0-9a-fA-F]{6})$`)

func hexToRGBString(hex string) string {
	clean := strings.TrimPrefix(hex, "#")
	if len(clean) != 6 {
		return "255, 145, 0"
	}
	r, _ := strconv.ParseInt(clean[0:2], 16, 64)
	g, _ := strconv.ParseInt(clean[2:4], 16, 64)
	b, _ := strconv.ParseInt(clean[4:6], 16, 64)
	return fmt.Sprintf("%d, %d, %d", r, g, b)
}

func resolveTheme(c *gin.Context) ResolvedTheme {
	palette := strings.ToLower(strings.TrimSpace(c.DefaultQuery("palette", "volcano")))
	customColor := strings.TrimSpace(c.Query("color"))
	customBg := strings.TrimSpace(c.Query("bg"))

	// 預設主題色票
	accentHex := "#ff9100" // volcano 經典黑橘
	bgHex := "#141622"

	switch palette {
	case "sage": // 莫蘭迪鼠尾草綠
		accentHex = "#82947d"
		bgHex = "#181C14"
	case "ocean": // 海洋青藍
		accentHex = "#38bdf8"
		bgHex = "#0f172a"
	case "rose": // 霓虹櫻花粉
		accentHex = "#f43f5e"
		bgHex = "#1f1218"
	case "purple": // 極光紫
		accentHex = "#a855f7"
		bgHex = "#161122"
	case "gold": // 皇家金
		accentHex = "#eab308"
		bgHex = "#181510"
	default:
		palette = "volcano"
	}

	// 若使用者有傳入自訂 ?color=HEX（例如 ?color=ff5500 或 ?color=%23ff5500）
	if match := hexColorRegex.FindStringSubmatch(customColor); match != nil {
		accentHex = "#" + strings.ToLower(match[1])
		palette = "custom"
	}

	// 若使用者有傳入自訂卡片底色 ?bg=HEX
	if match := hexColorRegex.FindStringSubmatch(customBg); match != nil {
		bgHex = "#" + strings.ToLower(match[1])
	}

	return ResolvedTheme{
		Palette:   palette,
		AccentHex: accentHex,
		AccentRGB: hexToRGBString(accentHex),
		BgHex:     bgHex,
	}
}

// ─── 活動類別過濾（同步自 src/utils/eventFilterHelper.ts）────────────────────────

var excludeKeywords = []string{
	"展覽", "特展", "快閃店", "POP-UP", "POP UP", "博覽會", "畫展", "攝影展", "藝術展", "博物館", "美術館",
	"喜劇", "脫口秀", "漫才", "相聲", "短劇", "搞笑", "喜劇演員", "COMEDY", "STAND-UP", "STAND UP", "脫口",
	"舞台劇", "戲劇", "劇團", "劇院", "音樂劇", "話劇", "歌舞劇", "舞劇", "芭蕾", "舞蹈", "舞團", "兒童劇", "巧虎", "佩佩豬", "劇本殺", "馬戲團",
	"演講", "講座", "工作坊", "研討會", "說明會", "MEETUP", "COSCUP", "DEVFEST", "PYCON", "JSCONF", "WELCOME-PARTY", "RELAUNCH PARTY", "BIRTHDAY CAFE", "生日應援", "應援咖啡",
	"電影", "試映會", "特映會", "影展", "紀錄片", "電影院",
	"羽球", "籃球", "足球", "桌球", "排球", "路跑", "馬拉松", "賽車", "F1", "電競", "LCP ", "PCS ", "傳說對決", "英雄聯盟", "賽事票房", "排球賽",
}

var allowKeywords = []string{
	"演唱會", "音樂會", "見面會", "簽售", "簽名會", "簽頁會", "棒球", "職棒", "CPBL", "例行賽", "總冠軍賽", "季後賽", "明星賽",
	"LIVE", "CONCERT", "TOUR", "FAN MEETING", "FANMEETING", "FAN-MEETING", "巡迴", "巡演", "專場", "音樂祭", "音樂節", "祭典", "聽歌會", "發表會", "影音會", "DJ", "PARTY", "派對", "樂團", "BAND", "ACOUSTIC", "LIVEHOUSE", "LIVE HOUSE", "演奏",
}

func isTargetEventCategory(ev RawEvent) bool {
	name := strings.ToUpper(ev.Name)
	source := strings.ToUpper(ev.Source)
	venue := strings.ToUpper(ev.VenueName + " " + ev.VenueRaw)

	if strings.Contains(source, "棒球") || source == "中華職棒" ||
		strings.Contains(name, "中華職棒") || strings.Contains(name, "CPBL") || strings.Contains(name, "棒球") {
		return true
	}

	for _, kw := range excludeKeywords {
		if strings.Contains(name, kw) {
			return false
		}
	}

	for _, kw := range allowKeywords {
		if strings.Contains(name, kw) {
			return true
		}
	}

	if source == "INDIEVOX" ||
		strings.Contains(venue, "LEGACY") ||
		strings.Contains(venue, "ZEPP") ||
		strings.Contains(venue, "THE WALL") ||
		strings.Contains(venue, "PIPE") ||
		strings.Contains(venue, "CORNER HOUSE") ||
		strings.Contains(venue, "CLAPPER") {
		return true
	}

	return false
}

// ─── 記憶體快取（避免每次 API 請求都重新讀檔或打 GitHub）─────────────────────────

var (
	cacheMu     sync.RWMutex
	cachedData  *RawPayload
	cacheExpiry time.Time
)

const (
	remoteConcertsURL = "https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/concerts.json"
	siteOrigin        = "https://concert.pihai0202.com"
	cacheTTL          = 5 * time.Minute
)

func getConcertsData() (*RawPayload, error) {
	cacheMu.RLock()
	if cachedData != nil && time.Now().Before(cacheExpiry) {
		defer cacheMu.RUnlock()
		return cachedData, nil
	}
	cacheMu.RUnlock()

	cacheMu.Lock()
	defer cacheMu.Unlock()

	if cachedData != nil && time.Now().Before(cacheExpiry) {
		return cachedData, nil
	}

	var rawBytes []byte

	localPaths := []string{"../public/concerts.json", "./public/concerts.json"}
	for _, p := range localPaths {
		if data, err := os.ReadFile(p); err == nil {
			rawBytes = data
			break
		}
	}

	if len(rawBytes) == 0 {
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(remoteConcertsURL)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		rawBytes = data
	}

	var payload RawPayload
	if err := json.Unmarshal(rawBytes, &payload); err != nil {
		return nil, err
	}

	cachedData = &payload
	cacheExpiry = time.Now().Add(cacheTTL)
	return cachedData, nil
}

// ─── 卡片欄位轉換邏輯（同步自 src/App.tsx 與 src/utils/cpblUtils.ts）─────────────

func shortenCpblTeamName(name string) string {
	clean := strings.TrimSpace(name)
	switch {
	case strings.Contains(clean, "富邦"):
		return "富邦"
	case strings.Contains(clean, "統一"):
		return "統一"
	case strings.Contains(clean, "中信") || strings.Contains(clean, "兄弟"):
		return "中信"
	case strings.Contains(clean, "味全"):
		return "味全"
	case strings.Contains(clean, "樂天") || strings.Contains(clean, "桃猿"):
		return "樂天"
	case strings.Contains(clean, "台鋼") || strings.Contains(clean, "雄鷹"):
		return "台鋼"
	default:
		return clean
	}
}

var (
	bracketRegex = regexp.MustCompile(`^\s*(?:【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）)\s*`)
	yearPrefix   = regexp.MustCompile(`^(?:202\d\s*年?\s*)`)
	tourRegex    = regexp.MustCompile(`(?i)\s+(?:Prema\s+World\s+Tour|ASIA\s+ARENA\s+TOUR|ASIA\s+FAN\s*MEETING|ASIA\s+FAN\s*CONCERT|ASIA\s+TOUR|WORLD\s+TOUR|ARENA\s+TOUR|DOME\s+TOUR|LIVE\s+TOUR|CONCERT\s+TOUR|TOUR\s+202\d|FAN\s*MEETING|FAN\s*CONCERT|IN\s+TAIPEI|IN\s+KAOHSIUNG|IN\s+TAOYUAN)`)
	trailingWord = regexp.MustCompile(`(?i)\s*(?:202\d|ASIA|WORLD|LIVE|TOUR)\s*$`)
	asciiWord    = regexp.MustCompile(`^[A-Za-z0-9&'.]+$`)
	stopWord     = regexp.MustCompile(`(?i)^(tour|live|in|at|asia|world|the|concert|arena|dome)$`)
)

func extractSubtitle(e RawEvent) string {
	if e.GameScore != nil {
		vTeam := shortenCpblTeamName(e.GameScore.VisitingTeam)
		hTeam := shortenCpblTeamName(e.GameScore.HomeTeam)
		if e.GameScore.Status == "scheduled" {
			return fmt.Sprintf("%s vs %s", vTeam, hTeam)
		}
		statusLabel := e.GameScore.StatusText
		if e.GameScore.Status == "live" {
			statusLabel = "比賽中"
		} else if statusLabel == "" {
			if e.GameScore.Status == "finished" {
				statusLabel = "已完賽"
			} else {
				statusLabel = "未開打"
			}
		}
		vScore := "-"
		if e.GameScore.VisitingScore != nil && fmt.Sprintf("%v", e.GameScore.VisitingScore) != "" {
			vScore = fmt.Sprintf("%v", e.GameScore.VisitingScore)
		}
		hScore := "-"
		if e.GameScore.HomeScore != nil && fmt.Sprintf("%v", e.GameScore.HomeScore) != "" {
			hScore = fmt.Sprintf("%v", e.GameScore.HomeScore)
		}
		return fmt.Sprintf("%s %s : %s %s · %s", vTeam, vScore, hScore, hTeam, statusLabel)
	}

	if strings.TrimSpace(e.Artist) != "" {
		return strings.TrimSpace(e.Artist)
	}

	s := strings.TrimSpace(e.Name)
	for bracketRegex.MatchString(s) {
		s = bracketRegex.ReplaceAllString(s, "")
	}
	s = strings.Trim(s, "《「『【》」』】 ")
	s = yearPrefix.ReplaceAllString(s, "")

	if loc := tourRegex.FindStringIndex(s); loc != nil {
		s = strings.TrimSpace(s[:loc[0]])
	} else {
		seps := []string{"《", "「", "『", "<", " - ", " – ", " — ", "｜", "|", "：", ":", "★"}
		for _, sep := range seps {
			if idx := strings.Index(s, sep); idx != -1 {
				part := strings.TrimSpace(s[:idx])
				if len([]rune(part)) >= 2 {
					s = part
					break
				}
			}
		}
	}

	s = strings.TrimSpace(trailingWord.ReplaceAllString(s, ""))
	if s != "" && s != e.Name && len([]rune(s)) <= 28 {
		return s
	}

	words := strings.Fields(s)
	if len(words) > 1 && asciiWord.MatchString(words[0]) {
		if len(words) > 2 && asciiWord.MatchString(words[1]) && !stopWord.MatchString(words[1]) {
			return words[0] + " " + words[1]
		}
		return words[0]
	}

	if e.Source != "" {
		return e.Source
	}
	return "售票活動"
}

func formatVenueText(e RawEvent) string {
	v := e.VenueName
	if v == "" {
		v = e.VenueRaw
	}
	if v == "" {
		v = e.City
	}
	if v == "" {
		return "地點待確認"
	}
	if e.VenueID == "kaohsiung-natl" || v == "國家體育場" || v == "高雄國家體育場" {
		return "高雄世運"
	}
	return strings.ReplaceAll(v, "臺", "台")
}

func normalizeImageURL(img string) string {
	img = strings.TrimSpace(img)
	if strings.HasPrefix(img, "/") {
		return siteOrigin + img
	}
	return img
}

func toTicketCard(e RawEvent) TicketCard {
	subtitle := extractSubtitle(e)
	sourceBadge := e.Source
	if subtitle == sourceBadge {
		sourceBadge = ""
	}

	category := "concert"
	if e.Source == "中華職棒" || e.Category == "sport" {
		category = "sport"
	}

	day := "--"
	yearMonth := "日期未定"
	cleanDate := strings.ReplaceAll(strings.TrimSpace(e.Date), "/", "-")
	if len(cleanDate) >= 10 {
		parts := strings.Split(cleanDate[:10], "-")
		if len(parts) == 3 {
			yearMonth = parts[0] + "." + parts[1]
			day = parts[2]
		}
	}

	url := strings.TrimSpace(e.URL)
	if url == "" {
		url = siteOrigin
	}

	return TicketCard{
		ID:              e.ID,
		Subtitle:        subtitle,
		SourceBadge:     sourceBadge,
		Title:           e.Name,
		Venue:           formatVenueText(e),
		VenueID:         e.VenueID,
		City:            strings.ReplaceAll(e.City, "臺", "台"),
		Category:        category,
		BackgroundImage: normalizeImageURL(e.Image),
		URL:             url,
		Stub: TicketStub{
			BadgeText: "今天",
			IsToday:   true,
			Day:       day,
			YearMonth: yearMonth,
		},
		TicketLinks: e.TicketLinks,
	}
}

func queryTodayCards(c *gin.Context) (*TodayResponse, ResolvedTheme, error) {
	theme := resolveTheme(c)
	payload, err := getConcertsData()
	if err != nil {
		return nil, theme, err
	}

	taipeiLoc := time.FixedZone("Asia/Taipei", 8*3600)
	targetDate := c.DefaultQuery("date", time.Now().In(taipeiLoc).Format("2006-01-02"))
	cityFilter := strings.ReplaceAll(strings.TrimSpace(c.Query("city")), "臺", "台")
	venueFilter := strings.TrimSpace(c.Query("venue_id"))
	categoryFilter := strings.TrimSpace(c.Query("category"))
	includeRaw := c.Query("raw") == "true"

	cards := make([]TicketCard, 0)
	for _, ev := range payload.Events {
		cleanDate := strings.ReplaceAll(strings.TrimSpace(ev.Date), "/", "-")
		if !strings.HasPrefix(cleanDate, targetDate) {
			continue
		}

		if !includeRaw && !isTargetEventCategory(ev) {
			continue
		}

		card := toTicketCard(ev)

		if cityFilter != "" && !strings.Contains(card.City, cityFilter) {
			continue
		}
		if venueFilter != "" && card.VenueID != venueFilter {
			continue
		}
		if categoryFilter != "" && card.Category != categoryFilter {
			continue
		}

		cards = append(cards, card)
	}

	return &TodayResponse{
		Date:      targetDate,
		UpdatedAt: payload.UpdatedAt,
		Theme: CardTheme{
			Palette:     theme.Palette,
			AccentColor: theme.AccentHex,
			CardBgColor: theme.BgHex,
		},
		Count: len(cards),
		Cards: cards,
	}, theme, nil
}

// ─── HTML 模板 1：純卡片嵌入視圖 (/embed/today) ─────────────────────────────────

const embedHTMLTemplate = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>今日演出票根卡片</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@500;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root {
    --gold: {{.Theme.AccentHex}};
    --gold-rgb: {{.Theme.AccentRGB}};
    --teal: {{.Theme.AccentHex}};
    --teal-rgb: {{.Theme.AccentRGB}};
    --card-bg: {{.Theme.BgHex}};
    --ticket-stub-width: 96px;
    --ticket-notch-radius: 7.5px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans TC", system-ui, -apple-system, sans-serif;
    background: transparent;
    padding: 4px;
    color: #fff;
  }
  .cards-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 440px;
    margin: 0 auto;
  }
  .remote-card {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    min-height: 112px;
    background: var(--card-bg);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    color: #ffffff;
    text-decoration: none;
    display: block;
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease;
    -webkit-mask-image:
      radial-gradient(circle at calc(100% - var(--ticket-stub-width)) 0, transparent var(--ticket-notch-radius), #000 calc(var(--ticket-notch-radius) + 0.6px)),
      radial-gradient(circle at calc(100% - var(--ticket-stub-width)) 100%, transparent var(--ticket-notch-radius), #000 calc(var(--ticket-notch-radius) + 0.6px));
    -webkit-mask-size: 100% 51%, 100% 51%;
    -webkit-mask-position: top, bottom;
    -webkit-mask-repeat: no-repeat;
    mask-image:
      radial-gradient(circle at calc(100% - var(--ticket-stub-width)) 0, transparent var(--ticket-notch-radius), #000 calc(var(--ticket-notch-radius) + 0.6px)),
      radial-gradient(circle at calc(100% - var(--ticket-stub-width)) 100%, transparent var(--ticket-notch-radius), #000 calc(var(--ticket-notch-radius) + 0.6px));
    mask-size: 100% 51%, 100% 51%;
    mask-position: top, bottom;
    mask-repeat: no-repeat;
  }
  .remote-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--gold) 0%, var(--teal) 100%);
    z-index: 3;
    opacity: 0.95;
  }
  .remote-card:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--gold-rgb), 0.55);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  }
  .remote-card-bg-wrap {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .remote-card-bg-img {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    transition: transform 0.4s ease;
  }
  .remote-card:hover .remote-card-bg-img {
    transform: scale(1.05);
  }
  .remote-card-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #131622 0%, #1c2030 100%);
    color: rgba(var(--gold-rgb), 0.25);
    font-size: 2rem; font-weight: 800; letter-spacing: 0.18em;
  }
  .remote-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(10, 12, 20, 0.78) 0%, rgba(10, 12, 20, 0.45) 58%, rgba(10, 12, 20, 0.68) 100%);
  }
  .remote-ticket-layout {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: stretch;
    min-height: 112px;
    width: 100%;
  }
  .remote-ticket-main {
    flex: 1; min-width: 0;
    display: flex; align-items: center;
    padding: 0.78rem 0.9rem 0.78rem 1rem;
  }
  .remote-ticket-info {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; justify-content: center;
    gap: 0.28rem;
  }
  .remote-card-kicker-row {
    display: flex; align-items: center; gap: 0.45rem; min-width: 0;
  }
  .remote-card-artist {
    color: var(--gold);
    font-weight: 800; font-size: 0.76rem; line-height: 1.25;
    letter-spacing: 0.03em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
  }
  .remote-card-source-pill {
    flex-shrink: 0;
    font-size: 0.64rem; font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 0.1rem 0.42rem; border-radius: 4px; line-height: 1.2;
    backdrop-filter: blur(4px);
  }
  .remote-card-name {
    color: #ffffff;
    font-weight: 800; font-size: 0.96rem; line-height: 1.32;
    display: -webkit-box; overflow: hidden;
    -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0, 0, 0, 0.8);
  }
  .remote-card-footer-row {
    display: flex; align-items: center; gap: 0.4rem; margin-top: 0.08rem;
  }
  .remote-card-venue {
    display: inline-flex; align-items: center; gap: 0.28rem;
    color: rgba(255, 255, 255, 0.92);
    font-weight: 700; font-size: 0.76rem; line-height: 1.3;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.8);
  }
  .ticket-pin-icon {
    flex-shrink: 0; width: 0.88em; height: 0.88em;
    color: var(--teal);
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85));
  }
  .remote-card-venue-text {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .remote-ticket-stub {
    width: var(--ticket-stub-width); flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0.6rem 0.5rem;
    background: rgba(10, 12, 20, 0.46);
    backdrop-filter: blur(6px);
    border-left: 1.5px dashed rgba(255, 255, 255, 0.24);
    gap: 0.18rem;
  }
  .ticket-stub-countdown {
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    background: rgba(var(--gold-rgb), 0.88);
    border: 1px solid rgba(255, 255, 255, 0.45);
    color: #ffffff;
    box-shadow: 0 0 12px rgba(var(--gold-rgb), 0.5);
    font-size: 0.66rem; font-weight: 800; line-height: 1.1;
    padding: 0.2rem 0.48rem; border-radius: 6px;
    white-space: nowrap; margin-bottom: 0.1rem;
  }
  .stub-live-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #ffffff; box-shadow: 0 0 6px #ffffff;
  }
  .ticket-stub-day {
    font-size: 1.85rem; font-weight: 900; color: #ffffff; line-height: 1;
    letter-spacing: -0.03em;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
  }
  .ticket-stub-ym {
    font-size: 0.68rem; font-weight: 700;
    color: rgba(255, 255, 255, 0.72);
    letter-spacing: 0.06em; line-height: 1.1;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  }
  .empty-card {
    background: var(--card-bg);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    padding: 1.4rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.65);
    font-size: 0.88rem;
  }
</style>
</head>
<body>
  <div class="cards-wrap">
    {{if eq (len .Cards) 0}}
      <div class="empty-card" style="display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>{{.Date}} 今日暫無符合條件的演出活動</span>
      </div>
    {{end}}
    {{range .Cards}}
      <a class="remote-card" href="{{.URL}}" target="_blank" rel="noopener noreferrer">
        <div class="remote-card-bg-wrap">
          {{if .BackgroundImage}}
            <img class="remote-card-bg-img" src="{{.BackgroundImage}}" alt="" loading="lazy" onerror="this.style.display='none'" />
          {{else}}
            <div class="remote-card-fallback">LIVE</div>
          {{end}}
          <div class="remote-card-overlay"></div>
        </div>
        <div class="remote-ticket-layout">
          <div class="remote-ticket-main">
            <div class="remote-ticket-info">
              <div class="remote-card-kicker-row">
                <span class="remote-card-artist" title="{{.Subtitle}}">{{.Subtitle}}</span>
                {{if .SourceBadge}}
                  <span class="remote-card-source-pill">{{.SourceBadge}}</span>
                {{end}}
              </div>
              <div class="remote-card-name" title="{{.Title}}">{{.Title}}</div>
              <div class="remote-card-footer-row">
                <div class="remote-card-venue">
                  <svg class="ticket-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span class="remote-card-venue-text">{{.Venue}}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="remote-ticket-stub">
            <div class="ticket-stub-countdown">
              <span class="stub-live-dot"></span>
              {{.Stub.BadgeText}}
            </div>
            <div class="ticket-stub-day">{{.Stub.Day}}</div>
            <div class="ticket-stub-ym">{{.Stub.YearMonth}}</div>
          </div>
        </div>
      </a>
    {{end}}
  </div>
</body>
</html>`

// ─── HTML 模板 2：互動式顏色選擇與 API 產生器首頁 (/) ─────────────────────────────

const builderHTMLTemplate = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>今日演出票根卡片 API 產生器</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans TC", system-ui, sans-serif;
    background: #0b0c10;
    color: #f1f5f9;
    min-height: 100vh;
    padding: 2rem 1.2rem;
  }
  .container {
    max-width: 980px;
    margin: 0 auto;
  }
  .header {
    margin-bottom: 1.8rem;
  }
  .header h1 {
    font-size: 1.55rem;
    font-weight: 900;
    margin-bottom: 0.4rem;
    background: linear-gradient(90deg, #ff9100, #ffd166);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header p {
    color: #94a3b8;
    font-size: 0.9rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.05fr;
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 780px) {
    .grid { grid-template-columns: 1fr; }
  }
  .panel {
    background: #14161f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1.4rem;
  }
  .panel-title {
    font-size: 0.95rem;
    font-weight: 800;
    margin-bottom: 1rem;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .form-group {
    margin-bottom: 1.15rem;
  }
  .form-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    align-items: center;
  }
  .swatch-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.42rem 0.75rem;
    border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.14);
    background: #1c1f2b;
    color: #e2e8f0;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s;
  }
  .swatch-btn.active {
    border-color: #ff9100;
    background: rgba(255, 145, 0, 0.14);
    color: #fff;
  }
  .swatch-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  .custom-color-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.65rem;
  }
  input[type="color"] {
    width: 38px;
    height: 34px;
    border: none;
    background: none;
    cursor: pointer;
  }
  select, input[type="text"], input[type="date"] {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: #1c1f2b;
    color: #fff;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .code-box {
    background: #090a0f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    color: #38bdf8;
    word-break: break-all;
    margin-bottom: 0.85rem;
    position: relative;
  }
  .copy-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .copy-btn:hover { background: rgba(255, 255, 255, 0.2); }
  iframe {
    width: 100%;
    height: 360px;
    border: none;
    border-radius: 12px;
    background: transparent;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="display:flex;align-items:center;gap:8px;">
        <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="#ff9100" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
        今日演出票根卡片 API 產生器
      </h1>
      <p>自訂票根卡片主題顏色與篩選條件，即時預覽並複製專屬 API 網址或網站嵌入碼</p>
    </div>

    <div class="grid">
      <!-- 左側：設定面板 -->
      <div class="panel">
        <div class="panel-title">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="#ff9100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.72 1.7-1.65 0-.43-.17-.83-.44-1.14-.27-.3-.43-.72-.43-1.17 0-.92.75-1.67 1.67-1.67H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/></svg>
            1. 選擇卡片顏色與篩選條件
          </span>
        </div>

        <div class="form-group">
          <label class="form-label">預設主題色票 (palette)</label>
          <div class="swatches" id="palette-group">
            <button type="button" class="swatch-btn active" data-palette="volcano" data-hex="#ff9100">
              <span class="swatch-dot" style="background:#ff9100"></span> 經典黑橘
            </button>
            <button type="button" class="swatch-btn" data-palette="sage" data-hex="#82947d">
              <span class="swatch-dot" style="background:#82947d"></span> 鼠尾草綠
            </button>
            <button type="button" class="swatch-btn" data-palette="ocean" data-hex="#38bdf8">
              <span class="swatch-dot" style="background:#38bdf8"></span> 海洋青藍
            </button>
            <button type="button" class="swatch-btn" data-palette="rose" data-hex="#f43f5e">
              <span class="swatch-dot" style="background:#f43f5e"></span> 霓虹櫻花
            </button>
            <button type="button" class="swatch-btn" data-palette="purple" data-hex="#a855f7">
              <span class="swatch-dot" style="background:#a855f7"></span> 極光紫
            </button>
            <button type="button" class="swatch-btn" data-palette="gold" data-hex="#eab308">
              <span class="swatch-dot" style="background:#eab308"></span> 皇家金
            </button>
          </div>

          <div class="custom-color-row">
            <input type="color" id="custom-color-picker" value="#ff9100" />
            <input type="text" id="custom-color-input" placeholder="或輸入自訂 HEX 色碼，如 #ff9100" style="flex:1" />
          </div>
        </div>

        <div class="row-2">
          <div class="form-group">
            <label class="form-label">篩選城市 (city)</label>
            <select id="city-select">
              <option value="">全台灣</option>
              <option value="台北">台北</option>
              <option value="新北">新北</option>
              <option value="桃園">桃園</option>
              <option value="台中">台中</option>
              <option value="台南">台南</option>
              <option value="高雄">高雄</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">活動類別 (category)</label>
            <select id="category-select">
              <option value="">全部演出與賽事</option>
              <option value="concert">只看演唱會 (concert)</option>
              <option value="sport">只看中華職棒 (sport)</option>
            </select>
          </div>
        </div>

        <div class="panel-title" style="margin-top: 0.6rem;">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="#ff9100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            2. 複製 API 或網站嵌入碼
          </span>
        </div>

        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;">
          <span>JSON API 網址 (回傳包含顏色設定與卡片欄位的 JSON)</span>
          <button class="copy-btn" onclick="copyText('json-url')">複製</button>
        </label>
        <div class="code-box" id="json-url"></div>

        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;">
          <span>Iframe 網頁嵌入碼 (可直接貼入 Notion / 部落格 / 外部網站)</span>
          <button class="copy-btn" onclick="copyText('iframe-code')">複製</button>
        </label>
        <div class="code-box" id="iframe-code"></div>

        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;">
          <span>JavaScript 自動嵌入標籤</span>
          <button class="copy-btn" onclick="copyText('script-code')">複製</button>
        </label>
        <div class="code-box" id="script-code" style="margin-bottom:0"></div>
      </div>

      <!-- 右側：即時預覽 -->
      <div class="panel">
        <div class="panel-title">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="#ff9100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            即時票根卡片預覽
          </span>
          <a id="open-embed-link" href="/embed/today" target="_blank" style="color:#ff9100;font-size:0.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            在新分頁開啟
            <svg viewBox="0 0 24 24" width="0.95em" height="0.95em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        <iframe id="preview-iframe" src="/embed/today"></iframe>
      </div>
    </div>
  </div>

  <script>
    var selectedPalette = 'volcano';
    var customColor = '';

    var paletteBtns = document.querySelectorAll('#palette-group .swatch-btn');
    var colorPicker = document.getElementById('custom-color-picker');
    var colorInput = document.getElementById('custom-color-input');
    var citySelect = document.getElementById('city-select');
    var categorySelect = document.getElementById('category-select');

    paletteBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        paletteBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedPalette = btn.getAttribute('data-palette');
        customColor = '';
        colorInput.value = '';
        colorPicker.value = btn.getAttribute('data-hex');
        updatePreview();
      });
    });

    colorPicker.addEventListener('input', function() {
      paletteBtns.forEach(function(b) { b.classList.remove('active'); });
      customColor = colorPicker.value.replace('#', '');
      colorInput.value = colorPicker.value;
      updatePreview();
    });

    colorInput.addEventListener('input', function() {
      var val = colorInput.value.trim().replace('#', '');
      if (/^[0-9a-fA-F]{6}$/.test(val)) {
        paletteBtns.forEach(function(b) { b.classList.remove('active'); });
        customColor = val;
        colorPicker.value = '#' + val;
        updatePreview();
      }
    });

    citySelect.addEventListener('change', updatePreview);
    categorySelect.addEventListener('change', updatePreview);

    function updatePreview() {
      var params = new URLSearchParams();
      if (customColor) {
        params.set('color', customColor);
      } else if (selectedPalette && selectedPalette !== 'volcano') {
        params.set('palette', selectedPalette);
      }
      if (citySelect.value) params.set('city', citySelect.value);
      if (categorySelect.value) params.set('category', categorySelect.value);

      var qs = params.toString();
      var suffix = qs ? ('?' + qs) : '';
      var origin = window.location.origin;

      var jsonUrl = origin + '/api/v1/today' + suffix;
      var embedUrl = origin + '/embed/today' + suffix;

      document.getElementById('json-url').textContent = jsonUrl;
      document.getElementById('iframe-code').textContent = '<iframe src="' + embedUrl + '" style="width:100%;max-width:440px;height:260px;border:none;" loading="lazy"></iframe>';

      var dataAttrs = '';
      if (citySelect.value) dataAttrs += ' data-city="' + citySelect.value + '"';
      if (categorySelect.value) dataAttrs += ' data-category="' + categorySelect.value + '"';
      if (customColor) {
        dataAttrs += ' data-color="' + customColor + '"';
      } else {
        dataAttrs += ' data-palette="' + selectedPalette + '"';
      }
      document.getElementById('script-code').textContent = '<div id="tw-concert-today"' + dataAttrs + '></div>\n<script src="' + origin + '/widget.js" async><\/script>';

      document.getElementById('preview-iframe').src = '/embed/today' + suffix;
      document.getElementById('open-embed-link').href = '/embed/today' + suffix;
    }

    function copyText(id) {
      var text = document.getElementById(id).textContent;
      navigator.clipboard.writeText(text);
    }

    updatePreview();
  </script>
</body>
</html>`

// ─── Gin 伺服器與路由 ───────────────────────────────────────────────────────────

func main() {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins: true,
		AllowMethods:    []string{"GET", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Type", "Accept"},
		MaxAge:          12 * time.Hour,
	}))

	embedTmpl := template.Must(template.New("embed").Parse(embedHTMLTemplate))
	builderTmpl := template.Must(template.New("builder").Parse(builderHTMLTemplate))

	// 首頁 (/)：互動式「票根卡片顏色選擇與嵌入碼產生器」
	r.GET("/", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		_ = builderTmpl.Execute(c.Writer, nil)
	})

	// 1. 純 JSON API：回傳包含 theme 顏色資訊與今日卡片清單的 JSON
	v1 := r.Group("/api/v1")
	{
		v1.GET("/today", func(c *gin.Context) {
			resp, _, err := queryTodayCards(c)
			if err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "無法讀取演出資料", "detail": err.Error()})
				return
			}
			c.JSON(http.StatusOK, resp)
		})
	}

	// 2. 視覺化票根卡片網頁：支援 ?palette= 與 ?color= 自訂任意顏色
	r.GET("/embed/today", func(c *gin.Context) {
		resp, theme, err := queryTodayCards(c)
		if err != nil {
			c.String(http.StatusServiceUnavailable, "無法讀取演出資料")
			return
		}
		c.Header("Content-Type", "text/html; charset=utf-8")
		_ = embedTmpl.Execute(c.Writer, gin.H{
			"Date":  resp.Date,
			"Cards": resp.Cards,
			"Theme": theme,
		})
	})

	// 3. JavaScript Widget：支援 data-palette 與 data-color 屬性
	r.GET("/widget.js", func(c *gin.Context) {
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)
		js := fmt.Sprintf(`(function(){
  var containers = document.querySelectorAll('#tw-concert-today, .tw-concert-today');
  containers.forEach(function(el) {
    var city = el.getAttribute('data-city') || '';
    var category = el.getAttribute('data-category') || '';
    var date = el.getAttribute('data-date') || '';
    var palette = el.getAttribute('data-palette') || '';
    var color = el.getAttribute('data-color') || '';
    var bg = el.getAttribute('data-bg') || '';
    var params = new URLSearchParams();
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (date) params.set('date', date);
    if (palette) params.set('palette', palette);
    if (color) params.set('color', color.replace('#', ''));
    if (bg) params.set('bg', bg.replace('#', ''));
    var iframe = document.createElement('iframe');
    iframe.src = '%s/embed/today?' + params.toString();
    iframe.style.width = '100%%';
    iframe.style.maxWidth = '440px';
    iframe.style.height = el.getAttribute('data-height') || '260px';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    el.innerHTML = '';
    el.appendChild(iframe);
  });
})();`, baseURL)
		c.Data(http.StatusOK, "application/javascript; charset=utf-8", []byte(js))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r.Run(":" + port)
}
