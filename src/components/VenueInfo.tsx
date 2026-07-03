import { useState } from 'react'
import type { Venue, RemoteConcert } from '../types'
import { logCustomEvent } from '../firebase'
import { MapIcon, CloseIcon, CheckIcon, PinIcon, CompassIcon, TrainIcon } from './SvgIcon'

interface VenueInfoProps {
  venue: Venue | null
  concertCount: number
  onAddConcert: () => void
  onClearVenue: () => void
  todayConcerts?: RemoteConcert[]
  onSelectTicket?: (ticket: RemoteConcert) => void
}

export function VenueInfo({
  venue,
  concertCount,
  onAddConcert,
  onClearVenue,
  todayConcerts = [],
  onSelectTicket,
}: VenueInfoProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showMap, setShowMap] = useState(false)

  if (!venue) {
    return (
      <div className="venue-info empty">
        <div className="empty-hint">
          <div className="icon"><MapIcon size="2.5em" /></div>
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
            <CloseIcon size="0.85em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            清除選取
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
          {concertCount > 0 ? (
            <>
              <CheckIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {concertCount} 場
            </>
          ) : (
            '未造訪'
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="venue-capacity">容量：{venue.capacity} 人</div>

          {/* 今日演出 */}
          <div className="venue-today-section">
            <div className="venue-today-title">
              <span className="live-pulse-dot"></span>
              今日演出
            </div>
            {todayConcerts.length > 0 ? (
              <div className="venue-today-list">
                {todayConcerts.map((concert) => (
                  <div
                    key={concert.id}
                    className="venue-today-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectTicket?.(concert)}
                  >
                    <div className="venue-today-item-header">
                      <span className="venue-today-source">{concert.source}</span>
                      {concert.price && <span className="venue-today-price">{concert.price}</span>}
                    </div>
                    <div className="venue-today-name">{concert.name}</div>
                    {concert.ticket_links && concert.ticket_links.length > 0 && (
                      <div className="venue-today-links">
                        {concert.ticket_links.slice(0, 2).map((link) => (
                          <a
                            key={`${concert.id}-${link.platform}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="venue-today-link-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {link.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="venue-today-empty">今日無演出活動</div>
            )}
          </div>

          {venue.address && (
            <div className="venue-address">
              <span className="icon">
                <PinIcon size="0.9em" style={{ verticalAlign: 'middle' }} />
              </span>
              <span className="text">{venue.address}</span>
              <button
                className={`address-nav-btn${showMap ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  const nextShowMap = !showMap
                  setShowMap(nextShowMap)
                  if (nextShowMap) {
                    logCustomEvent('click_navigation_toggle', {
                      venue_id: venue.id,
                      venue_name: venue.name
                    })
                  }
                }}
              >
                <CompassIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                導航
              </button>
            </div>
          )}
          {venue.transit && showMap && (
            <div className="venue-transit">
              <span className="icon">
                <TrainIcon size="0.95em" style={{ verticalAlign: 'middle' }} />
              </span>
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
                onClick={() => {
                  logCustomEvent('click_google_maps_external', {
                    venue_id: venue.id,
                    venue_name: venue.name
                  })
                }}
              >
                <CompassIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Google 地圖導航
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
