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

interface TdxTrainStopTime {
  StationID: string
  StationName?: { Zh_tw?: string; En?: string }
  ArrivalTime?: string
  DepartureTime?: string
}

interface TdxTrainTimetable {
  TrainInfo?: {
    TrainNo?: string
    TrainTypeName?: { Zh_tw?: string; En?: string }
  }
  StopTimes?: TdxTrainStopTime[]
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

// ─── 靜態資料 ────────────────────────────────────────────────────────────────

const METRO_LINE_DATA = {
  taipei: [
    { line: '板南線 (藍線)', peak: '2~3 分鐘', offpeak: '4~6 分鐘', first: '06:00', last: '00:00' },
    { line: '淡水信義線 (紅線)', peak: '3~4 分鐘', offpeak: '4~8 分鐘', first: '06:00', last: '00:00' },
    { line: '松山新店線 (綠線)', peak: '3~4 分鐘', offpeak: '5~7 分鐘', first: '06:00', last: '00:00' },
    { line: '中和新蘆線 (橘線)', peak: '3~4 分鐘', offpeak: '5~9 分鐘', first: '06:00', last: '00:00' },
    { line: '文湖線 (棕線)', peak: '2~4 分鐘', offpeak: '4~7 分鐘', first: '06:00', last: '00:00' },
    { line: '環狀線 (黃線)', peak: '4~6 分鐘', offpeak: '5~10 分鐘', first: '06:00', last: '00:00' },
  ],
  kaohsiung: [
    { line: '紅線 (R)', peak: '4~6 分鐘', offpeak: '8~10 分鐘', first: '05:55', last: '00:00' },
    { line: '橘線 (O)', peak: '4~6 分鐘', offpeak: '8~10 分鐘', first: '06:00', last: '00:00' },
    { line: '輕軌 (C)', peak: '10 分鐘', offpeak: '15 分鐘', first: '06:30', last: '22:00' },
  ],
  taichung: [
    { line: '綠線 (10)', peak: '5~8 分鐘', offpeak: '10 分鐘', first: '06:00', last: '00:00' },
  ],
}

const THSR_STATIONS = ['南港', '台北', '板橋', '桃園', '新竹', '苗栗', '台中', '彰化', '雲林', '嘉義', '台南', '左營']
const TRA_STATIONS = ['基隆', '七堵', '南港', '松山', '台北', '板橋', '樹林', '桃園', '中壢', '新竹', '竹南', '苗栗', '豐原', '台中', '彰化', '員林', '斗六', '嘉義', '新營', '台南', '岡山', '新左營', '高雄', '屏東', '宜蘭', '羅東', '花蓮', '玉里', '台東']

const COUNTIES = [
  { id: 'Taipei', name: '台北市' },
  { id: 'NewTaipei', name: '新北市' },
  { id: 'Taichung', name: '台中市' },
  { id: 'Kaohsiung', name: '高雄市' },
  { id: 'Tainan', name: '台南市' },
]

// 外部連結
const TDX_OFFICIAL_QUERY_URL = 'https://tdx.transportdata.tw/maas'
const TDX_SWAGGER_URL = 'https://tdx.transportdata.tw/api-service/swagger'
const TAIPEI_BUS_API_DOC_URL = 'https://pto.gov.taipei/News_Content.aspx?n=A1DF07A86105B6BB&s=55E8ADD164E4F579'

// Firebase Function proxy 端點（由 firebase.json rewrite /api/tdx/** → tdxProxy Function）
// 本地開發時透過 Vite proxy 轉發；部署後由 Firebase Hosting rewrite 處理
const TDX_PROXY_BASE = '/api/tdx'

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

/**
 * 透過 Firebase Function proxy 呼叫 TDX API。
 * 路徑格式：fetchTdx('/v2/Rail/THSR/Station') → GET /api/tdx/v2/Rail/THSR/Station
 * TRA 使用 v3；THSR / Bus 使用 v2。
 */
async function fetchTdx<T>(path: string): Promise<T> {
  // path 開頭已含版本號，例如 /v2/Rail/THSR/... 或 /v3/Rail/TRA/...
  const url = `${TDX_PROXY_BASE}${path}${path.includes('?') ? '&' : '?'}$format=JSON`
  const response = await fetch(url)
  if (!response.ok) {
    // 嘗試解析後端錯誤訊息
    let msg = `TDX 查詢失敗 (${response.status})`
    try {
      const errJson = await response.json() as { error?: string }
      if (errJson.error) msg = errJson.error
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return (await response.json()) as T
}

// 車站清單快取（同一個 session 內只查一次）
const stationCache: Partial<Record<'THSR' | 'TRA', TdxStation[]>> = {}

async function getTdxStations(type: 'THSR' | 'TRA') {
  if (stationCache[type]) return stationCache[type]!
  // THSR → v2，TRA → v2（車站清單 v2 仍有效）
  const stations = await fetchTdx<TdxStation[]>(
    `/v2/Rail/${type}/Station?$select=StationID,StationName`
  )
  stationCache[type] = stations
  return stations
}

function findStationId(stations: TdxStation[], stationName: string) {
  const target = normalizeStationName(stationName)
  return stations.find(
    (s) => normalizeStationName(s.StationName?.Zh_tw ?? '') === target
  )?.StationID
}

function getStopTime(timetable: TdxTrainTimetable, stationId: string) {
  return timetable.StopTimes?.find((stop) => stop.StationID === stationId)
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────

export function TransitInfoBoard() {
  const [tdxActive, setTdxActive] = useState(false)
  const [selectedService, setSelectedService] = useState('trtc')
  const [statuses, setStatuses] = useState<Record<string, TransitStatusData>>({})
  const [loading, setLoading] = useState(false)

  // Tabs: 'status' | 'metro' | 'train' | 'bus'
  const [activeTab, setActiveTab] = useState<'status' | 'metro' | 'train' | 'bus'>('status')

  // 雙鐵查詢
  const [trainType, setTrainType] = useState<'thsr' | 'tra'>('thsr')
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

  // 2. 雙鐵時刻查詢（透過 Firebase Function → TDX API）
  const handleTrainSearch = useCallback(async () => {
    setIsTrainSearching(true)
    setTdxActive(false)
    setTrainError('')
    setQueryResults([])
    try {
      const railType = trainType === 'thsr' ? 'THSR' : 'TRA'
      const stations = await getTdxStations(railType)
      const originId = findStationId(stations, originStation)
      const destinationId = findStationId(stations, destinationStation)
      if (!originId || !destinationId) throw new Error('找不到對應車站代碼，請換一個站名試試')

      const today = getTodayTaipei()

      // TRA 使用 v3 API；THSR 使用 v2 OD 時刻表
      const apiVersion = trainType === 'tra' ? 'v3' : 'v2'
      const path = `/${apiVersion}/Rail/${railType}/DailyTrainTimetable/OD/${originId}/to/${destinationId}/${today}?$top=20`
      const data = await fetchTdx<TdxTrainTimetable[]>(path)

      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
      const results = data
        .map((item) => {
          const originStop = getStopTime(item, originId)
          const destinationStop = getStopTime(item, destinationId)
          const depTime = originStop?.DepartureTime ?? originStop?.ArrivalTime
          const arrTime = destinationStop?.ArrivalTime ?? destinationStop?.DepartureTime
          if (!depTime || !arrTime) return null
          const depMinutes = Number(depTime.slice(0, 2)) * 60 + Number(depTime.slice(3, 5))
          const trainTypeName =
            item.TrainInfo?.TrainTypeName?.Zh_tw ?? (trainType === 'thsr' ? '高鐵' : '列車')
          return {
            trainType: trainTypeName,
            trainNo: item.TrainInfo?.TrainNo ?? '--',
            depTime: depTime.slice(0, 5),
            arrTime: arrTime.slice(0, 5),
            duration: formatDuration(depTime, arrTime),
            isExpress: !['區間', '區間車', '站站停'].some((t) => trainTypeName.includes(t)),
            status: depMinutes >= nowMinutes ? '🟢 今日班表' : '⚪ 已發車',
          } satisfies TrainQueryResult
        })
        .filter((item): item is TrainQueryResult => item !== null)
        .filter((item) => {
          const dep = Number(item.depTime.slice(0, 2)) * 60 + Number(item.depTime.slice(3, 5))
          return dep >= nowMinutes
        })
        .slice(0, 6)

      setQueryResults(results)
      setTdxActive(true)
      if (results.length === 0) {
        setTrainError('今日班表查無此區間接下來的班次，請改查其他站點或前往官方查詢。')
      }
    } catch (e) {
      console.error('Train search error:', e)
      setTrainError(e instanceof Error ? e.message : '雙鐵時刻查詢失敗，請稍後再試')
    } finally {
      setIsTrainSearching(false)
    }
  }, [trainType, originStation, destinationStation])

  // 3. 公車動態查詢（透過 Firebase Function → TDX API）
  const handleBusSearch = useCallback(async (directionOverride?: number) => {
    const queryStr = busSearch.trim()
    if (!queryStr) return
    setIsBusSearching(true)
    setBusError('')
    const targetDirection = directionOverride !== undefined ? directionOverride : busDirection

    try {
      const routeName = encodeURIComponent(queryStr)
      const [routes, stopRoutes, etas] = await Promise.all([
        fetchTdx<TdxBusRoute[]>(`/v2/Bus/Route/City/${selectedCounty}/${routeName}?$top=1`),
        fetchTdx<TdxBusStopOfRoute[]>(`/v2/Bus/DisplayStopOfRoute/City/${selectedCounty}/${routeName}`),
        fetchTdx<TdxBusEta[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${selectedCounty}/${routeName}`),
      ])

      const route = routes[0]
      const selectedStopRoute = stopRoutes.find((item) => item.Direction === targetDirection) ?? stopRoutes[0]
      const stopsToRender = selectedStopRoute?.Stops ?? []

      if (!route || stopsToRender.length === 0) {
        throw new Error('查無此公車路線或站牌資料，請確認路線號碼與縣市是否正確')
      }

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
        // 加入 trim() 比對避免全形空格造成 miss
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

  // Tab 切換時自動觸發查詢
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'train') handleTrainSearch()
      else if (activeTab === 'bus') handleBusSearch()
    }, 0)
    return () => clearTimeout(timer)
  }, [activeTab, handleTrainSearch, handleBusSearch])

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
                捷運班距
              </>
            ),
            train: (
              <>
                <TrainIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                雙鐵動態 (開發中)
              </>
            ),
            bus: (
              <>
                <BusIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                公車動態 (開發中)
              </>
            ),
          }
          const isDisabled = tab === 'train' || tab === 'bus'
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

      {/* ── Tab 2：捷運班距 ── */}
      {activeTab === 'metro' && (
        <div className="transit-tab-content">
          <div className="metro-headway-wrapper">
            {([
              { title: '台北捷運 班距時程', data: METRO_LINE_DATA.taipei },
              { title: '高雄捷運 班距時程', data: METRO_LINE_DATA.kaohsiung },
              { title: '台中捷運 班距時程', data: METRO_LINE_DATA.taichung },
            ] as const).map(({ title, data }, i) => (
              <div key={i}>
                <div className="metro-sub-title" style={i > 0 ? { marginTop: '1.2rem' } : {}}>
                  <TrainIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  {title}
                </div>
                <div className="metro-freq-table">
                  {data.map((m) => (
                    <div className="metro-freq-row" key={m.line}>
                      <div className="metro-line-name">{m.line}</div>
                      <div className="metro-freq-details">
                        <span>尖峰: <strong>{m.peak}</strong></span>
                        <span>離峰: <strong>{m.offpeak}</strong></span>
                        <span>首尾班: <strong>{m.first}~{m.last}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 3：雙鐵時刻 ── */}
      {activeTab === 'train' && (
        <div className="transit-tab-content">
          <div className="train-query-form">
            <div className="train-type-row">
              <button
                type="button"
                className={`train-type-btn${trainType === 'thsr' ? ' active' : ''}`}
                onClick={() => { setTrainType('thsr'); setOriginStation('台北'); setDestinationStation('左營') }}
              >
                高鐵時刻表
              </button>
              <button
                type="button"
                className={`train-type-btn${trainType === 'tra' ? ' active' : ''}`}
                onClick={() => { setTrainType('tra'); setOriginStation('台北'); setDestinationStation('台中') }}
              >
                台鐵時刻表
              </button>
            </div>
            <div className="train-station-selects">
              <div className="station-select-group">
                <label>起程站</label>
                <select value={originStation} onChange={(e) => setOriginStation(e.target.value)} className="transit-select">
                  {(trainType === 'thsr' ? THSR_STATIONS : TRA_STATIONS).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div className="station-select-group">
                <label>到達站</label>
                <select value={destinationStation} onChange={(e) => setDestinationStation(e.target.value)} className="transit-select">
                  {(trainType === 'thsr' ? THSR_STATIONS : TRA_STATIONS)
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
                <div className="bus-stops-loading">正在向 TDX 查詢雙鐵時刻...</div>
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
                      <span className={`train-status-badge ${tr.status.includes('今日') ? 'status-ontime' : 'status-delayed'}`}>
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
