import { useState, useEffect, useCallback } from 'react'

interface VenueWeatherProps {
  latitude?: number
  longitude?: number
  cityName: string
  onClose?: () => void
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

// Module-level cache to store weather responses for 5 minutes
const weatherCache = new Map<string, { data: { weather: WeatherData; aqi: AqiData }; timestamp: number }>()
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Map WMO Weather Codes to Description and Emoji
function parseWeatherCode(code: number): { desc: string; emoji: string } {
  switch (code) {
    case 0:
      return { desc: '晴朗', emoji: '☀️' }
    case 1:
      return { desc: '晴間多雲', emoji: '🌤️' }
    case 2:
      return { desc: '多雲', emoji: '⛅' }
    case 3:
      return { desc: '陰天', emoji: '☁️' }
    case 45:
    case 48:
      return { desc: '有霧', emoji: '🌫️' }
    case 51:
    case 53:
    case 55:
      return { desc: '毛毛雨', emoji: '🌧️' }
    case 56:
    case 57:
      return { desc: '凍毛毛雨', emoji: '🌧️' }
    case 61:
      return { desc: '小雨', emoji: '🌧️' }
    case 63:
      return { desc: '中雨', emoji: '🌧️' }
    case 65:
      return { desc: '大雨', emoji: '🌧️' }
    case 66:
    case 67:
      return { desc: '凍雨', emoji: '🌧️' }
    case 71:
      return { desc: '小雪', emoji: '❄️' }
    case 73:
      return { desc: '中雪', emoji: '❄️' }
    case 75:
      return { desc: '大雪', emoji: '❄️' }
    case 77:
      return { desc: '雪粒', emoji: '❄️' }
    case 80:
      return { desc: '小陣雨', emoji: '🌦️' }
    case 81:
      return { desc: '陣雨', emoji: '🌧️' }
    case 82:
      return { desc: '暴陣雨', emoji: '⛈️' }
    case 85:
    case 86:
      return { desc: '陣雪', emoji: '❄️' }
    case 95:
      return { desc: '雷陣雨', emoji: '⛈️' }
    case 96:
    case 99:
      return { desc: '雷雨伴有冰雹', emoji: '⛈️' }
    default:
      return { desc: '未知天氣', emoji: '🌡️' }
  }
}

// Get AQI category details
function getAqiDetails(aqi: number): { label: string; className: string; advice: string } {
  if (aqi <= 50) {
    return {
      label: '良好',
      className: 'aqi-good',
      advice: '🟢 空氣品質良好，非常適合前往演唱會與進行戶外活動！',
    }
  } else if (aqi <= 100) {
    return {
      label: '普通',
      className: 'aqi-moderate',
      advice: '🟡 空氣品質普通，敏感族群可適度防護。',
    }
  } else if (aqi <= 150) {
    return {
      label: '敏感不良',
      className: 'aqi-sensitive',
      advice: '🟠 空氣對敏感族群不健康，建議敏感族群配戴口罩。',
    }
  } else {
    return {
      label: '不良',
      className: 'aqi-unhealthy',
      advice: '🔴 空氣品質不良！一般樂迷也建議佩戴口罩，並減少戶外長時間劇烈運動。',
    }
  }
}

// Generate weather specific advisories/warnings
function getWeatherWarnings(weather: WeatherData): string[] {
  const warnings: string[] = []

  // Rain alerts based on WMO codes
  const heavyRainCodes = [65, 82, 95, 96, 99]
  const lightRainCodes = [51, 53, 55, 56, 57, 61, 63, 66, 67, 80, 81]

  if (heavyRainCodes.includes(weather.weatherCode)) {
    warnings.push('⚠️ 劇烈降雨警告：目前降雨強烈，請攜帶雨具，避開積水路段，注意安全！')
  } else if (lightRainCodes.includes(weather.weatherCode)) {
    warnings.push('☔ 降雨提醒：目前有降雨，若屬半戶外/戶外場地請備妥雨傘或雨衣。')
  }

  // Temperature alerts
  if (weather.feelsLike >= 35) {
    warnings.push('🥵 高溫警報：體感溫度偏高，請多補水、防曬，防範熱傷害。')
  } else if (weather.temp <= 15) {
    warnings.push('🥶 低溫提醒：天氣寒冷，前往場館請多穿衣物注意保暖防寒。')
  }

  // Wind speed alert (wind speed from Open-Meteo is in km/h)
  if (weather.windSpeed >= 20) {
    warnings.push('💨 強風提醒：風速較強，若在戶外排隊請注意防風，保管好隨身物品。')
  }

  return warnings
}

export function VenueWeather({ latitude, longitude, cityName, onClose }: VenueWeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [aqi, setAqi] = useState<AqiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

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
      setIsFallback(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch both weather and AQI concurrently
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
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

      setWeather(newWeather)
      setAqi(newAqi)
      setIsFallback(false)

      // Store in cache
      weatherCache.set(cacheKey, {
        data: { weather: newWeather, aqi: newAqi },
        timestamp: Date.now()
      })
    } catch (err) {
      console.warn('Unable to load real-time weather from Open-Meteo, using offline simulated data.', err)
      // Generates elegant fallback simulated data based on season (June) and location
      const month = new Date().getMonth() + 1
      let baseTemp = 22
      let baseHumidity = 75
      let isSummer = month >= 6 && month <= 9
      let isWinter = month === 12 || month <= 2

      if (isSummer) {
        baseTemp = 30
      } else if (isWinter) {
        baseTemp = 16
      } else {
        baseTemp = 24
      }

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

      setWeather(fallbackWeather)
      setAqi(fallbackAqi)
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude, cityName])

  useEffect(() => {
    fetchWeather()
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

  const weatherInfo = parseWeatherCode(weather.weatherCode)
  const aqiInfo = getAqiDetails(aqi.aqi)
  const warnings = getWeatherWarnings(weather)

  return (
    <div className="weather-widget">
      <div className="weather-header">
        <div className="weather-title">
          <span>🌦️ 即時天氣預報</span>
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
            {loading ? '↻' : '⟲'}
          </button>
          {onClose && (
            <button
              className="weather-close-btn"
              type="button"
              onClick={onClose}
              title="關閉氣象預報"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="weather-body">
        {/* Main temperature and weather condition */}
        <div className="weather-main">
          <div className="weather-temp-section">
            <span className="weather-emoji" role="img" aria-label={weatherInfo.desc}>
              {weatherInfo.emoji}
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

        {/* Warnings & Suggestions alerts */}
        <div className="weather-alerts">
          <div className="alerts-title">📝 貼心防護警語與建議</div>
          <div className="alerts-list">
            <div className="alert-item aqi-advice">{aqiInfo.advice}</div>
            {warnings.map((warning, index) => (
              <div key={index} className="alert-item weather-warning">
                {warning}
              </div>
            ))}
            {warnings.length === 0 && weather.weatherCode === 0 && (
              <div className="alert-item weather-sunny">
                ☀️ 天氣晴朗炎熱，若前往戶外排隊請做好防曬，適時補充水分喔！
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
