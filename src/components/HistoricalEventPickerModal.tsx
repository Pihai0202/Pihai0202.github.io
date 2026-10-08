import { useState, useEffect, useRef } from 'react'
import type { HistoricalEvent } from '../types'
import { searchHistoricalEvents } from '../utils/historicalEventsService'
import { CloseIcon, SearchIcon, CalendarIcon, PinIcon, CheckIcon, TicketIcon, BaseballIcon } from './SvgIcon'
import { LazyImage } from './LazyImage'

interface HistoricalEventPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectEvent: (event: HistoricalEvent) => void
  initialQuery?: string
}

export function HistoricalEventPickerModal({
  isOpen,
  onClose,
  onSelectEvent,
  initialQuery = '',
}: HistoricalEventPickerModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [year, setYear] = useState('all')
  const [category, setCategory] = useState('all')
  const [city, setCity] = useState('all')
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(30)
  const listRef = useRef<HTMLDivElement>(null)

  // Sync initialQuery when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery)
      }
      setDisplayLimit(30)
    }
  }, [isOpen, initialQuery])

  // Search execution with debounce
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await searchHistoricalEvents({
          query,
          year,
          category,
          city,
          limit: displayLimit,
        })
        if (isMounted) {
          setEvents(res.events)
          setTotalMatches(res.totalMatches)
        }
      } catch (err) {
        console.error('Failed to search historical events:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }, 150)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [isOpen, query, year, category, city, displayLimit])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + 30)
  }

  const handleSelect = (ev: HistoricalEvent) => {
    onSelectEvent(ev)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="historical-picker-backdrop" onClick={onClose}>
      <div
        className="historical-picker-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="historical-picker-title"
      >
        {/* Modal Header */}
        <div className="historical-picker-header">
          <div className="picker-header-text">
            <div className="picker-title-row">
              <span className="picker-badge-sparkle">🏛️ 歷年活動資料庫</span>
              <span className="picker-count-pill">{totalMatches.toLocaleString()} 場收錄</span>
            </div>
            <h2 id="historical-picker-title">挑選過往活動紀錄</h2>
            <p className="picker-subtitle">
              收錄歷年售票演唱會與中華職棒賽事，點選活動即可一鍵帶入表單！
            </p>
          </div>
          <button
            type="button"
            className="picker-close-btn"
            onClick={onClose}
            aria-label="關閉"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="historical-picker-controls">
          <div className="picker-search-bar">
            <span className="picker-search-icon">
              <SearchIcon size={18} />
            </span>
            <input
              type="text"
              className="picker-search-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setDisplayLimit(30)
              }}
              placeholder="搜尋歌手、活動名稱、場館 (如：五月天、周杰倫、中信兄弟、大巨蛋...)"
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="picker-search-clear"
                onClick={() => {
                  setQuery('')
                  setDisplayLimit(30)
                }}
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="picker-filters-row">
            {/* Year Filters */}
            <div className="picker-filter-group">
              <span className="picker-filter-label">年份：</span>
              <div className="picker-pills-scroll">
                {[
                  { id: 'all', label: '全部' },
                  { id: '2026', label: '2026' },
                  { id: '2025', label: '2025' },
                  { id: '2024', label: '2024' },
                  { id: '2023', label: '2023' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`picker-pill${year === item.id ? ' active' : ''}`}
                    onClick={() => {
                      setYear(item.id)
                      setDisplayLimit(30)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filters */}
            <div className="picker-filter-group">
              <span className="picker-filter-label">類別：</span>
              <div className="picker-pills-scroll">
                {[
                  { id: 'all', label: '全部' },
                  { id: 'music', label: '🎵 音樂演唱' },
                  { id: 'sport', label: '⚾ 職棒運動' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`picker-pill${category === item.id ? ' active' : ''}`}
                    onClick={() => {
                      setCategory(item.id)
                      setDisplayLimit(30)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* City Filters */}
            <div className="picker-filter-group">
              <span className="picker-filter-label">城市：</span>
              <div className="picker-pills-scroll">
                {['all', '台北', '新北', '桃園', '台中', '台南', '高雄', '宜蘭'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`picker-pill${city === c ? ' active' : ''}`}
                    onClick={() => {
                      setCity(c)
                      setDisplayLimit(30)
                    }}
                  >
                    {c === 'all' ? '全部城市' : c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Body */}
        <div className="historical-picker-body" ref={listRef}>
          {loading && events.length === 0 ? (
            <div className="picker-loading-state">
              <div className="picker-spinner" />
              <p>正在自歷史資料庫查詢活動...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="picker-empty-state">
              <span className="empty-icon">🔍</span>
              <h3>找不到符合條件的活動</h3>
              <p>嘗試更換關鍵字或重設年份與城市篩選條件</p>
              {(query || year !== 'all' || category !== 'all' || city !== 'all') && (
                <button
                  type="button"
                  className="picker-reset-btn"
                  onClick={() => {
                    setQuery('')
                    setYear('all')
                    setCategory('all')
                    setCity('all')
                  }}
                >
                  重設所有篩選
                </button>
              )}
            </div>
          ) : (
            <div className="historical-cards-grid">
              {events.map((ev) => {
                const isSport = ev.category === 'sport' || ev.source === '中華職棒'
                return (
                  <div
                    key={ev.id}
                    className="historical-card"
                    onClick={() => handleSelect(ev)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelect(ev)
                      }
                    }}
                  >
                    {/* Event Thumbnail */}
                    <div className="historical-card-thumb">
                      {ev.image ? (
                        <LazyImage
                          src={ev.image}
                          alt={ev.name}
                          className="historical-card-img"
                        />
                      ) : (
                        <div className="historical-card-img-placeholder">
                          {isSport ? (
                            <BaseballIcon size={32} />
                          ) : (
                            <TicketIcon size={32} />
                          )}
                        </div>
                      )}
                      <span className={`historical-category-badge ${isSport ? 'sport' : 'music'}`}>
                        {isSport ? '賽事' : '演唱會'}
                      </span>
                    </div>

                    {/* Event Content */}
                    <div className="historical-card-content">
                      <h4 className="historical-card-title" title={ev.name}>
                        {ev.name}
                      </h4>

                      {ev.artist && (
                        <div className="historical-card-artist">
                          🎤 <span>{ev.artist}</span>
                        </div>
                      )}

                      <div className="historical-card-meta">
                        <div className="meta-item date">
                          <CalendarIcon size={14} />
                          <span>{ev.date}</span>
                        </div>

                        {(ev.venue_name || ev.city) && (
                          <div className="meta-item venue">
                            <PinIcon size={14} />
                            <span>
                              {ev.city ? `${ev.city} · ` : ''}
                              {ev.venue_name || '待定場館'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Select Action */}
                      <div className="historical-card-action">
                        {ev.source && (
                          <span className="historical-card-source">{ev.source}</span>
                        )}
                        <button
                          type="button"
                          className="historical-card-select-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelect(ev)
                          }}
                        >
                          <CheckIcon size={14} />
                          <span>選取帶入</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Load More Button */}
          {events.length < totalMatches && (
            <div className="picker-load-more-row">
              <button
                type="button"
                className="picker-load-more-btn"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? '載入中...' : `載入更多活動 (目前顯示 ${events.length} / ${totalMatches})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
