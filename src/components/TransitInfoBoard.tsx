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

const COUNTIES = [
  { id: 'tpe', name: '台北市' },
  { id: 'ntpc', name: '新北市' },
  { id: 'txg', name: '台中市' },
  { id: 'khh', name: '高雄市' },
  { id: 'tnn', name: '台南市' }
]

const HSR_OFFSETS: Record<string, number> = {
  '南港': 0, '台北': 10, '板橋': 18, '桃園': 32, '新竹': 43,
  '苗栗': 54, '台中': 70, '彰化': 82, '雲林': 92, '嘉義': 102,
  '台南': 118, '左營': 133
};

const TRA_WESTERN: Record<string, number> = {
  '基隆': -45, '七堵': -30, '南港': -15, '松山': -8, '台北': 0,
  '板橋': 10, '樹林': 18, '桃園': 35, '中壢': 45, '新竹': 75,
  '竹南': 95, '苗栗': 110, '豐原': 145, '台中': 160, '彰化': 175,
  '員林': 190, '斗六': 220, '嘉義': 245, '新營': 270, '台南': 300,
  '岡山': 325, '新左營': 340, '高雄': 350, '屏東': 380
};

const TRA_EASTERN: Record<string, number> = {
  '宜蘭': 70, '羅東': 80, '花蓮': 130, '玉里': 190, '台東': 240
};

function getHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function generateDynamicStops(busNum: string, county: string): { routeName: string; startTerminal: string; endTerminal: string; stops: string[] } {
  const queryStr = busNum.trim()
  
  const popularDataset: Record<string, Record<string, { start: string; end: string; stops: string[] }>> = {
    'tpe': {
      '307': {
        start: '板橋前站',
        end: '撫遠街',
        stops: ['板橋前站', '新北市政府', '捷運板橋站', '致理科技大學', '積穗', '中和中山路', '連城路', '華中橋', '萬大路', '捷運西門站', '台北車站(忠孝)', '捷運南京復興站', '南京三民', '撫遠街']
      },
      '299': {
        start: '輔大',
        end: '永春高中',
        stops: ['輔仁大學', '新莊地政事務所', '新莊田徑場', '中華路', '三重自強路', '台北車站(忠孝)', '捷運忠孝新生站', '捷運忠孝復興站', '捷運忠孝敦化站', '市府轉運站', '永春高中']
      }
    },
    'ntpc': {
      '307': {
        start: '板橋前站',
        end: '撫遠街',
        stops: ['板橋前站', '新北市政府', '捷運板橋站', '致理科技大學', '積穗', '中和中山路', '連城路', '華中橋', '萬大路', '捷運西門站', '台北車站(忠孝)', '捷運南京復興站', '南京三民', '撫遠街']
      },
      '299': {
        start: '輔大',
        end: '永春高中',
        stops: ['輔仁大學', '新莊地政事務所', '新莊田徑場', '中華路', '三重自強路', '台北車站(忠孝)', '捷運忠孝新生站', '捷運忠孝復興站', '捷運忠孝敦化站', '市府轉運站', '永春高中']
      }
    },
    'txg': {
      '300': {
        start: '靜宜大學',
        end: '台中車站',
        stops: ['靜宜大學', '弘光科技大學', '正英路', '坪頂', '東海別墅', '榮總/東海大學', '澄清醫院', '秋紅谷', '市政府', '科博館', '原子街口', '台中車站']
      },
      '151': {
        start: '朝陽科大',
        end: '台中高鐵站',
        stops: ['朝陽科大', '霧峰農會', '亞大醫院', '霧峰公車站', '林森路口', '省議會', '台中高鐵站']
      }
    },
    'khh': {
      '100': {
        start: '瑞豐站',
        end: '高雄車站',
        stops: ['瑞豐站', '瑞隆路口', '崗山仔', '輕軌籬仔內站', '一心路口', '三多商圈', '中央公園', '美麗島', '高雄車站']
      },
      '50': {
        start: '五甲社區',
        end: '鼓山輪渡站',
        stops: ['五甲社區', '前鎮高中', '輕軌凱旋瑞田站', '夢時代', '捷運獅甲站', '三多商圈', '中央公園', '捷運鹽埕埔站', '駁二藝術特區', '哈瑪星', '鼓山輪渡站']
      }
    },
    'tnn': {
      '5': {
        start: '鹽田里',
        end: '市立醫院',
        stops: ['鹽田里', '台南科大', '六甲頂', '奇美醫院', '大橋車站', '台南車站(北站)', '赤崁樓', '西門路', '台南市政府', '體育公園', '文化中心', '市立醫院']
      },
      '2': {
        start: '崑山科大',
        end: '安平',
        stops: ['崑山科大', '平實公園', '台南車站(北站)', '赤崁樓', '郭綜合醫院', '民生路', '安平古堡', '安平國中', '三信家商']
      }
    }
  }

  const countyData = popularDataset[county]
  if (countyData && countyData[queryStr]) {
    const route = countyData[queryStr]
    return {
      routeName: queryStr,
      startTerminal: route.start,
      endTerminal: route.end,
      stops: route.stops
    }
  }

  let landmarks = [
    '台北車站', '西門町', '市政府', '南港展覽館', '小巨蛋',
    '板橋公車站', '府中商圈', '淡水老街', '碧潭風景區', '陽明山'
  ]
  let startStop = ''
  let endStop = ''

  if (county === 'txg') {
    landmarks = ['台中車站', '一中街', '逢甲夜市', '東海大學', '秋紅谷', '科博館', '台中市政府', '勤美誠品', '國家歌劇院', '高美濕地']
    startStop = '台中榮總'
    endStop = '台中火車站'
  } else if (county === 'khh') {
    landmarks = ['高雄車站', '西子灣', '駁二特區', '三多商圈', '美麗島', '中央公園', '巨蛋商圈', '衛武營', '瑞豐夜市', '高雄展覽館']
    startStop = '左營高鐵站'
    endStop = '夢時代'
  } else if (county === 'tnn') {
    landmarks = ['台南車站', '赤崁樓', '孔廟', '花園夜市', '安平古堡', '億載金城', '奇美博物館', '神農街', '台南美術館', '安平樹屋']
    startStop = '台南科大'
    endStop = '台南市立醫院'
  } else if (county === 'ntpc') {
    landmarks = ['板橋公車站', '新北市政府', '致理科大', '積穗', '中和中山路', '連城路', '華中橋', '樹林車站', '三峽老街', '淡水捷運站']
    startStop = '新莊輔大'
    endStop = '板橋前站'
  }

  const hashVal = getHash(queryStr)

  if (!startStop || !endStop) {
    const startIdx = hashVal % landmarks.length
    startStop = landmarks[startIdx]
    let endIdx = (hashVal + 3) % landmarks.length
    if (endIdx === startIdx) {
      endIdx = (endIdx + 1) % landmarks.length
    }
    endStop = landmarks[endIdx]
  }

  const numStops = 8 + (hashVal % 5)
  const stops: string[] = []
  stops.push(startStop)

  const pool = landmarks.filter((item) => item !== startStop && item !== endStop)
  for (let i = 0; i < numStops - 2; i++) {
    if (pool.length === 0) break
    const idx = (hashVal + i * 7) % pool.length
    stops.push(pool[idx])
    pool.splice(idx, 1)
  }
  stops.push(endStop)

  return {
    routeName: queryStr,
    startTerminal: startStop,
    endTerminal: endStop,
    stops
  }
}

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
  const [queryResults, setQueryResults] = useState<TrainQueryResult[]>([])

  // Bus search state
  const [selectedCounty, setSelectedCounty] = useState('tpe')
  const [busSearch, setBusSearch] = useState('307')
  const [busStops, setBusStops] = useState<BusStopInfo[]>([])
  const [isBusSearching, setIsBusSearching] = useState(false)
  const [busDirection, setBusDirection] = useState<0 | 1>(0)
  const [busRouteDetails, setBusRouteDetails] = useState<{
    routeName: string;
    startTerminal: string;
    endTerminal: string;
    stops: string[];
  } | null>(null)

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
    const timer = setTimeout(() => {
      fetchStatus()
    }, 0)
    const interval = setInterval(fetchStatus, 300_000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
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
      detail: '無法連接即時伺服器取得資訊，請點擊下方按鈕前往官方網站查看最新營運通阻。',
      isNormal: true,
      updatedAt: ''
    }

    return { info, current }
  }

  const { info, current } = getStatusDetails()

  // 2. Train Timetable generator
  const handleTrainSearch = useCallback(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()

    const results = []
    
    if (trainType === 'thsr') {
      const oOffset = HSR_OFFSETS[originStation] ?? 0;
      const dOffset = HSR_OFFSETS[destinationStation] ?? 0;
      const isNorthbound = oOffset > dOffset;
      const baseDistance = Math.abs(oOffset - dOffset);

      // Generate 6 trains departing starting from the current time
      let departureMinAccum = 5;
 
      for (let i = 0; i < 6; i++) {
        const totalMinutes = currentMin + departureMinAccum;
        const depHour = (currentHour + Math.floor(totalMinutes / 60)) % 24;
        const depMin = totalMinutes % 60;
 
        // HSR Train Type: i % 3 === 0 ? "直達" : "站站停"
        const isExpress = i % 3 === 0 && 
          ['台北', '板橋', '台中', '左營'].includes(originStation) && 
          ['台北', '板橋', '台中', '左營'].includes(destinationStation);
        
        const speedFactor = isExpress ? 0.75 : 1.0;
        const durationMin = Math.max(10, Math.round(baseDistance * speedFactor));
        
        const totalArrMinutes = totalMinutes + durationMin;
        const arrHour = (currentHour + Math.floor(totalArrMinutes / 60)) % 24;
        const arrMin = totalArrMinutes % 60;
 
        const formatTime = (h: number, m: number) => 
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
 
        // Train number
        const trainNo = isExpress
          ? (isNorthbound ? `${100 + i * 2 + 1}` : `${100 + i * 2}`)
          : (isNorthbound ? `${600 + i * 4 + 1}` : `${600 + i * 4}`);
 
        // Delay status: 90% on time
        const delayRnd = (getHash(trainNo) + i) % 100;
        let delayStatus = '🟢 準點';
        if (delayRnd >= 95) {
          delayStatus = `🟡 晚 ${delayRnd - 94} 分`;
        }
 
        results.push({
          trainType: isExpress ? '直達' : '站站停',
          trainNo,
          depTime: formatTime(depHour, depMin),
          arrTime: formatTime(arrHour, arrMin),
          duration: `${Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}小時` : ''}${durationMin % 60}分`,
          isExpress,
          status: delayStatus
        });
 
        departureMinAccum += 20 + (delayRnd % 15);
      }
    } else {
      // TRA
      const isWestO = TRA_WESTERN[originStation] !== undefined;
      const isWestD = TRA_WESTERN[destinationStation] !== undefined;
      
      let baseDistance: number;

      if (isWestO && isWestD) {
        baseDistance = Math.abs(TRA_WESTERN[originStation] - TRA_WESTERN[destinationStation]);
      } else if (!isWestO && !isWestD) {
        baseDistance = Math.abs((TRA_EASTERN[originStation] ?? 0) - (TRA_EASTERN[destinationStation] ?? 0));
      } else {
        // West to East or East to West (through Taipei)
        const westVal = isWestO ? TRA_WESTERN[originStation] : TRA_WESTERN[destinationStation];
        const eastVal = !isWestO ? TRA_EASTERN[originStation] : TRA_EASTERN[destinationStation];
        baseDistance = Math.abs(westVal) + Math.abs(eastVal);
      }

      const isNorthbound = (isWestO && isWestD && TRA_WESTERN[originStation] > TRA_WESTERN[destinationStation]) ||
                            (!isWestO && !isWestD && TRA_EASTERN[originStation] > TRA_EASTERN[destinationStation]) ||
                            (isWestO && !isWestD);

      let departureMinAccum = 3;
 
      for (let i = 0; i < 6; i++) {
        const totalMinutes = currentMin + departureMinAccum;
        const depHour = (currentHour + Math.floor(totalMinutes / 60)) % 24;
        const depMin = totalMinutes % 60;
 
        let traType: string;
        let speedFactor: number;
        let isExpress = false;
        
        const typeSelect = (i + (isNorthbound ? 1 : 0)) % 4;
        if (typeSelect === 0) {
          traType = '自強';
          speedFactor = 0.7;
          isExpress = true;
        } else if (typeSelect === 1) {
          traType = '區間';
          speedFactor = 1.15;
        } else if (typeSelect === 2) {
          traType = '莒光';
          speedFactor = 0.9;
        } else {
          const isEasternRelated = !isWestO || !isWestD;
          traType = isEasternRelated ? '普悠瑪' : '區間快';
          speedFactor = isEasternRelated ? 0.65 : 0.85;
          isExpress = true;
        }

        const durationMin = Math.max(8, Math.round(baseDistance * speedFactor));

        let arrHour = depHour + Math.floor((depMin + durationMin) / 60);
        const arrMin = (depMin + durationMin) % 60;
        arrHour = arrHour % 24;

        const formatTime = (h: number, m: number) => 
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        let trainNo: string;
        if (traType === '自強') {
          trainNo = String(100 + i * 14 + (isNorthbound ? 1 : 2));
        } else if (traType === '普悠瑪' || traType === '太魯閣') {
          trainNo = String(200 + i * 8 + (isNorthbound ? 1 : 2));
        } else if (traType === '莒光') {
          trainNo = String(500 + i * 12 + (isNorthbound ? 1 : 2));
        } else {
          trainNo = String(2100 + i * 22 + (isNorthbound ? 1 : 2));
        }

        const delayRnd = (getHash(trainNo) + i) % 100;
        let delayStatus = '🟢 準點';
        if (delayRnd >= 75) {
          const delayMinutes = (delayRnd % 12) + 1;
          delayStatus = `🟡 晚 ${delayMinutes} 分`;
        }

        results.push({
          trainType: traType,
          trainNo,
          depTime: formatTime(depHour, depMin),
          arrTime: formatTime(arrHour, arrMin),
          duration: `${Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}小時` : ''}${durationMin % 60}分`,
          isExpress,
          status: delayStatus
        });

        departureMinAccum += 15 + (delayRnd % 15);
      }
    }

    setQueryResults(results)
  }, [trainType, originStation, destinationStation])

  // 3. County Bus dynamic simulator
  const handleBusSearch = useCallback((directionOverride?: number) => {
    const queryStr = busSearch.trim()
    if (!queryStr) return
    setIsBusSearching(true)
    
    const targetDirection = directionOverride !== undefined ? directionOverride : busDirection

    setTimeout(() => {
      const routeInfo = generateDynamicStops(queryStr, selectedCounty)
      setBusRouteDetails(routeInfo)
      
      const stopsToRender = targetDirection === 0 
        ? [...routeInfo.stops] 
        : [...routeInfo.stops].reverse();

      const headway = 15;
      const hash = getHash(queryStr);
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const stops = stopsToRender.map((stop, index) => {
        const stopJitter = (hash + index * 17) % 3 - 1;
        const cumTime = index * 2.5 + stopJitter;

        const diff = currentMinutes - cumTime;
        const timeRemaining = diff <= 0
          ? Math.round(-diff)
          : (diff % headway === 0 ? 0 : Math.round(headway - (diff % headway)));

        let statusText: string;
        let className: string;

        const isOffline = (hash + index * 9) % 15 === 0 && index > stopsToRender.length - 3;

        if (isOffline) {
          statusText = '未發車';
          className = 'status-offline';
        } else if (timeRemaining <= 1) {
          statusText = timeRemaining === 0 ? '接近中 🚌' : '將到站';
          className = 'status-approaching';
        } else if (timeRemaining <= 4) {
          statusText = `${timeRemaining} 分鐘`;
          className = 'status-soon';
        } else {
          statusText = `${timeRemaining} 分鐘`;
          className = 'status-ok';
        }

        return { name: stop, status: statusText, className }
      })

      setBusStops(stops)
      setIsBusSearching(false)
    }, 500)
  }, [busSearch, selectedCounty, busDirection])

  const handleToggleBusDirection = () => {
    const nextDirection = busDirection === 0 ? 1 : 0
    setBusDirection(nextDirection)
    handleBusSearch(nextDirection)
  }

  // Auto-trigger queries on mount/toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'train') {
        handleTrainSearch()
      } else if (activeTab === 'bus') {
        handleBusSearch()
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [activeTab, handleTrainSearch, handleBusSearch])

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
          disabled
        >
          🚄 雙鐵動態 (開發中)
        </button>
        <button
          type="button"
          className={`transit-tab-btn${activeTab === 'bus' ? ' active' : ''}`}
          onClick={() => setActiveTab('bus')}
          disabled
        >
          🚌 公車動態 (開發中)
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

            <div className="metro-sub-title" style={{ marginTop: '1.2rem' }}>🚇 台中捷運 班距時程</div>
            <div className="metro-freq-table">
              {METRO_LINE_DATA.taichung.map((m) => (
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
              <span>車種</span>
              <span>車次</span>
              <span>出發</span>
              <span>抵達</span>
              <span>行車時間 / 狀態</span>
            </div>
            <div className="train-board-rows">
              {queryResults.map((tr, idx) => (
                <div className={`train-board-row${tr.isExpress ? ' express' : ''}`} key={idx}>
                  <span className={`train-type-badge type-${tr.trainType}`}>{tr.trainType}</span>
                  <span className="train-no">{tr.trainNo}</span>
                  <span className="train-time-dep">{tr.depTime}</span>
                  <span className="train-time-arr">{tr.arrTime}</span>
                  <div className="train-dur-info">
                    <span className="train-dur">{tr.duration}</span>
                    <span className={`train-status-badge ${tr.status.includes('準點') ? 'status-ontime' : 'status-delayed'}`}>
                      {tr.status}
                    </span>
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
                onClick={() => {
                  setBusDirection(0);
                  handleBusSearch(0);
                }}
                disabled={isBusSearching}
              >
                查詢
              </button>
            </div>
          </div>

          {/* Bus Route Direction Header */}
          {busRouteDetails && busStops.length > 0 && !isBusSearching && (
            <div className="bus-route-header-info">
              <div className="bus-route-title">
                🚌 路線 {busRouteDetails.routeName} ({busRouteDetails.startTerminal} ⇄ {busRouteDetails.endTerminal})
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
                  🔄 切換方向
                </button>
              </div>
            </div>
          )}

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

