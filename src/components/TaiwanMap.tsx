import { useState, useRef, useMemo, useEffect, memo } from 'react'
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
  'witch-house',
  'tianmu',
  'xinzhuang',
  'ticc',
  'legacy-max',
  'ntu-sports-center',
  'clapper-studio',
  'xinzhuang-gym',
  'ntpc-exhibition-center',
  'ntpc-hall',
  'linkou-arena'
]

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
  'chiayi',
  'linkou-arena'
]

interface RegionClusterDef {
  id: string
  name: Record<string, string>
  label: Record<string, string>
  venueIds: string[]
  pos: { x: number; y: number }
  viewBox: string
  counties: string[]
}

const REGION_CLUSTERS: RegionClusterDef[] = [
  {
    id: 'shuangbei',
    name: {
      'zh-TW': '雙北地區場館特寫',
      ja: '双北（台北・新北）会場ズーム',
      ko: '쌍북(타이베이·신베이) 공연장 돋보기',
      en: 'Shuangbei Venues Detail',
    },
    label: {
      'zh-TW': '雙北場館',
      ja: '双北会場',
      ko: '쌍북 공연장',
      en: 'Shuangbei',
    },
    venueIds: SHUANGBEI_VENUE_IDS,
    pos: { x: 537, y: 247 },
    viewBox: '495 205 125 115',
    counties: ['Taipei', 'New Taipei', 'Keelung', 'Taoyuan'],
  },
  {
    id: 'kaohsiung',
    name: {
      'zh-TW': '高雄地區場館特寫',
      ja: '高雄会場ズーム',
      ko: '가오슝 공연장 돋보기',
      en: 'Kaohsiung Venues Detail',
    },
    label: {
      'zh-TW': '高雄場館',
      ja: '高雄会場',
      ko: '가오슝 공연장',
      en: 'Kaohsiung',
    },
    venueIds: [
      'kaohsiung-dome',
      'kaohsiung-natl',
      'kaohsiung-music-center',
      'backstage-live',
      'chengcing-lake',
      'live-warehouse',
    ],
    pos: { x: 340, y: 663 },
    viewBox: '290 610 110 100',
    counties: ['Kaohsiung', 'Pingtung'],
  },
  {
    id: 'tainan',
    name: {
      'zh-TW': '台南地區場館特寫',
      ja: '台南会場ズーム',
      ko: '타이남 공연장 돋보기',
      en: 'Tainan Venues Detail',
    },
    label: {
      'zh-TW': '台南場館',
      ja: '台南会場',
      ko: '타이남 공연장',
      en: 'Tainan',
    },
    venueIds: [
      'tainan',
      'asia-pacific-main',
      'tcrc-livehouse',
      'wild-egret',
    ],
    pos: { x: 325, y: 600 },
    viewBox: '275 545 110 100',
    counties: ['Tainan', 'Chiayi'],
  },
  {
    id: 'taichung',
    name: {
      'zh-TW': '台中地區場館特寫',
      ja: '台中会場ズーム',
      ko: '타이중 공연장 돋보기',
      en: 'Taichung Venues Detail',
    },
    label: {
      'zh-TW': '台中場館',
      ja: '台中会場',
      ko: '타이중 공연장',
      en: 'Taichung',
    },
    venueIds: [
      'taichung-dome',
      'taichung-venue',
      'legacy-taichung',
    ],
    pos: { x: 395, y: 372 },
    viewBox: '340 340 115 100',
    counties: ['Taichung', 'Changhua'],
  },
]

const ALL_CLUSTERED_VENUE_IDS = new Set(REGION_CLUSTERS.flatMap(r => r.venueIds))
const SHUANGBEI_SET = new Set(SHUANGBEI_VENUE_IDS)
const SPORT_SET = new Set(SPORT_VENUE_IDS)

const SORTED_TAIWAN_PATHS = Object.entries(TAIWAN_PATHS).sort(([a], [b]) =>
  a === 'Taipei' ? 1 : b === 'Taipei' ? -1 : 0
)

const TaiwanMapBackground = memo(function TaiwanMapBackground() {
  return (
    <>
      {SORTED_TAIWAN_PATHS.map(([countyName, pathD]) => (
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
    </>
  )
})

const PREPROJECTED_VENUES = VENUES.map((venue) => ({
  ...venue,
  pos: project(venue.longitude || 0, venue.latitude || 0),
  isShuangbei: SHUANGBEI_SET.has(venue.id),
  isSport: SPORT_SET.has(venue.id),
}))

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
  categoryFilter?: 'all' | 'concert' | 'sport' | 'today'
}

function TaiwanMapComponent({
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
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null)
  const didDragRef = useRef(false)

  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number | null>(null)
  const pinchStartMidpointRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pinchStartMapCenterRef = useRef<{ x: number; y: number } | null>(null)

  const selectedVenue = useMemo(
    () => VENUES.find((v) => v.id === selectedVenueId),
    [selectedVenueId],
  )

  const visitedVenueIds = useMemo(
    () => new Set(concerts.map((c) => c.venueId)),
    [concerts],
  )

  const [displayZoom, setDisplayZoom] = useState(zoom)
  const [displayCenter, setDisplayCenter] = useState(center)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [overlappingVenues, setOverlappingVenues] = useState<typeof VENUES | null>(null)
  const [overlapPos, setOverlapPos] = useState<{ x: number; y: number } | null>(null)

  const isAnimatingRef = useRef(false)
  const animationRef = useRef<number | null>(null)
  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)
  const displayZoomRef = useRef(zoom)
  const displayCenterRef = useRef(center)

  const updateDisplayZoom = (z: number) => {
    displayZoomRef.current = z
    zoomRef.current = z
    setDisplayZoom(z)
  }

  const updateDisplayCenter = (c: { x: number; y: number }) => {
    displayCenterRef.current = c
    centerRef.current = c
    setDisplayCenter(c)
  }

  useEffect(() => {
    centerRef.current = center
    displayCenterRef.current = center
  }, [center])

  useEffect(() => {
    zoomRef.current = zoom
    displayZoomRef.current = zoom
  }, [zoom])

  const rafPendingRef = useRef<{ center?: { x: number; y: number }; zoom?: number }>({})
  const rafIdRef = useRef<number | null>(null)

  const scheduleRafUpdate = () => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      if (rafPendingRef.current.center) {
        updateDisplayCenter(rafPendingRef.current.center)
      }
      if (typeof rafPendingRef.current.zoom === 'number') {
        updateDisplayZoom(rafPendingRef.current.zoom)
      }
      rafPendingRef.current = {}
    })
  }

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      if (wheelTimeoutRef.current !== null) clearTimeout(wheelTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isAnimatingRef.current) updateDisplayZoom(zoom)
  }, [zoom])

  useEffect(() => {
    if (!isAnimatingRef.current) updateDisplayCenter(center)
  }, [center])

  const lastSelectedVenueId = useRef(selectedVenueId)

  useEffect(() => {
    if (selectedVenueId === lastSelectedVenueId.current) return
    lastSelectedVenueId.current = selectedVenueId

    // Cancel any active animation and reset animation flag on transition
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    isAnimatingRef.current = false

    if (selectedVenue) {
      const projected = project(selectedVenue.longitude || 0, selectedVenue.latitude || 0)
      let targetZoom = 3.5
      if (selectedVenue.id === 'linkou-arena' || selectedVenue.id === 'taoyuan-arena') {
        targetZoom = 3.8
      }

      // Start animating from current visual coordinates
      const startZoom = displayZoomRef.current || displayZoom
      const startX = displayCenterRef.current.x
      const startY = displayCenterRef.current.y
      const targetX = projected.x
      const targetY = projected.y

      const duration = 500
      const startTime = performance.now()
      isAnimatingRef.current = true

      const animate = (time: number) => {
        const elapsed = time - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)

        const newZoom = startZoom + (targetZoom - startZoom) * ease
        const newX = startX + (targetX - startX) * ease
        const newY = startY + (targetY - startY) * ease

        updateDisplayZoom(newZoom)
        updateDisplayCenter({ x: newX, y: newY })

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          isAnimatingRef.current = false
          setCenter({ x: targetX, y: targetY })
          onZoomChange(targetZoom)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    } else {
      const defaultZoom = typeof window !== 'undefined' && window.innerWidth <= 1200 ? 0.95 : 1.1
      // Start animating from current visual coordinates back to default zoom and center
      const startZoom = displayZoomRef.current || displayZoom
      const startX = displayCenterRef.current.x
      const startY = displayCenterRef.current.y
      const targetX = 455
      const targetY = 500

      const duration = 500
      const startTime = performance.now()
      isAnimatingRef.current = true

      const animate = (time: number) => {
        const elapsed = time - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)

        const newZoom = startZoom + (defaultZoom - startZoom) * ease
        const newX = startX + (targetX - startX) * ease
        const newY = startY + (targetY - startY) * ease

        updateDisplayZoom(newZoom)
        updateDisplayCenter({ x: newX, y: newY })

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          isAnimatingRef.current = false
          onZoomChange(defaultZoom)
          setCenter({ x: 455, y: 500 })
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      isAnimatingRef.current = false
    }
  }, [selectedVenueId, selectedVenue, onZoomChange])

  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const currentZoom = displayZoomRef.current || zoomRef.current
      const currentCenter = displayCenterRef.current || centerRef.current
      const w = 800 / currentZoom
      const h = 800 / currentZoom
      const minX = currentCenter.x - w / 2
      const minY = currentCenter.y - h / 2
      const mx = minX + pctX * w
      const my = minY + pctY * h
      const zoomFactor = 1.08
      const newZoom = Math.max(0.7, Math.min(9.99, e.deltaY < 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor))
      const newWidth = 800 / newZoom
      const newHeight = 800 / newZoom
      const newMinX = mx - pctX * newWidth
      const newMinY = my - pctY * newHeight
      const nextCenter = { x: newMinX + newWidth / 2, y: newMinY + newHeight / 2 }
      
      updateDisplayZoom(newZoom)
      updateDisplayCenter(nextCenter)

      rafPendingRef.current.center = nextCenter
      rafPendingRef.current.zoom = newZoom
      scheduleRafUpdate()

      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
      wheelTimeoutRef.current = setTimeout(() => {
        setCenter(centerRef.current)
        onZoomChange(zoomRef.current)
      }, 50)
    }

    svgEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => svgEl.removeEventListener('wheel', handleWheel)
  }, [onZoomChange])

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    didDragRef.current = false
    setHoveredVenue(null)
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, centerX: centerRef.current.x, centerY: centerRef.current.y }
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStartRef.current || !svgRef.current) return
    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    const svgRect = svgRef.current.getBoundingClientRect()
    const w = 800 / zoomRef.current
    const h = 800 / zoomRef.current
    rafPendingRef.current.center = { x: dragStartRef.current.centerX - dx * (w / svgRect.width), y: dragStartRef.current.centerY - dy * (h / svgRect.height) }
    scheduleRafUpdate()
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    dragStartRef.current = null
    setCenter(centerRef.current)
  }

  const handleSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    if (didDragRef.current) return
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'path') {
      onClearVenue()
      setOverlappingVenues(null)
    }
  }

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const getTouchInfo = (touches: TouchList) => {
      const t1 = touches[0], t2 = touches[1]
      const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY
      return { distance: Math.sqrt(dx * dx + dy * dy), midpoint: { clientX: (t1.clientX + t2.clientX) / 2, clientY: (t1.clientY + t2.clientY) / 2 } }
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        didDragRef.current = false
        const t = e.touches[0]
        dragStartRef.current = { clientX: t.clientX, clientY: t.clientY, centerX: centerRef.current.x, centerY: centerRef.current.y }
        setIsDragging(true)
      } else if (e.touches.length === 2) {
        e.preventDefault()
        setIsDragging(false)
        dragStartRef.current = null
        const { distance, midpoint } = getTouchInfo(e.touches)
        pinchStartDistanceRef.current = distance
        pinchStartZoomRef.current = zoomRef.current
        pinchStartMidpointRef.current = midpoint
        pinchStartMapCenterRef.current = { ...centerRef.current }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && dragStartRef.current && svgRef.current) {
        const t = e.touches[0]
        const dx = t.clientX - dragStartRef.current.clientX
        const dy = t.clientY - dragStartRef.current.clientY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
        const svgRect = svgRef.current.getBoundingClientRect()
        const w = 800 / zoomRef.current
        const h = 800 / zoomRef.current
        rafPendingRef.current.center = { x: dragStartRef.current.centerX - dx * (w / svgRect.width), y: dragStartRef.current.centerY - dy * (h / svgRect.height) }
        scheduleRafUpdate()
      } else if (e.touches.length === 2 && pinchStartDistanceRef.current !== null && pinchStartZoomRef.current !== null && pinchStartMidpointRef.current !== null && pinchStartMapCenterRef.current !== null && svgRef.current) {
        e.preventDefault()
        didDragRef.current = true
        const { distance, midpoint } = getTouchInfo(e.touches)
        const scale = distance / pinchStartDistanceRef.current
        const newZoom = Math.min(9.99, Math.max(0.7, pinchStartZoomRef.current * scale))
        const rect = svgRef.current.getBoundingClientRect()
        const clientX = midpoint.clientX - rect.left
        const clientY = midpoint.clientY - rect.top
        const pctX = clientX / rect.width
        const pctY = clientY / rect.height
        const w = 800 / pinchStartZoomRef.current
        const h = 800 / pinchStartZoomRef.current
        const mx = pinchStartMapCenterRef.current.x - w / 2 + pctX * w
        const my = pinchStartMapCenterRef.current.y - h / 2 + pctY * h
        const newW = 800 / newZoom, newH = 800 / newZoom
        rafPendingRef.current.center = { x: mx - pctX * newW + newW / 2, y: my - pctY * newH + newH / 2 }
        rafPendingRef.current.zoom = newZoom
        scheduleRafUpdate()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (pinchStartDistanceRef.current !== null) {
          setCenter(centerRef.current)
          onZoomChange(zoomRef.current)
        }
        pinchStartDistanceRef.current = null
        pinchStartZoomRef.current = null
        pinchStartMidpointRef.current = null
        pinchStartMapCenterRef.current = null
      }
      if (e.touches.length === 0) {
        setIsDragging(false)
        dragStartRef.current = null
        setCenter(centerRef.current)
      }
    }

    svgEl.addEventListener('touchstart', handleTouchStart, { passive: false })
    svgEl.addEventListener('touchmove', handleTouchMove, { passive: false })
    svgEl.addEventListener('touchend', handleTouchEnd)
    svgEl.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      svgEl.removeEventListener('touchstart', handleTouchStart)
      svgEl.removeEventListener('touchmove', handleTouchMove)
      svgEl.removeEventListener('touchend', handleTouchEnd)
      svgEl.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [onZoomChange])

  const width = 800 / displayZoom
  const height = 800 / displayZoom
  const minX = displayCenter.x - width / 2
  const minY = displayCenter.y - height / 2

  return (
    <div
      className="taiwan-map-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ['--map-zoom' as any]: displayZoom,
      }}
    >
      <svg
        id="taiwan-map"
        ref={svgRef}
        className={isDragging ? 'dragging' : ''}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        onClick={handleSvgClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--map-glow-start, transparent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--map-glow-end, transparent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <TaiwanMapBackground />

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
          <g className="region-clusters-layer">
            {REGION_CLUSTERS.map((cluster) => {
              const isActive = activeClusterId === cluster.id
              const labelText = cluster.label[lang] || cluster.label['zh-TW']
              return (
                <g
                  key={cluster.id}
                  className={`shuangbei-cluster-group${isActive ? ' active' : ''}`}
                  transform={`translate(${cluster.pos.x},${cluster.pos.y})`}
                  onClick={(e) => {
                    if (didDragRef.current) return
                    e.stopPropagation()
                    setActiveClusterId(cluster.id)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle className="click-target" r="22" cx="0" cy="0" fill="transparent" />
                  <circle className="pulse-ring-cluster" r="18" cx="0" cy="0" />
                  <circle className="cluster-plate" cx="0" cy="0" r="14" />
                  <text x="0" y="4" textAnchor="middle" className="cluster-text">
                    {cluster.venueIds.length}
                  </text>
                  <text x="0" y="27" textAnchor="middle" className="cluster-label">
                    {labelText}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        <g>
          {PREPROJECTED_VENUES.map((venue) => {
            const hasVisits = visitedVenueIds.has(venue.id)
            const isActive = selectedVenueId === venue.id
            const isCategoryInactive = categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(venue.id)
            const shouldShowIcon = isActive || hasVisits || (activeVenueIds && activeVenueIds.has(venue.id)) || displayZoom >= 1.5 || (hoveredVenue && hoveredVenue.id === venue.id)
            if (displayZoom < 1.5 && ALL_CLUSTERED_VENUE_IDS.has(venue.id)) return null

            return (
              <g
                key={venue.id}
                data-venue-id={venue.id}
                className={`venue-icon-group${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}${isCategoryInactive ? ' category-inactive' : ''} ${shouldShowIcon ? 'show-icon' : 'show-dot'}`}
                transform={`translate(${venue.pos.x},${venue.pos.y})`}
                onClick={(e) => {
                  if (isCategoryInactive || didDragRef.current) return
                  e.stopPropagation()
                  
                  let targetVenueId = venue.id
                  if (svgRef.current) {
                    const groups = Array.from(svgRef.current.querySelectorAll('.venue-icon-group:not(.category-inactive)'))
                    const nearby = groups
                      .filter((el) => {
                        const r = el.getBoundingClientRect()
                        const dist = Math.sqrt(Math.pow(e.clientX - (r.left + r.width / 2), 2) + Math.pow(e.clientY - (r.top + r.height / 2), 2))
                        return dist < 22
                      })
                      .map((el) => VENUES.find((v) => v.id === el.getAttribute('data-venue-id')))
                      .filter(Boolean) as Venue[]

                    if (nearby.length >= 2) {
                      const container = svgRef.current.parentElement
                      if (container) {
                        const containerRect = container.getBoundingClientRect()
                        const offsetX = e.clientX - containerRect.left
                        const offsetY = e.clientY - containerRect.top
                        setOverlappingVenues(nearby)
                        setOverlapPos({ x: offsetX, y: offsetY })
                        return
                      }
                    }
                  }

                  setOverlappingVenues(null)
                  onSelectVenue(targetVenueId)
                  setActiveClusterId(null)
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
                    {venue.isSport ? (
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

      {activeClusterId && (() => {
        const activeCluster = REGION_CLUSTERS.find(c => c.id === activeClusterId) || REGION_CLUSTERS[0]
        const clusterVenues = VENUES.filter(v => activeCluster.venueIds.includes(v.id))
        const clusterTitle = activeCluster.name[lang] || activeCluster.name['zh-TW']

        return (
          <div className="shuangbei-popover">
            <div className="popover-header">
              <span className="popover-title">
                <PinIcon size="1.1em" style={{ marginRight: '6px', color: '#ef5350', verticalAlign: 'middle' }} />
                {clusterTitle}
              </span>
              <button className="popover-close-btn" type="button" onClick={() => setActiveClusterId(null)}>×</button>
            </div>
            
            <div className="popover-map-container">
              <svg viewBox={activeCluster.viewBox} className="shuangbei-mini-map">
                {activeCluster.counties.map((countyName) => (
                  <path
                    key={countyName}
                    d={TAIWAN_PATHS[countyName]}
                    className="mini-map-county"
                  />
                ))}
                
                {clusterVenues.map((venue) => {
                  const hasVisits = visitedVenueIds.has(venue.id)
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
                        setActiveClusterId(null)
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
              {clusterVenues.map((venue) => {
                const hasVisits = visitedVenueIds.has(venue.id)
                const isActive = selectedVenueId === venue.id
                
                return (
                  <div
                    key={venue.id}
                    className={`popover-venue-item${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}`}
                    onClick={() => {
                      onSelectVenue(venue.id)
                      setActiveClusterId(null)
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
        )
      })()}

      {overlappingVenues && overlapPos && (
        <div
          className={`overlap-venues-popover ${overlapPos.y < 320 ? 'position-bottom' : 'position-top'}`}
          style={{
            position: 'absolute',
            left: overlapPos.x,
            top: overlapPos.y,
            zIndex: 1000,
          }}
        >
          <div className="overlap-popover-header">
            <span>{lang === 'zh-TW' ? '請選擇場館' : lang === 'ja' ? '会場を選択してください' : lang === 'ko' ? '공연장을 선택하세요' : 'Select Venue'}</span>
            <button className="overlap-close-btn" type="button" onClick={() => setOverlappingVenues(null)}>✕</button>
          </div>
          <div className="overlap-venue-list">
            {overlappingVenues.map((venue) => {
              const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
              const isActive = selectedVenueId === venue.id
              return (
                <button
                  key={venue.id}
                  type="button"
                  className={`overlap-venue-item${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}`}
                  onClick={() => {
                    onSelectVenue(venue.id)
                    setOverlappingVenues(null)
                  }}
                >
                  <div className="overlap-venue-name">{translateVenueName(venue.name, lang)}</div>
                  <div className="overlap-venue-meta">
                    <span>{translateCityName(venue.city, lang)}</span>
                    <span className="dot-divider">•</span>
                    <span>{t('capacityPeople', { capacity: venue.capacity })}</span>
                  </div>
                </button>
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

export const TaiwanMap = memo(TaiwanMapComponent)
