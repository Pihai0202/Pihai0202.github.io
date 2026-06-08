import { useState } from 'react'
import type { Venue } from '../types'

interface VenueInfoProps {
  venue: Venue | null
  concertCount: number
  onAddConcert: () => void
  onClearVenue: () => void
}

export function VenueInfo({
  venue,
  concertCount,
  onAddConcert,
  onClearVenue,
}: VenueInfoProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showMap, setShowMap] = useState(false)

  if (!venue) {
    return (
      <div className="venue-info empty">
        <div className="empty-hint">
          <div className="icon">🗺️</div>
          <p>
            點擊地圖上的場館
            <br />
            查看詳情並記錄演唱會
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`venue-info${isCollapsed ? ' collapsed' : ''}`}>
      <div className="venue-top">
        <div className="venue-city">{venue.city}</div>
        <div className="venue-top-actions">
          <button
            className="toggle-collapse-btn"
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? '▼ 展開' : '▲ 收起'}
          </button>
          <button className="clear-venue-btn" type="button" onClick={onClearVenue}>
            ✕ 清除選取
          </button>
        </div>
      </div>
      <div
        className="venue-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="venue-name">{venue.name}</div>
        <div className={`venue-count${concertCount > 0 ? ' has-visits' : ''}`}>
          {concertCount > 0 ? `✓ ${concertCount} 場` : '未造訪'}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="venue-capacity">容量：{venue.capacity} 人</div>

          {venue.address && (
            <div className="venue-address">
              <span className="icon">📍</span>
              <span className="text">{venue.address}</span>
              <button
                className={`address-nav-btn${showMap ? ' active' : ''}`}
                type="button"
                onClick={() => setShowMap(!showMap)}
              >
                🧭 導航
              </button>
            </div>
          )}
          {venue.transit && showMap && (
            <div className="venue-transit">
              <span className="icon">🚇</span>
              <span className="text">{venue.transit}</span>
            </div>
          )}

          {venue.address && showMap && (
            <div className="venue-map-embed">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${venue.city} ${venue.name} ${venue.address}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                title={`${venue.name} map`}
                loading="lazy"
              />
            </div>
          )}

          <div className="venue-actions">
            <button className="add-concert-btn" type="button" onClick={onAddConcert}>
              ＋ 新增演唱會記錄
            </button>
            {showMap && (
              <a
                className="nav-map-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.city} ${venue.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                🧭 Google 地圖導航 ↗
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
