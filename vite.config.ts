import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 本地開發：將 /api/tdx/** 轉發至 TDX API（繞過瀏覽器 CORS 限制）
      // 部署後由 Firebase Hosting rewrite 至 tdxProxy Cloud Function 處理
      '/api/tdx': {
        target: 'https://tdx.transportdata.tw/api/basic',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tdx/, ''),
      },
      // 本地開發：將 /api/cwa/** 轉發至中央氣象署開放資料 API
      // 部署後由 Firebase Hosting rewrite 至 cwaProxy Cloud Function 處理
      '/api/cwa': {
        target: 'https://opendata.cwa.gov.tw/api/v1/rest/datastore',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cwa/, ''),
      },
      '/api/suspension': {
        target: 'https://concert-c399d.web.app',
        changeOrigin: true,
      },
    },
  },
})
