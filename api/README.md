# 今日演出票根卡片 API (Go + Gin)

這是一個基於 **Go + Gin** 打造的公開 RESTful JSON API 與網頁嵌入元件服務，專門將「台灣演唱會地圖」中的當日演出資訊轉換為**票根卡片（Ticket Card）**，供外部網站、部落格、Notion 或開發者串接使用。

## 🚀 本機快速啟動與預覽

```powershell
cd api
go mod tidy
go run main.go
```

啟動後打開瀏覽器：
- **視覺化票根卡片預覽**：`http://localhost:8080/embed/today`
- **純 JSON 資料 API**：`http://localhost:8080/api/v1/today`
- **自動嵌入腳本**：`http://localhost:8080/widget.js`

---

## 🌐 外部網站怎麼使用？（3 種方式）

### 方式 1：一行 `<script>` 自動嵌入票根卡片（適合部落格、外部網站）
外部網站只要在 HTML 貼上這兩行，就會自動向 API 請求今日演出並畫出黑橘配色的票根卡片：

```html
<div id="tw-concert-today" data-city="台北" data-category="concert" data-palette="volcano"></div>
<script src="https://你的API網址/widget.js" async></script>
```

### 方式 2：`<iframe>` 嵌入（適合 Notion、WordPress、Medium）
```html
<iframe 
  src="https://你的API網址/embed/today?city=台北&palette=volcano" 
  style="width: 100%; max-width: 440px; height: 260px; border: none;"
  loading="lazy">
</iframe>
```

### 方式 3：直接呼叫 JSON API（適合前端/後端工程師、LINE Bot、iOS 捷徑）
已開啟全域 CORS (`Access-Control-Allow-Origin: *`)，任何網站皆可直接 `fetch`：

```javascript
fetch('https://你的API網址/api/v1/today?city=台北&category=concert')
  .then(res => res.json())
  .then(data => {
    console.log(data.cards);
  });
```

---

## 📡 支援的查詢參數 (Query Parameters)
`/api/v1/today` 與 `/embed/today` 皆支援以下參數：

| 參數 | 說明 | 範例 |
| :--- | :--- | :--- |
| `city` | 依城市篩選（自動相容「台/臺」） | `?city=台北`、`?city=高雄` |
| `venue_id` | 依指定場館 ID 篩選 | `?venue_id=taipei-arena` |
| `category` | 依類型篩選：`concert`（演唱會）或 `sport`（中華職棒） | `?category=concert` |
| `date` | 指定日期查詢（格式 `YYYY-MM-DD`，預設為台北時間今日） | `?date=2026-10-28` |
| `palette` | （僅 `/embed/today`）切換配色：`volcano`（經典黑橘）或 `sage`（鼠尾草綠） | `?palette=volcano` |

---

## ☁️ 如何免費部署上線？

因為這是一個標準的 Go + Dockerfile 專案，只要將變更 Push 到 GitHub，即可免費部署在以下支援 Go / Docker 的雲端平台：

### 選項 A：部署至 Render / Zeabur / Railway（最簡單，免裝 CLI）
1. 將 `api/` 資料夾 Commit 並 Push 到你的 GitHub Repo (`Pihai0202/Pihai0202.github.io`)。
2. 登入 [Render](https://render.com/) 或 [Zeabur](https://zeabur.com/)，選擇 **New Web Service** 並連結你的 GitHub Repo。
3. 將 **Root Directory（根目錄）** 設定為 `api`（平台會自動偵測 `api/Dockerfile` 或 `api/go.mod` 進行編譯）。
4. 部署完成後，平台就會給你一個公開的 `https://xxxx.onrender.com`（或可綁定你自己的子網域 `https://api.pihai0202.com`）。

### 選項 B：部署至 Google Cloud Run
若安裝了 Google Cloud SDK (`gcloud`)，只要在 `api/` 目錄下執行一行指令即可部署到台灣機房 (`asia-east1`)：
```bash
cd api
gcloud run deploy concert-today-api --source . --region asia-east1 --allow-unauthenticated
```
