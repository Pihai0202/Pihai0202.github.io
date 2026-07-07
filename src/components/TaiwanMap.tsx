import { useState, useRef, useMemo, useEffect } from 'react'
import type { MouseEvent } from 'react'
import type { Concert, Venue } from '../types'
import { VENUES } from '../constants/venues'
import { TAIWAN_PATHS } from '../constants/taiwanPaths'
import { useTranslation, translateVenueName, translateCityName } from '../utils/i18n.tsx'
import { PinIcon, UserIcon } from './SvgIcon'

const project = (lon: number, lat: number) => {
  const x = 159.787256 * lon - 18882.141068
  const y = -172.627301 * lat + 4572.883143
  return { x, y }
}

const SHUANGBEI_VENUE_IDS = [
  'taipei-dome',
  'taipei-arena',
  'nangang',
  'taipei-music-center',
  'zepp-new-taipei',
  'legacy-taipei',
  'the-wall',
  'tianmu',
  'xinzhuang'
]

export function Stat({ number, label }: { number: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-num">{number}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="legend-item">
      <div className="legend-dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}

interface TaiwanMapProps {
  concerts: Concert[]
  selectedVenueId: string | null
  onSelectVenue: (venueId: string) => void
  onClearVenue: () => void
  zoom: number
  onZoomChange: (newZoom: number) => void
  activeVenueIds?: Set<string>
  categoryFilter?: 'all' | 'concert' | 'sport'
}

export function TaiwanMap({
  concerts,
  selectedVenueId,
  onSelectVenue,
  onClearVenue,
  zoom,
  onZoomChange,
  activeVenueIds,
  categoryFilter = 'all',
}: TaiwanMapProps) {
  const { t, lang } = useTranslation()
  const [center, setCenter] = useState({ x: 455, y: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [showShuangbeiDetail, setShowShuangbeiDetail] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null)
  const didDragRef = useRef(false)

  // Pinch-to-zoom state refs
  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number | null>(null)
  const pinchStartMidpointRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pinchStartMapCenterRef = useRef<{ x: number; y: number } | null>(null)

  const selectedVenue = useMemo(
    () => VENUES.find((v) => v.id === selectedVenueId),
    [selectedVenueId],
  )

  const [displayZoom, setDisplayZoom] = useState(zoom)
  const [displayCenter, setDisplayCenter] = useState(center)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const isAnimatingRef = useRef(false)
  const animationRef = useRef<number | null>(null)
  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    centerRef.current = center
  }, [center])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const rafPendingRef = useRef<{ center: { x: number; y: number } | null; zoom: number | null }>({ center: null, zoom: null })
  const rafIdRef = useRef<number | null>(null)
  const wheelTimeoutRef = useRef<any>(null)

  const scheduleRafUpdate = () => {
    if (rafIdRef.current !== null) return

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const { center: nextCenter, zoom: nextZoom } = rafPendingRef.current

      if (nextCenter !== null) {
        setDisplayCenter(nextCenter)
        centerRef.current = nextCenter
      }

      if (nextZoom !== null) {
        setDisplayZoom(nextZoom)
        zoomRef.current = nextZoom
      }

      rafPendingRef.current = { center: null, zoom: null }
    })
  }

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      if (wheelTimeoutRef.current !== null) clearTimeout(wheelTimeoutRef.current)
    }
  }, [])

  // Keep display states synchronized instantly when not animating
  useEffect(() => {
    if (!isAnimatingRef.current) {
      setDisplayZoom(zoom)
    }
  }, [zoom])

  useEffect(() => {
    if (!isAnimatingRef.current) {
      setDisplayCenter(center)
    }
  }, [center])

  const lastSelectedVenueId = useRef(selectedVenueId)

  useEffect(() => {
    if (selectedVenueId === lastSelectedVenueId.current) {
      return
    }
    lastSelectedVenueId.current = selectedVenueId

    // Calculate targets
    const targetX = selectedVenue ? project(selectedVenue.longitude || 0, selectedVenue.latitude || 0).x : 455
    let targetY = selectedVenue ? project(selectedVenue.longitude || 0, selectedVenue.latitude || 0).y : 500
    // 若使用者已經手動調整過縮放比例（不等於初始的 1.1），則在選取場館時維持使用者當前的縮放比；否則使用預設特寫縮放比 1.8
    const targetZoom = selectedVenue ? (zoom !== 1.1 ? zoom : 1.8) : 1.1

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    if (selectedVenue && isMobile) {
      // 底部抽屜在手機端佔用下半部約 45% 高度，將選取的場館中心點往上偏移以置中於上方可視區（地圖往下移 22% 視區高度）
      // 偏移量會依據選取時的 zoom 比例動態縮放，確保在任何縮放比下都能精確置中
      const heightVal = 800 / targetZoom
      targetY += heightVal * 0.22
    }

    // Update target states in React first
    setCenter({ x: targetX, y: targetY })
    onZoomChange(targetZoom)

    const startX = displayCenter.x
    const startY = displayCenter.y
    const startZoom = displayZoom

    const duration = 500 // ms
    const startTime = performance.now()
    isAnimatingRef.current = true

    const animate = (time: number) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // easeOutCubic

      const newZoom = startZoom + (targetZoom - startZoom) * ease
      const newX = startX + (targetX - startX) * ease
      const newY = startY + (targetY - startY) * ease

      setDisplayZoom(newZoom)
      setDisplayCenter({ x: newX, y: newY })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        isAnimatingRef.current = false
      }
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      isAnimatingRef.current = false
    }
  }, [selectedVenueId, selectedVenue, onZoomChange])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = svgEl.getBoundingClientRect()
      const clientX = e.clientX - rect.left
      const clientY = e.clientY - rect.top

      const pctX = clientX / rect.width
      const pctY = clientY / rect.height

      const currentZoom = zoomRef.current
      const currentCenter = centerRef.current

      const w = 800 / currentZoom
      const h = 800 / currentZoom

      const minX = currentCenter.x - w / 2
      const minY = currentCenter.y - h / 2

      const mx = minX + pctX * w
      const my = minY + pctY * h

      const zoomFactor = 1.08
      let newZoom = currentZoom
      if (e.deltaY < 0) {
        newZoom = Math.min(5.0, currentZoom * zoomFactor)
      } else {
        newZoom = Math.max(0.7, currentZoom / zoomFactor)
      }

      const newWidth = 800 / newZoom
      const newHeight = 800 / newZoom

      const newMinX = mx - pctX * newWidth
      const newMinY = my - pctY * newHeight

      const nextCenter = {
        x: newMinX + newWidth / 2,
        y: newMinY + newHeight / 2,
      }

      rafPendingRef.current.center = nextCenter
      rafPendingRef.current.zoom = newZoom
      scheduleRafUpdate()

      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
      wheelTimeoutRef.current = setTimeout(() => {
        setCenter(centerRef.current)
        onZoomChange(zoomRef.current)
      }, 100)
    }

    svgEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      svgEl.removeEventListener('wheel', handleWheel)
    }
  }, [onZoomChange])

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    didDragRef.current = false
    setHoveredVenue(null)
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      centerX: centerRef.current.x,
      centerY: centerRef.current.y,
    }
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStartRef.current || !svgRef.current) return

    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragRef.current = true
    }

    const svgRect = svgRef.current.getBoundingClientRect()
    const currentZoom = zoomRef.current
    const w = 800 / currentZoom
    const h = 800 / currentZoom
    const scaleX = w / svgRect.width
    const scaleY = h / svgRect.height

    const nextCenter = {
      x: dragStartRef.current.centerX - dx * scaleX,
      y: dragStartRef.current.centerY - dy * scaleY,
    }
    rafPendingRef.current.center = nextCenter
    scheduleRafUpdate()
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    dragStartRef.current = null
    setCenter(centerRef.current)
  }

  // Bind native touch event listeners non-passively to prevent browser viewport zoom
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const getTouchInfo = (touches: TouchList) => {
      const t1 = touches[0]
      const t2 = touches[1]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const midpoint = {
        clientX: (t1.clientX + t2.clientX) / 2,
        clientY: (t1.clientY + t2.clientY) / 2,
      }
      return { distance, midpoint }
    }

    const handleTouchStartNative = (e: globalThis.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        didDragRef.current = false
        setHoveredVenue(null)
        dragStartRef.current = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          centerX: centerRef.current.x,
          centerY: centerRef.current.y,
        }
        setIsDragging(true)
        
        pinchStartDistanceRef.current = null
        pinchStartZoomRef.current = null
        pinchStartMidpointRef.current = null
        pinchStartMapCenterRef.current = null
      } else if (e.touches.length === 2) {
        e.preventDefault() // Block browser native viewport zoom
        setIsDragging(false)
        dragStartRef.current = null

        const { distance, midpoint } = getTouchInfo(e.touches)
        pinchStartDistanceRef.current = distance
        pinchStartZoomRef.current = zoomRef.current
        pinchStartMidpointRef.current = midpoint
        pinchStartMapCenterRef.current = { ...centerRef.current }
      }
    }

    const handleTouchMoveNative = (e: globalThis.TouchEvent) => {
      if (e.touches.length === 1) {
        if (!isDragging || !dragStartRef.current) return
        e.preventDefault() // Block browser viewport scroll/pull-to-refresh during map panning
        const touch = e.touches[0]

        const dx = touch.clientX - dragStartRef.current.clientX
        const dy = touch.clientY - dragStartRef.current.clientY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          didDragRef.current = true
        }

        const svgRect = svgEl.getBoundingClientRect()
        const currentZoom = zoomRef.current
        const w = 800 / currentZoom
        const h = 800 / currentZoom
        const scaleX = w / svgRect.width
        const scaleY = h / svgRect.height

        const nextCenter = {
          x: dragStartRef.current.centerX - dx * scaleX,
          y: dragStartRef.current.centerY - dy * scaleY,
        }

        rafPendingRef.current.center = nextCenter
        scheduleRafUpdate()
      } else if (e.touches.length === 2) {
        e.preventDefault() // Block browser native viewport zoom
        if (
          pinchStartDistanceRef.current === null ||
          pinchStartZoomRef.current === null ||
          pinchStartMidpointRef.current === null ||
          pinchStartMapCenterRef.current === null
        ) return

        const { distance, midpoint } = getTouchInfo(e.touches)

        const ratio = distance / pinchStartDistanceRef.current
        let newZoom = pinchStartZoomRef.current * ratio
        newZoom = Math.max(0.7, Math.min(5.0, newZoom))

        const svgRect = svgEl.getBoundingClientRect()

        const deltaClientX = midpoint.clientX - pinchStartMidpointRef.current.clientX
        const deltaClientY = midpoint.clientY - pinchStartMidpointRef.current.clientY

        const currentW = 800 / newZoom
        const currentH = 800 / newZoom
        const scaleX = currentW / svgRect.width
        const scaleY = currentH / svgRect.height

        const clientX = midpoint.clientX - svgRect.left
        const clientY = midpoint.clientY - svgRect.top
        const pctX = clientX / svgRect.width
        const pctY = clientY / svgRect.height

        const startW = 800 / pinchStartZoomRef.current
        const startH = 800 / pinchStartZoomRef.current
        const startMinX = pinchStartMapCenterRef.current.x - startW / 2
        const startMinY = pinchStartMapCenterRef.current.y - startH / 2
        const mx = startMinX + pctX * startW
        const my = startMinY + pctY * startH

        const newWidth = 800 / newZoom
        const newHeight = 800 / newZoom
        const newMinX = mx - pctX * newWidth
        const newMinY = my - pctY * newHeight

        const adjustedMinX = newMinX - deltaClientX * scaleX
        const adjustedMinY = newMinY - deltaClientY * scaleY

        const nextCenter = {
          x: adjustedMinX + newWidth / 2,
          y: adjustedMinY + newHeight / 2,
        }

        rafPendingRef.current.center = nextCenter
        rafPendingRef.current.zoom = newZoom
        scheduleRafUpdate()
      }
    }

    const handleTouchEndNative = () => {
      setIsDragging(false)
      dragStartRef.current = null
      pinchStartDistanceRef.current = null
      pinchStartZoomRef.current = null
      pinchStartMidpointRef.current = null
      pinchStartMapCenterRef.current = null

      setCenter(centerRef.current)
      onZoomChange(zoomRef.current)
    }

    svgEl.addEventListener('touchstart', handleTouchStartNative, { passive: false })
    svgEl.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
    svgEl.addEventListener('touchend', handleTouchEndNative, { passive: true })
    svgEl.addEventListener('touchcancel', handleTouchEndNative, { passive: true })

    return () => {
      svgEl.removeEventListener('touchstart', handleTouchStartNative)
      svgEl.removeEventListener('touchmove', handleTouchMoveNative)
      svgEl.removeEventListener('touchend', handleTouchEndNative)
      svgEl.removeEventListener('touchcancel', handleTouchEndNative)
    }
  }, [isDragging, onZoomChange])

  const handleSvgClick = () => {
    if (!didDragRef.current) {
      onClearVenue()
      setShowShuangbeiDetail(false)
    }
  }

  const SPORT_VENUE_IDS = [
    'taipei-dome',
    'taoyuan-arena',
    'hsinchu',
    'taichung-dome',
    'changhua',
    'tainan',
    'kaohsiung-natl',
    'hualien',
    'taitung',
    'tianmu',
    'xinzhuang',
    'asia-pacific-main',
    'chengcing-lake',
    'douliou',
    'chiayi'
  ]

  const width = 800 / displayZoom
  const height = 800 / displayZoom
  const minX = displayCenter.x - width / 2
  const minY = displayCenter.y - height / 2
  const viewBoxStr = `${minX} ${minY} ${width} ${height}`

  return (
    <div className="taiwan-map-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        id="taiwan-map"
        ref={svgRef}
        className={isDragging ? 'dragging' : ''}
        viewBox={viewBoxStr}
        xmlns="http://www.w3.org/2000/svg"
        onClick={handleSvgClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{ '--map-zoom': displayZoom } as React.CSSProperties}
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--map-glow-start, #1a1a3e)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--map-glow-end, #0a0a0f)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="455" cy="500" rx="300" ry="350" fill="url(#mapGlow)" />
        {Object.entries(TAIWAN_PATHS)
          .sort(([a], [b]) => (a === 'Taipei' ? 1 : b === 'Taipei' ? -1 : 0))
          .map(([countyName, pathD]) => (
          <path
            key={countyName}
            d={pathD}
            fill="var(--map-land, #1e2040)"
            stroke="var(--map-land-stroke, #2a2a60)"
            strokeWidth="1.2"
            opacity="0.9"
            style={{ transition: 'fill 0.3s' }}
          />
        ))}
        <text x="213" y="585" fill="var(--map-label, #4a4a70)" fontSize="13" fontWeight="bold" textAnchor="middle">
          {lang === 'zh-TW' ? '澎湖' : 'Penghu'}
        </text>
        <text x="25" y="375" fill="var(--map-label, #4a4a70)" fontSize="13" fontWeight="bold" textAnchor="middle">
          {lang === 'zh-TW' ? '金門' : 'Kinmen'}
        </text>
        <text x="324" y="115" fill="var(--map-label, #4a4a70)" fontSize="13" fontWeight="bold" textAnchor="middle">
          {lang === 'zh-TW' ? '馬祖' : 'Matsu'}
        </text>

        {displayZoom < 1.5 && (
          <g
            className={`shuangbei-cluster-group${showShuangbeiDetail ? ' active' : ''}`}
            transform={`translate(537,247)`}
            onClick={(e) => {
              if (didDragRef.current) return
              e.stopPropagation()
              setShowShuangbeiDetail(true)
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle className="click-target" r="22" cx="0" cy="0" fill="transparent" />
            <circle className="pulse-ring-cluster" r="18" cx="0" cy="0" />
            <circle className="cluster-plate" cx="0" cy="0" r="14" />
            <text x="0" y="4" textAnchor="middle" className="cluster-text">
              9
            </text>
            <text x="0" y="27" textAnchor="middle" className="cluster-label">
              {t('shuangbeiCluster')}
            </text>
          </g>
        )}

        <g>
          {VENUES.map((venue) => {
            const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
            const isActive = selectedVenueId === venue.id
            const isCategoryInactive = categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(venue.id)
            const hasActiveConcerts = Boolean(activeVenueIds && activeVenueIds.has(venue.id))

            // Show full icon if active, visited, has active concerts, zoomed in (>=1.5), or currently hovered
            const shouldShowIcon = isActive ||
                                   hasVisits ||
                                   hasActiveConcerts ||
                                   displayZoom >= 1.5 ||
                                   (hoveredVenue && hoveredVenue.id === venue.id)

            const isShuangbei = SHUANGBEI_VENUE_IDS.includes(venue.id)
            if (displayZoom < 1.5 && isShuangbei) {
              return null
            }

            const isSport = SPORT_VENUE_IDS.includes(venue.id)

            return (
              <g
                key={venue.id}
                className={`venue-icon-group${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}${isCategoryInactive ? ' category-inactive' : ''} ${shouldShowIcon ? 'show-icon' : 'show-dot'}`}
                transform={`translate(${project(venue.longitude || 0, venue.latitude || 0).x},${project(venue.longitude || 0, venue.latitude || 0).y})`}
                onClick={(e) => {
                  if (isCategoryInactive || didDragRef.current) return
                  e.stopPropagation()
                  onSelectVenue(venue.id)
                  setShowShuangbeiDetail(false)
                }}
                onMouseEnter={() => {
                  if (isCategoryInactive || isDragging) return
                  setHoveredVenue(venue)
                }}
                onMouseMove={(e) => {
                  setTooltipPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHoveredVenue(null)
                }}
              >
                <circle className="click-target" r={22 / displayZoom} cx="0" cy="0" fill="transparent" style={{ cursor: 'pointer' }} />
                <circle className="pulse-ring" r="12" cx="0" cy="0" />
                <circle className="placeholder-dot" r="4" cx="0" cy="0" />
                <g className="venue-icon">
                  <g transform="scale(0.666667) translate(-12, -12)">
                    <circle className="icon-plate" cx="12" cy="12" r="11" />
                    {isSport ? (
                      <g className="icon-symbol" strokeWidth="1.5" fill="none" stroke="currentColor">
                        <path d="M6 12a6 6 0 0 1 12 0" />
                        <path d="M6 12a6 6 0 0 0 12 0" />
                      </g>
                    ) : (
                      <g className="icon-symbol" stroke="currentColor">
                        <path d="M9 18V5l12-2v13" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </g>
                    )}
                  </g>
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      {showShuangbeiDetail && (
        <div className="shuangbei-popover">
          <div className="popover-header">
            <span className="popover-title">
              <PinIcon size="1.1em" style={{ marginRight: '6px', color: '#ef5350', verticalAlign: 'middle' }} />
              {lang === 'zh-TW' ? '雙北地區場館特寫' : lang === 'ja' ? '双北（台北・新北）会場ズーム' : lang === 'ko' ? '쌍북(타이베이·신베이) 공연장 돋보기' : 'Shuangbei Venues Detail'}
            </span>
            <button className="popover-close-btn" onClick={() => setShowShuangbeiDetail(false)}>×</button>
          </div>
          
          <div className="popover-map-container">
            <svg viewBox="495 205 125 115" className="shuangbei-mini-map">
              {['Taipei', 'New Taipei', 'Keelung'].map((countyName) => (
                <path
                  key={countyName}
                  d={TAIWAN_PATHS[countyName]}
                  className="mini-map-county"
                />
              ))}
              
              {VENUES.filter(v => SHUANGBEI_VENUE_IDS.includes(v.id)).map((venue) => {
                const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
                const isActive = selectedVenueId === venue.id
                const { x, y } = project(venue.longitude || 0, venue.latitude || 0)
                
                return (
                  <g
                     key={venue.id}
                     className={`mini-venue-icon-group${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}`}
                     transform={`translate(${x},${y})`}
                     onClick={(e) => {
                       e.stopPropagation()
                       onSelectVenue(venue.id)
                       setShowShuangbeiDetail(false)
                     }}
                     style={{ cursor: 'pointer' }}
                  >
                    <circle className="mini-click-target" r="6" cx="0" cy="0" fill="transparent" />
                    <circle className="mini-pulse-ring" r="4.5" cx="0" cy="0" />
                    <circle className="mini-placeholder-dot" r="1.8" cx="0" cy="0" />
                  </g>
                )
              })}
            </svg>
          </div>
          
          <div className="popover-venue-list">
            {VENUES.filter(v => SHUANGBEI_VENUE_IDS.includes(v.id)).map((venue) => {
              const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
              const isActive = selectedVenueId === venue.id
              
              return (
                <div
                  key={venue.id}
                  className={`popover-venue-item${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}`}
                  onClick={() => {
                    onSelectVenue(venue.id)
                    setShowShuangbeiDetail(false)
                  }}
                >
                  <div className="popover-venue-name-row">
                    <span className="popover-venue-name">{translateVenueName(venue.name, lang)}</span>
                    {hasVisits && <span className="visited-tick">✓</span>}
                  </div>
                  <div className="popover-venue-meta">
                    <span>
                      <UserIcon size="0.95em" style={{ marginRight: '4px', color: '#42a5f5', verticalAlign: 'middle' }} />
                      {t('capacityPeople', { capacity: venue.capacity })}
                    </span>
                    <span>
                      <PinIcon size="0.95em" style={{ marginRight: '4px', color: '#ef5350', verticalAlign: 'middle' }} />
                      {translateCityName(venue.city, lang)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hoveredVenue && (
        <div
          className="map-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="tooltip-title">{translateVenueName(hoveredVenue.name, lang)}</div>
          <div className="tooltip-meta">
            <span>
              <PinIcon size="0.95em" style={{ marginRight: '4px', color: '#ef5350', verticalAlign: 'middle' }} />
              {translateCityName(hoveredVenue.city, lang)}
            </span>
            <span>
              <UserIcon size="0.95em" style={{ marginRight: '4px', color: '#42a5f5', verticalAlign: 'middle' }} />
              {t('capacityPeople', { capacity: hoveredVenue.capacity })}
            </span>
          </div>
          {concerts.some((c) => c.venueId === hoveredVenue.id) && (
            <div className="tooltip-status visited">{t('visitedBadgeText')}</div>
          )}
        </div>
      )}
    </div>
  )
}
