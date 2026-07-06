import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../utils/i18n.tsx'
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
}

// Module-level cache to store weather responses for 5 minutes
const weatherCache = new Map<string, { data: { weather: WeatherData; aqi: AqiData; daily: DailyForecast[] }; timestamp: number }>()
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Map WMO Weather Codes to Description and SVG Icon
function parseWeatherCode(code: number, lang: string = 'zh-TW'): { desc: string; icon: React.ReactNode } {
  const isZh = lang === 'zh-TW'
  switch (code) {
    case 0:
      return { desc: isZh ? '晴朗' : lang === 'ja' ? '快晴' : lang === 'ko' ? '맑음' : 'Clear Sky', icon: <SunIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 1:
      return { desc: isZh ? '晴間多雲' : lang === 'ja' ? '晴れ時々曇り' : lang === 'ko' ? '구름 조금' : 'Partly Cloudy', icon: <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 2:
      return { desc: isZh ? '多雲' : lang === 'ja' ? '曇り' : lang === 'ko' ? '구름 많음' : 'Cloudy', icon: <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 3:
      return { desc: isZh ? '陰天' : lang === 'ja' ? '曇天' : lang === 'ko' ? '흐림' : 'Overcast', icon: <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 45:
    case 48:
      return { desc: isZh ? '有霧' : lang === 'ja' ? '霧' : lang === 'ko' ? '안개' : 'Foggy', icon: <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return { desc: isZh ? '雨天' : lang === 'ja' ? '雨' : lang === 'ko' ? '비' : 'Rainy', icon: <UmbrellaIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 71:
    case 73:
    case 75:
    case 77:
      return { desc: isZh ? '雪天' : lang === 'ja' ? '雪' : lang === 'ko' ? '눈' : 'Snowy', icon: <SnowflakeIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 80:
      return { desc: isZh ? '小陣雨' : lang === 'ja' ? '小雨' : lang === 'ko' ? '소나기' : 'Light Showers', icon: <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 81:
      return { desc: isZh ? '陣雨' : lang === 'ja' ? 'にわか雨' : lang === 'ko' ? '소나기' : 'Showers', icon: <UmbrellaIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 82:
      return { desc: isZh ? '暴陣雨' : lang === 'ja' ? '豪雨' : lang === 'ko' ? '폭우' : 'Heavy Showers', icon: <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 85:
    case 86:
      return { desc: isZh ? '陣雪' : lang === 'ja' ? 'にわか雪' : lang === 'ko' ? '눈보라' : 'Snow Showers', icon: <SnowflakeIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 95:
      return { desc: isZh ? '雷陣雨' : lang === 'ja' ? '雷雨' : lang === 'ko' ? '뇌우' : 'Thunderstorms', icon: <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    case 96:
    case 99:
      return { desc: isZh ? '雷雨伴有冰雹' : lang === 'ja' ? '雹を伴う雷雨' : lang === 'ko' ? '우박을 동반한 뇌우' : 'Thunderstorms with Hail', icon: <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
    default:
      return { desc: isZh ? '未知天氣' : lang === 'ja' ? '不明な天気' : lang === 'ko' ? '알 수 없는 날씨' : 'Unknown', icon: <ThermometerIcon size="1.2em" style={{ verticalAlign: 'middle' }} /> }
  }
}

// Get AQI category details
function getAqiDetails(aqi: number, lang: string = 'zh-TW'): { label: string; className: string; advice: string } {
  const isZh = lang === 'zh-TW'
  if (aqi <= 50) {
    return {
      label: isZh ? '良好' : lang === 'ja' ? '良好' : lang === 'ko' ? '좋음' : 'Good',
      className: 'aqi-good',
      advice: isZh 
        ? '空氣品質良好，非常適合前往演唱會與進行戶外活動！' 
        : lang === 'ja' 
          ? '空気質は良好です。ライブ参加やアウトドア活動に最適です！' 
          : lang === 'ko' 
            ? '공기질이 좋습니다. 콘서트 관람 및 야외 활동을 하기에 아주 적합합니다!' 
            : 'Air quality is good, perfect for concerts and outdoor activities!',
    }
  } else if (aqi <= 100) {
    return {
      label: isZh ? '普通' : lang === 'ja' ? '普通' : lang === 'ko' ? '보통' : 'Moderate',
      className: 'aqi-moderate',
      advice: isZh 
        ? '空氣品質普通，敏感族群可適度防護。' 
        : lang === 'ja' 
          ? '空気質は普通です。敏感な方は適度な対策をお勧めします。' 
          : lang === 'ko' 
            ? '공기질이 보통입니다. 민감군 환자는 가벼운 대비를 하시기 바랍니다.' 
            : 'Air quality is moderate, sensitive groups should take precautions.',
    }
  } else if (aqi <= 150) {
    return {
      label: isZh ? '敏感不良' : lang === 'ja' ? '敏感肌に好ましくない' : lang === 'ko' ? '민감군 영향' : 'Unhealthy for Sensitive Groups',
      className: 'aqi-sensitive',
      advice: isZh 
        ? '空氣對敏感族群不健康，建議敏感族群配戴口罩。' 
        : lang === 'ja' 
          ? '敏感なグループの健康に悪影響を及ぼす可能性があります。マスクの着用をお勧めします。' 
          : lang === 'ko' 
            ? '민감군에게 해로울 수 있으므로 마스크 착용을 권장합니다.' 
            : 'Air quality is unhealthy for sensitive groups, masks recommended.',
    }
  } else {
    return {
      label: isZh ? '不良' : lang === 'ja' ? '健康に良くない' : lang === 'ko' ? '나쁨' : 'Unhealthy',
      className: 'aqi-unhealthy',
      advice: isZh 
        ? '空氣品質不良！一般樂迷也建議佩戴口罩，並減少戶外長時間劇烈運動。' 
        : lang === 'ja' 
          ? '空気質が悪いです！マスクの着用をお勧めします。屋外での長時間の激しい運動は避けてください。' 
          : lang === 'ko' 
            ? '공기질이 나쁩니다! 일반 관객분들도 마스크를 착용하시고 야외에서의 격렬한 운동을 자제해 주세요.' 
            : 'Air quality is unhealthy! General audience is advised to wear masks and limit strenuous outdoor activities.',
    }
  }
}

// Generate weather specific advisories/warnings
function getWeatherWarnings(weather: WeatherData, lang: string = 'zh-TW'): string[] {
  const warnings: string[] = []
  const isZh = lang === 'zh-TW'

  // Rain alerts based on WMO codes
  const heavyRainCodes = [65, 82, 95, 96, 99]
  const lightRainCodes = [51, 53, 55, 56, 57, 61, 63, 66, 67, 80, 81]

  if (heavyRainCodes.includes(weather.weatherCode)) {
    warnings.push(
      isZh 
        ? '劇烈降雨警告：目前降雨強烈，請攜帶雨具，避開積水路段，注意安全！' 
        : lang === 'ja' 
          ? '豪雨警告：強い雨が降っています。雨具を持参し、冠水道路を避けて安全に注意してください！' 
          : lang === 'ko' 
            ? '호우 경보: 강한 비가 내리고 있습니다. 우산을 준비하고 침수된 도로를 피해 안전에 유의하세요!' 
            : 'Heavy rain warning: Strong rainfall, please bring rain gear, avoid flooded roads and stay safe!'
    )
  } else if (lightRainCodes.includes(weather.weatherCode)) {
    warnings.push(
      isZh 
        ? '降雨提醒：目前有降雨，若屬半戶外/戶外場地請備妥雨傘或雨衣。' 
        : lang === 'ja' 
          ? '降水注意：雨が降っています。半屋外・屋外会場の場合は傘やレインコートをご用意ください。' 
          : lang === 'ko' 
            ? '강수 안내: 비가 내리고 있습니다. 반야외/야외 공연장인 경우 우산이나 우비를 준비하세요.' 
            : 'Rain notice: Light rain falling, please prepare umbrellas or raincoats if it is an outdoor venue.'
    )
  }

  // Temperature alerts
  if (weather.feelsLike >= 35) {
    warnings.push(
      isZh 
        ? '高溫警報：體感溫度偏高，請多補水、防曬，防範熱傷害。' 
        : lang === 'ja' 
          ? '高温警報：体感温度が非常に高いです。水分補給と日焼け対策を怠らず、熱中症に注意してください。' 
          : lang === 'ko' 
            ? '폭염 경보: 체감 온도가 높습니다. 수분을 충분히 섭취하고 자외선을 차단하여 온열질환에 유의하세요.' 
            : 'High temperature warning: Apparent temperature is very high, please hydrate, wear sunscreen, and prevent heat exhaustion.'
    )
  } else if (weather.temp <= 15) {
    warnings.push(
      isZh 
        ? '低溫提醒：天氣寒冷，前往場館請多穿衣物注意保暖防寒。' 
        : lang === 'ja' 
          ? '低温注意：寒い天気です。会場へお越しの際は防寒対策をしっかり行ってください。' 
          : lang === 'ko' 
            ? '한파 안내: 날씨가 춥습니다. 공연장에 방문하실 때 옷을 따뜻하게 입고 보온에 유의하세요.' 
            : 'Low temperature warning: Cold weather, please dress warmly and keep warm when going to the venue.'
    )
  }

  // Wind speed alert (wind speed from Open-Meteo is in km/h)
  if (weather.windSpeed >= 20) {
    warnings.push(
      isZh 
        ? '強風提醒：風速較強，若在戶外排隊請注意防風，保管好隨身物品。' 
        : lang === 'ja' 
          ? '強風注意：風が強いです。屋外での整列時は防風に注意し、手荷物をしっかり管理してください。' 
          : lang === 'ko' 
            ? '강풍 안내: 바람이 강하게 붑니다. 야외 대기 시 방풍에 유의하고 소지품을 잘 보관하세요.' 
            : 'Strong wind notice: Wind speed is high, please block wind when queueing outdoors and secure your belongings.'
    )
  }

  return warnings
}

export function VenueWeather({ latitude, longitude, cityName, onClose, onViewDetails }: VenueWeatherProps) {
  const { t, lang } = useTranslation()
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
      // Fetch both weather and AQI concurrently
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
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

      const newWeather: WeatherData = {
        temp: Math.round(weatherJson.current.temperature_2m),
        feelsLike: Math.round(weatherJson.current.apparent_temperature),
        humidity: Math.round(weatherJson.current.relative_humidity_2m),
        weatherCode: weatherJson.current.weather_code,
        windSpeed: Math.round(weatherJson.current.wind_speed_10m)
      }

      const newAqi: AqiData = {
        aqi: Math.round(aqiJson.current.us_aqi),
        pm25: Math.round(aqiJson.current.pm2_5),
        pm10: Math.round(aqiJson.current.pm10)
      }

      const dailyData = weatherJson.daily
      const newDaily: DailyForecast[] = []
      if (dailyData && dailyData.time) {
        for (let i = 0; i < 7 && i < dailyData.time.length; i++) {
          newDaily.push({
            date: dailyData.time[i],
            tempMax: Math.round(dailyData.temperature_2m_max[i]),
            tempMin: Math.round(dailyData.temperature_2m_min[i]),
            weatherCode: dailyData.weather_code[i]
          })
        }
      }

      setWeather(newWeather)
      setAqi(newAqi)
      setDailyForecast(newDaily)
      setIsFallback(false)

      // Store in cache
      weatherCache.set(cacheKey, {
        data: { weather: newWeather, aqi: newAqi, daily: newDaily },
        timestamp: Date.now()
      })
    } catch (err) {
      console.warn('Unable to load real-time weather from Open-Meteo, using offline simulated data.', err)
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
        <span className="spinner" /> {lang === 'zh-TW' ? '讀取天氣資訊中...' : lang === 'en' ? 'Loading weather...' : lang === 'ja' ? '天気情報を読み込み中...' : '날씨 정보를 불러오는 중...'}
      </div>
    )
  }

  if (!weather || !aqi) {
    return null
  }

  const weatherInfo = parseWeatherCode(weather.weatherCode, lang)
  const aqiInfo = getAqiDetails(aqi.aqi, lang)
  const warnings = getWeatherWarnings(weather, lang)

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <div className="weather-title">
          <span>
            <CloudSunIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {t('weatherTitle')}
          </span>
          {isFallback && <span className="fallback-badge" title="暫時無法連接中央氣象服務，顯示模擬氣候資訊">{lang === 'zh-TW' ? '模擬數據' : lang === 'en' ? 'Simulated' : lang === 'ja' ? 'シミュレーション' : '시뮬레이션'}</span>}
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
              <span className="label">{lang === 'zh-TW' ? '體感溫度' : lang === 'en' ? 'Feels Like' : lang === 'ja' ? '体感温度' : '체감 온도'}</span>
              <span className="value">{weather.feelsLike}°C</span>
            </div>
            <div className="detail-item">
              <span className="label">{lang === 'zh-TW' ? '相對濕度' : lang === 'en' ? 'Humidity' : lang === 'ja' ? '相対湿度' : '상대 습도'}</span>
              <span className="value">{weather.humidity}%</span>
            </div>
            <div className="detail-item">
              <span className="label">{lang === 'zh-TW' ? '目前風速' : lang === 'en' ? 'Wind Speed' : lang === 'ja' ? '現在の風速' : '현재 풍속'}</span>
              <span className="value">{weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>

        {/* Air Quality section */}
        <div className="weather-aqi-section">
          <div className="aqi-badge-container">
            <span className="label">{lang === 'zh-TW' ? '空氣品質指數' : lang === 'en' ? 'Air Quality Index' : lang === 'ja' ? '空気質指数' : '대기질 지수'}</span>
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
              {t('sevenDayForecast')}
            </div>
            <div className="forecast-grid">
              {dailyForecast.map((day) => {
                const info = parseWeatherCode(day.weatherCode, lang)
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
            {lang === 'zh-TW' ? '貼心防護警語與建議' : lang === 'en' ? 'Health Advisory & Advice' : lang === 'ja' ? '健康上の注意とアドバイス' : '건강 권고사항 및 조언'}
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
                {lang === 'zh-TW' 
                  ? '天氣晴朗炎熱，若前往戶外排隊請做好防曬，適時補充水分喔！' 
                  : lang === 'ja'
                    ? '快晴で暑い天気です。屋外で並ぶ際は日焼け対策を行い、適度に水分を補給してください！'
                    : lang === 'ko'
                      ? '날씨가 맑고 덥습니다. 야외 대기 시 자외선 차단에 신경 쓰시고 수분을 충분히 섭취하세요!'
                      : 'It is sunny and hot, please wear sunscreen and drink plenty of water if queueing outdoors!'}
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
            {lang === 'zh-TW' ? '查看場館詳情與記錄' : lang === 'en' ? 'View Venue Details & Logs' : lang === 'ja' ? '会場の詳細と記録を表示' : '공연장 상세 정보 및 기록 보기'}
          </button>
        )}
      </div>
    </div>
  )
}
