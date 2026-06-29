import { useState, useEffect, useCallback } from 'react'
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


// 外部連結
const TDX_OFFICIAL_QUERY_URL = 'https://tdx.transportdata.tw/maas'
const TDX_SWAGGER_URL = 'https://tdx.transportdata.tw/api-service/swagger'
const TAIPEI_BUS_API_DOC_URL = 'https://pto.gov.taipei/News_Content.aspx?n=A1DF07A86105B6BB&s=55E8ADD164E4F579'

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
function formatDuration(depTime: string, arrTime: string) {
  const [depHour, depMin] = depTime.split(':').map(Number)
  const [arrHour, arrMin] = arrTime.split(':').map(Number)
  let minutes = arrHour * 60 + arrMin - (depHour * 60 + depMin)
  if (minutes < 0) minutes += 24 * 60
  return `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}小時` : ''}${minutes % 60}分`
}

/** 公車站牌到站狀態文字與樣式 */
function getBusStopStatus(eta?: TdxBusEta) {
  if (!eta) return { status: '暫無資料', className: 'status-offline' }
  if (eta.StopStatus !== undefined && eta.StopStatus !== 0) {
    const statusMap: Record<number, string> = {
      1: '尚未發車', 2: '交管不停靠', 3: '末班已過', 4: '今日未營運',
    }
    return { status: statusMap[eta.StopStatus] ?? '暫無資料', className: 'status-offline' }
  }
  if (eta.EstimateTime === undefined) return { status: '暫無資料', className: 'status-offline' }
  const minutes = Math.ceil(eta.EstimateTime / 60)
  if (minutes <= 1) return { status: '即將到站', className: 'status-approaching' }
  if (minutes <= 4) return { status: `${minutes} 分鐘`, className: 'status-soon' }
  return { status: `${minutes} 分鐘`, className: 'status-ok' }
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


/**
 * 透過 Cloudflare Worker proxy 呼叫 TDX API。
 * 路徑格式：fetchTdx('/v2/Rail/THSR/Station') → GET {TDX_PROXY_BASE}/v2/Rail/THSR/Station
 * TRA 使用 v3；THSR / Bus 使用 v2。
 *
 * TDX API 使用 OData 格式，所有列表端點均回傳 { value: [...], Count: N }。
 * 此函式會自動偵測並解包，確保呼叫端永遠收到純陣列或原始物件。
 * 遇到 429 時會自動等待 1.2 秒後重試一次。
 */
async function fetchTdx<T>(path: string, retryCount = 0): Promise<T> {
  // 加入 10 秒區間的 cache buster (_t) 以繞過 Cloudflare Worker 代理端長效快取（解決先前快取被空陣列或異常污染的問題）
  const t = Math.floor(Date.now() / 10000)
  const separator = path.includes('?') ? '&' : '?'
  const url = `${TDX_PROXY_BASE}${path}${separator}_t=${t}&$format=JSON`
  const response = await fetch(url)
  if (!response.ok) {
    // 429 時前端自動等待後重試一次（Worker 也有 retry，此為雙重保險）
    if (response.status === 429 && retryCount < 1) {
      await new Promise((r) => setTimeout(r, 1200))
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
  if (json && typeof json === 'object' && !Array.isArray(json) && Array.isArray((json as Record<string, unknown>).value)) {
    return (json as Record<string, unknown>).value as T
  }
  return json as T
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
    try {
      const [liveData, timetableData] = await Promise.all([
        fetchTdx<TdxMetroLiveBoard[]>(
          `/v2/Rail/Metro/LiveBoard/${operator}?$filter=StationID eq '${stationId}'`
        ).catch((err) => {
          console.error('LiveBoard error:', err)
          return []
        }),
        fetchTdx<TdxMetroStationTimeTable[]>(
          `/v2/Rail/Metro/StationTimeTable/${operator}?$filter=StationID eq '${stationId}'`
        ).catch((err) => {
          console.error('StationTimeTable error:', err)
          return []
        })
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
          const trainNo = item.DailyTrainInfo?.TrainNo ?? '--'
          const trainType = getHsrTrainType(trainNo)

          return [{
            trainType,
            trainNo,
            depTime: depTime.slice(0, 5),
            arrTime: arrTime.slice(0, 5),
            duration: formatDuration(depTime, arrTime),
            isExpress: trainType === '直達',
            status: isDeparted ? '已駛離' : '🟢',
          }]
        })

      // 依出發時間排序
      results.sort((a, b) => a.depTime.localeCompare(b.depTime))

      setQueryResults(results)
      setTdxActive(true)
      if (results.length === 0) {
        setTrainError('今日班表查無此區間的班次，請改查其他站點或前往官方查詢。')
      }
    } catch (e) {
      console.error('Train search error:', e)
      setTrainError(e instanceof Error ? e.message : '高鐵時刻查詢失敗，請稍後再試')
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

      // 依序查詢，避免同時打 3 個 request 在 Worker 冷啟動時競爭 token 觸發 429
      const routes = await fetchTdx<TdxBusRoute[]>(`/v2/Bus/Route/City/${selectedCounty}/${routeName}?$top=1`)
      const route = routes[0]
      if (!route) throw new Error('查無此公車路線，請確認路線號碼與縣市是否正確')

      const stopRoutes = await fetchTdx<TdxBusStopOfRoute[]>(`/v2/Bus/DisplayStopOfRoute/City/${selectedCounty}/${routeName}`)
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
        const { status, className } = getBusStopStatus(eta)
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
    <section className="transit-board" aria-label="大眾運輸即時動態">
      {/* 標題與重整按鈕 */}
      <div className="section-row" style={{ marginBottom: '0.6rem' }}>
        <div className="section-title" style={{ padding: '0.2rem 0.5rem 0' }}>— 交通即時動態 —</div>
        {activeTab === 'status' && (
          <button
            className="refresh-events-btn"
            type="button"
            disabled={loading}
            onClick={fetchStatus}
          >
            {loading ? (
              '讀取中'
            ) : (
              <>
                <RefreshIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                重新整理
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
                營運通阻
              </>
            ),
            metro: (
              <>
                <TrainIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                捷運時刻表
              </>
            ),
            train: (
              <>
                <TrainIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                高鐵動態
              </>
            ),
            bus: (
              <>
                <BusIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                公車動態
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
              <option value="trtc">台北捷運</option>
              <option value="krtc">高雄捷運</option>
              <option value="tmrt">台中捷運</option>
              <option value="thsr">台灣高鐵</option>
              <option value="tra">台灣鐵路</option>
            </select>
          </div>

          <div className="transit-card">
            <div className="transit-card-header">
              <div className="transit-service-name">
                <span className="transit-icon">{info.icon}</span>
                <span>{info.name}</span>
                {tdxActive ? (
                  <span className="transit-badge normal" style={{ marginLeft: '0.5rem' }}>即時資料</span>
                ) : (
                  <span className="transit-badge warning" style={{ marginLeft: '0.5rem' }}>靜態資料</span>
                )}
              </div>
              <div className={`transit-badge${current.isNormal ? ' normal' : ' warning'}${loading ? ' loading' : ''}`}>
                {current.status.replace(/[\uD800-\uDFFF\u2600-\u27BF🟢🔴🟡]/g, '').trim()}
              </div>
            </div>
            <p className="transit-detail">{current.detail}</p>
            {current.updatedAt && (
              <div className="transit-updated">
                最後更新：{new Date(current.updatedAt).toLocaleTimeString('zh-TW')}
              </div>
            )}
            <a href={info.url} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
              前往官方網站查看即時動態
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
                <label>捷運系統</label>
                <select
                  value={metroOperator}
                  onChange={(e) => setMetroOperator(e.target.value)}
                  className="transit-select"
                >
                  {METRO_OPERATORS.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
              <div className="station-select-group">
                <label>選擇車站</label>
                <select
                  value={selectedMetroStation}
                  onChange={(e) => setSelectedMetroStation(e.target.value)}
                  className="transit-select"
                  disabled={metroStationsLoading || metroStations.length === 0}
                >
                  {metroStationsLoading ? (
                    <option>讀取車站中...</option>
                  ) : metroStations.length === 0 ? (
                    <option>無車站資料</option>
                  ) : (
                    metroStations.map((st) => (
                      <option key={st.StationID} value={st.StationID}>
                        {st.StationID} - {st.StationName.Zh_tw}
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
              {metroQueryLoading ? '查詢中...' : '重新整理即時資料'}
            </button>
          </div>

          {/* 查詢結果區塊 */}
          <div className="metro-dynamic-results">
            {metroQueryLoading && metroLiveBoard.length === 0 && metroTimetables.length === 0 ? (
              <div className="bus-stops-loading" style={{ margin: '2rem 0' }}>
                正在向 TDX 查詢捷運時刻與即時看板...
              </div>
            ) : metroQueryError ? (
              <div className="bus-stops-empty">
                {metroQueryError}
              </div>
            ) : !selectedMetroStation ? (
              <div className="bus-stops-empty">請選擇捷運系統與車站。</div>
            ) : (
              <div className="metro-results-grid">
                
                {/* 1. 即時列車看板 */}
                <div className="metro-column">
                  <div className="metro-column-title">
                    <span className="live-pulse-dot"></span>
                    即時到站看板
                  </div>
                  <div className="metro-live-list">
                    {metroLiveBoard.length === 0 ? (
                      <div className="metro-no-data">
                        {metroOperator === 'TRTC'
                          ? '台北捷運不提供預估到站時間（系統限制），列車進站時才會顯示，請參考右側時刻表。'
                          : '暫無即時到站資訊（可能非營運時間或該站點不支援）'}
                      </div>
                    ) : (
                      [...metroLiveBoard]
                        .sort((a, b) => (a.EstimateTime ?? 9999) - (b.EstimateTime ?? 9999))
                        .map((train, idx) => {
                          const est = train.EstimateTime
                          let timeText = '列車進站中'
                          let badgeClass = 'approaching'
                          if (est !== undefined && est > 0) {
                            // 判斷單位：高雄捷運 (KRTC)、桃園捷運 (TYMC) 與高雄輕軌 (KLRT) 回傳的 EstimateTime 單位為「分鐘」；其餘系統為「秒」
                            const isMinutes = metroOperator === 'KRTC' || metroOperator === 'TYMC' || metroOperator === 'KLRT'
                            const minutes = isMinutes ? est : Math.ceil(est / 60)
                            timeText = `${minutes} 分鐘`
                            badgeClass = minutes <= 2 ? 'soon' : 'normal'
                          } else if (est === undefined || est < 0) {
                            timeText = '已到站/即將發車'
                            badgeClass = 'approaching'
                          }

                          return (
                            <div className="metro-live-item" key={idx}>
                              <div className="metro-live-destination">
                                往 <strong>{train.DestinationStationName?.Zh_tw ?? '終點站'}</strong>
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
                    <div className="metro-column-title">今日班表時刻表</div>
                    <button
                      type="button"
                      className="metro-toggle-times-btn"
                      onClick={() => setShowAllMetroTimes(!showAllMetroTimes)}
                    >
                      {showAllMetroTimes ? '只顯示未發車' : '顯示整天班表'}
                    </button>
                  </div>
                  
                  <div className="metro-timetables-wrapper">
                    {Object.keys(getFilteredTimetables()).length === 0 ? (
                      <div className="metro-no-data">此車站今日無時刻表資料</div>
                    ) : (
                      Object.entries(getFilteredTimetables()).map(([dest, times]) => {
                        const nowTime = getTaipeiTimeStr()
                        const displayedTimes = showAllMetroTimes 
                          ? times 
                          : times.filter(t => t >= nowTime)

                        return (
                          <div className="metro-timetable-group" key={dest}>
                            <div className="metro-timetable-dest-header">
                              往 <strong>{dest}</strong>
                              <span className="metro-dest-count">({displayedTimes.length} 班次)</span>
                            </div>
                            <div className="metro-time-chips">
                              {displayedTimes.length === 0 ? (
                                <div className="metro-no-data-small">今日後續無發車班次</div>
                              ) : (
                                displayedTimes.map((time, tIdx) => {
                                  const isNext = time >= nowTime && times.filter(t => t >= nowTime)[0] === time
                                  return (
                                    <span 
                                      className={`metro-time-chip${isNext ? ' next-train' : ''}`} 
                                      key={tIdx}
                                      title={isNext ? '最接近的下一班車' : undefined}
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
                <label>起程站</label>
                <select value={originStation} onChange={(e) => setOriginStation(e.target.value)} className="transit-select">
                  {THSR_STATIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div className="station-select-group">
                <label>到達站</label>
                <select value={destinationStation} onChange={(e) => setDestinationStation(e.target.value)} className="transit-select">
                  {THSR_STATIONS
                    .filter((st) => st !== originStation)
                    .map((st) => (
                      <option key={st} value={st}>{st}</option>
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
              {isTrainSearching ? '查詢中...' : '查詢今日班表'}
            </button>
          </div>

          {/* 雙鐵班表結果 */}
          <div className="train-results-board">
            <div className="train-board-header">
              <span>車種</span>
              <span>車次</span>
              <span>出發</span>
              <span>抵達</span>
              <span>行車時間 / 狀態</span>
            </div>
            <div className="train-board-rows">
              {isTrainSearching ? (
                <div className="bus-stops-loading">正在向 TDX 查詢高鐵時刻...</div>
              ) : trainError ? (
                <div className="bus-stops-empty">
                  {trainError}
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={TDX_OFFICIAL_QUERY_URL} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
                      前往 TDX MaaS 查詢 ↗
                    </a>
                  </div>
                </div>
              ) : queryResults.length === 0 ? (
                <div className="bus-stops-empty">請選擇起訖站後按「查詢今日班表」。</div>
              ) : (
                queryResults.map((tr, idx) => (
                  <div className={`train-board-row${tr.isExpress ? ' express' : ''}`} key={idx}>
                    <span className={`train-type-badge type-${tr.trainType}`}>{tr.trainType}</span>
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
                        {tr.status}
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
              {COUNTIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="bus-search-row">
              <input
                type="text"
                placeholder="搜尋公車路線 (如: 307)"
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
                {isBusSearching ? '查詢中...' : '查詢'}
              </button>
            </div>
          </div>

          {/* 公車路線方向切換 */}
          {busRouteDetails && busStops.length > 0 && !isBusSearching && (
            <div className="bus-route-header-info">
              <div className="bus-route-title">
                <BusIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                路線 {busRouteDetails.routeName} ({busRouteDetails.startTerminal} ⇄ {busRouteDetails.endTerminal})
              </div>
              <div className="bus-direction-row">
                <span className="bus-direction-label">
                  往 <strong>{busDirection === 0 ? busRouteDetails.endTerminal : busRouteDetails.startTerminal}</strong>
                </span>
                <button
                  type="button"
                  className="bus-direction-toggle-btn"
                  onClick={handleToggleBusDirection}
                >
                  <RefreshIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  切換方向
                </button>
              </div>
            </div>
          )}

          {/* 站牌到站倒數 */}
          <div className="bus-stops-board">
            {isBusSearching ? (
              <div className="bus-stops-loading">正在搜尋公車即時動態...</div>
            ) : busError ? (
              <div className="bus-stops-empty">
                {busError}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a href={TDX_SWAGGER_URL} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
                    TDX API 文件 ↗
                  </a>
                  <a href={TAIPEI_BUS_API_DOC_URL} target="_blank" rel="noopener noreferrer" className="transit-link-btn">
                    台北市公車 API 文件 ↗
                  </a>
                </div>
              </div>
            ) : busStops.length === 0 ? (
              <div className="bus-stops-empty">請輸入公車號碼進行查詢。</div>
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
