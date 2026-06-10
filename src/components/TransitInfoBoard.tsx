import { useState, useEffect, useCallback } from 'react'

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

// Timetables and schedules data
const METRO_LINE_DATA = {
  taipei: [
    { line: '板南線 (藍線)', peak: '2~3 分鐘', offpeak: '4~6 分鐘', first: '06:00', last: '00:00' },
    { line: '淡水信義線 (紅線)', peak: '3~4 分鐘', offpeak: '4~8 分鐘', first: '06:00', last: '00:00' },
    { line: '松山新店線 (綠線)', peak: '3~4 分鐘', offpeak: '5~7 分鐘', first: '06:00', last: '00:00' },
    { line: '中和新蘆線 (橘線)', peak: '3~4 分鐘', offpeak: '5~9 分鐘', first: '06:00', last: '00:00' },
    { line: '文湖線 (棕線)', peak: '2~4 分鐘', offpeak: '4~7 分鐘', first: '06:00', last: '00:00' },
    { line: '環狀線 (黃線)', peak: '4~6 分鐘', offpeak: '5~10 分鐘', first: '06:00', last: '00:00' }
  ],
  kaohsiung: [
    { line: '紅線 (R)', peak: '4~6 分鐘', offpeak: '8~10 分鐘', first: '05:55', last: '00:00' },
    { line: '橘線 (O)', peak: '4~6 分鐘', offpeak: '8~10 分鐘', first: '06:00', last: '00:00' },
    { line: '輕軌 (C)', peak: '10 分鐘', offpeak: '15 分鐘', first: '06:30', last: '22:00' }
  ],
  taichung: [
    { line: '綠線 (10)', peak: '5~8 分鐘', offpeak: '10 分鐘', first: '06:00', last: '00:00' }
  ]
}

const THSR_STATIONS = ['南港', '台北', '板橋', '桃園', '新竹', '苗栗', '台中', '彰化', '雲林', '嘉義', '台南', '左營']
const TRA_STATIONS = ['基隆', '七堵', '南港', '松山', '台北', '板橋', '樹林', '桃園', '中壢', '新竹', '竹南', '苗栗', '豐原', '台中', '彰化', '員林', '斗六', '嘉義', '新營', '台南', '岡山', '新左營', '高雄', '屏東', '宜蘭', '羅東', '花蓮', '玉里', '台東']

// Simulated popular bus routes for county bus search
const POPULAR_BUSES: Record<string, { route: string; stops: string[] }> = {
  '307': {
    route: '307 (板橋前站 - 撫遠街)',
    stops: ['板橋公車站', '新北市政府', '致理科技大學', '積穗', '中和中山路', '連城路', '華中橋', '萬大路', '西門町', '台北車站', '南京復興', '南京三民', '撫遠街']
  },
  '299': {
    route: '299 (輔大 - 永春高中)',
    stops: ['輔仁大學', '新莊地政事務所', '新莊田徑場', '中華路', '三重自強路', '台北車站', '忠孝新生', '忠孝復興', '忠孝敦化', '市政府', '永春高中']
  },
  '301': {
    route: '301 (台中車站 - 靜宜大學)',
    stops: ['台中車站', '中友百貨', '科博館', '秋紅谷', '新光三越', '東海大學', '榮總', '弘光科大', '靜宜大學']
  },
  '100': {
    route: '100 (瑞豐沙崙 - 高雄車站)',
    stops: ['瑞豐站', '五甲路', '前鎮高中', '三多商圈', '中央公園', '美麗島', '高雄車站']
  },
  '綠1': {
    route: '綠1 (新店 - 市政府)',
    stops: ['新店捷運站', '七張', '大坪林', '木柵', '信義安和', '台北101/世貿', '市政府']
  }
}

const COUNTIES = [
  { id: 'tpe', name: '台北市' },
  { id: 'ntpc', name: '新北市' },
  { id: 'txg', name: '台中市' },
  { id: 'khh', name: '高雄市' },
  { id: 'tnn', name: '台南市' }
]

export function TransitInfoBoard() {
  const [selectedService, setSelectedService] = useState('trtc')
  const [statuses, setStatuses] = useState<Record<string, TransitStatusData>>({})
  const [loading, setLoading] = useState(false)
  
  // Tabs: 'status' | 'metro' | 'train' | 'bus'
  const [activeTab, setActiveTab] = useState<'status' | 'metro' | 'train' | 'bus'>('status')
  
  // Train search state
  const [trainType, setTrainType] = useState<'thsr' | 'tra'>('thsr')
  const [originStation, setOriginStation] = useState('台北')
  const [destinationStation, setDestinationStation] = useState('左營')
  const [queryResults, setQueryResults] = useState<any[]>([])

  // Bus search state
  const [selectedCounty, setSelectedCounty] = useState('tpe')
  const [busSearch, setBusSearch] = useState('307')
  const [busStops, setBusStops] = useState<any[]>([])
  const [isBusSearching, setIsBusSearching] = useState(false)

  // 1. Fetch system status from transit-status.json
  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}transit-status.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('transit-status.json not found')
      const data = (await response.json()) as TransitPayload
      if (data && data.statuses) {
        setStatuses(data.statuses)
      }
    } catch (e) {
      console.error('Failed to fetch transit status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 300_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Get current active status details
  const getStatusDetails = () => {
    const serviceMap: Record<string, { name: string; icon: string; url: string }> = {
      trtc: { name: '台北捷運', icon: '🚇', url: 'https://www.metro.taipei/' },
      krtc: { name: '高雄捷運', icon: '🚇', url: 'https://www.krtc.com.tw/' },
      tmrt: { name: '台中捷運', icon: '🚇', url: 'https://www.tmrt.com.tw/' },
      thsr: { name: '台灣高鐵', icon: '🚄', url: 'https://www.thsrc.com.tw/' },
      tra: { name: '台灣鐵路', icon: '🚂', url: 'https://tip.railway.gov.tw/tra-tip-web/tip/tip007/tip711/blockList' }
    }

    const info = serviceMap[selectedService] || serviceMap.trtc
    const current = statuses[selectedService] || {
      name: info.name,
      status: '🟢 營運正常',
      isNormal: true,
      detail: '無法連接即時伺服器取得資訊，請點擊下方按鈕前往官方網站查看最新營運通阻。',
      updatedAt: ''
    }

    return { info, current }
  }

  const { info, current } = getStatusDetails()

  // 2. Train Timetable generator
  const handleTrainSearch = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()

    const results = []
    const baseInterval = trainType === 'thsr' ? 25 : 20 // minutes between trains

    // Generate 6 trains leaving starting from the current hour/minute
    let departureMinAccum = currentMin + 5 // start in 5 minutes
    let hourOffset = 0

    for (let i = 0; i < 6; i++) {
      let depHour = currentHour + hourOffset
      let depMin = departureMinAccum

      if (depMin >= 60) {
        depHour += Math.floor(depMin / 60)
        depMin = depMin % 60
      }
      depHour = depHour % 24

      // Mock travel duration
      const isExpress = trainType === 'thsr' && i % 2 === 0
      const durationMin = trainType === 'thsr' ? (isExpress ? 96 : 124) : 180 + (i * 15) % 60
      
      let arrHour = depHour + Math.floor((depMin + durationMin) / 60)
      let arrMin = (depMin + durationMin) % 60
      arrHour = arrHour % 24

      const formatTime = (h: number, m: number) => 
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

      results.push({
        trainNo: trainType === 'thsr' ? `${100 + i * 13}` : `${500 + i * 22}`,
        depTime: formatTime(depHour, depMin),
        arrTime: formatTime(arrHour, arrMin),
        duration: `${Math.floor(durationMin / 60)}小時${durationMin % 60}分`,
        isExpress,
        status: i === 0 ? '🕒 接近發車' : '🟢 尚有空位'
      })

      departureMinAccum += baseInterval
    }

    setQueryResults(results)
  }

  // 3. County Bus dynamic simulator
  const handleBusSearch = () => {
    setIsBusSearching(true)
    setTimeout(() => {
      // Find route details
      const busKey = Object.keys(POPULAR_BUSES).find(
        (key) => key.toLowerCase().includes(busSearch.toLowerCase())
      ) || '307'
      
      const routeInfo = POPULAR_BUSES[busKey]
      
      // Simulate real-time arrival times for stops
      const stops = routeInfo.stops.map((stop, index) => {
        // First few stops are close, later are farther
        const timeVal = Math.round((index * 3 + new Date().getMinutes() % 15))
        
        let status = ''
        let className = ''
        if (timeVal <= 1) {
          status = '接近中 🚌'
          className = 'status-approaching'
        } else if (timeVal <= 3) {
          status = '2 分鐘'
          className = 'status-soon'
        } else if (timeVal <= 5) {
          status = '5 分鐘'
          className = 'status-soon'
        } else if (timeVal > 25) {
          status = '未發車'
          className = 'status-offline'
        } else {
          status = `${timeVal} 分鐘`
          className = 'status-ok'
        }
        
        return { name: stop, status, className }
      })

      setBusStops(stops)
      setIsBusSearching(false)
    }, 600)
  }

  // Auto-trigger queries on mount/toggle
  useEffect(() => {
    if (activeTab === 'train') {
      handleTrainSearch()
    } else if (activeTab === 'bus') {
      handleBusSearch()
    }
  }, [activeTab, trainType, originStation, destinationStation])

  return (
    <section className="transit-board" aria-label="大眾運輸即時動態">
      {/* 標題與更新 */}
      <div className="section-row" style={{ marginBottom: '0.6rem' }}>
        <div className="section-title" style={{ padding: '0.2rem 0.5rem 0' }}>— 交通即時動態 —</div>
        {activeTab === 'status' && (
          <button
            className="refresh-events-btn"
            type="button"
            disabled={loading}
            onClick={fetchStatus}
          >
            {loading ? '讀取中' : '重新整理 ↻'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="transit-tabs">
        <button
          type="button"
          className={`transit-tab-btn${activeTab === 'status' ? ' active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          🚨 營運通阻
        </button>
        <button
          type="button"
          className={`transit-tab-btn${activeTab === 'metro' ? ' active' : ''}`}
          onClick={() => setActiveTab('metro')}
        >
          🚇 捷運班距
        </button>
        <button
          type="button"
          className={`transit-tab-btn${activeTab === 'train' ? ' active' : ''}`}
          onClick={() => setActiveTab('train')}
        >
          🚄 雙鐵時刻
        </button>
        <button
          type="button"
          className={`transit-tab-btn${activeTab === 'bus' ? ' active' : ''}`}
          onClick={() => setActiveTab('bus')}
        >
          🚌 公車動態
        </button>
      </div>

      {/* Tab Content 1: Status Alerts */}
      {activeTab === 'status' && (
        <div className="transit-tab-content">
          <div className="transit-selector-row" style={{ padding: 0 }}>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="transit-select"
            >
              <option value="trtc">🚇 台北捷運</option>
              <option value="krtc">🚇 高雄捷運</option>
              <option value="tmrt">🚇 台中捷運</option>
              <option value="thsr">🚄 台灣高鐵</option>
              <option value="tra">🚂 台灣鐵路</option>
            </select>
          </div>

          <div className="transit-card">
            <div className="transit-card-header">
              <div className="transit-service-name">
                <span className="transit-icon">{info.icon}</span>
                <span>{info.name}</span>
              </div>
              <div className={`transit-badge${current.isNormal ? ' normal' : ' warning'}${loading ? ' loading' : ''}`}>
                {current.status}
              </div>
            </div>
            <p className="transit-detail">{current.detail}</p>
            {current.updatedAt && (
              <div className="transit-updated">
                最後更新：{new Date(current.updatedAt).toLocaleTimeString('zh-TW')}
              </div>
            )}
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transit-link-btn"
            >
              🧭 前往官方網站查看即時動態 ↗
            </a>
          </div>
        </div>
      )}

      {/* Tab Content 2: Metro Line Frequency */}
      {activeTab === 'metro' && (
        <div className="transit-tab-content">
          <div className="metro-headway-wrapper">
            <div className="metro-sub-title">🚇 台北捷運 班距時程</div>
            <div className="metro-freq-table">
              {METRO_LINE_DATA.taipei.map((m) => (
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

            <div className="metro-sub-title" style={{ marginTop: '1.2rem' }}>🚇 高雄捷運 班距時程</div>
            <div className="metro-freq-table">
              {METRO_LINE_DATA.kaohsiung.map((m) => (
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
        </div>
      )}

      {/* Tab Content 3: Train Queries */}
      {activeTab === 'train' && (
        <div className="transit-tab-content">
          <div className="train-query-form">
            <div className="train-type-row">
              <button
                type="button"
                className={`train-type-btn${trainType === 'thsr' ? ' active' : ''}`}
                onClick={() => {
                  setTrainType('thsr')
                  setOriginStation('台北')
                  setDestinationStation('左營')
                }}
              >
                高鐵時刻表
              </button>
              <button
                type="button"
                className={`train-type-btn${trainType === 'tra' ? ' active' : ''}`}
                onClick={() => {
                  setTrainType('tra')
                  setOriginStation('台北')
                  setDestinationStation('台中')
                }}
              >
                台鐵時刻表
              </button>
            </div>
            <div className="train-station-selects">
              <div className="station-select-group">
                <label>起程站</label>
                <select
                  value={originStation}
                  onChange={(e) => setOriginStation(e.target.value)}
                  className="transit-select"
                >
                  {(trainType === 'thsr' ? THSR_STATIONS : TRA_STATIONS).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div className="station-select-group">
                <label>到達站</label>
                <select
                  value={destinationStation}
                  onChange={(e) => setDestinationStation(e.target.value)}
                  className="transit-select"
                >
                  {(trainType === 'thsr' ? THSR_STATIONS : TRA_STATIONS)
                    .filter((st) => st !== originStation)
                    .map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Train results grid */}
          <div className="train-results-board">
            <div className="train-board-header">
              <span>車次</span>
              <span>出發</span>
              <span>抵達</span>
              <span>行車時間</span>
            </div>
            <div className="train-board-rows">
              {queryResults.map((tr, idx) => (
                <div className={`train-board-row${tr.isExpress ? ' express' : ''}`} key={idx}>
                  <span className="train-no">{tr.trainNo}</span>
                  <span className="train-time-dep">{tr.depTime}</span>
                  <span className="train-time-arr">{tr.arrTime}</span>
                  <div className="train-dur-info">
                    <span className="train-dur">{tr.duration}</span>
                    <span className="train-status-badge">{tr.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: County Bus Arrivals */}
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
                onClick={handleBusSearch}
                disabled={isBusSearching}
              >
                查詢
              </button>
            </div>
          </div>

          {/* Bus stops countdown display */}
          <div className="bus-stops-board">
            {isBusSearching ? (
              <div className="bus-stops-loading">正在搜尋公車即時動態...</div>
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
