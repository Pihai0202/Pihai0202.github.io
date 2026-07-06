import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from '../utils/i18n.tsx'
import { WarningIcon, TrainIcon, BusIcon, RefreshIcon } from './SvgIcon'

// ─── 型別定義 ────────────────────────────────────────────────────────────────

interface TransitStatusData {
  name: string
  status: string
  isNormal: boolean
  detail: string
  updatedAt: string
}

interface TransitPayload {
  updated_at: string
  statuses: Record<string, TransitStatusData>
}

interface TrainQueryResult {
  trainType: string
  trainNo: string
  depTime: string
  arrTime: string
  duration: string
  isExpress: boolean
  status: string
}

interface BusStopInfo {
  name: string
  status: string
  className: string
}

interface TdxStation {
  StationID: string
  StationName: {
    Zh_tw?: string
    En?: string
  }
}

// THSR v2 /DailyTimetable/OD/... 回傳結構（OData 包裝，每筆為獨立的 OD 項）
interface TdxThsrDailyTimetableItem {
  DailyTrainInfo?: {
    TrainNo?: string
    Overnight?: boolean
  }
  OriginStopTime?: {
    StationID?: string
    ArrivalTime?: string
    DepartureTime?: string
  }
  DestinationStopTime?: {
    StationID?: string
    ArrivalTime?: string
    DepartureTime?: string
  }
}

interface TdxBusRoute {
  RouteName?: { Zh_tw?: string; En?: string }
  DepartureStopNameZh?: string
  DestinationStopNameZh?: string
}

interface TdxBusStopOfRoute {
  Direction?: number
  Stops?: Array<{ StopName?: { Zh_tw?: string; En?: string } }>
}

interface TdxBusEta {
  Direction?: number
  StopName?: { Zh_tw?: string; En?: string }
  EstimateTime?: number
  StopStatus?: number
}

interface TdxMetroLiveBoard {
  StationID: string
  StationName?: { Zh_tw?: string; En?: string }
  DestinationStationName?: { Zh_tw?: string; En?: string }
  Direction?: number
  EstimateTime?: number
  SrcUpdateTime?: string
  UpdateTime?: string
}

// TDX 捷運時刻表：ServiceDay 欄位為布林值（非整數）
// Timetables 內每個條目只有 DepartureTime，無 DestinationStationName
interface TdxMetroStationTimeTable {
  StationID: string
  Direction?: number
  ServiceDay?: {
    Monday?: boolean | number
    Tuesday?: boolean | number
    Wednesday?: boolean | number
    Thursday?: boolean | number
    Friday?: boolean | number
    Saturday?: boolean | number
    Sunday?: boolean | number
    NationalHolidays?: boolean | number
  }
  // 實際 API 欄位名稱（不含終點站資訊）
  Timetables?: Array<{
    Sequence?: number
    DepartureTime?: string
    TrainType?: number
  }>
  // 備用舊欄位名稱
  TimeTables?: Array<{
    DepartureTime?: string
  }>
}


// ─── 靜態資料 ────────────────────────────────────────────────────────────────


const THSR_STATIONS = ['南港', '台北', '板橋', '桃園', '新竹', '苗栗', '台中', '彰化', '雲林', '嘉義', '台南', '左營']

const translateHsrStation = (st: string, lang: string) => {
  if (lang === 'zh-TW') return st;
  const hsrMap: Record<string, Record<string, string>> = {
    '南港': { en: 'Nangang', ja: '南港', ko: '난강' },
    '台北': { en: 'Taipei', ja: '台北', ko: '타이베이' },
    '板橋': { en: 'Banqiao', ja: '板橋', ko: '반차오' },
    '桃園': { en: 'Taoyuan', ja: '桃園', ko: '타오위안' },
    '新竹': { en: 'Hsinchu', ja: '新竹', ko: '신주' },
    '苗栗': { en: 'Miaoli', ja: '苗栗', ko: '먀오리' },
    '台中': { en: 'Taichung', ja: '台中', ko: '타이중' },
    '彰化': { en: 'Changhua', ja: '彰化', ko: '창화' },
    '雲林': { en: 'Yunlin', ja: '雲林', ko: '윈린' },
    '嘉義': { en: 'Chiayi', ja: '嘉義', ko: '자이' },
    '台南': { en: 'Tainan', ja: '台南', ko: '타이난' },
    '左營': { en: 'Zuoying (Kaohsiung)', ja: '左営 (高雄)', ko: '쭤잉 (가오슝)' },
  };
  return hsrMap[st]?.[lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'] || st;
}

// 高鐵車站 ID 對照（直接硬編碼，省去 Station API 呼叫）
const THSR_STATION_IDS: Record<string, string> = {
  '南港': '0990', '台北': '1000', '板橋': '1010', '桃園': '1020',
  '新竹': '1030', '苗栗': '1035', '台中': '1040', '彰化': '1043',
  '雲林': '1047', '嘉義': '1050', '台南': '1060', '左營': '1070',
}

const TRA_STATION_IDS: Record<string, string> = {}

const COUNTIES = [
  { id: 'Taipei', name: '台北市' },
  { id: 'NewTaipei', name: '新北市' },
  { id: 'Taichung', name: '台中市' },
  { id: 'Kaohsiung', name: '高雄市' },
  { id: 'Tainan', name: '台南市' },
]

const METRO_OPERATORS = [
  { id: 'TRTC', name: '台北捷運' },
  { id: 'NTMC', name: '新北捷運 (環狀線/輕軌)' },
  { id: 'TYMC', name: '桃園捷運' },
  { id: 'TMRT', name: '台中捷運' },
  { id: 'KRTC', name: '高雄捷運' },
]

// TDX LiveBoard 支援的捷運系統（不含 TMRT）
const LIVEBOARD_SUPPORTED = new Set(['TRTC', 'KRTC', 'TYMC', 'KLRT'])
// TDX StationTimeTable 支援的捷運系統（不含 TMRT）
const TIMETABLE_SUPPORTED = new Set(['TRTC', 'KRTC', 'TYMC', 'KLRT', 'NTDLRT', 'NTALRT', 'NTMC'])

// 捷運系統官方網站（用於不支援 TDX 查詢時的引導連結）
const METRO_OFFICIAL_URLS: Record<string, string> = {
  TRTC: 'https://www.metro.taipei/',
  NTMC: 'https://www.ntmetro.com.tw/',
  TYMC: 'https://www.tymetro.com.tw/',
  TMRT: 'https://www.tmrt.com.tw/',
  KRTC: 'https://www.krtc.com.tw/',
}


// 外部連結
const TDX_OFFICIAL_QUERY_URL = 'https://tdx.transportdata.tw/maas'
const TDX_SWAGGER_URL = 'https://tdx.transportdata.tw/api-service/swagger'

// TDX API 代理端點。若使用 Cloudflare Workers，可在 .env 中設定 VITE_TDX_PROXY_URL（如 https://xxxx.workers.dev，結尾不加斜線）
const TDX_PROXY_BASE = import.meta.env.VITE_TDX_PROXY_URL || '/api/tdx'

// ─── 工具函式 ────────────────────────────────────────────────────────────────

/** 正規化車站名稱（臺→台、去空格）*/
function normalizeStationName(name: string) {
  return name.replace(/^臺/, '台').replace(/\s/g, '')
}

/** 取得今日日期（台北時區，YYYY-MM-DD 格式）*/
function getTodayTaipei() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** 計算行程時間字串 */
function formatDuration(depTime: string, arrTime: string, lang: string = 'zh-TW') {
  const [depHour, depMin] = depTime.split(':').map(Number)
  const [arrHour, arrMin] = arrTime.split(':').map(Number)
  let minutes = arrHour * 60 + arrMin - (depHour * 60 + depMin)
  if (minutes < 0) minutes += 24 * 60
  
  const hr = Math.floor(minutes / 60)
  const min = minutes % 60
  if (lang === 'zh-TW') {
    return `${hr > 0 ? `${hr}小時` : ''}${min}分`
  }
  if (lang === 'ja') {
    return `${hr > 0 ? `${hr}時間` : ''}${min}分`
  }
  if (lang === 'ko') {
    return `${hr > 0 ? `${hr}시간 ` : ''}${min}분`
  }
  return `${hr > 0 ? `${hr}h ` : ''}${min}m`
}

/** 公車站牌到站狀態文字與樣式 */
function getBusStopStatus(eta?: TdxBusEta, lang: string = 'zh-TW') {
  const isZh = lang === 'zh-TW'
  const noData = isZh ? '暫無資料' : 'No Info'
  if (!eta) return { status: noData, className: 'status-offline' }
  if (eta.StopStatus !== undefined && eta.StopStatus !== 0) {
    const statusMap: Record<number, string> = isZh ? {
      1: '尚未發車', 2: '交管不停靠', 3: '末班已過', 4: '今日未營運',
    } : lang === 'ja' ? {
      1: '始発前', 2: '規制通過', 3: '終バス通過', 4: '本日運休',
    } : lang === 'ko' ? {
      1: '출발 전', 2: '교통통제 통과', 3: '막차 통과', 4: '오늘 미운행',
    } : {
      1: 'Not Started', 2: 'Detour', 3: 'Passed', 4: 'Not Operating Today',
    }
    return { status: statusMap[eta.StopStatus] ?? noData, className: 'status-offline' }
  }
  if (eta.EstimateTime === undefined) return { status: noData, className: 'status-offline' }
  const minutes = Math.ceil(eta.EstimateTime / 60)
  if (minutes <= 1) return { status: isZh ? '即將到站' : lang === 'ja' ? 'まもなく到着' : lang === 'ko' ? '곧 도착' : 'Approaching', className: 'status-approaching' }
  if (minutes <= 4) return { status: `${minutes} ${isZh ? '分鐘' : lang === 'ja' ? '分' : lang === 'ko' ? '분' : 'min'}`, className: 'status-soon' }
  return { status: `${minutes} ${isZh ? '分鐘' : lang === 'ja' ? '分' : lang === 'ko' ? '분' : 'min'}`, className: 'status-ok' }
}

/** 依高鐵車次判定車種（直達 vs 站站停） */
function getHsrTrainType(trainNo: string): string {
  const cleanNo = trainNo.replace(/^0/, '') // 去除前導 0
  // 如果是 3 位數且 1 開頭 (如 1xx) 或 4 位數且 11 開頭 (如 11xx)，則判定為直達車
  if (/^1\d{2}$|^11\d{2}$/.test(cleanNo)) {
    return '直達'
  }
  return '站站停'
}


// ─── 前端回應快取（記憶體 + TTL）──────────────────────────────────────────────
const tdxResponseCache = new Map<string, { data: unknown; expiry: number }>()

/** 根據 API 路徑決定前端快取 TTL（毫秒） */
function getFrontendCacheTtl(path: string): number {
  if (/\/Station\//.test(path))              return 24 * 60 * 60 * 1000 // 車站清單：24 小時
  if (/\/DailyTimetable\//.test(path))       return 10 * 60 * 1000      // 高鐵每日時刻：10 分鐘
  if (/\/StationTimeTable\//.test(path))     return 5 * 60 * 1000       // 捷運時刻表：5 分鐘
  if (/\/DisplayStopOfRoute\//.test(path))   return 5 * 60 * 1000       // 公車站牌：5 分鐘
  if (/\/Bus\/Route\//.test(path))           return 5 * 60 * 1000       // 公車路線：5 分鐘
  if (/\/LiveBoard\//.test(path))            return 20 * 1000           // 即時到站：20 秒
  if (/EstimatedTimeOfArrival/.test(path))   return 20 * 1000           // 公車 ETA：20 秒
  return 2 * 60 * 1000                                                  // 預設：2 分鐘
}

/**
 * 透過 Cloudflare Worker proxy 呼叫 TDX API。
 * 路徑格式：fetchTdx('/v2/Rail/THSR/Station') → GET {TDX_PROXY_BASE}/v2/Rail/THSR/Station
 * TRA 使用 v3；THSR / Bus 使用 v2。
 *
 * TDX API 使用 OData 格式，所有列表端點均回傳 { value: [...], Count: N }。
 * 此函式會自動偵測並解包，確保呼叫端永遠收到純陣列或原始物件。
 *
 * 特性：
 * - 前端記憶體快取（依 API 類型不同 TTL）
 * - AbortController 12 秒超時保護
 * - 429 自動重試 2 次（指數退避 1.5s → 3s）
 */
async function fetchTdx<T>(path: string, retryCount = 0): Promise<T> {
  // ── 前端快取命中檢查 ──
  const cacheKey = path
  const cached = tdxResponseCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T
  }

  // 加入 10 秒區間的 cache buster (_t) 以繞過 Cloudflare Worker KV 快取
  const t = Math.floor(Date.now() / 10000)
  const separator = path.includes('?') ? '&' : '?'
  const url = `${TDX_PROXY_BASE}${path}${separator}_t=${t}&$format=JSON`

  // ── AbortController 超時保護（12 秒）──
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      // 429 時前端自動等待後重試（最多 2 次，指數退避）
      if (response.status === 429 && retryCount < 2) {
        const waitMs = retryCount === 0 ? 1500 : 3000
        await new Promise((r) => setTimeout(r, waitMs))
        return fetchTdx<T>(path, retryCount + 1)
      }
      let msg = `TDX API 查詢失敗 (${response.status})`
      try {
        const errJson = await response.json() as { error?: string }
        if (errJson.error) msg = errJson.error
      } catch { /* ignore */ }
      throw new Error(msg)
    }

    const json = await response.json()
    // 自動解包 OData 回應格式：{ value: [...], Count: N } → [...]
    let result: T
    if (json && typeof json === 'object' && !Array.isArray(json) && Array.isArray((json as Record<string, unknown>).value)) {
      result = (json as Record<string, unknown>).value as T
    } else {
      result = json as T
    }

    // ── 寫入前端快取 ──
    const ttl = getFrontendCacheTtl(path)
    tdxResponseCache.set(cacheKey, { data: result, expiry: Date.now() + ttl })

    return result
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('查詢逾時，TDX 伺服器可能繁忙，請稍後再試')
    }
    throw err
  }
}

// 直接用硬編碼對照表取得車站 ID，不呼叫 Station API
function getStationId(type: 'THSR' | 'TRA', stationName: string): string | undefined {
  const normalized = normalizeStationName(stationName)
  const map = type === 'THSR' ? THSR_STATION_IDS : TRA_STATION_IDS
  return map[normalized]
}

// ─── 捷運車站快取（雙層）─────────────────────────────────────────────────────
// Level 1：記憶體快取（同一 session 最快，無需解析 JSON）
const metroStationCache: Record<string, TdxStation[]> = {}

// Level 2：localStorage 持久快取（24 小時 TTL，重新整理頁面也不會重打 API）
const STATION_LS_TTL_MS = 24 * 60 * 60 * 1000

function getStationFromLS(operator: string): TdxStation[] | null {
  try {
    const raw = localStorage.getItem(`metro_stations_${operator}`)
    if (!raw) return null
    const { data, expiry } = JSON.parse(raw) as { data: TdxStation[]; expiry: number }
    if (Date.now() > expiry) {
      localStorage.removeItem(`metro_stations_${operator}`)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setStationToLS(operator: string, stations: TdxStation[]) {
  try {
    localStorage.setItem(
      `metro_stations_${operator}`,
      JSON.stringify({ data: stations, expiry: Date.now() + STATION_LS_TTL_MS })
    )
  } catch {
    // localStorage 空間不足或不可用時靜默忽略
  }
}



export function TransitInfoBoard() {
  const { t, lang } = useTranslation()
  const [tdxActive, setTdxActive] = useState(false)
  const [selectedService, setSelectedService] = useState('trtc')
  const [statuses, setStatuses] = useState<Record<string, TransitStatusData>>({})
  const [loading, setLoading] = useState(false)

  // Tabs: 'status' | 'metro' | 'train' | 'bus'
  const [activeTab, setActiveTab] = useState<'status' | 'metro' | 'train' | 'bus'>('status')

  // 高鐵查詢
  const [originStation, setOriginStation] = useState('台北')
  const [destinationStation, setDestinationStation] = useState('左營')
  const [queryResults, setQueryResults] = useState<TrainQueryResult[]>([])
  const [isTrainSearching, setIsTrainSearching] = useState(false)
  const [trainError, setTrainError] = useState('')

  // 公車動態
  const [selectedCounty, setSelectedCounty] = useState('Taipei')
  const [busSearch, setBusSearch] = useState('307')
  const [busStops, setBusStops] = useState<BusStopInfo[]>([])
  const [isBusSearching, setIsBusSearching] = useState(false)
  const [busError, setBusError] = useState('')
  const [busDirection, setBusDirection] = useState<0 | 1>(0)
  const [busRouteDetails, setBusRouteDetails] = useState<{
    routeName: string
    startTerminal: string
    endTerminal: string
    stops: string[]
  } | null>(null)

  // 捷運時刻與看板查詢
  const [metroOperator, setMetroOperator] = useState('TRTC')
  const [metroStations, setMetroStations] = useState<TdxStation[]>([])
  const [selectedMetroStation, setSelectedMetroStation] = useState('')
  const [metroStationsLoading, setMetroStationsLoading] = useState(false)
  const [metroLiveBoard, setMetroLiveBoard] = useState<TdxMetroLiveBoard[]>([])
  const [metroTimetables, setMetroTimetables] = useState<TdxMetroStationTimeTable[]>([])
  const [metroQueryLoading, setMetroQueryLoading] = useState(false)
  const [metroQueryError, setMetroQueryError] = useState('')
  const [showAllMetroTimes, setShowAllMetroTimes] = useState(false)

  const isLiveBoardStale = useMemo(() => {
    if (metroLiveBoard.length === 0) return false
    const first = metroLiveBoard[0]
    const updateTimeStr = first.SrcUpdateTime || first.UpdateTime
    if (!updateTimeStr) return true
    try {
      const updateTime = new Date(updateTimeStr).getTime()
      const now = Date.now()
      return Math.abs(now - updateTime) > 5 * 60 * 1000
    } catch (e) {
      return true
    }
  }, [metroLiveBoard])

  const formatStaleTime = useCallback((timeStr?: string): string => {
    if (!timeStr) return ''
    try {
      const date = new Date(timeStr)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `最後更新：${month}/${day} ${hours}:${minutes}`
    } catch (e) {
      return ''
    }
  }, [])


  // 1. 讀取營運通阻狀態（transit-status.json，由 GitHub Actions 每小時更新）
  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}transit-status.json?t=${Date.now()}`,
        { cache: 'no-store' }
      )
      if (!response.ok) throw new Error('transit-status.json not found')
      const data = (await response.json()) as TransitPayload
      if (data?.statuses) setStatuses(data.statuses)
    } catch (e) {
      console.error('Failed to fetch transit status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchStatus, 0)
    const interval = setInterval(fetchStatus, 300_000)
    return () => { clearTimeout(timer); clearInterval(interval) }
  }, [fetchStatus])

  // 載入捷運車站清單（雙層快取：記憶體 → localStorage → TDX API）
  useEffect(() => {
    let active = true
    const loadStations = async () => {
      const cacheKey = `METRO_${metroOperator}`

      // 切換系統時立即清空舊車站資料，避免殘留上一個系統的車站
      setMetroStations([])
      setSelectedMetroStation('')
      setMetroQueryError('')
      setMetroLiveBoard([])
      setMetroTimetables([])

      // Level 1：記憶體快取（同 session 最快）
      if (metroStationCache[cacheKey]) {
        setMetroStations(metroStationCache[cacheKey])
        if (metroStationCache[cacheKey].length > 0) {
          setSelectedMetroStation(metroStationCache[cacheKey][0].StationID)
        }
        return
      }

      // Level 2：localStorage 快取（24h TTL，跨頁面重整有效）
      const lsCached = getStationFromLS(metroOperator)
      if (lsCached) {
        metroStationCache[cacheKey] = lsCached  // 同步回記憶體
        setMetroStations(lsCached)
        if (lsCached.length > 0) setSelectedMetroStation(lsCached[0].StationID)
        return
      }

      // Level 3：向 TDX API 請求（快取未命中才呼叫）
      setMetroStationsLoading(true)
      try {
        const data = await fetchTdx<TdxStation[]>(
          `/v2/Rail/Metro/Station/${metroOperator}?$select=StationID,StationName`
        )
        if (active) {
          const sorted = [...data].sort((a, b) => a.StationID.localeCompare(b.StationID))
          metroStationCache[cacheKey] = sorted  // 寫入記憶體快取
          setStationToLS(metroOperator, sorted)  // 寫入 localStorage 快取
          setMetroStations(sorted)
          if (sorted.length > 0) setSelectedMetroStation(sorted[0].StationID)
        }
      } catch (e) {
        console.error('Failed to load metro stations:', e)
        if (active) {
          setMetroQueryError(
            e instanceof Error
              ? `車站清單載入失敗：${e.message}`
              : '車站清單載入失敗，請稍後再試'
          )
        }
      } finally {
        if (active) setMetroStationsLoading(false)
      }
    }

    if (activeTab === 'metro') loadStations()
    return () => { active = false }
  }, [metroOperator, activeTab])


  // 查詢捷運即時看板與時刻表
  const queryMetroData = useCallback(async (operator: string, stationId: string) => {
    if (!stationId) return
    setMetroQueryLoading(true)
    setMetroQueryError('')

    // 檢查此捷運系統是否被 TDX API 支援
    const hasLiveBoard = LIVEBOARD_SUPPORTED.has(operator)
    const hasTimetable = TIMETABLE_SUPPORTED.has(operator)

    if (!hasLiveBoard && !hasTimetable) {
      // 此系統完全不支援查詢，直接設定提示訊息
      const opName = METRO_OPERATORS.find(o => o.id === operator)?.name ?? operator
      setMetroLiveBoard([])
      setMetroTimetables([])
      setMetroQueryError(`TDX 目前不提供「${opName}」的即時到站與時刻表資料，請前往官方網站查詢。`)
      setMetroQueryLoading(false)
      return
    }

    try {
      const [liveData, timetableData] = await Promise.all([
        hasLiveBoard
          ? fetchTdx<TdxMetroLiveBoard[]>(
              `/v2/Rail/Metro/LiveBoard/${operator}?$filter=StationID eq '${stationId}'`
            ).catch((err) => {
              console.error('LiveBoard error:', err)
              return []
            })
          : Promise.resolve([]),
        hasTimetable
          ? fetchTdx<TdxMetroStationTimeTable[]>(
              `/v2/Rail/Metro/StationTimeTable/${operator}?$filter=StationID eq '${stationId}'`
            ).catch((err) => {
              console.error('StationTimeTable error:', err)
              return []
            })
          : Promise.resolve([])
      ])
      setMetroLiveBoard(liveData)
      setMetroTimetables(timetableData)
    } catch (e) {
      console.error('Metro query error:', e)
      setMetroQueryError(e instanceof Error ? e.message : '查詢捷運時刻失敗，請稍後再試')
    } finally {
      setMetroQueryLoading(false)
    }
  }, [])

  // 捷運時刻表查詢：僅在使用者主動按下「重新整理即時資料」按鈕時才發起
  // 不自動觸發，避免切換 tab 時同時打多個 API 造成 429
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useEffect(() => { /* 保留 deps 追蹤，queryMetroData 由按鈕主動呼叫 */ }, [selectedMetroStation, metroOperator, activeTab, queryMetroData])

  // 取得台北時區的星期幾（英文名稱對應 ServiceDay 欄位）
  const getTodayDayOfWeek = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
    return days[date.getDay()]
  }

  // 取得台北時區的時間字串 (HH:MM)
  const getTaipeiTimeStr = () => {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  }

  // 過濾今日時刻表（捷運 API 不回傳終點站，改用方向分群）
  const getFilteredTimetables = () => {
    const todayDay = getTodayDayOfWeek()
    const todayTimetableList: Array<{ departureTime: string; direction: number }> = []

    metroTimetables.forEach((item) => {
      const serviceDay = item.ServiceDay as Record<string, boolean | number | undefined>
      // ServiceDay 欄位為布林值，需同時支援 true（布林）和 1（整數）
      const isServiceDay = serviceDay && (serviceDay[todayDay] === true || serviceDay[todayDay] === 1)
      if (isServiceDay) {
        const trainTimes = item.Timetables || item.TimeTables || []
        trainTimes.forEach((t) => {
          if (t.DepartureTime) {
            todayTimetableList.push({
              departureTime: t.DepartureTime.slice(0, 5),
              direction: item.Direction ?? 0,
            })
          }
        })
      }
    })

    todayTimetableList.sort((a, b) => a.departureTime.localeCompare(b.departureTime))

    // 以方向（去程/回程）分群
    const grouped: Record<string, string[]> = {}
    todayTimetableList.forEach((t) => {
      const dirLabel = t.direction === 0 ? '去程' : '回程'
      if (!grouped[dirLabel]) {
        grouped[dirLabel] = []
      }
      grouped[dirLabel].push(t.departureTime)
    })

    return grouped
  }


  // 取得當前服務的顯示資訊
  const getStatusDetails = () => {
    const serviceMap: Record<string, { name: string; icon: React.ReactNode; url: string }> = {
      trtc: { name: '台北捷運', icon: <TrainIcon size="1.2em" style={{ verticalAlign: 'middle' }} />, url: 'https://www.metro.taipei/' },
      krtc: { name: '高雄捷運', icon: <TrainIcon size="1.2em" style={{ verticalAlign: 'middle' }} />, url: 'https://www.krtc.com.tw/' },
      tmrt: { name: '台中捷運', icon: <TrainIcon size="1.2em" style={{ verticalAlign: 'middle' }} />, url: 'https://www.tmrt.com.tw/' },
      thsr: { name: '台灣高鐵', icon: <TrainIcon size="1.2em" style={{ verticalAlign: 'middle' }} />, url: 'https://www.thsrc.com.tw/' },
      tra:  { name: '台灣鐵路', icon: <TrainIcon size="1.2em" style={{ verticalAlign: 'middle' }} />, url: 'https://tip.railway.gov.tw/tra-tip-web/tip/tip007/tip711/blockList' },
    }
    const info = serviceMap[selectedService] ?? serviceMap.trtc
    const current = statuses[selectedService] ?? {
      name: info.name,
      status: '營運正常',
      detail: '無法連接即時伺服器取得資訊，請點擊下方按鈕前往官方網站查看最新營運通阻。',
      isNormal: true,
      updatedAt: '',
    }
    return { info, current }
  }

  const { info, current } = getStatusDetails()

  // 高鐵時刻查詢
  const handleTrainSearch = useCallback(async () => {
    setIsTrainSearching(true)
    setTdxActive(false)
    setTrainError('')
    setQueryResults([])
    try {
      const originId = getStationId('THSR', originStation)
      const destinationId = getStationId('THSR', destinationStation)
      if (!originId || !destinationId) throw new Error('找不到對應車站代碼，請換一個站名試試')

      const today = getTodayTaipei()
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

      const path = `/v2/Rail/THSR/DailyTimetable/OD/${originId}/to/${destinationId}/${today}?$top=150`
      const data = await fetchTdx<TdxThsrDailyTimetableItem[]>(path)
      const results = (Array.isArray(data) ? data : [])
        .flatMap((item): TrainQueryResult[] => {
          const depTime = item.OriginStopTime?.DepartureTime ?? item.OriginStopTime?.ArrivalTime
          const arrTime = item.DestinationStopTime?.ArrivalTime ?? item.DestinationStopTime?.DepartureTime
          if (!depTime || !arrTime) return []
          const depMinutes = Number(depTime.slice(0, 2)) * 60 + Number(depTime.slice(3, 5))
          const isDeparted = depMinutes < nowMinutes
          if (isDeparted) return [] // 排除已駛離的班次，僅保留即將進站/尚未出發的班次

          const trainNo = item.DailyTrainInfo?.TrainNo ?? '--'
          const trainType = getHsrTrainType(trainNo)

          return [{
            trainType,
            trainNo,
            depTime: depTime.slice(0, 5),
            arrTime: arrTime.slice(0, 5),
            duration: formatDuration(depTime, arrTime, lang),
            isExpress: trainType === '直達',
            status: '🟢',
          }]
        })

      // 依出發時間排序
      results.sort((a, b) => a.depTime.localeCompare(b.depTime))

      setQueryResults(results)
      setTdxActive(true)
      if (results.length === 0) {
        setTrainError(
          lang === 'zh-TW' 
            ? '今日該區間已無尚未出發的車次，請改查其他站點或前往官方查詢。' 
            : lang === 'en' 
              ? 'No more departures for this route today. Please check other routes or official site.' 
              : lang === 'ja' 
                ? '本日のこの区間の列車は終了しました。他の区間を検索するか公式サイトをご確認ください。' 
                : '오늘 이 구간의 남은 열차가 없습니다. 다른 구간을 조회하거나 공식 홈페이지를 확인하세요.'
        )
      }
    } catch (e) {
      console.error('Train search error:', e)
      setTrainError(
        e instanceof Error 
          ? e.message 
          : (lang === 'zh-TW' 
            ? '高鐵時刻查詢失敗，請稍後再試' 
            : lang === 'en' 
              ? 'Failed to query HSR timetable, please try again later.' 
              : lang === 'ja' 
                ? '新幹線の時刻表検索に失敗しました。後ほどもう一度お試しください。' 
                : '고속철도 시간표 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      )
    } finally {
      setIsTrainSearching(false)
    }
  }, [originStation, destinationStation])

  // 3. 公車動態查詢（依序查詢：route → stops → eta，避免同時 3 個 API 觸發 429）
  const handleBusSearch = useCallback(async (directionOverride?: number) => {
    const queryStr = busSearch.trim()
    if (!queryStr) return
    setIsBusSearching(true)
    setBusError('')
    const targetDirection = directionOverride !== undefined ? directionOverride : busDirection

    try {
      // 將全形數字/英文字母轉換為半形，避免使用者輸入全形字元導致 API 查無資料
      const cleanQuery = queryStr
        .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
      const routeName = encodeURIComponent(cleanQuery)

      // Route + StopOfRoute 平行查詢（互不依賴），ETA 串列（需路線名稱）
      const [routes, stopRoutes] = await Promise.all([
        fetchTdx<TdxBusRoute[]>(`/v2/Bus/Route/City/${selectedCounty}/${routeName}?$top=1`),
        fetchTdx<TdxBusStopOfRoute[]>(`/v2/Bus/DisplayStopOfRoute/City/${selectedCounty}/${routeName}`)
      ])
      const route = routes[0]
      if (!route) throw new Error('查無此公車路線，請確認路線號碼與縣市是否正確')

      const selectedStopRoute = stopRoutes.find((item) => item.Direction === targetDirection) ?? stopRoutes[0]
      const stopsToRender = selectedStopRoute?.Stops ?? []

      if (stopsToRender.length === 0) {
        throw new Error('查無此路線站牌資料，請確認路線號碼與縣市是否正確')
      }

      const etas = await fetchTdx<TdxBusEta[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${selectedCounty}/${routeName}`)

      const startTerminal = route.DepartureStopNameZh ?? stopsToRender[0]?.StopName?.Zh_tw ?? '起點'
      const endTerminal = route.DestinationStopNameZh ?? stopsToRender[stopsToRender.length - 1]?.StopName?.Zh_tw ?? '終點'
      const routeInfo = {
        routeName: route.RouteName?.Zh_tw ?? queryStr,
        startTerminal,
        endTerminal,
        stops: stopsToRender.map((s) => s.StopName?.Zh_tw ?? s.StopName?.En ?? '未命名站牌'),
      }
      setBusRouteDetails(routeInfo)

      const stops = routeInfo.stops.map((stop) => {
        const eta = etas.find(
          (item) =>
            item.Direction === targetDirection &&
            (item.StopName?.Zh_tw?.trim() === stop.trim())
        )
        const { status, className } = getBusStopStatus(eta, lang)
        return { name: stop, status, className }
      })

      setBusStops(stops)
      setTdxActive(true)
    } catch (e) {
      console.error('Bus search error:', e)
      setBusRouteDetails(null)
      setBusStops([])
      setBusError(e instanceof Error ? e.message : '公車動態查詢失敗，請稍後再試')
    } finally {
      setIsBusSearching(false)
    }
  }, [busSearch, selectedCounty, busDirection])

  const handleToggleBusDirection = () => {
    const next = busDirection === 0 ? 1 : 0
    setBusDirection(next)
    handleBusSearch(next)
  }

  // Tab 切換時不再自動觸發查詢（避免 useCallback 重建導致連鎖 429）
  // 使用者需自行按下查詢按鈕才會發起對 TDX 的呼叫

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <section className="transit-board" aria-label={t('transitTitle')}>
      {/* 標題與重整按鈕 */}
      <div className="section-row" style={{ marginBottom: '0.6rem' }}>
        <div className="section-title" style={{ padding: '0.2rem 0.5rem 0' }}>— {t('transitTitle')} —</div>
        {activeTab === 'status' && (
          <button
            className="refresh-events-btn"
            type="button"
            disabled={loading}
            onClick={fetchStatus}
          >
            {loading ? (
              lang === 'zh-TW' ? '讀取中' : 'Loading...'
            ) : (
              <>
                <RefreshIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '重新整理' : 'Refresh'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab 按鈕列 */}
      <div className="transit-tabs">
        {(['status', 'metro', 'train', 'bus'] as const).map((tab) => {
          const labels: Record<string, React.ReactNode> = {
            status: (
              <>
                <WarningIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '營運通阻' : lang === 'en' ? 'Status' : lang === 'ja' ? '運行状況' : '운행 상태'}
              </>
            ),
            metro: (
              <>
                <TrainIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '捷運時刻表' : lang === 'en' ? 'Metro' : lang === 'ja' ? 'メトロ' : '지하철'}
              </>
            ),
            train: (
              <>
                <TrainIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '高鐵動態' : lang === 'en' ? 'HSR' : lang === 'ja' ? '新幹線' : '고속철도'}
              </>
            ),
            bus: (
              <>
                <BusIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '公車動態' : lang === 'en' ? 'Bus' : lang === 'ja' ? 'バス' : '버스'}
              </>
            ),
          }
          const isDisabled = false
          return (
            <button
              key={tab}
              type="button"
              className={`transit-tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
              disabled={isDisabled}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* ── Tab 1：營運通阻 ── */}
      {activeTab === 'status' && (
        <div className="transit-tab-content">
          <div className="transit-selector-row" style={{ padding: 0 }}>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="transit-select"
            >
              <option value="trtc">{lang === 'zh-TW' ? '台北捷運' : lang === 'en' ? 'Taipei MRT' : lang === 'ja' ? '台北メトロ' : '타이베이 지하철'}</option>
              <option value="krtc">{lang === 'zh-TW' ? '高雄捷運' : lang === 'en' ? 'Kaohsiung MRT' : lang === 'ja' ? '高雄メトロ' : '가오슝 지하철'}</option>
              <option value="tmrt">{lang === 'zh-TW' ? '台中捷運' : lang === 'en' ? 'Taichung MRT' : lang === 'ja' ? '台中メトロ' : '타이중 지하철'}</option>
              <option value="thsr">{lang === 'zh-TW' ? '台灣高鐵' : lang === 'en' ? 'Taiwan HSR' : lang === 'ja' ? '台湾高鉄' : '대만 고속철도'}</option>
              <option value="tra">{lang === 'zh-TW' ? '台灣鐵路' : lang === 'en' ? 'Taiwan Railway' : lang === 'ja' ? '台湾鉄道' : '대만 철도'}</option>
            </select>
          </div>

          <div className="transit-card">
            <div className="transit-card-header">
              <div className="transit-service-name">
                <span className="transit-icon">{info.icon}</span>
                <span>{info.name}</span>
                {tdxActive ? (
                  <span className="transit-badge normal" style={{ marginLeft: '0.5rem' }}>{lang === 'zh-TW' ? '即時資料' : lang === 'en' ? 'Live Data' : lang === 'ja' ? 'リアルタイム情報' : '실시간 정보'}</span>
                ) : (
                  <span className="transit-badge warning" style={{ marginLeft: '0.5rem' }}>{lang === 'zh-TW' ? '靜態資料' : lang === 'en' ? 'Static Data' : lang === 'ja' ? '静的情報' : '정적 정보'}</span>
                )}
              </div>
              <div className={`transit-badge${current.isNormal ? ' normal' : ' warning'}${loading ? ' loading' : ''}`}>
                {current.status.replace(/[\uD800-\uDFFF\u2600-\u27BF🟢🔴🟡]/g, '').trim()}
              </div>
            </div>
            <p className="transit-detail">{current.detail}</p>
            {current.updatedAt && (
              <div className="transit-updated">
                {lang === 'zh-TW' ? '最後更新：' : lang === 'en' ? 'Last Update: ' : lang === 'ja' ? '最終更新：' : '최종 업데이트: '}{new Date(current.updatedAt).toLocaleTimeString(lang === 'zh-TW' ? 'zh-TW' : 'en-US')}
              </div>
            )}
            <a href={info.url} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
              {lang === 'zh-TW' ? '前往官方網站查看即時動態' : lang === 'en' ? 'Go to Official Website' : lang === 'ja' ? '公式サイトで詳細を確認' : '공식 웹사이트에서 확인'}
            </a>
          </div>
        </div>
      )}

      {/* ── Tab 2：捷運時刻與即時看板 ── */}
      {activeTab === 'metro' && (
        <div className="transit-tab-content">
          <div className="train-query-form">
            <div className="train-station-selects">
              <div className="station-select-group">
                <label>{lang === 'zh-TW' ? '捷運系統' : lang === 'en' ? 'Metro System' : lang === 'ja' ? '路線' : '노선'}</label>
                <select
                  value={metroOperator}
                  onChange={(e) => setMetroOperator(e.target.value)}
                  className="transit-select"
                >
                  {METRO_OPERATORS.map((op) => {
                    let opName = op.name
                    if (lang !== 'zh-TW') {
                      if (op.id === 'TRTC') opName = lang === 'en' ? 'Taipei MRT' : lang === 'ja' ? '台北メトロ' : '타이베이 지하철'
                      else if (op.id === 'KRTC') opName = lang === 'en' ? 'Kaohsiung MRT' : lang === 'ja' ? '高雄メトロ' : '가오슝 지하철'
                      else if (op.id === 'TYMC') opName = lang === 'en' ? 'Taoyuan MRT' : lang === 'ja' ? '桃園メトロ' : '타오위안 지하철'
                      else if (op.id === 'TMRT') opName = lang === 'en' ? 'Taichung MRT' : lang === 'ja' ? '台中メトロ' : '타이중 지하철'
                      else if (op.id === 'NTMC') opName = lang === 'en' ? 'LRT (Danhai/Ankeng)' : lang === 'ja' ? '淡海・安坑LRT' : '단하이/안컹 LRT'
                      else if (op.id === 'KLRT') opName = lang === 'en' ? 'Kaohsiung LRT' : lang === 'ja' ? '高雄LRT' : '가오슝 LRT'
                    }
                    return <option key={op.id} value={op.id}>{opName}</option>
                  })}
                </select>
              </div>
              <div className="station-select-group">
                <label>{lang === 'zh-TW' ? '選擇車站' : lang === 'en' ? 'Select Station' : lang === 'ja' ? '駅を選択' : '역 선택'}</label>
                <select
                  value={selectedMetroStation}
                  onChange={(e) => setSelectedMetroStation(e.target.value)}
                  className="transit-select"
                  disabled={metroStationsLoading || metroStations.length === 0}
                >
                  {metroStationsLoading ? (
                    <option>{lang === 'zh-TW' ? '讀取車站中...' : lang === 'en' ? 'Loading stations...' : lang === 'ja' ? '駅を読み込み中...' : '역 로딩 중...'}</option>
                  ) : metroStations.length === 0 ? (
                    <option>{lang === 'zh-TW' ? '無車站資料' : lang === 'en' ? 'No station data' : lang === 'ja' ? '駅データなし' : '역 데이터 없음'}</option>
                  ) : (
                    metroStations.map((st) => (
                      <option key={st.StationID} value={st.StationID}>
                        {st.StationID} - {lang === 'zh-TW' ? st.StationName.Zh_tw : (st.StationName.En || st.StationName.Zh_tw)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            
            <button
              type="button"
              className="bus-search-btn"
              onClick={() => queryMetroData(metroOperator, selectedMetroStation)}
              disabled={metroQueryLoading || !selectedMetroStation}
            >
              {metroQueryLoading ? (lang === 'zh-TW' ? '查詢中...' : lang === 'en' ? 'Searching...' : lang === 'ja' ? '検索中...' : '검색 중...') : (lang === 'zh-TW' ? '重新整理即時資料' : lang === 'en' ? 'Refresh Live Data' : lang === 'ja' ? 'リアルタイム情報を更新' : '실시간 정보 새로고침')}
            </button>
          </div>

          {/* 查詢結果區塊 */}
          <div className="metro-dynamic-results">
            {metroQueryLoading && metroLiveBoard.length === 0 && metroTimetables.length === 0 ? (
              <div className="bus-stops-loading" style={{ margin: '2rem 0' }}>
                {lang === 'zh-TW' ? '正在向 TDX 查詢捷運時刻與即時看板...' : lang === 'en' ? 'Querying MRT live board from TDX...' : lang === 'ja' ? 'TDXからメトロの運行状況を照会中...' : 'TDX에서 지하철 실시간 정보 조회 중...'}
              </div>
            ) : metroQueryError ? (
              <div className="bus-stops-empty">
                {metroQueryError}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(!LIVEBOARD_SUPPORTED.has(metroOperator) && !TIMETABLE_SUPPORTED.has(metroOperator)) ? (
                    <a
                      href={METRO_OFFICIAL_URLS[metroOperator] || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transit-link-btn"
                      style={{ flex: 'unset', width: 'auto' }}
                    >
                      {lang === 'zh-TW' ? '前往官方網站查詢 ↗' : lang === 'en' ? 'Go to Official Website ↗' : lang === 'ja' ? '公式サイトで調べる ↗' : '공식 홈페이지 조회 ↗'}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="transit-retry-btn"
                      onClick={() => queryMetroData(metroOperator, selectedMetroStation)}
                    >
                      <RefreshIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {lang === 'zh-TW' ? '重試' : lang === 'en' ? 'Retry' : lang === 'ja' ? '重試' : '재시도'}
                    </button>
                  )}
                </div>
              </div>
            ) : !selectedMetroStation ? (
              <div className="bus-stops-empty">{lang === 'zh-TW' ? '請選擇捷運系統與車站。' : lang === 'en' ? 'Please select a metro system and station.' : lang === 'ja' ? '路線と駅を選択してください。' : '지하철 노선과 역을 선택해 주세요.'}</div>
            ) : (
              <div className="metro-results-grid">
                
                {/* 1. 即時列車看板 */}
                <div className="metro-column">
                  <div className="metro-column-title">
                    <span className="live-pulse-dot"></span>
                    {lang === 'zh-TW' ? '即時到站看板' : lang === 'en' ? 'Live Board' : lang === 'ja' ? '発車案内板' : '실시간 열차 정보'}
                  </div>
                  <div className="metro-live-list">
                    {metroLiveBoard.length === 0 ? (
                      <div className="metro-no-data">
                        {metroOperator === 'TRTC'
                          ? (lang === 'zh-TW' ? '台北捷運不提供預估到站時間（系統限制），列車進站時才會顯示，請參考右側時刻表。' : lang === 'en' ? 'Taipei MRT does not support estimated arrival times due to API limitations. Please refer to the timetable on the right.' : lang === 'ja' ? '台北メトロはシステムの制限により到着予想時間を提供していません。右側の時刻表をご参照ください。' : '타이베이 지하철은 시스템 제한으로 인해 도착 예정 시간을 제공하지 않습니다. 오른쪽 시간표를 참고하세요.')
                          : (lang === 'zh-TW' ? '暫無即時到站資訊（可能非營運時間或該站點不支援）' : lang === 'en' ? 'No real-time arrival info (maybe outside operating hours or unsupported station)' : lang === 'ja' ? '現在、リアルタイム情報はありません（運行時間外、または未対応の可能性があります）' : '실시간 정보가 없습니다 (영업시간 외 또는 미지원 역)')}
                      </div>
                    ) : isLiveBoardStale ? (
                      <div className="metro-no-data warning-box" style={{ 
                        background: 'rgba(255, 107, 0, 0.1)', 
                        border: '1px solid rgba(255, 107, 0, 0.3)', 
                        color: 'var(--gold)',
                        padding: '12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        lineHeight: '1.4'
                      }}>
                        ⚠️ {(() => {
                          const staleTimeStr = formatStaleTime(metroLiveBoard[0].SrcUpdateTime || metroLiveBoard[0].UpdateTime)
                          return lang === 'zh-TW' 
                            ? `即時到站資訊已中斷更新（${staleTimeStr}）。系統目前無法取得最新列車位置，請參考時刻表。` 
                            : lang === 'en' 
                              ? `Live board updates interrupted (${staleTimeStr}). System cannot get train positions, please refer to timetable.` 
                              : lang === 'ja' 
                                ? `リアルタイム情報の更新が中断されました（${staleTimeStr}）。列車の現在位置を取得できません。時刻表を参照してください。` 
                                : `실시간 정보 업데이트가 중단되었습니다 (${staleTimeStr}). 열차 현재 위치를 가져올 수 없습니다. 시간표를 참고하세요.`
                        })()}
                      </div>
                    ) : (
                      [...metroLiveBoard]
                        .sort((a, b) => (a.EstimateTime ?? 9999) - (b.EstimateTime ?? 9999))
                        .map((train, idx) => {
                          const est = train.EstimateTime
                          let timeText = lang === 'zh-TW' ? '列車進站中' : lang === 'en' ? 'Approaching' : lang === 'ja' ? 'まもなく到着' : '열차 진입 중'
                          let badgeClass = 'approaching'
                          if (est !== undefined && est > 0) {
                            const isMinutes = metroOperator === 'KRTC' || metroOperator === 'TYMC' || metroOperator === 'KLRT'
                            const minutes = isMinutes ? est : Math.ceil(est / 60)
                            timeText = `${minutes} ${lang === 'zh-TW' ? '分鐘' : lang === 'en' ? 'min' : lang === 'ja' ? '分' : '분'}`
                            badgeClass = minutes <= 2 ? 'soon' : 'normal'
                          } else if (est === undefined || est < 0) {
                            timeText = lang === 'zh-TW' ? '已到站/即將發車' : lang === 'en' ? 'Arrived' : lang === 'ja' ? '到着済み/発車' : '도착함/출발 예정'
                            badgeClass = 'approaching'
                          }

                          const destName = lang === 'zh-TW' 
                            ? (train.DestinationStationName?.Zh_tw ?? '終點站') 
                            : (train.DestinationStationName?.En ?? train.DestinationStationName?.Zh_tw ?? 'Terminal')

                          return (
                            <div className="metro-live-item" key={idx}>
                              <div className="metro-live-destination">
                                {lang === 'ja' ? (
                                  <><strong>{destName}</strong> 行き</>
                                ) : (
                                  <>{lang === 'zh-TW' ? '往' : lang === 'en' ? 'To' : lang === 'ko' ? '행' : 'To'} <strong>{destName}</strong>{lang === 'ko' ? ' ' : ''}</>
                                )}
                              </div>
                              <span className={`metro-live-eta eta-${badgeClass}`}>
                                {timeText}
                              </span>
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>

                {/* 2. 今日時刻表 */}
                <div className="metro-column">
                  <div className="metro-column-title-row">
                    <div className="metro-column-title">{lang === 'zh-TW' ? '今日班表時刻表' : lang === 'en' ? 'Today Timetable' : lang === 'ja' ? '本日の時刻表' : '오늘 시간표'}</div>
                    <button
                      type="button"
                      className="metro-toggle-times-btn"
                      onClick={() => setShowAllMetroTimes(!showAllMetroTimes)}
                    >
                      {showAllMetroTimes ? (lang === 'zh-TW' ? '只顯示未發車' : lang === 'en' ? 'Hide Departed' : lang === 'ja' ? '未発車のみ表示' : '미출발 열차만 표시') : (lang === 'zh-TW' ? '顯示整天班表' : lang === 'en' ? 'Show Full Day' : lang === 'ja' ? '終日表示' : '전체 시간표 표시')}
                    </button>
                  </div>
                  
                  <div className="metro-timetables-wrapper">
                    {Object.keys(getFilteredTimetables()).length === 0 ? (
                      <div className="metro-no-data">{lang === 'zh-TW' ? '此車站今日無時刻表資料' : lang === 'en' ? 'No timetable data for today' : lang === 'ja' ? '本日の時刻表データはありません' : '오늘 시간표 데이터가 없습니다'}</div>
                    ) : (
                      Object.entries(getFilteredTimetables()).map(([dest, times]) => {
                        const nowTime = getTaipeiTimeStr()
                        const displayedTimes = showAllMetroTimes 
                          ? times 
                          : times.filter(t => t >= nowTime)

                        return (
                          <div className="metro-timetable-group" key={dest}>
                            <div className="metro-timetable-dest-header">
                              {lang === 'ja' ? (
                                <><strong>{dest}</strong> 行き</>
                              ) : (
                                <>{lang === 'zh-TW' ? '往' : lang === 'en' ? 'To' : lang === 'ko' ? '행' : 'To'} <strong>{dest}</strong>{lang === 'ko' ? ' ' : ''}</>
                              )}
                              <span className="metro-dest-count">({displayedTimes.length} {lang === 'zh-TW' ? '班次' : lang === 'en' ? 'trains' : lang === 'ja' ? '便' : '회'})</span>
                            </div>
                            <div className="metro-time-chips">
                              {displayedTimes.length === 0 ? (
                                <div className="metro-no-data-small">{lang === 'zh-TW' ? '今日後續無發車班次' : lang === 'en' ? 'No more trains today' : lang === 'ja' ? '本日の運行は終了しました' : '오늘 남은 열차가 없습니다'}</div>
                              ) : (
                                displayedTimes.map((time, tIdx) => {
                                  const isNext = time >= nowTime && times.filter(t => t >= nowTime)[0] === time
                                  return (
                                    <span 
                                      className={`metro-time-chip${isNext ? ' next-train' : ''}`} 
                                      key={tIdx}
                                      title={isNext ? (lang === 'zh-TW' ? '最接近的下一班車' : lang === 'en' ? 'Next Train' : lang === 'ja' ? '次の発車列車' : '가장 가까운 다음 열차') : undefined}
                                    >
                                      {time}
                                    </span>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3：高鐵動態 ── */}
      {activeTab === 'train' && (
        <div className="transit-tab-content">
          <div className="train-query-form">
            <div className="train-station-selects">
              <div className="station-select-group">
                <label>{lang === 'zh-TW' ? '起程站' : lang === 'en' ? 'Origin' : lang === 'ja' ? '乗車駅' : '출발역'}</label>
                <select value={originStation} onChange={(e) => setOriginStation(e.target.value)} className="transit-select">
                  {THSR_STATIONS.map((st) => (
                    <option key={st} value={st}>{translateHsrStation(st, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="station-select-group">
                <label>{lang === 'zh-TW' ? '到達站' : lang === 'en' ? 'Destination' : lang === 'ja' ? '降車駅' : '도착역'}</label>
                <select value={destinationStation} onChange={(e) => setDestinationStation(e.target.value)} className="transit-select">
                  {THSR_STATIONS
                    .filter((st) => st !== originStation)
                    .map((st) => (
                      <option key={st} value={st}>{translateHsrStation(st, lang)}</option>
                    ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="bus-search-btn"
              onClick={handleTrainSearch}
              disabled={isTrainSearching}
            >
              {isTrainSearching ? (lang === 'zh-TW' ? '查詢中...' : lang === 'en' ? 'Searching...' : lang === 'ja' ? '検索中...' : '검색 중...') : (lang === 'zh-TW' ? '查詢今日班表' : lang === 'en' ? 'Search Schedule' : lang === 'ja' ? '本日の時刻表を検索' : '오늘 시간표 검색')}
            </button>
          </div>

          {/* 雙鐵班表結果 */}
          <div className="train-results-board">
            <div className="train-board-header">
              <span>{lang === 'zh-TW' ? '車種' : lang === 'en' ? 'Type' : lang === 'ja' ? '列車種別' : '열차 종류'}</span>
              <span>{lang === 'zh-TW' ? '車次' : lang === 'en' ? 'Train No.' : lang === 'ja' ? '列車番号' : '열차 번호'}</span>
              <span>{lang === 'zh-TW' ? '出發' : lang === 'en' ? 'Departure' : lang === 'ja' ? '出発' : '출발'}</span>
              <span>{lang === 'zh-TW' ? '抵達' : lang === 'en' ? 'Arrival' : lang === 'ja' ? '到着' : '도착'}</span>
              <span>{lang === 'zh-TW' ? '行車時間 / 狀態' : lang === 'en' ? 'Duration / Status' : lang === 'ja' ? '所要時間 / 運行状況' : '소요 시간 / 상태'}</span>
            </div>
            <div className="train-board-rows">
              {isTrainSearching ? (
                <div className="bus-stops-loading">{lang === 'zh-TW' ? '正在向 TDX 查詢高鐵時刻...' : lang === 'en' ? 'Querying HSR timetables from TDX...' : lang === 'ja' ? 'TDXから新幹線の時刻表を照会中...' : 'TDX에서 고속철도 시간표 조회 중...'}</div>
              ) : trainError ? (
                <div className="bus-stops-empty">
                  {trainError}
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="transit-retry-btn"
                      onClick={handleTrainSearch}
                    >
                      <RefreshIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {lang === 'zh-TW' ? '重試' : lang === 'en' ? 'Retry' : lang === 'ja' ? '重試' : '재시도'}
                    </button>
                    <a href={TDX_OFFICIAL_QUERY_URL} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
                      {lang === 'zh-TW' ? '前往 TDX MaaS 查詢 ↗' : lang === 'en' ? 'Search TDX MaaS ↗' : lang === 'ja' ? 'TDX MaaSで検索 ↗' : 'TDX MaaS에서 검색 ↗'}
                    </a>
                  </div>
                </div>
              ) : queryResults.length === 0 ? (
                <div className="bus-stops-empty">{lang === 'zh-TW' ? '請選擇起訖站後按「查詢今日班表」。' : lang === 'en' ? 'Please select origin/destination and search.' : lang === 'ja' ? '乗車駅と降車駅を選択し、検索してください。' : '출발지와 도착지를 선택한 후 검색해 주세요.'}</div>
              ) : (
                queryResults.map((tr, idx) => (
                  <div className={`train-board-row${tr.isExpress ? ' express' : ''}`} key={idx}>
                    <span className={`train-type-badge type-${tr.trainType}`}>
                      {tr.trainType === '直達' 
                        ? (lang === 'zh-TW' ? '直達' : lang === 'en' ? 'Express' : lang === 'ja' ? '直行' : '직통') 
                        : (lang === 'zh-TW' ? '站站停' : lang === 'en' ? 'Local' : lang === 'ja' ? '各停' : '완행')}
                    </span>
                    <span className="train-no">{tr.trainNo}</span>
                    <span className="train-time-dep">{tr.depTime}</span>
                    <span className="train-time-arr">{tr.arrTime}</span>
                    <div className="train-dur-info">
                      <span className="train-dur">{tr.duration}</span>
                      <span className={`train-status-badge ${
                        tr.status.includes('🟢')
                          ? 'status-ontime'
                          : tr.status === '已駛離'
                            ? '' // 預設灰色樣式
                            : 'status-delayed'
                      }`}>
                        {tr.status === '已駛離' 
                          ? (lang === 'zh-TW' ? '已駛離' : lang === 'en' ? 'Departed' : lang === 'ja' ? '発車済み' : '출발함') 
                          : tr.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4：公車動態 ── */}
      {activeTab === 'bus' && (
        <div className="transit-tab-content">
          <div className="bus-query-form">
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="bus-county-select"
            >
              {COUNTIES.map((c) => {
                let countyName = c.name
                if (lang !== 'zh-TW') {
                  const countyEn: Record<string, string> = {
                    Taipei: 'Taipei City', NewTaipei: 'New Taipei City', Taichung: 'Taichung City',
                    Tainan: 'Tainan City', Kaohsiung: 'Kaohsiung City', Keelung: 'Keelung City',
                    Taoyuan: 'Taoyuan City', HsinchuCounty: 'Hsinchu County', HsinchuCity: 'Hsinchu City',
                    Miaoli: 'Miaoli County', Changhua: 'Changhua County', Nantou: 'Nantou County',
                    Yunlin: 'Yunlin County', ChiayiCounty: 'Chiayi County', ChiayiCity: 'Chiayi City',
                    Pingtung: 'Pingtung County', Yilan: 'Yilan County', Hualien: 'Hualien County',
                    Taitung: 'Taitung County', Penghu: 'Penghu County', Kinmen: 'Kinmen County', Lienchiang: 'Lienchiang County'
                  }
                  countyName = countyEn[c.id] || c.name
                }
                return <option key={c.id} value={c.id}>{countyName}</option>
              })}
            </select>
            <div className="bus-search-row">
              <input
                type="text"
                placeholder={lang === 'zh-TW' ? '搜尋公車路線 (如: 307)' : lang === 'en' ? 'Search route (e.g. 307)' : lang === 'ja' ? 'バス路線を検索 (例: 307)' : '버스 노선 검색 (예: 307)'}
                value={busSearch}
                onChange={(e) => setBusSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBusSearch()}
                className="bus-search-input"
              />
              <button
                type="button"
                className="bus-search-btn"
                onClick={() => { setBusDirection(0); handleBusSearch(0) }}
                disabled={isBusSearching}
              >
                {isBusSearching ? (lang === 'zh-TW' ? '查詢中...' : lang === 'en' ? 'Searching...' : lang === 'ja' ? '検索中...' : '검색 중...') : (lang === 'zh-TW' ? '查詢' : lang === 'en' ? 'Search' : lang === 'ja' ? '検索' : '검색')}
              </button>
            </div>
          </div>

          {/* 公車路線方向切換 */}
          {busRouteDetails && busStops.length > 0 && !isBusSearching && (
            <div className="bus-route-header-info">
              <div className="bus-route-title">
                <BusIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '路線' : lang === 'en' ? 'Route' : lang === 'ja' ? '路線' : '노선'} {busRouteDetails.routeName} ({busRouteDetails.startTerminal} ⇄ {busRouteDetails.endTerminal})
              </div>
              <div className="bus-direction-row">
                <span className="bus-direction-label">
                  {lang === 'ja' ? (
                    <><strong>{busDirection === 0 ? busRouteDetails.endTerminal : busRouteDetails.startTerminal}</strong> 行き</>
                  ) : (
                    <>{lang === 'zh-TW' ? '往' : lang === 'en' ? 'To' : lang === 'ko' ? '행' : 'To'} <strong>{busDirection === 0 ? busRouteDetails.endTerminal : busRouteDetails.startTerminal}</strong>{lang === 'ko' ? ' ' : ''}</>
                  )}
                </span>
                <button
                  type="button"
                  className="bus-direction-toggle-btn"
                  onClick={handleToggleBusDirection}
                >
                  <RefreshIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {lang === 'zh-TW' ? '切換方向' : lang === 'en' ? 'Change Direction' : lang === 'ja' ? '方面切替' : '방향 전환'}
                </button>
              </div>
            </div>
          )}

          {/* 站牌到站倒數 */}
          <div className="bus-stops-board">
            {isBusSearching ? (
              <div className="bus-stops-loading">{lang === 'zh-TW' ? '正在搜尋公車即時動態...' : lang === 'en' ? 'Searching for bus live ETA...' : lang === 'ja' ? 'バスの運行情報を検索中...' : '실시간 버스 정보 검색 중...'}</div>
            ) : busError ? (
              <div className="bus-stops-empty">
                {busError}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="transit-retry-btn"
                    onClick={() => { setBusDirection(0); handleBusSearch(0) }}
                  >
                    <RefreshIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {lang === 'zh-TW' ? '重試' : lang === 'en' ? 'Retry' : lang === 'ja' ? '重試' : '재시도'}
                  </button>
                  <a href={TDX_SWAGGER_URL} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
                    {lang === 'zh-TW' ? 'TDX API 文件 ↗' : 'TDX API Doc ↗'}
                  </a>
                </div>
              </div>
            ) : busStops.length === 0 ? (
              <div className="bus-stops-empty">{lang === 'zh-TW' ? '請輸入公車號碼進行查詢。' : lang === 'en' ? 'Please enter a bus route number to search.' : lang === 'ja' ? 'バスの路線番号を入力して検索してください。' : '버스 번호를 입력한 후 검색해 주세요.'}</div>
            ) : (
              <div className="bus-stops-list">
                {busStops.map((stop, index) => (
                  <div className="bus-stop-item" key={index}>
                    <span className={`bus-stop-eta ${stop.className}`}>{stop.status}</span>
                    <span className="bus-stop-name">{stop.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
