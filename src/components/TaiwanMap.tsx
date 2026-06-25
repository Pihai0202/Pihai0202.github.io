import { useState, useRef, useMemo, useEffect } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import type { Concert, Venue } from '../types'
import { VENUES } from '../constants/venues'

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
  const [center, setCenter] = useState({ x: 235, y: 295 })
  const [isDragging, setIsDragging] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragStartRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null)
  const didDragRef = useRef(false)

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
  centerRef.current = center

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
    const targetX = selectedVenue ? selectedVenue.x : 235
    const targetY = selectedVenue ? selectedVenue.y : 295
    const targetZoom = selectedVenue ? 1.8 : 1.1

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

      const w = 370 / zoom
      const h = 450 / zoom

      const minX = center.x - w / 2
      const minY = center.y - h / 2

      const mx = minX + pctX * w
      const my = minY + pctY * h

      const zoomFactor = 1.08
      let newZoom = zoom
      if (e.deltaY < 0) {
        newZoom = Math.min(2.5, zoom * zoomFactor)
      } else {
        newZoom = Math.max(0.7, zoom / zoomFactor)
      }

      const newWidth = 370 / newZoom
      const newHeight = 450 / newZoom

      const newMinX = mx - pctX * newWidth
      const newMinY = my - pctY * newHeight

      setCenter({
        x: newMinX + newWidth / 2,
        y: newMinY + newHeight / 2,
      })

      onZoomChange(newZoom)
    }

    svgEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      svgEl.removeEventListener('wheel', handleWheel)
    }
  }, [zoom, center, onZoomChange])

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    didDragRef.current = false
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      centerX: center.x,
      centerY: center.y,
    }
    setIsDragging(true)
  }

  const handleTouchStart = (e: TouchEvent<SVGSVGElement>) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    didDragRef.current = false
    dragStartRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      centerX: center.x,
      centerY: center.y,
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
    const w = 370 / zoom
    const h = 450 / zoom
    const scaleX = w / svgRect.width
    const scaleY = h / svgRect.height

    setCenter({
      x: dragStartRef.current.centerX - dx * scaleX,
      y: dragStartRef.current.centerY - dy * scaleY,
    })
  }

  const handleTouchMove = (e: TouchEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStartRef.current || !svgRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]

    const dx = touch.clientX - dragStartRef.current.clientX
    const dy = touch.clientY - dragStartRef.current.clientY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragRef.current = true
    }

    const svgRect = svgRef.current.getBoundingClientRect()
    const w = 370 / zoom
    const h = 450 / zoom
    const scaleX = w / svgRect.width
    const scaleY = h / svgRect.height

    setCenter({
      x: dragStartRef.current.centerX - dx * scaleX,
      y: dragStartRef.current.centerY - dy * scaleY,
    })
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    dragStartRef.current = null
  }

  const handleSvgClick = () => {
    if (!didDragRef.current) {
      onClearVenue()
    }
  }

  const width = 370 / displayZoom
  const height = 450 / displayZoom
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleDragEnd}
        style={{ '--map-zoom': displayZoom } as React.CSSProperties}
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--map-glow-start, #1a1a3e)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--map-glow-end, #0a0a0f)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="235" cy="285" rx="180" ry="220" fill="url(#mapGlow)" />
        <path
          d="M 225,95 L 232,88 L 248,82 L 262,78 L 278,76 L 292,78 L 305,84 L 315,92 L 322,104 L 325,118 L 323,134 L 318,150 L 310,165 L 320,178 L 330,195 L 335,215 L 334,235 L 328,255 L 318,272 L 310,290 L 305,310 L 302,332 L 298,355 L 292,378 L 282,400 L 270,420 L 256,438 L 240,452 L 225,462 L 212,468 L 198,472 L 185,472 L 172,468 L 162,460 L 155,448 L 152,434 L 154,420 L 160,405 L 168,390 L 172,374 L 170,358 L 164,344 L 156,330 L 150,316 L 148,302 L 150,288 L 156,274 L 162,260 L 165,244 L 162,228 L 156,212 L 152,196 L 154,178 L 162,160 L 172,143 L 182,128 L 194,114 L 206,103 L 216,97 L 225,95 Z"
          fill="var(--map-land, #1e2040)"
          stroke="var(--map-land-stroke, #2a2a60)"
          strokeWidth="1.5"
          opacity="0.9"
        />
        <path
          d="M 220,200 Q 240,190 260,205 Q 275,220 265,240 Q 250,255 235,248 Q 218,238 215,220 Q 212,207 220,200 Z"
          fill="none"
          stroke="var(--map-contour, #2a2a55)"
          strokeWidth="0.8"
          opacity="0.5"
        />
        <path
          d="M 218,195 Q 245,182 268,200 Q 285,218 272,244 Q 256,262 236,254 Q 212,243 208,222 Q 205,204 218,195 Z"
          fill="none"
          stroke="var(--map-contour, #2a2a55)"
          strokeWidth="0.6"
          opacity="0.3"
        />
        <path
          d="M 230,150 L 250,110 L 268,145 L 280,125 L 295,160 L 285,185 L 265,200 L 245,205 L 228,190 Z"
          fill="var(--map-mountain, #1a1a35)"
          stroke="var(--map-mountain-stroke, #252545)"
          strokeWidth="1"
          opacity="0.6"
        />
        <circle cx="120" cy="330" r="12" fill="var(--map-land, #1e2040)" stroke="var(--map-land-stroke, #2a2a60)" strokeWidth="1" />
        <circle cx="108" cy="320" r="7" fill="var(--map-land, #1e2040)" stroke="var(--map-land-stroke, #2a2a60)" strokeWidth="1" />
        <circle cx="128" cy="315" r="5" fill="var(--map-land, #1e2040)" stroke="var(--map-land-stroke, #2a2a60)" strokeWidth="1" />
        <text x="110" y="348" fill="var(--map-label, #4a4a70)" fontSize="9" textAnchor="middle">
          澎湖
        </text>
        <circle cx="355" cy="450" r="8" fill="var(--map-land, #1e2040)" stroke="var(--map-land-stroke, #2a2a60)" strokeWidth="1" />
        <rect x="58" y="280" width="25" height="15" rx="4" fill="var(--map-land, #1e2040)" stroke="var(--map-land-stroke, #2a2a60)" strokeWidth="1" />
        <text x="70" y="306" fill="var(--map-label, #4a4a70)" fontSize="9" textAnchor="middle">
          金門
        </text>

        <g>
          {VENUES.map((venue) => {
            const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
            const isActive = selectedVenueId === venue.id
            const isCategoryInactive = categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(venue.id)

            const isSport = venue.name.includes('棒球場') ||
                            venue.name.includes('體育場') ||
                            venue.name.includes('體育館') ||
                            venue.name.includes('巨蛋')

            const iconSize = 16 / displayZoom
            const halfSize = iconSize / 2

            return (
              <g
                key={venue.id}
                className={`venue-icon-group${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}${isCategoryInactive ? ' category-inactive' : ''}`}
                transform={`translate(${venue.x},${venue.y})`}
                onClick={(e) => {
                  if (isCategoryInactive) return
                  e.stopPropagation()
                  onSelectVenue(venue.id)
                }}
                onMouseEnter={() => {
                  if (isCategoryInactive) return
                  setHoveredVenue(venue)
                }}
                onMouseMove={(e) => {
                  setTooltipPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHoveredVenue(null)
                }}
              >
                <circle className="click-target" r="18" cx="0" cy="0" fill="transparent" style={{ cursor: 'pointer' }} />
                <circle className="pulse-ring" r="12" cx="0" cy="0" />
                <svg
                  x={-halfSize}
                  y={-halfSize}
                  width={iconSize}
                  height={iconSize}
                  viewBox="0 0 24 24"
                  className="venue-icon"
                >
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
                </svg>
              </g>
            )
          })}
        </g>
      </svg>

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
          <div className="tooltip-title">{hoveredVenue.name}</div>
          <div className="tooltip-meta">
            <span>📍 {hoveredVenue.city}</span>
            <span>👥 {hoveredVenue.capacity} 人</span>
          </div>
          {concerts.some((c) => c.venueId === hoveredVenue.id) && (
            <div className="tooltip-status visited">✓ 已拜訪過此場館</div>
          )}
        </div>
      )}
    </div>
  )
}
