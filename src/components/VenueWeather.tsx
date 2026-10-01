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
  address?: string
  onClose?: () => void
  onViewDetails?: () => void
}

interface WeatherData {
  temp: number
  feelsLike: number
  humidity: number
  weatherCode: number
  windSpeed: number
  pop?: number // 降雨機率 %
  cwaDesc?: string // CWA 原文天氣現象描述
  cwaSummary?: string // CWA 綜合預報描述
  uvIndex?: number // 紫外線指數
  uvLevel?: string // 紫外線等級
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
  rain?: string
}

// Module-level cache to store weather responses for 5 minutes
const weatherCache = new Map<string, { data: { weather: WeatherData; aqi: AqiData; daily: DailyForecast[]; isCwa: boolean }; timestamp: number }>()
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Central Weather Administration (CWA) API Key
const CWA_API_KEY = import.meta.env.VITE_CWA_API_KEY || 'CWA-B04957E8-910E-4E55-BC61-A01FFF86B1AE'

/**
 * 依據場館城市名稱或地址，對應到中央氣象署 (CWA) 的 22 個法定縣市名稱
 */
export function getCwaLocationName(cityName: string, address?: string): string {
  const text = (address || cityName || '').trim()
  if (text.includes('臺北') || text.includes('台北')) return '臺北市'
  if (text.includes('新北')) return '新北市'
  if (text.includes('桃園')) return '桃園市'
  if (text.includes('臺中') || text.includes('台中')) return '臺中市'
  if (text.includes('臺南') || text.includes('台南')) return '臺南市'
  if (text.includes('高雄')) return '高雄市'
  if (text.includes('基隆')) return '基隆市'
  if (text.includes('新竹縣')) return '新竹縣'
  if (text.includes('新竹')) return '新竹市'
  if (text.includes('嘉義縣')) return '嘉義縣'
  if (text.includes('嘉義')) return '嘉義市'
  if (text.includes('苗栗')) return '苗栗縣'
  if (text.includes('彰化')) return '彰化縣'
  if (text.includes('南投')) return '南投縣'
  if (text.includes('雲林')) return '雲林縣'
  if (text.includes('屏東')) return '屏東縣'
  if (text.includes('宜蘭')) return '宜蘭縣'
  if (text.includes('花蓮')) return '花蓮縣'
  if (text.includes('臺東') || text.includes('台東')) return '臺東縣'
  if (text.includes('澎湖')) return '澎湖縣'
  if (text.includes('金門')) return '金門縣'
  if (text.includes('連江') || text.includes('馬祖')) return '連江縣'
  return '臺北市'
}

/**
 * 解析天氣現象代碼 (相容 CWA 與 WMO) 並回傳描述與圖示
 */
function parseWeatherCode(code: number, lang: string = 'zh-TW', rawDesc?: string): { desc: string; icon: React.ReactNode } {
  const isZh = lang === 'zh-TW'
  let desc = rawDesc || ''
  let icon: React.ReactNode = <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />

  // 晴天
  if (code === 1 || code === 0) {
    icon = <SunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? '晴朗' : lang === 'ja' ? '快晴' : lang === 'ko' ? '맑음' : 'Clear Sky'
    }
  }
  // 晴時多雲、多雲時晴、多雲
  else if (code >= 2 && code <= 4) {
    icon = <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? (code === 4 ? '多雲' : '晴時多雲') : lang === 'ja' ? '晴れ時々曇り' : lang === 'ko' ? '구름 조금' : 'Partly Cloudy'
    }
  }
  // 多雲時陰、陰天
  else if ((code >= 5 && code <= 7) || code === 3) {
    icon = <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? (code === 7 ? '陰天' : '多雲時陰') : lang === 'ja' ? '曇天' : lang === 'ko' ? '흐림' : 'Overcast'
    }
  }
  // 陣雨、短暫陣雨、雨天
  else if (
    (code >= 8 && code <= 14) ||
    code === 19 || code === 20 ||
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  ) {
    icon = <UmbrellaIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? '短暫陣雨' : lang === 'ja' ? 'にわか雨' : lang === 'ko' ? '소나기' : 'Showers'
    }
  }
  // 雷陣雨、雷雨
  else if (
    (code >= 15 && code <= 18) ||
    code === 21 || code === 22 ||
    (code >= 29 && code <= 42) ||
    [95, 96, 99].includes(code)
  ) {
    icon = <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? '雷陣雨' : lang === 'ja' ? '雷雨' : lang === 'ko' ? '뇌우' : 'Thunderstorms'
    }
  }
  // 霧、雪
  else if ((code >= 23 && code <= 28) || [45, 48, 71, 73, 75, 77, 85, 86].includes(code)) {
    icon = (code === 23 || code === 45 || code === 48)
      ? <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      : <SnowflakeIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    if (!desc || !isZh) {
      desc = isZh ? (code === 23 ? '有霧' : '降雪') : lang === 'ja' ? '霧/雪' : lang === 'ko' ? '안개/눈' : 'Fog/Snow'
    }
  }
  // 其他/文字輔助判斷
  else {
    if (rawDesc) {
      if (rawDesc.includes('雷')) icon = <CloudLightningIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      else if (rawDesc.includes('雨')) icon = <UmbrellaIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      else if (rawDesc.includes('陰')) icon = <CloudIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      else if (rawDesc.includes('晴')) icon = <SunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      else icon = <CloudSunIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
    } else {
      icon = <ThermometerIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
      desc = isZh ? '晴間多雲' : 'Partly Cloudy'
    }
  }

  return { desc: desc || (isZh ? '晴間多雲' : 'Partly Cloudy'), icon }
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

  // Rain alerts based on CWA / WMO codes
  const heavyRainCodes = [15, 16, 17, 18, 21, 22, 29, 30, 31, 32, 33, 34, 35, 36, 65, 82, 95, 96, 99]
  const lightRainCodes = [8, 9, 10, 11, 12, 13, 14, 19, 20, 51, 53, 55, 56, 57, 61, 63, 66, 67, 80, 81]

  if (heavyRainCodes.includes(weather.weatherCode)) {
    warnings.push(
      isZh 
        ? '劇烈降雨/雷雨警告：目前有強降雨或雷陣雨，請務必攜帶雨具，避開低窪積水路段，注意安全！' 
        : lang === 'ja' 
          ? '豪雨・雷雨警告：強い雨や雷雨が予想されます。雨具を持参し、冠水道路を避けて安全に注意してください！' 
          : lang === 'ko' 
            ? '호우/뇌우 경보: 강한 비나 뇌우가 발생 중입니다. 우산을 준비하고 침수된 도로를 피해 안전에 유의하세요!' 
            : 'Heavy rain/thunderstorm warning: Strong rainfall or thunderstorm, please bring rain gear, avoid flooded roads and stay safe!'
    )
  } else if (lightRainCodes.includes(weather.weatherCode) || (weather.pop !== undefined && weather.pop >= 40)) {
    const popMsg = weather.pop !== undefined ? `（降雨機率 ${weather.pop}%）` : ''
    warnings.push(
      isZh 
        ? `降雨提醒：目前有降雨或預報降雨${popMsg}，若屬半戶外/戶外場地請備妥雨傘或雨衣。` 
        : lang === 'ja' 
          ? '降水注意：雨が降っています。半屋外・屋外会場の場合は傘やレインコートをご用意ください。' 
          : lang === 'ko' 
            ? '강수 안내: 비가 내리고 있습니다. 반야외/야외 공연장인 경우 우산이나 우비를 준비하세요.' 
            : 'Rain notice: Light rain likely, please prepare umbrellas or raincoats if it is an outdoor venue.'
    )
  }

  // Temperature alerts
  if (weather.feelsLike >= 35) {
    warnings.push(
      isZh 
        ? '高溫警報：體感溫度偏高（≧35°C），請多補水、防曬，防範熱傷害。' 
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

  // Wind speed alert (in km/h)
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

  // UV alert
  if (weather.uvIndex && weather.uvIndex >= 8) {
    warnings.push(
      isZh
        ? `紫外線警報：紫外線指數達 ${weather.uvIndex}（${weather.uvLevel || '過量級'}），戶外活動請做好防曬與水分補充。`
        : `UV Warning: UV Index is ${weather.uvIndex} (${weather.uvLevel || 'Very High'}), please apply sunscreen and drink water.`
    )
  }

  return warnings
}

export function VenueWeather({ latitude, longitude, cityName, address, onClose, onViewDetails }: VenueWeatherProps) {
  const { t, lang } = useTranslation()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [aqi, setAqi] = useState<AqiData | null>(null)
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [isCwa, setIsCwa] = useState(false)

  const cwaLocationName = getCwaLocationName(cityName, address)

  const getDayLabel = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const tomorrow = new Date()
      tomorrow.setDate(today.getDate() + 1)
      const dayAfter = new Date()
      dayAfter.setDate(today.getDate() + 2)

      const isZh = lang === 'zh-TW'
      if (date.toDateString() === today.toDateString()) {
        return isZh ? '今天' : lang === 'ja' ? '今日' : lang === 'ko' ? '오늘' : 'Today'
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return isZh ? '明天' : lang === 'ja' ? '明日' : lang === 'ko' ? '내일' : 'Tomorrow'
      } else if (date.toDateString() === dayAfter.toDateString()) {
        return isZh ? '後天' : lang === 'ja' ? '明後日' : lang === 'ko' ? '모레' : 'Day After'
      } else {
        const days = isZh 
          ? ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
          : lang === 'ja'
            ? ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
            : lang === 'ko'
              ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        return days[date.getDay()]
      }
    } catch {
      return dateStr
    }
  }

  const fetchWeather = useCallback(async (forceRefresh = false) => {
    if (!cityName && (!latitude || !longitude)) {
      setError('此場地暫無位置資訊')
      return
    }

    const cwaLocation = getCwaLocationName(cityName, address)
    const cacheKey = `${cwaLocation}_${(latitude || 0).toFixed(3)},${(longitude || 0).toFixed(3)}`
    const cached = weatherCache.get(cacheKey)

    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      setWeather(cached.data.weather)
      setAqi(cached.data.aqi)
      setDailyForecast(cached.data.daily)
      setIsCwa(cached.data.isCwa)
      setIsFallback(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    // Air quality data (from Open-Meteo Air Quality API, as CWA does not host AQI)
    let fetchedAqi: AqiData = { aqi: 42, pm25: 11, pm10: 18 }
    if (latitude && longitude) {
      try {
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5,pm10`
        const aqiRes = await fetch(aqiUrl)
        if (aqiRes.ok) {
          const aqiJson = await aqiRes.json()
          if (aqiJson?.current) {
            fetchedAqi = {
              aqi: Math.round(aqiJson.current.us_aqi ?? 42),
              pm25: Math.round(aqiJson.current.pm2_5 ?? 11),
              pm10: Math.round(aqiJson.current.pm10 ?? 18)
            }
          }
        }
      } catch (err) {
        console.warn('AQI fetch failed, using fallback values.', err)
      }
    }

    try {
      // 1. Primary: Central Weather Administration (中央氣象署) API
      const cwaUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-091?Authorization=${CWA_API_KEY}&LocationName=${encodeURIComponent(cwaLocation)}`
      const cwaRes = await fetch(cwaUrl)

      if (!cwaRes.ok) {
        throw new Error(`CWA API responded with status ${cwaRes.status}`)
      }

      const cwaJson = await cwaRes.json()
      const loc = cwaJson.records?.Locations?.[0]?.Location?.[0]
      if (!loc) {
        throw new Error('Location not found in CWA data')
      }

      const getEl = (name: string) => loc.WeatherElement?.find((e: any) => e.ElementName === name)?.Time?.[0]?.ElementValue?.[0]

      const temp = parseInt(getEl('平均溫度')?.Temperature || '26')
      const maxApp = parseInt(getEl('最高體感溫度')?.MaxApparentTemperature || String(temp))
      const minApp = parseInt(getEl('最低體感溫度')?.MinApparentTemperature || String(temp))
      const feelsLike = Math.round((maxApp + minApp) / 2)
      const humidity = parseInt(getEl('平均相對濕度')?.RelativeHumidity || '70')
      const windMps = parseFloat(getEl('風速')?.WindSpeed || '2')
      const windSpeed = Math.round(windMps * 3.6) // m/s to km/h
      const wx = getEl('天氣現象')
      const weatherCode = parseInt(wx?.WeatherCode || '1')
      const cwaDesc = wx?.Weather || '晴'
      const popRaw = getEl('12小時降雨機率')?.ProbabilityOfPrecipitation
      const pop = popRaw && popRaw !== '-' ? parseInt(popRaw) : undefined
      const uvEl = getEl('紫外線指數')
      const uvIndex = uvEl?.UVIndex ? parseInt(uvEl.UVIndex) : undefined
      const uvLevel = uvEl?.UVExposureLevel
      const cwaSummary = getEl('天氣預報綜合描述')?.WeatherDescription

      const newWeather: WeatherData = {
        temp,
        feelsLike,
        humidity,
        weatherCode,
        windSpeed,
        pop,
        cwaDesc,
        cwaSummary,
        uvIndex,
        uvLevel
      }

      // Group 14 time periods into 7 daily forecasts
      const wxEl = loc.WeatherElement.find((e: any) => e.ElementName === '天氣現象')
      const maxTEl = loc.WeatherElement.find((e: any) => e.ElementName === '最高溫度')
      const minTEl = loc.WeatherElement.find((e: any) => e.ElementName === '最低溫度')
      const popEl = loc.WeatherElement.find((e: any) => e.ElementName === '12小時降雨機率')

      const dailyMap = new Map<string, DailyForecast>()
      const times = wxEl?.Time || []
      for (let i = 0; i < times.length; i++) {
        const start = times[i].StartTime
        const date = start.split('T')[0]
        const max = parseInt(maxTEl?.Time?.[i]?.ElementValue?.[0]?.MaxTemperature || '0')
        const min = parseInt(minTEl?.Time?.[i]?.ElementValue?.[0]?.MinTemperature || '0')
        const code = parseInt(times[i].ElementValue?.[0]?.WeatherCode || '1')
        const desc = times[i].ElementValue?.[0]?.Weather || ''
        const rain = popEl?.Time?.[i]?.ElementValue?.[0]?.ProbabilityOfPrecipitation

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            tempMax: max,
            tempMin: min,
            weatherCode: code,
            desc,
            rain: rain !== '-' ? rain : undefined
          })
        } else {
          const item = dailyMap.get(date)!
          item.tempMax = Math.max(item.tempMax, max)
          item.tempMin = Math.min(item.tempMin, min)
          if (start.includes('06:00') || start.includes('12:00')) {
            item.weatherCode = code
            item.desc = desc
          }
          if (!item.rain && rain && rain !== '-') {
            item.rain = rain
          }
        }
      }
      const newDaily = Array.from(dailyMap.values()).slice(0, 7)

      setWeather(newWeather)
      setAqi(fetchedAqi)
      setDailyForecast(newDaily)
      setIsCwa(true)
      setIsFallback(false)

      weatherCache.set(cacheKey, {
        data: { weather: newWeather, aqi: fetchedAqi, daily: newDaily, isCwa: true },
        timestamp: Date.now()
      })
    } catch (cwaErr) {
      console.warn('CWA API unavailable, falling back to Open-Meteo...', cwaErr)

      try {
        if (!latitude || !longitude) throw new Error('No coordinates for fallback')
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
        const weatherRes = await fetch(weatherUrl)
        if (!weatherRes.ok) throw new Error('Open-Meteo failed')

        const weatherJson = await weatherRes.json()
        const newWeather: WeatherData = {
          temp: Math.round(weatherJson.current.temperature_2m),
          feelsLike: Math.round(weatherJson.current.apparent_temperature),
          humidity: Math.round(weatherJson.current.relative_humidity_2m),
          weatherCode: weatherJson.current.weather_code,
          windSpeed: Math.round(weatherJson.current.wind_speed_10m)
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
        setAqi(fetchedAqi)
        setDailyForecast(newDaily)
        setIsCwa(false)
        setIsFallback(false)

        weatherCache.set(cacheKey, {
          data: { weather: newWeather, aqi: fetchedAqi, daily: newDaily, isCwa: false },
          timestamp: Date.now()
        })
      } catch (fallbackErr) {
        console.warn('Using offline simulated weather data.', fallbackErr)
        const month = new Date().getMonth() + 1
        const isSummer = month >= 6 && month <= 9
        const isWinter = month === 12 || month <= 2
        const baseTemp = isSummer ? 30 : isWinter ? 16 : 24
        const offset = (cityName.length % 5) - 2
        const temp = baseTemp + offset

        const fallbackWeather: WeatherData = {
          temp,
          feelsLike: temp + (isSummer ? 3 : -1),
          humidity: 75 + (cityName.length * 3) % 15,
          weatherCode: 2,
          windSpeed: 8 + (cityName.length * 2) % 12,
          cwaDesc: '晴時多雲'
        }

        const fallbackDaily: DailyForecast[] = []
        for (let i = 0; i < 7; i++) {
          const nextDay = new Date()
          nextDay.setDate(new Date().getDate() + i)
          fallbackDaily.push({
            date: nextDay.toISOString().split('T')[0],
            tempMax: temp + 2 - (i % 2),
            tempMin: temp - 4 - (i % 3),
            weatherCode: (2 + i) % 4
          })
        }

        setWeather(fallbackWeather)
        setAqi(fetchedAqi)
        setDailyForecast(fallbackDaily)
        setIsCwa(false)
        setIsFallback(true)
      }
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude, cityName, address])

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
        <span className="spinner" /> {lang === 'zh-TW' ? '讀取中央氣象署資訊中...' : lang === 'en' ? 'Loading weather...' : lang === 'ja' ? '天気情報を読み込み中...' : '날씨 정보를 불러오는 중...'}
      </div>
    )
  }

  if (!weather || !aqi) {
    return null
  }

  const weatherInfo = parseWeatherCode(weather.weatherCode, lang, weather.cwaDesc)
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
          {isCwa && (
            <span className="cwa-badge" title={`資料來源：交通部中央氣象署 (${cwaLocationName})`}>
              中央氣象署 CWA
            </span>
          )}
          {isFallback && <span className="fallback-badge" title="暫時無法連接氣象服務，顯示模擬氣候資訊">{lang === 'zh-TW' ? '模擬數據' : lang === 'en' ? 'Simulated' : lang === 'ja' ? 'シミュレーション' : '시뮬레이션'}</span>}
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
            {weather.pop !== undefined && (
              <div className="detail-item">
                <span className="label">{lang === 'zh-TW' ? '降雨機率' : lang === 'en' ? 'Rain Chance' : lang === 'ja' ? '降水確率' : '강수 확률'}</span>
                <span className="value" style={{ color: weather.pop >= 40 ? '#38bdf8' : 'inherit' }}>{weather.pop}%</span>
              </div>
            )}
            <div className="detail-item">
              <span className="label">{lang === 'zh-TW' ? '目前風速' : lang === 'en' ? 'Wind Speed' : lang === 'ja' ? '現在の風速' : '현재 풍속'}</span>
              <span className="value">{weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>

        {/* CWA Weather Summary text */}
        {weather.cwaSummary && (
          <div className="weather-summary-banner" title={weather.cwaSummary}>
            {weather.cwaSummary}
          </div>
        )}

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
                const info = parseWeatherCode(day.weatherCode, lang, day.desc)
                const dayLabel = getDayLabel(day.date)
                const displayDesc = lang === 'zh-TW' && info.desc.length > 4
                  ? info.desc.replace(/短暫陣雨/g, '短暫雨').replace(/短暫雷陣雨/g, '雷雨').replace(/時多雲/g, '').replace(/時陰/g, '')
                  : info.desc

                return (
                  <div className="forecast-item" key={day.date}>
                    <span className="forecast-day">{dayLabel}</span>
                    <span className="forecast-emoji" title={info.desc}>{info.icon}</span>
                    <span className="forecast-desc" title={info.desc}>{displayDesc}</span>
                    <span className="forecast-temp">{day.tempMin}°~{day.tempMax}°C</span>
                    {day.rain && day.rain !== '-' && (
                      <span className="forecast-rain" title="降雨機率">💧{day.rain}%</span>
                    )}
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
            {warnings.length === 0 && weather.weatherCode <= 2 && (
              <div className="alert-item weather-sunny">
                <SunIcon size="0.95em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' 
                  ? '天氣舒適宜人，若前往戶外排隊請做好防曬，適時補充水分喔！' 
                  : lang === 'ja'
                    ? '快適な天気です。屋外で並ぶ際は日焼け対策を行い、適度に水分を補給してください！'
                    : lang === 'ko'
                      ? '날씨가 쾌적합니다. 야외 대기 시 자외선 차단에 신경 쓰시고 수분을 충분히 섭취하세요!'
                      : 'Pleasant weather, please wear sunscreen and drink plenty of water if queueing outdoors!'}
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
