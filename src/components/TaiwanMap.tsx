import { useState, useRef, useMemo, useEffect, memo } from 'react'
import type { MouseEvent } from 'react'
import type { Concert, Venue } from '../types'
import { VENUES } from '../constants/venues'
import { TAIWAN_PATHS } from '../constants/taiwanPaths'
import { useTranslation, translateVenueName, translateCityName } from '../utils/i18n.tsx'
import { PinIcon, UserIcon, CheckIcon, CloseIcon } from './SvgIcon'

const project = (lon: number, lat: number) => {
  const x = 159.787256 * lon - 18882.141068
  const y = -172.627301 * lat + 4572.883143
  return { x, y }
}

const getVenueTier = (venue: Venue): 1 | 2 | 3 => {
  const cap = parseInt((venue.capacity || '').replace(/[^0-9]/g, ''), 10) || 0
  if (cap >= 8000) return 1
  if (cap >= 2000) return 2
  return 3
}

const getClusterLabel = (clusterVenues: Venue[], lang: string): string => {
  const cityCounts: Record<string, number> = {}
  clusterVenues.forEach((v) => {
    const c = v.city || ''
    cityCounts[c] = (cityCounts[c] || 0) + 1
  })

  const uniqueCities = Object.keys(cityCounts)
  const hasTaipei = uniqueCities.some((c) => c.includes('台北') || c.includes('臺北'))
  const hasNewTaipei = uniqueCities.some((c) => c.includes('新北'))

  if (hasTaipei && hasNewTaipei && uniqueCities.length <= 3) {
    if (lang === 'zh-TW') return '雙北'
    if (lang === 'ja') return '双北'
    if (lang === 'ko') return '쌍북'
    return 'Shuangbei'
  }

  uniqueCities.sort((a, b) => cityCounts[b] - cityCounts[a])
  const mainCity = uniqueCities[0] || ''
  return translateCityName(mainCity, lang)
}

const SPORT_VENUE_IDS = [
  'taipei-dome',
  'tianmu',
  'xinzhuang',
  'xinzhuang-gym',
  'banqiao-stadium',
  'taoyuan-arena',
  'taoyuan-dome-gym',
  'linkou-arena',
  'hsinchu',
  'hsinchu-county-gym',
  'taichung-dome',
  'ntupes-gym',
  'changhua',
  'douliou',
  'chiayi',
  'tainan',
  'asia-pacific-main',
  'kaohsiung-natl',
  'kaohsiung-dome',
  'chengcing-lake',
  'pingtung-gym',
  'hualien',
  'taitung',
]

const SPORT_SET = new Set(SPORT_VENUE_IDS)

const SORTED_TAIWAN_PATHS = Object.entries(TAIWAN_PATHS).sort(([a], [b]) =>
  a === 'Taipei' ? 1 : b === 'Taipei' ? -1 : 0
)

interface CountyLabelItem {
  id: string
  name: string
  x: number
  y: number
  minZoom?: number
}

const COUNTY_LABELS: CountyLabelItem[] = [
  { id: 'Keelung', name: '基隆', x: 574, y: 234, minZoom: 1.2 },
  { id: 'Taipei', name: '台北', x: 538, y: 242 },
  { id: 'NewTaipei', name: '新北', x: 572, y: 270 },
  { id: 'Taoyuan', name: '桃園', x: 486, y: 280 },
  { id: 'Hsinchu', name: '新竹', x: 468, y: 310 },
  { id: 'Miaoli', name: '苗栗', x: 436, y: 345 },
  { id: 'Taichung', name: '台中', x: 432, y: 388 },
  { id: 'Changhua', name: '彰化', x: 366, y: 434 },
  { id: 'Nantou', name: '南投', x: 450, y: 458 },
  { id: 'Yunlin', name: '雲林', x: 356, y: 488 },
  { id: 'Chiayi', name: '嘉義', x: 384, y: 510 },
  { id: 'Tainan', name: '台南', x: 344, y: 574 },
  { id: 'Kaohsiung', name: '高雄', x: 388, y: 612 },
  { id: 'Pingtung', name: '屏東', x: 382, y: 720 },
  { id: 'Yilan', name: '宜蘭', x: 560, y: 325 },
  { id: 'Hualien', name: '花蓮', x: 512, y: 475 },
  { id: 'Taitung', name: '台東', x: 495, y: 645 },
  { id: 'Penghu', name: '澎湖', x: 213, y: 585 },
  { id: 'Kinmen', name: '金門', x: 25, y: 375 },
  { id: 'Lienchiang', name: '馬祖', x: 324, y: 115 },
]

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
  venues?: Venue[]
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
  venues = VENUES,
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
  const [hoveredCluster, setHoveredCluster] = useState<DynamicCluster | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null)
  const didDragRef = useRef(false)

  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number | null>(null)
  const pinchStartMidpointRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pinchStartMapCenterRef = useRef<{ x: number; y: number } | null>(null)

  const preprojectedVenues = useMemo(() => {
    return venues.map((venue) => ({
      ...venue,
      pos: project(venue.longitude || 0, venue.latitude || 0),
      isSport: SPORT_SET.has(venue.id),
      tier: getVenueTier(venue),
    }))
  }, [venues])

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId),
    [venues, selectedVenueId],
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

  const flyTo = (targetX: number, targetY: number, targetZoom: number, duration = 450) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    isAnimatingRef.current = false

    const startZoom = displayZoomRef.current || displayZoom
    const startX = displayCenterRef.current.x
    const startY = displayCenterRef.current.y

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
  }

  interface DynamicCluster {
    id: string
    isCluster: true
    pos: { x: number; y: number }
    venues: (typeof preprojectedVenues)[0][]
    count: number
    label: string
    hasVisits: boolean
    hasEvents: boolean
    isCategoryInactive: boolean
  }

  interface SingleVenueItem {
    id: string
    isCluster: false
    pos: { x: number; y: number }
    venue: (typeof preprojectedVenues)[0]
    hasVisits: boolean
    hasEvents: boolean
    isActive: boolean
    isCategoryInactive: boolean
  }

  type MapDisplayItem = DynamicCluster | SingleVenueItem

  // Quantize zoom bucket to stabilize clusters during continuous touch pinch/drag
  const clusterZoomBucket = Math.round(displayZoom * 10) / 10

  const dynamicDisplayItems = useMemo<MapDisplayItem[]>(() => {
    // Adaptive radius: larger at full-island view to merge adjacent metropolitan zones, tighter when zoomed in
    const baseRadius = clusterZoomBucket < 1.3 ? 48 : clusterZoomBucket < 2.0 ? 36 : clusterZoomBucket < 3.0 ? 26 : 18
    const radiusSvg = Math.max(6, baseRadius / clusterZoomBucket)
    // Always cluster >= 2 items when they visually collide to avoid overlapping dots
    const minClusterCount = 2

    const visited = new Set<string>()
    const items: MapDisplayItem[] = []

    // Sort: Tier 1 (major stadiums) first so clusters anchor around central regional hubs
    const sorted = [...preprojectedVenues].sort((a, b) => {
      if (a.id === selectedVenueId) return -1
      if (b.id === selectedVenueId) return 1
      if (a.tier !== b.tier) return a.tier - b.tier
      const capA = parseInt((a.capacity || '').replace(/[^0-9]/g, ''), 10) || 0
      const capB = parseInt((b.capacity || '').replace(/[^0-9]/g, ''), 10) || 0
      return capB - capA
    })

    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i]
      if (visited.has(v.id)) continue

      // Explicitly keep the currently selected venue unclustered so its focus ring is directly visible
      if (v.id === selectedVenueId) {
        visited.add(v.id)
        const hasVisits = visitedVenueIds.has(v.id)
        const hasEvents = activeVenueIds ? activeVenueIds.has(v.id) : false
        const isCategoryInactive = categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(v.id)
        items.push({
          id: v.id,
          isCluster: false,
          pos: v.pos,
          venue: v,
          hasVisits,
          hasEvents,
          isActive: true,
          isCategoryInactive: !!isCategoryInactive,
        })
        continue
      }

      const group = [v]
      visited.add(v.id)

      for (let j = i + 1; j < sorted.length; j++) {
        const v2 = sorted[j]
        if (visited.has(v2.id) || v2.id === selectedVenueId) continue
        const dist = Math.hypot(v.pos.x - v2.pos.x, v.pos.y - v2.pos.y)
        if (dist <= radiusSvg) {
          group.push(v2)
          visited.add(v2.id)
        }
      }

      if (group.length >= minClusterCount) {
        const avgX = group.reduce((sum, g) => sum + g.pos.x, 0) / group.length
        const avgY = group.reduce((sum, g) => sum + g.pos.y, 0) / group.length
        const clusterHasVisits = group.some((gv) => visitedVenueIds.has(gv.id))
        const clusterHasEvents = group.some((gv) => activeVenueIds && activeVenueIds.has(gv.id))
        const allCategoryInactive =
          categoryFilter !== 'all' &&
          activeVenueIds &&
          group.every((gv) => !activeVenueIds.has(gv.id))

        items.push({
          id: `cluster-${group[0].id}-${group.length}`,
          isCluster: true,
          pos: { x: avgX, y: avgY },
          venues: group,
          count: group.length,
          label: getClusterLabel(group, lang),
          hasVisits: clusterHasVisits,
          hasEvents: !!clusterHasEvents,
          isCategoryInactive: !!allCategoryInactive,
        })
      } else {
        for (const gv of group) {
          const hasVisits = visitedVenueIds.has(gv.id)
          const hasEvents = activeVenueIds ? activeVenueIds.has(gv.id) : false
          const isCategoryInactive = categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(gv.id)
          items.push({
            id: gv.id,
            isCluster: false,
            pos: gv.pos,
            venue: gv,
            hasVisits,
            hasEvents,
            isActive: false,
            isCategoryInactive: !!isCategoryInactive,
          })
        }
      }
    }

    return items
  }, [preprojectedVenues, clusterZoomBucket, selectedVenueId, visitedVenueIds, activeVenueIds, categoryFilter, lang])

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

    if (selectedVenue) {
      const projected = project(selectedVenue.longitude || 0, selectedVenue.latitude || 0)
      let targetZoom = 3.5
      if (selectedVenue.id === 'linkou-arena' || selectedVenue.id === 'taoyuan-arena') {
        targetZoom = 3.8
      }
      flyTo(projected.x, projected.y, targetZoom)
    } else {
      const defaultZoom = typeof window !== 'undefined' && window.innerWidth <= 1200 ? 0.95 : 1.1
      flyTo(455, 500, defaultZoom)
    }
  }, [selectedVenueId, selectedVenue])

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

  const handleClusterClick = (cluster: DynamicCluster, e: MouseEvent) => {
    if (didDragRef.current) return
    e.stopPropagation()

    const maxSpread = Math.max(
      ...cluster.venues.map((v) => Math.hypot(v.pos.x - cluster.pos.x, v.pos.y - cluster.pos.y))
    )

    if (displayZoom >= 3.4 || maxSpread < 6) {
      if (svgRef.current) {
        const container = svgRef.current.parentElement
        if (container) {
          const containerRect = container.getBoundingClientRect()
          setOverlappingVenues(cluster.venues)
          setOverlapPos({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top,
          })
          return
        }
      }
    }

    const targetZoom = Math.min(5.5, Math.max(displayZoom * 1.85, 2.8))
    flyTo(cluster.pos.x, cluster.pos.y, targetZoom)
  }

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

        {/* Region & County Name Labels Layer */}
        <g className="map-county-labels-layer" pointerEvents="none" style={{ userSelect: 'none' }}>
          {COUNTY_LABELS.map((item) => {
            if (displayZoom < (item.minZoom || 0.8)) return null
            return (
              <text
                key={item.id}
                x={item.x}
                y={item.y}
                className="map-county-label"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {translateCityName(item.name, lang)}
              </text>
            )
          })}
        </g>

        <g className="dynamic-markers-layer">
          {dynamicDisplayItems.map((item) => {
            if (item.isCluster) {
              const isLarge = item.count >= 15
              const plateRadius = isLarge ? 13 : 11
              return (
                <g
                  key={item.id}
                  className={`shuangbei-cluster-group${item.hasVisits ? ' visited' : ''}${item.hasEvents ? ' has-events' : ''}${item.isCategoryInactive ? ' category-inactive' : ''}`}
                  transform={`translate(${item.pos.x},${item.pos.y})`}
                  onClick={(e) => handleClusterClick(item, e)}
                  onMouseEnter={() => {
                    if (!isDragging) setHoveredCluster(item)
                  }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCluster(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <g transform={`scale(${1 / displayZoom})`}>
                    <circle className="click-target" r={plateRadius + 7} cx="0" cy="0" fill="transparent" />
                    <circle className="pulse-ring-cluster" r={plateRadius + 2.5} cx="0" cy="0" />
                    <circle className="cluster-plate" cx="0" cy="0" r={plateRadius} />
                    <text
                      x="0"
                      y={isLarge ? 4.5 : 4}
                      textAnchor="middle"
                      className="cluster-text"
                      fontSize={isLarge ? 12 : 11}
                    >
                      {item.count}
                    </text>
                  </g>
                </g>
              )
            }

            const { venue, hasVisits, isActive, hasEvents, isCategoryInactive } = item
            const isHovered = hoveredVenue && hoveredVenue.id === venue.id

            // LOD (Level of Detail):
            // - Selected / hovered / visited / active events: high priority
            // - Tier 1: stadium icon at zoom >= 1.6
            // - Tier 2: arena/hall icon at zoom >= 2.4
            // - Tier 3: livehouse icon at zoom >= 3.4
            const shouldShowIcon =
              isActive ||
              isHovered ||
              hasVisits ||
              hasEvents ||
              (venue.tier === 1 && displayZoom >= 1.6) ||
              (venue.tier === 2 && displayZoom >= 2.4) ||
              displayZoom >= 3.4

            return (
              <g
                key={venue.id}
                data-venue-id={venue.id}
                className={`venue-icon-group${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}${isCategoryInactive ? ' category-inactive' : ''} ${shouldShowIcon ? 'show-icon' : 'show-dot'}`}
                transform={`translate(${item.pos.x},${item.pos.y})`}
                onClick={(e) => {
                  if (isCategoryInactive || didDragRef.current) return
                  e.stopPropagation()

                  if (svgRef.current) {
                    const groups = Array.from(svgRef.current.querySelectorAll('.venue-icon-group:not(.category-inactive)'))
                    const nearby = groups
                      .filter((el) => {
                        const r = el.getBoundingClientRect()
                        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
                        return dist < 22
                      })
                      .map((el) => venues.find((v) => v.id === el.getAttribute('data-venue-id')))
                      .filter(Boolean) as Venue[]

                    if (nearby.length >= 2) {
                      const container = svgRef.current.parentElement
                      if (container) {
                        const containerRect = container.getBoundingClientRect()
                        setOverlappingVenues(nearby)
                        setOverlapPos({
                          x: e.clientX - containerRect.left,
                          y: e.clientY - containerRect.top,
                        })
                        return
                      }
                    }
                  }

                  setOverlappingVenues(null)
                  onSelectVenue(venue.id)
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
                <circle
                  className={`placeholder-dot tier-${venue.tier}${hasEvents ? ' has-events' : ''}`}
                  r={venue.tier === 1 ? 4.2 : venue.tier === 2 ? 3.4 : 2.8}
                  cx="0"
                  cy="0"
                />
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

      {hoveredCluster && (
        <div
          className="map-tooltip cluster-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="tooltip-title">
            {hoveredCluster.label} ({hoveredCluster.count} {lang === 'zh-TW' ? '個場館' : lang === 'ja' ? '会場' : lang === 'ko' ? '곳' : 'venues'})
          </div>
          <div className="tooltip-meta" style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
            {lang === 'zh-TW' ? '點擊放大探索此區域' : lang === 'ja' ? 'クリックしてズーム' : lang === 'ko' ? '클릭하여 확대' : 'Click to zoom into area'}
          </div>
        </div>
      )}

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
            <button className="overlap-close-btn" type="button" onClick={() => setOverlappingVenues(null)} aria-label="Close">
              <CloseIcon size="0.9em" />
            </button>
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
                  <div className="overlap-venue-name">
                    {translateVenueName(venue.name, lang)}
                    {hasVisits && <CheckIcon size="0.85em" style={{ marginLeft: '6px', color: 'var(--teal)' }} />}
                  </div>
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
