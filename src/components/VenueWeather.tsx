import { useState, useEffect, useCallback } from 'react'
import {
  SunIcon,
  CloudSunIcon,
  CloudIcon,
  UmbrellaIcon,
  SnowflakeIcon,
  CloudLightningIcon,
  ThermometerIcon,
  WarningIcon,
  RefreshIcon,
  CloseIcon,
  CalendarIcon,
  ClipboardIcon,
  CheckIcon
} from './SvgIcon'

interface VenueWeatherProps {
  latitude?: number
  longitude?: number
  cityName: string
  onClose?: () => void
  onViewDetails?: () => void
}

interface WeatherData {
  temp: number
  feelsLike: number
  humidity: number
  weatherCode: number
  windSpeed: number
  desc?: string
}

interface AqiData {
  aqi: number
  pm25: number
  pm10: number
}

interface DailyForecast {
  date: string
  tempMax: number
  tempMin: number
  weatherCode: number
  desc?: string
}

// Module-level cache to store weather responses for 5 minutes
const weatherCache = new Map<string, { data: { weather: WeatherData; aqi: AqiData; daily: DailyForecast[] }; timestamp: number }>()
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Map CWA Wx Weather Codes to Description and SVG Icon
function parseWeatherCode(code: number, customDesc?: string): { desc: string; icon: React.ReactNode } {
  let desc = customDesc || '未知天氣';
  if (!customDesc) {
    if (code === 1) desc = '晴天';
    else if (code >= 2 && code <= 6) desc = '多雲';
    else if (code === 7) desc = '陰天';
    else if ([15, 16, 17, 18, 33, 34, 35, 36].includes(code)) desc = '雷陣雨';
    else if ([23, 37].includes(code)) desc = '雪天';
    else if ([24, 25, 26, 27, 28, 42].includes(code)) desc = '有霧';
    else desc = '雨天';
  }

  let icon = <ThermometerIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  if (code === 1) {
    icon = <SunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else if (code >= 2 && code <= 6) {
    icon = <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else if (code === 7) {
    icon = <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else if ([15, 16, 17, 18, 33, 34, 35, 36].includes(code)) {
    icon = <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else if ([23, 37].includes(code)) {
    icon = <SnowflakeIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else if ([24, 25, 26, 27, 28, 42].includes(code)) {
    icon = <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  } else {
    // 8-14, 19-22, 29-32, 38-41, etc.
    icon = <UmbrellaIcon size="1.2em" style={{ verticalAlign: 'middle' }} />;
  }

  return { desc, icon };
}

// Get AQI category details
function getAqiDetails(aqi: number): { label: string; className: string; advice: string } {
  if (aqi <= 50) {
    return {
      label: '良好',
      className: 'aqi-good',
      advice: '空氣品質良好，非常適合前往演唱會與進行戶外活動！',
    }
  } else if (aqi <= 100) {
    return {
      label: '普通',
      className: 'aqi-moderate',
      advice: '空氣品質普通，敏感族群可適度防護。',
    }
  } else if (aqi <= 150) {
    return {
      label: '敏感不良',
      className: 'aqi-sensitive',
      advice: '空氣對敏感族群不健康，建議敏感族群配戴口罩。',
    }
  } else {
    return {
      label: '不良',
      className: 'aqi-unhealthy',
      advice: '空氣品質不良！一般樂迷也建議佩戴口罩，並減少戶外長時間劇烈運動。',
    }
  }
}

// Generate weather specific advisories/warnings
function getWeatherWarnings(weather: WeatherData): string[] {
  const warnings: string[] = []

  // Rain alerts based on CWA Wx codes
  const heavyRainCodes = [12, 13, 14, 15, 16, 17, 18, 32, 33, 34, 35, 36]
  const lightRainCodes = [8, 9, 10, 11, 19, 20, 21, 22, 29, 30, 31, 38, 39, 40, 41]

  if (heavyRainCodes.includes(weather.weatherCode)) {
    warnings.push('劇烈降雨警告：目前降雨強烈，請攜帶雨具，避開積水路段，注意安全！')
  } else if (lightRainCodes.includes(weather.weatherCode)) {
    warnings.push('降雨提醒：目前有降雨，若屬半戶外/戶外場地請備妥雨傘或雨衣。')
  }

  // Temperature alerts
  if (weather.feelsLike >= 35) {
    warnings.push('高溫警報：體感溫度偏高，請多補水、防曬，防範熱傷害。')
  } else if (weather.temp <= 15) {
    warnings.push('低溫提醒：天氣寒冷，前往場館請多穿衣物注意保暖防寒。')
  }

  // Wind speed alert (wind speed is in km/h after m/s conversion)
  if (weather.windSpeed >= 20) {
    warnings.push('強風提醒：風速較強，若在戶外排隊請注意防風，保管好隨身物品。')
  }

  return warnings
}

// Map coordinates or cityName to CWA county and township
function getCwaLocation(latitude: number, longitude: number, cityName: string): { county: string; township?: string } {
  // 1. Precise coordinate matching for static venues
  const venuesMapping = [
    { coords: [25.0440, 121.5606], county: '臺北市', township: '信義區' }, // 台北大巨蛋
    { coords: [25.0510, 121.5502], county: '臺北市', township: '松山區' }, // 台北小巨蛋
    { coords: [25.0569, 121.6189], county: '臺北市', township: '南港區' }, // 南港展覽館
    { coords: [25.0483, 121.5977], county: '臺北市', township: '南港區' }, // 台北流行音樂中心
    { coords: [25.0601, 121.4447], county: '新北市', township: '新莊區' }, // Zepp New Taipei
    { coords: [25.0441, 121.5294], county: '臺北市', township: '中正區' }, // Legacy Taipei
    { coords: [25.0125, 121.5367], county: '臺北市', township: '文山區' }, // The Wall
    { coords: [25.0003, 121.2003], county: '桃園市', township: '中壢區' }, // 桃園棒球場
    { coords: [24.8066, 120.9601], county: '新竹市', township: '北區' },   // 新竹棒球場
    { coords: [24.2003, 120.6853], county: '臺中市', township: '北屯區' }, // 台中洲際棒球場
    { coords: [24.1627, 120.6405], county: '臺中市', township: '西屯區' }, // 台中國家歌劇院
    { coords: [24.1802, 120.6186], county: '臺中市', township: '西屯區' }, // Legacy Taichung
    { coords: [24.0652, 120.5583], county: '彰化縣', township: '彰化市' }, // 彰化體育場
    { coords: [22.9831, 120.2045], county: '臺南市', township: '南區' },   // 台南棒球場
    { coords: [22.6698, 120.3022], county: '高雄市', township: '左營區' }, // 高雄巨蛋
    { coords: [22.7018, 120.2946], county: '高雄市', township: '左營區' }, // 世運主場館
    { coords: [22.6212, 120.2917], county: '高雄市', township: '鹽埕區' }, // 高雄流行音樂中心
    { coords: [22.6186, 120.2931], county: '高雄市', township: '苓雅區' }, // 後台
    { coords: [23.9984, 121.5878], county: '花蓮縣', township: '花蓮市' }, // 花蓮體育場
    { coords: [22.7744, 121.1189], county: '臺東縣', township: '臺東市' }, // 台東棒球場
    { coords: [25.1146, 121.5352], county: '臺北市', township: '士林區' }, // 天母棒球場
    { coords: [25.0408, 121.4475], county: '新北市', township: '新莊區' }, // 新莊棒球場
    { coords: [23.0628, 120.2364], county: '臺南市', township: '安南區' }, // 亞太棒球中心
    { coords: [22.6544, 120.3591], county: '高雄市', township: '鳥松區' }, // 澄清湖棒球場
    { coords: [23.7168, 120.5354], county: '雲林縣', township: '斗六市' }, // 斗六棒球場
    { coords: [23.4811, 120.4658], county: '嘉義市', township: '東區' }     // 嘉義市棒球場
  ];

  for (const item of venuesMapping) {
    const latDiff = Math.abs(item.coords[0] - latitude);
    const lonDiff = Math.abs(item.coords[1] - longitude);
    if (latDiff < 0.005 && lonDiff < 0.005) {
      return { county: item.county, township: item.township };
    }
  }

  // 2. Fallback to cityName mapping
  const city = cityName.trim();
  let county = '';
  if (city.includes('台北') || city === '台北') county = '臺北市';
  else if (city.includes('新北') || city === '新北') county = '新北市';
  else if (city.includes('桃園') || city === '桃園') county = '桃園市';
  else if (city.includes('台中') || city === '台中') county = '臺中市';
  else if (city.includes('台南') || city === '台南') county = '臺南市';
  else if (city.includes('高雄') || city === '高雄') county = '高雄市';
  else if (city.includes('新竹') || city === '新竹') {
    county = city.includes('縣') ? '新竹縣' : '新竹市';
  }
  else if (city.includes('苗栗') || city === '苗栗') county = '苗栗縣';
  else if (city.includes('彰化') || city === '彰化') county = '彰化縣';
  else if (city.includes('南投') || city === '南投') county = '南投縣';
  else if (city.includes('雲林') || city === '雲林') county = '雲林縣';
  else if (city.includes('嘉義') || city === '嘉義') {
    county = city.includes('縣') ? '嘉義縣' : '嘉義市';
  }
  else if (city.includes('屏東') || city === '屏東') county = '屏東縣';
  else if (city.includes('宜蘭') || city === '宜蘭') county = '宜蘭縣';
  else if (city.includes('花蓮') || city === '花蓮') county = '花蓮縣';
  else if (city.includes('台東') || city === '台東') county = '臺東縣';
  else if (city.includes('澎湖') || city === '澎湖') county = '澎湖縣';
  else if (city.includes('金門') || city === '金門') county = '金門縣';
  else if (city.includes('連江') || city === '連江') county = '連江縣';
  else {
    county = city.endsWith('市') || city.endsWith('縣') ? city : city + '市';
  }

  return { county };
}

export function VenueWeather({ latitude, longitude, cityName, onClose, onViewDetails }: VenueWeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [aqi, setAqi] = useState<AqiData | null>(null)
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

  const getDayLabel = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const tomorrow = new Date()
      tomorrow.setDate(today.getDate() + 1)
      const dayAfter = new Date()
      dayAfter.setDate(today.getDate() + 2)

      if (date.toDateString() === today.toDateString()) {
        return '今天'
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return '明天'
      } else if (date.toDateString() === dayAfter.toDateString()) {
        return '後天'
      } else {
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
        return days[date.getDay()]
      }
    } catch {
      return dateStr
    }
  }

  const fetchWeather = useCallback(async (forceRefresh = false) => {
    if (!latitude || !longitude) {
      setError('此場地暫無座標資訊')
      return
    }

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
    const cached = weatherCache.get(cacheKey)

    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      setWeather(cached.data.weather)
      setAqi(cached.data.aqi)
      setDailyForecast(cached.data.daily)
      setIsFallback(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { county, township } = getCwaLocation(latitude, longitude, cityName);
      
      let weatherUrl = `/api/cwa/F-D0047-091?locationsName=${encodeURIComponent(county)}`;
      if (township) {
        weatherUrl += `&locationName=${encodeURIComponent(township)}`;
      }
      weatherUrl += `&elementName=T,RH,MaxT,MinT,Wx,WS,MaxAT,MinAT`;

      const apiKey = import.meta.env.VITE_CWA_API_KEY;
      if (apiKey) {
        weatherUrl += `&Authorization=${encodeURIComponent(apiKey)}`;
      }

      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10`

      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(aqiUrl)
      ])

      if (!weatherRes.ok || !aqiRes.ok) {
        throw new Error('API request failed')
      }

      const weatherJson = await weatherRes.json()
      const aqiJson = await aqiRes.json()

      const locations = weatherJson.records?.locations?.[0]?.location;
      if (!locations || locations.length === 0) {
        throw new Error('找不到氣象署之該地區預報資料')
      }

      const loc = township 
        ? (locations.find((l: any) => l.locationName === township) || locations[0])
        : locations[0];

      const elements = loc.weatherElement || [];
      const getElement = (name: string) => elements.find((el: any) => el.elementName === name);

      const tEl = getElement('T');
      const rhEl = getElement('RH');
      const maxTEl = getElement('MaxT');
      const minTEl = getElement('MinT');
      const wxEl = getElement('Wx');
      const wsEl = getElement('WS');
      const maxAtEl = getElement('MaxAT');
      const minAtEl = getElement('MinAT');

      const tTimeSlots = tEl?.time || [];
      const now = new Date();

      // Find current time slot index
      let currentSlotIndex = 0;
      for (let i = 0; i < tTimeSlots.length; i++) {
        const start = new Date(tTimeSlots[i].startTime);
        const end = new Date(tTimeSlots[i].endTime);
        if (now >= start && now <= end) {
          currentSlotIndex = i;
          break;
        }
      }

      const currentT = tTimeSlots[currentSlotIndex]?.elementValue?.[0]?.value;
      const tempVal = currentT ? Math.round(parseFloat(currentT)) : 25;

      const currentRH = rhEl?.time?.[currentSlotIndex]?.elementValue?.[0]?.value;
      const humidityVal = currentRH ? Math.round(parseFloat(currentRH)) : 70;

      const currentMinAT = minAtEl?.time?.[currentSlotIndex]?.elementValue?.[0]?.value;
      const currentMaxAT = maxAtEl?.time?.[currentSlotIndex]?.elementValue?.[0]?.value;
      let feelsLikeVal = tempVal;
      if (currentMinAT && currentMaxAT) {
        feelsLikeVal = Math.round((parseFloat(currentMinAT) + parseFloat(currentMaxAT)) / 2);
      } else if (currentMaxAT) {
        feelsLikeVal = Math.round(parseFloat(currentMaxAT));
      } else if (currentMinAT) {
        feelsLikeVal = Math.round(parseFloat(currentMinAT));
      }

      const currentWS = wsEl?.time?.[currentSlotIndex]?.elementValue?.[0]?.value;
      const windSpeedVal = currentWS ? Math.round(parseFloat(currentWS) * 3.6) : 10; // m/s to km/h

      const currentWxValues = wxEl?.time?.[currentSlotIndex]?.elementValue || [];
      const wxValObj = currentWxValues.find((v: any) => v.measures === '天氣現象') || currentWxValues[0];
      const wxCodeObj = currentWxValues.find((v: any) => v.measures === '天氣代碼' || v.measures === '天氣現象代碼') || currentWxValues[1];
      const descVal = wxValObj?.value || '未知天氣';
      const codeVal = wxCodeObj ? parseInt(wxCodeObj.value, 10) : 1;

      const newWeather: WeatherData = {
        temp: tempVal,
        feelsLike: feelsLikeVal,
        humidity: humidityVal,
        weatherCode: codeVal,
        windSpeed: windSpeedVal,
        desc: descVal
      }

      const newAqi: AqiData = {
        aqi: Math.round(aqiJson.current.us_aqi),
        pm25: Math.round(aqiJson.current.pm2_5),
        pm10: Math.round(aqiJson.current.pm10)
      }

      // 7-day daily forecast parsing by date
      const dailyMap = new Map<string, { maxTemp?: number; minTemp?: number; weatherCode?: number; desc?: string }>();
      
      const maxTTime = maxTEl?.time || [];
      const minTTime = minTEl?.time || [];
      const wxTime = wxEl?.time || [];

      maxTTime.forEach((slot: any) => {
        const dateStr = slot.startTime.split('T')[0];
        const val = slot.elementValue?.[0]?.value;
        if (val) {
          const temp = Math.round(parseFloat(val));
          const entry = dailyMap.get(dateStr) || {};
          entry.maxTemp = entry.maxTemp !== undefined ? Math.max(entry.maxTemp, temp) : temp;
          dailyMap.set(dateStr, entry);
        }
      });

      minTTime.forEach((slot: any) => {
        const dateStr = slot.startTime.split('T')[0];
        const val = slot.elementValue?.[0]?.value;
        if (val) {
          const temp = Math.round(parseFloat(val));
          const entry = dailyMap.get(dateStr) || {};
          entry.minTemp = entry.minTemp !== undefined ? Math.min(entry.minTemp, temp) : temp;
          dailyMap.set(dateStr, entry);
        }
      });

      wxTime.forEach((slot: any) => {
        const dateStr = slot.startTime.split('T')[0];
        const values = slot.elementValue || [];
        const wValObj = values.find((v: any) => v.measures === '天氣現象') || values[0];
        const wCodeObj = values.find((v: any) => v.measures === '天氣代碼' || v.measures === '天氣現象代碼') || values[1];

        if (wValObj || wCodeObj) {
          const entry = dailyMap.get(dateStr) || {};
          if (entry.weatherCode === undefined) {
            entry.weatherCode = wCodeObj ? parseInt(wCodeObj.value, 10) : 1;
            entry.desc = wValObj?.value || '未知天氣';
          }
          dailyMap.set(dateStr, entry);
        }
      });

      const newDaily: DailyForecast[] = [];
      const sortedDates = Array.from(dailyMap.keys()).sort();
      for (const d of sortedDates) {
        const entry = dailyMap.get(d)!;
        if (entry.maxTemp !== undefined && entry.minTemp !== undefined && entry.weatherCode !== undefined) {
          newDaily.push({
            date: d,
            tempMax: entry.maxTemp,
            tempMin: entry.minTemp,
            weatherCode: entry.weatherCode,
            desc: entry.desc
          });
        }
      }

      setWeather(newWeather)
      setAqi(newAqi)
      setDailyForecast(newDaily)
      setIsFallback(false)

      weatherCache.set(cacheKey, {
        data: { weather: newWeather, aqi: newAqi, daily: newDaily },
        timestamp: Date.now()
      })
    } catch (err) {
      console.warn('Unable to load real-time weather from CWA API, using offline simulated data.', err)
      // Generates elegant fallback simulated data based on season (June) and location
      const month = new Date().getMonth() + 1
      const isSummer = month >= 6 && month <= 9
      const isWinter = month === 12 || month <= 2
      const baseTemp = isSummer ? 30 : isWinter ? 16 : 24
      const baseHumidity = 75

      // Add a small deterministic deviation based on city name length
      const offset = (cityName.length % 5) - 2
      const temp = baseTemp + offset
      const feelsLike = temp + (isSummer ? 3 : -1)

      const fallbackWeather: WeatherData = {
        temp,
        feelsLike,
        humidity: baseHumidity + (cityName.length * 3) % 15,
        weatherCode: 2, // default partly cloudy
        windSpeed: 8 + (cityName.length * 2) % 12
      }

      const fallbackAqi: AqiData = {
        aqi: 40 + (cityName.length * 7) % 35,
        pm25: 12 + (cityName.length * 2) % 15,
        pm10: 22 + (cityName.length * 4) % 20
      }

      const fallbackDaily: DailyForecast[] = []
      const today = new Date()
      for (let i = 0; i < 7; i++) {
        const nextDay = new Date()
        nextDay.setDate(today.getDate() + i)
        const dateStr = nextDay.toISOString().split('T')[0]
        
        fallbackDaily.push({
          date: dateStr,
          tempMax: temp + 2 - (i % 2),
          tempMin: temp - 4 - (i % 3),
          weatherCode: (2 + i) % 4
        })
      }

      setWeather(fallbackWeather)
      setAqi(fallbackAqi)
      setDailyForecast(fallbackDaily)
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude, cityName])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWeather()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchWeather])

  if (error) {
    return <div className="weather-widget error">{error}</div>
  }

  if (loading && !weather) {
    return (
      <div className="weather-widget loading">
        <span className="spinner" /> 讀取天氣資訊中...
      </div>
    )
  }

  if (!weather || !aqi) {
    return null
  }

  const weatherInfo = parseWeatherCode(weather.weatherCode, weather.desc)
  const aqiInfo = getAqiDetails(aqi.aqi)
  const warnings = getWeatherWarnings(weather)

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <div className="weather-title">
          <span>
            <CloudSunIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            即時天氣預報
          </span>
          {isFallback && <span className="fallback-badge" title="暫時無法連接中央氣象服務，顯示模擬氣候資訊">模擬數據</span>}
        </div>
        <div className="weather-header-actions" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className="weather-refresh-btn"
            type="button"
            onClick={() => fetchWeather(true)}
            disabled={loading}
            title="重新整理氣象資料"
          >
            {loading ? (
              '↻'
            ) : (
              <RefreshIcon size="0.95em" style={{ verticalAlign: 'middle' }} />
            )}
          </button>
          {onClose && (
            <button
              className="weather-close-btn"
              type="button"
              onClick={onClose}
              title="關閉氣象預報"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="weather-body">
        {/* Main temperature and weather condition */}
        <div className="weather-main">
          <div className="weather-temp-section">
            <span className="weather-emoji" role="img" aria-label={weatherInfo.desc}>
              {weatherInfo.icon}
            </span>
            <div className="weather-temp-wrap">
              <span className="temp-val">{weather.temp}°C</span>
              <span className="weather-desc">{weatherInfo.desc}</span>
            </div>
          </div>

          <div className="weather-details">
            <div className="detail-item">
              <span className="label">體感溫度</span>
              <span className="value">{weather.feelsLike}°C</span>
            </div>
            <div className="detail-item">
              <span className="label">相對濕度</span>
              <span className="value">{weather.humidity}%</span>
            </div>
            <div className="detail-item">
              <span className="label">目前風速</span>
              <span className="value">{weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>

        {/* Air Quality section */}
        <div className="weather-aqi-section">
          <div className="aqi-badge-container">
            <span className="label">空氣品質指數</span>
            <span className={`aqi-badge ${aqiInfo.className}`}>
              {aqi.aqi} AQI ({aqiInfo.label})
            </span>
          </div>
          <div className="aqi-particles">
            <span>PM₂.₅: <strong>{aqi.pm25} µg/m³</strong></span>
            <span>PM₁₀: <strong>{aqi.pm10} µg/m³</strong></span>
          </div>
        </div>

        {/* 7-day Weather Forecast */}
        {dailyForecast && dailyForecast.length > 0 && (
          <div className="weather-forecast-section">
            <div className="forecast-title">
              <CalendarIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              七日天氣預報
            </div>
            <div className="forecast-grid">
              {dailyForecast.map((day) => {
                const info = parseWeatherCode(day.weatherCode, day.desc)
                const dayLabel = getDayLabel(day.date)
                return (
                  <div className="forecast-item" key={day.date}>
                    <span className="forecast-day">{dayLabel}</span>
                    <span className="forecast-emoji" title={info.desc}>{info.icon}</span>
                    <span className="forecast-desc">{info.desc}</span>
                    <span className="forecast-temp">{day.tempMin}°~{day.tempMax}°C</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Warnings & Suggestions alerts */}
        <div className="weather-alerts">
          <div className="alerts-title">
            <ClipboardIcon size="1.05em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            貼心防護警語與建議
          </div>
          <div className="alerts-list">
            <div className="alert-item aqi-advice">
              {aqi.aqi <= 100 ? (
                <CheckIcon size="0.95em" style={{ marginRight: '6px', color: 'var(--success)', verticalAlign: 'middle' }} />
              ) : (
                <WarningIcon size="0.95em" style={{ marginRight: '6px', color: 'var(--warning)', verticalAlign: 'middle' }} />
              )}
              {aqiInfo.advice}
            </div>
            {warnings.map((warning, index) => (
              <div key={index} className="alert-item weather-warning">
                <WarningIcon size="0.95em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {warning}
              </div>
            ))}
            {warnings.length === 0 && weather.weatherCode === 0 && (
              <div className="alert-item weather-sunny">
                <SunIcon size="0.95em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                天氣晴朗炎熱，若前往戶外排隊請做好防曬，適時補充水分喔！
              </div>
            )}
          </div>
        </div>

        {onViewDetails && (
          <button
            className="weather-view-details-btn"
            type="button"
            onClick={onViewDetails}
          >
            <ClipboardIcon size="1.05em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            查看場館詳情與記錄
          </button>
        )}
      </div>
    </div>
  )
}
