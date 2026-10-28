import React, { useEffect, useMemo, useState } from 'react'
import type { RemoteConcert, RemoteConcertPayload } from '../types'
import { isTargetEventCategory } from '../utils/eventFilterHelper'
import { shortenCpblTeamName } from '../utils/cpblUtils'
import {
  TicketIcon,
  PaletteIcon,
  PinIcon,
  CalendarIcon,
  EyeIcon,
  CheckIcon,
  ClipboardIcon,
  CloseIcon,
  SparklesIcon,
  BaseballIcon
} from './SvgIcon'

// ─── 主題色票定義 ───────────────────────────────────────────────────────────────

export interface EmbedPaletteOption {
  id: string
  label: string
  hex: string
  bg: string
}

export const EMBED_PALETTES: EmbedPaletteOption[] = [
  { id: 'volcano', label: '經典黑橘', hex: '#ff9100', bg: '#141622' },
  { id: 'sage', label: '鼠尾草綠', hex: '#82947d', bg: '#181C14' },
  { id: 'ocean', label: '海洋青藍', hex: '#38bdf8', bg: '#0f172a' },
  { id: 'rose', label: '霓虹櫻花', hex: '#f43f5e', bg: '#1f1218' },
  { id: 'purple', label: '極光紫', hex: '#a855f7', bg: '#161122' },
  { id: 'gold', label: '皇家金', hex: '#eab308', bg: '#181510' }
]

export function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '').trim()
  if (clean.length !== 6) return '255, 145, 0'
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  return `${r}, ${g}, ${b}`
}

export function extractEmbedSubtitle(c: RemoteConcert): string {
  if (c.game_score) {
    const vTeam = shortenCpblTeamName(c.game_score.visiting_team)
    const hTeam = shortenCpblTeamName(c.game_score.home_team)
    if (c.game_score.status === 'scheduled') {
      return `${vTeam} vs ${hTeam}`
    }
    const statusLabel =
      c.game_score.status === 'live'
        ? '比賽中'
        : c.game_score.status_text || (c.game_score.status === 'finished' ? '已完賽' : '未開打')
    return `${vTeam} ${c.game_score.visiting_score ?? '-'} : ${c.game_score.home_score ?? '-'} ${hTeam} · ${statusLabel}`
  }
  if (c.artist && c.artist.trim()) return c.artist.trim()

  let s = (c.name || '').trim()
  s = s.replace(/^\s*(?:【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）)\s*/g, '')
  s = s.replace(/^[《「『【\s]+|[》」』】\s]+$/g, '')
  s = s.replace(/^(?:202\d\s*年?\s*)/, '')

  const tourRegex =
    /\s+(?:Prema\s+World\s+Tour|ASIA\s+ARENA\s+TOUR|ASIA\s+FAN\s*MEETING|ASIA\s+FAN\s*CONCERT|ASIA\s+TOUR|WORLD\s+TOUR|ARENA\s+TOUR|DOME\s+TOUR|LIVE\s+TOUR|CONCERT\s+TOUR|TOUR\s+202\d|FAN\s*MEETING|FAN\s*CONCERT|IN\s+TAIPEI|IN\s+KAOHSIUNG|IN\s+TAOYUAN)/i
  if (tourRegex.test(s)) {
    s = s.split(tourRegex)[0].trim()
  } else {
    const seps = ['《', '「', '『', '<', ' - ', ' – ', ' — ', '｜', '|', '：', ':', '★']
    for (const sep of seps) {
      if (s.includes(sep)) {
        const part = s.split(sep)[0].trim()
        if (part.length >= 2) {
          s = part
          break
        }
      }
    }
  }
  s = s.replace(/\s*(?:202\d|ASIA|WORLD|LIVE|TOUR)\s*$/i, '').trim()
  if (s && s !== c.name && s.length <= 28) {
    return s
  }
  const words = s.split(/\s+/)
  if (words.length > 1 && /^[A-Za-z0-9&'.]+$/.test(words[0])) {
    if (
      words.length > 2 &&
      /^[A-Za-z0-9&'.]+$/.test(words[1]) &&
      !/^(tour|live|in|at|asia|world|the|concert|arena|dome)$/i.test(words[1])
    ) {
      return `${words[0]} ${words[1]}`
    }
    return words[0]
  }
  return c.source || '售票活動'
}

export function formatEmbedVenue(c: RemoteConcert): string {
  const rawVal = c.venue_name || c.venue_raw || c.city
  if (!rawVal) return '地點待確認'
  if (c.venue_id === 'kaohsiung-natl' || rawVal === '國家體育場' || rawVal === '高雄國家體育場') {
    return '高雄世運'
  }
  return rawVal.replace(/臺/g, '台')
}

export function getTaipeiTodayStr(): string {
  const d = new Date()
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const taipeiTime = new Date(utc + 3600000 * 8)
  const yyyy = taipeiTime.getFullYear()
  const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
  const dd = String(taipeiTime.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ─── Code Icon (</> SVG) ────────────────────────────────────────────────────────

export const CodeSvgIcon: React.FC<{ size?: string | number; style?: React.CSSProperties }> = ({
  size = '1em',
  style
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

export const ExternalLinkSvgIcon: React.FC<{ size?: string | number; style?: React.CSSProperties }> = ({
  size = '1em',
  style
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

// ─── 1. 獨立嵌入視圖 (?embed=today) ─────────────────────────────────────────────

export const StandaloneEmbedTodayView: React.FC = () => {
  const [events, setEvents] = useState<RemoteConcert[]>([])
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const targetDate = params.get('date') || getTaipeiTodayStr()
  const cityFilter = (params.get('city') || '').replace(/臺/g, '台').trim()
  const venueFilter = (params.get('venue_id') || params.get('venue') || '').trim()
  const categoryFilter = (params.get('category') || '').trim()
  const paletteParam = (params.get('palette') || 'volcano').toLowerCase().trim()
  const customColorParam = (params.get('color') || '').replace('#', '').trim()
  const customBgParam = (params.get('bg') || '').replace('#', '').trim()

  const themeVars = useMemo(() => {
    const preset = EMBED_PALETTES.find((p) => p.id === paletteParam) || EMBED_PALETTES[0]
    let accentHex = preset.hex
    let bgHex = preset.bg
    if (/^[0-9a-fA-F]{6}$/.test(customColorParam)) {
      accentHex = `#${customColorParam.toLowerCase()}`
    }
    if (/^[0-9a-fA-F]{6}$/.test(customBgParam)) {
      bgHex = `#${customBgParam.toLowerCase()}`
    }
    return {
      accentHex,
      accentRgb: hexToRgbString(accentHex),
      bgHex
    }
  }, [paletteParam, customColorParam, customBgParam])

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.margin = '0'
    document.body.style.padding = '4px'

    const fetchEvents = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL || '/'
        const localUrl = `${baseUrl}concerts.json?t=${Date.now()}`
        const remoteUrl = `https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/concerts.json?t=${Date.now()}`

        const [localRes, remoteRes] = await Promise.all([
          fetch(localUrl, { cache: 'no-store' }).catch(() => null),
          fetch(remoteUrl, { cache: 'no-store' }).catch(() => null)
        ])

        let localData: RemoteConcertPayload | null = null
        let remoteData: RemoteConcertPayload | null = null
        if (localRes && localRes.ok) localData = await localRes.json().catch(() => null)
        if (remoteRes && remoteRes.ok) remoteData = await remoteRes.json().catch(() => null)

        let data: RemoteConcertPayload | null = null
        if (localData && remoteData) {
          const lt = localData.updated_at ? new Date(localData.updated_at).getTime() : 0
          const rt = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0
          data = rt > lt ? remoteData : localData
        } else {
          data = localData || remoteData
        }

        const rawList = Array.isArray(data?.events) ? data!.events : []
        setEvents(rawList.filter(isTargetEventCategory))
      } catch {
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const filteredCards = useMemo(() => {
    return events.filter((ev) => {
      const cleanDate = (ev.date || '').trim().replace(/\//g, '-')
      if (!cleanDate.startsWith(targetDate)) return false

      const city = (ev.city || '').replace(/臺/g, '台')
      if (cityFilter && !city.includes(cityFilter)) return false

      if (venueFilter && ev.venue_id !== venueFilter) return false

      const isSport = ev.source === '中華職棒' || ev.category === 'sport'
      const cat = isSport ? 'sport' : 'concert'
      if (categoryFilter && cat !== categoryFilter) return false

      return true
    })
  }, [events, targetDate, cityFilter, venueFilter, categoryFilter])

  return (
    <div
      style={
        {
          '--gold': themeVars.accentHex,
          '--gold-rgb': themeVars.accentRgb,
          '--teal': themeVars.accentHex,
          '--teal-rgb': themeVars.accentRgb,
          maxWidth: '440px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontFamily: '"Noto Sans TC", system-ui, -apple-system, sans-serif'
        } as React.CSSProperties
      }
    >
      {loading ? (
        <div
          style={{
            background: themeVars.bgHex,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '14px',
            padding: '1.35rem',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.86rem'
          }}
        >
          載入今日演出卡片中...
        </div>
      ) : filteredCards.length === 0 ? (
        <div
          style={{
            background: themeVars.bgHex,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '14px',
            padding: '1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'rgba(255,255,255,0.72)',
            fontSize: '0.86rem'
          }}
        >
          <CalendarIcon size="1.1em" style={{ color: themeVars.accentHex }} />
          <span>{targetDate} 今日暫無符合條件的演出活動</span>
        </div>
      ) : (
        filteredCards.map((concert) => {
          const subtitle = extractEmbedSubtitle(concert)
          const sourceBadge = concert.source && concert.source !== subtitle ? concert.source : ''
          const venueText = formatEmbedVenue(concert)
          const cleanDate = (concert.date || '').trim().replace(/\//g, '-')
          const parts = cleanDate.substring(0, 10).split('-')
          const yearMonth = parts.length === 3 ? `${parts[0]}.${parts[1]}` : '日期未定'
          const day = parts.length === 3 ? parts[2] : '--'
          const isSport = concert.source === '中華職棒' || concert.category === 'sport'

          return (
            <a
              key={concert.id}
              href={concert.url || 'https://concert.pihai0202.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="remote-card ticket-style-card"
              style={{
                background: themeVars.bgHex,
                marginBottom: 0,
                textDecoration: 'none'
              }}
            >
              <div className="remote-card-bg-wrap">
                {concert.image ? (
                  <img
                    src={concert.image}
                    alt=""
                    className="remote-card-bg-img"
                    loading="lazy"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className={`remote-card-fallback${isSport ? ' sport-fallback' : ''}`}>
                    {isSport ? <BaseballIcon size="2.2em" /> : 'LIVE'}
                  </div>
                )}
                <div className="remote-card-overlay" />
              </div>

              <div className="remote-ticket-layout">
                <div className="remote-ticket-main">
                  <div className="remote-ticket-info">
                    <div className="remote-card-kicker-row">
                      <span className="remote-card-artist" title={subtitle}>
                        {subtitle}
                      </span>
                      {sourceBadge && <span className="remote-card-source-pill">{sourceBadge}</span>}
                    </div>

                    <div className="remote-card-name" title={concert.name}>
                      {concert.name}
                    </div>

                    <div className="remote-card-footer-row">
                      <div className="remote-card-venue">
                        <PinIcon size="0.88em" className="ticket-pin-icon" />
                        <span className="remote-card-venue-text">{venueText}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="remote-ticket-stub">
                  <div
                    className="ticket-stub-countdown today"
                    style={{
                      background: `rgba(${themeVars.accentRgb}, 0.88)`,
                      borderColor: 'rgba(255, 255, 255, 0.45)',
                      boxShadow: `0 0 12px rgba(${themeVars.accentRgb}, 0.5)`
                    }}
                  >
                    <span className="stub-live-dot" />
                    今天
                  </div>
                  <div className="ticket-stub-day">{day}</div>
                  <div className="ticket-stub-ym">{yearMonth}</div>
                </div>
              </div>
            </a>
          )
        })
      )}
    </div>
  )
}

// ─── 2. 網站內建「今日演出卡片 API 與選色產生器」Modal ─────────────────────────

interface EmbedBuilderModalProps {
  isOpen: boolean
  onClose: () => void
}

export const EmbedBuilderModal: React.FC<EmbedBuilderModalProps> = ({ isOpen, onClose }) => {
  const [selectedPalette, setSelectedPalette] = useState<string>('volcano')
  const [customColor, setCustomColor] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!isOpen) return null

  const activeHex = customColor
    ? `#${customColor.replace('#', '')}`
    : EMBED_PALETTES.find((p) => p.id === selectedPalette)?.hex || '#ff9100'

  const queryParams = new URLSearchParams()
  queryParams.set('embed', 'today')
  if (customColor && /^[0-9a-fA-F]{6}$/.test(customColor.replace('#', ''))) {
    queryParams.set('color', customColor.replace('#', ''))
  } else if (selectedPalette !== 'volcano') {
    queryParams.set('palette', selectedPalette)
  }
  if (city) queryParams.set('city', city)
  if (category) queryParams.set('category', category)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://concert.pihai0202.com'
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const embedUrl = `${origin}${basePath}/?${queryParams.toString()}`
  const jsonApiUrl = `${origin}${basePath}/api/today.json`
  const iframeCode = `<iframe src="${embedUrl}" style="width:100%;max-width:440px;height:260px;border:none;" loading="lazy"></iframe>`

  let scriptAttrs = ''
  if (city) scriptAttrs += ` data-city="${city}"`
  if (category) scriptAttrs += ` data-category="${category}"`
  if (customColor && /^[0-9a-fA-F]{6}$/.test(customColor.replace('#', ''))) {
    scriptAttrs += ` data-color="${customColor.replace('#', '')}"`
  } else {
    scriptAttrs += ` data-palette="${selectedPalette}"`
  }
  const scriptCode = `<div id="tw-concert-today"${scriptAttrs}></div>\n<script src="${origin}${basePath}/widget.js" async></script>`

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(key)
    setTimeout(() => setCopiedField(null), 1800)
  }

  return (
    <div className="modal-overlay active" style={{ zIndex: 2300 }} onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: '880px',
          width: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.6rem',
          borderRadius: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          <CloseIcon />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <TicketIcon size="1.35em" style={{ color: 'var(--gold)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
            今日演出票根卡片 API 與嵌入產生器
          </h2>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '1.25rem' }}>
          自訂票根卡片主題顏色與篩選條件，供外部網站、Notion 或部落格嵌入今日演出資訊。
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            alignItems: 'start'
          }}
        >
          {/* 左欄：選色與條件 */}
          <div
            style={{
              background: 'rgba(var(--surface-rgb), 0.55)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '1.15rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 800,
                fontSize: '0.9rem',
                marginBottom: '0.85rem'
              }}
            >
              <PaletteIcon size="1.05em" style={{ color: 'var(--gold)' }} />
              <span>1. 選擇票根卡片主題顏色</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.75rem' }}>
              {EMBED_PALETTES.map((p) => {
                const isActive = !customColor && selectedPalette === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPalette(p.id)
                      setCustomColor('')
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.38rem 0.72rem',
                      borderRadius: '999px',
                      border: isActive ? `1.5px solid ${p.hex}` : '1px solid var(--border)',
                      background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        width: '11px',
                        height: '11px',
                        borderRadius: '50%',
                        background: p.hex,
                        display: 'inline-block'
                      }}
                    />
                    <span>{p.label}</span>
                    {isActive && <CheckIcon size="0.85em" style={{ color: p.hex }} />}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
              <input
                type="color"
                value={activeHex}
                onChange={(e) => setCustomColor(e.target.value.replace('#', ''))}
                style={{ width: '36px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
                title="自訂任意顏色"
              />
              <input
                type="text"
                placeholder="或輸入自訂 HEX 色碼 (例如 #ff9100)"
                value={customColor ? `#${customColor.replace('#', '')}` : ''}
                onChange={(e) => setCustomColor(e.target.value.replace('#', '').trim())}
                style={{
                  flex: 1,
                  padding: '0.48rem 0.7rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--text)',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.1rem' }}>
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--muted)',
                    marginBottom: '0.35rem'
                  }}
                >
                  <PinIcon size="0.9em" />
                  <span>篩選城市</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.48rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="">全台灣</option>
                  <option value="台北">台北</option>
                  <option value="新北">新北</option>
                  <option value="桃園">桃園</option>
                  <option value="台中">台中</option>
                  <option value="台南">台南</option>
                  <option value="高雄">高雄</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--muted)',
                    marginBottom: '0.35rem'
                  }}
                >
                  <SparklesIcon size="0.9em" />
                  <span>活動類型</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.48rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="">全部演出與賽事</option>
                  <option value="concert">只看演唱會</option>
                  <option value="sport">只看中華職棒</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 800,
                fontSize: '0.9rem',
                marginBottom: '0.7rem'
              }}
            >
              <CodeSvgIcon size="1.05em" style={{ color: 'var(--gold)' }} />
              <span>2. 複製嵌入碼或 JSON API</span>
            </div>

            {/* Iframe 嵌入碼 */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginBottom: '0.3rem'
                }}
              >
                <span>Iframe 嵌入碼 (適合 Notion / 部落格 / 外部網站)</span>
                <button
                  type="button"
                  onClick={() => handleCopy('iframe', iframeCode)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedField === 'iframe' ? <CheckIcon size="0.9em" /> : <ClipboardIcon size="0.9em" />}
                  <span>{copiedField === 'iframe' ? '已複製' : '複製'}</span>
                </button>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.38)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--gold)'
                }}
              >
                {iframeCode}
              </div>
            </div>

            {/* Script Widget */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginBottom: '0.3rem'
                }}
              >
                <span>JavaScript 自動嵌入標籤</span>
                <button
                  type="button"
                  onClick={() => handleCopy('script', scriptCode)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedField === 'script' ? <CheckIcon size="0.9em" /> : <ClipboardIcon size="0.9em" />}
                  <span>{copiedField === 'script' ? '已複製' : '複製'}</span>
                </button>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.38)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--gold)'
                }}
              >
                {scriptCode}
              </div>
            </div>

            {/* JSON API */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginBottom: '0.3rem'
                }}
              >
                <span>公開今日演出 JSON API 端點</span>
                <button
                  type="button"
                  onClick={() => handleCopy('json', jsonApiUrl)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedField === 'json' ? <CheckIcon size="0.9em" /> : <ClipboardIcon size="0.9em" />}
                  <span>{copiedField === 'json' ? '已複製' : '複製'}</span>
                </button>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.38)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--gold)'
                }}
              >
                {jsonApiUrl}
              </div>
            </div>
          </div>

          {/* 右欄：即時預覽 */}
          <div
            style={{
              background: 'rgba(var(--surface-rgb), 0.55)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '1.15rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.9rem' }}>
                <EyeIcon size="1.05em" style={{ color: 'var(--gold)' }} />
                <span>即時票根卡片預覽</span>
              </span>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.76rem',
                  color: 'var(--gold)',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                <span>獨立開啟卡片</span>
                <ExternalLinkSvgIcon size="0.95em" />
              </a>
            </div>

            <iframe
              key={embedUrl}
              src={embedUrl}
              title="今日演出卡片預覽"
              style={{
                width: '100%',
                height: '320px',
                border: 'none',
                borderRadius: '12px',
                background: 'transparent'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
