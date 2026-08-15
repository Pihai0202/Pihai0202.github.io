import { useState } from 'react'
import type { Venue, RemoteConcert, SuspensionItem } from '../types'
import { logCustomEvent } from '../firebase'
import { MapIcon, CloseIcon, CheckIcon, PinIcon, CompassIcon, TrainIcon, WarningIcon } from './SvgIcon'
import { useTranslation, translateVenueName, translateCityName } from '../utils/i18n'
import { getCitySuspensionStatus } from '../utils/suspensionHelper'
import { SafeIframe } from './SafeIframe'
import { LazyImage } from './LazyImage'

interface VenueInfoProps {
  venue: Venue | null
  concertCount: number
  onAddConcert: () => void
  onClearVenue: () => void
  todayConcerts?: RemoteConcert[]
  onSelectTicket?: (ticket: RemoteConcert) => void
  suspensionItems?: SuspensionItem[]
}

export function VenueInfo({
  venue,
  concertCount,
  onAddConcert,
  onClearVenue,
  todayConcerts = [],
  onSelectTicket,
  suspensionItems = [],
}: VenueInfoProps) {
  const { lang } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showMap, setShowMap] = useState(false)

  if (!venue) {
    return (
      <div className="venue-info empty">
        <div className="empty-hint">
          <div className="icon"><MapIcon size="2.5em" /></div>
          <p>
            {lang === 'zh-TW' ? (
              <>點擊地圖上的場館<br />查看詳情並記錄演唱會</>
            ) : lang === 'ja' ? (
              <>地図上の会場をクリックして<br />詳細を表示し、記録を追加します</>
            ) : lang === 'ko' ? (
              <>지도에서 공연장을 선택하여<br />상세 정보를 확인하고 후기를 남겨보세요</>
            ) : (
              <>Click a venue on the map<br />to view details and add records</>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`venue-info${isCollapsed ? ' collapsed' : ''}`}>
      <div className="venue-top">
        <div className="venue-city">{translateCityName(venue.city, lang)}</div>
        <div className="venue-top-actions">
          <button
            className="toggle-collapse-btn"
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed 
              ? (lang === 'zh-TW' ? '▼ 展開' : lang === 'ja' ? '▼ 展開' : lang === 'ko' ? '▼ 펼치기' : '▼ Expand') 
              : (lang === 'zh-TW' ? '▲ 收起' : lang === 'ja' ? '▲ 折りたたむ' : lang === 'ko' ? '▲ 접기' : '▲ Collapse')}
          </button>
          <button className="clear-venue-btn" type="button" onClick={onClearVenue}>
            <CloseIcon size="0.85em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {lang === 'zh-TW' ? '清除選取' : lang === 'en' ? 'Clear Selected' : lang === 'ja' ? '選択解除' : '선택 해제'}
          </button>
        </div>
      </div>
      <div
        className="venue-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="venue-name">{translateVenueName(venue.name, lang)}</div>
        <div className={`venue-count${concertCount > 0 ? ' has-visits' : ''}`}>
          {concertCount > 0 ? (
            <>
              <CheckIcon size="0.95em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {concertCount} {lang === 'zh-TW' ? '場' : lang === 'ja' ? '回' : lang === 'ko' ? '회' : 'visits'}
            </>
          ) : (
            lang === 'zh-TW' ? '未造訪' : lang === 'en' ? 'Unvisited' : lang === 'ja' ? '未訪問' : '미방문'
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="venue-capacity">
            {lang === 'zh-TW' 
              ? `容量：${venue.capacity} 人` 
              : lang === 'ja' 
                ? `キャパシティ：${venue.capacity} 人` 
                : lang === 'ko' 
                  ? `수용인원: ${venue.capacity}명` 
                  : `Capacity: ${venue.capacity}`}
          </div>

          {/* 今日演出 — 有演出才顯示，沒有就隱藏整個區塊 */}
          {todayConcerts.length > 0 && (
            <div className="venue-today-section">
              <div className="venue-today-title">
                <span className="live-pulse-dot"></span>
                {lang === 'zh-TW' ? '今日演出' : lang === 'en' ? "Today's Show" : lang === 'ja' ? '本日開催の公演' : '오늘의 공연'}
              </div>
              <div className="venue-today-list">
                {todayConcerts.map((concert) => (
                  <div
                    key={concert.id}
                    className="venue-today-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectTicket?.(concert)}
                  >
                    <div className="venue-today-item-body">
                      <LazyImage
                        src={concert.image}
                        alt=""
                        className="venue-today-thumb"
                        fallback={<div className="venue-today-fallback">LIVE</div>}
                      />
                      <div className="venue-today-info">
                        <div className="venue-today-item-header">
                          <span className="venue-today-source">{concert.source}</span>
                          {concert.price && <span className="venue-today-price">{concert.price}</span>}
                        </div>
                        <div className="venue-today-name">{concert.name}</div>
                        {concert.game_score && (
                          <div className={`cpbl-score-badge ${concert.game_score.status || 'scheduled'}`}>
                            <span className="cpbl-status-tag">
                              {concert.game_score.status === 'live' && <span className="live-pulsing-dot" />}
                              {concert.game_score.status_text || '賽事'}
                            </span>
                            <span className="cpbl-score-numbers">
                              {concert.game_score.visiting_team || '客隊'} <strong>{concert.game_score.visiting_score ?? '-'}</strong> : <strong>{concert.game_score.home_score ?? '-'}</strong> {concert.game_score.home_team || '主隊'}
                            </span>
                          </div>
                        )}
                        {getCitySuspensionStatus(venue.city, suspensionItems) && (
                          <div className="typhoon-warning-badge">
                            <WarningIcon size="0.95em" style={{ marginRight: '3px', flexShrink: 0 }} />
                            {lang === 'zh-TW' ? '因颱風停班停課，演出可能延期/取消' : 'Show may be postponed/cancelled due to typhoon.'}
                          </div>
                        )}
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {lang === 'zh-TW' ? '導航' : lang === 'en' ? 'Navigate' : lang === 'ja' ? '道案内' : '길찾기'}
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
              <SafeIframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${venue.city} ${venue.name} ${venue.address}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                title={`${venue.name} map`}
                loading="lazy"
              />
            </div>
          )}

          <div className="venue-actions">
            <button className="add-concert-btn" type="button" onClick={onAddConcert}>
              {lang === 'zh-TW' ? '＋ 新增演唱會記錄' : lang === 'en' ? '＋ Add Concert Record' : lang === 'ja' ? '＋ コンサート記録を追加' : '＋ 콘서트 기록 추가'}
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
                {lang === 'zh-TW' ? 'Google 地圖導航' : lang === 'en' ? 'Google Maps Navigation' : lang === 'ja' ? 'Googleマップで開く' : 'Google 지도 길찾기'}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
