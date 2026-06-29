import { useState, useMemo } from 'react'
import type { Concert, RemoteConcert } from '../types'
import {
  CloseIcon,
  SearchIcon,
  ClipboardIcon,
  TicketIcon,
  StarIcon,
  PinIcon,
  TrashIcon,
  CalendarIcon,
  DollarIcon
} from './SvgIcon'

interface CalendarViewProps {
  concerts: Concert[]
  remoteConcerts: RemoteConcert[]
  onAddEventClick: (date: string) => void
  onOpenConcertDetail: (id: string) => void
  onOpenTicketDetail: (ticket: RemoteConcert) => void
  onDeleteConcert: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void
}

export function CalendarView({
  concerts,
  remoteConcerts,
  onAddEventClick,
  onOpenConcertDetail,
  onOpenTicketDetail,
  onDeleteConcert,
}: CalendarViewProps) {
  // Current view month/year
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed

  // Selected date (defaults to today in YYYY-MM-DD)
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  // View mode: 'grid' (Month grid) or 'list' (Chronological list) - defaults to 'list' on mobile
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'list' : 'grid'
  })
  // Event filter: 'all' | 'ticket' | 'record'
  const [eventFilter, setEventFilter] = useState<'all' | 'ticket' | 'record'>('all')
  // Search query
  const [searchQuery, setSearchQuery] = useState('')
  // Mobile details drawer open state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  // 1. Navigate months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleGoToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDateStr(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
  }

  // Parse the day number from the selectedDateStr
  const selectedDayNum = useMemo(() => {
    const parts = selectedDateStr.split('-')
    return parts.length === 3 ? parseInt(parts[2], 10) : 1
  }, [selectedDateStr])

  // Get the array of days in the currently viewed month
  const daysInMonthArray = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: totalDays }, (_, i) => i + 1)
  }, [year, month])

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10)
    const maxDays = new Date(year, newMonth + 1, 0).getDate()
    const clampedDay = Math.min(selectedDayNum, maxDays)
    
    // Update viewed month
    setCurrentDate(new Date(year, newMonth, 1))
    // Update selected date string
    const dateStr = `${year}-${String(newMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
    setSelectedDateStr(dateStr)
    // Open mobile details drawer
    setIsMobileDrawerOpen(true)
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDay = parseInt(e.target.value, 10)
    // Update selected date string
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`
    setSelectedDateStr(dateStr)
    // Open mobile details drawer
    setIsMobileDrawerOpen(true)
  }

  // 2. Normalize date string from events (convert YYYY/MM/DD or other to YYYY-MM-DD)
  const normalizeDate = (dStr: string | undefined): string => {
    if (!dStr) return ''
    const clean = dStr.trim().replace(/\//g, '-')
    const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) {
      const y = match[1]
      const m = match[2].padStart(2, '0')
      const d = match[3].padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    return clean.substring(0, 10)
  }

  // 3. Filtered Events
  const filteredPersonalEvents = useMemo(() => {
    return concerts.filter(c => {
      const matchSearch = searchQuery.trim() === '' ||
        c.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.concertName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.venueCity.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchSearch && (eventFilter === 'all' || eventFilter === 'record')
    })
  }, [concerts, searchQuery, eventFilter])

  const filteredRemoteEvents = useMemo(() => {
    return remoteConcerts.filter(c => {
      const matchSearch = searchQuery.trim() === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.venue_name && c.venue_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.venue_raw && c.venue_raw.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.source.toLowerCase().includes(searchQuery.toLowerCase())

      return matchSearch && (eventFilter === 'all' || eventFilter === 'ticket')
    })
  }, [remoteConcerts, searchQuery, eventFilter])

  // Combine events grouped by date for fast lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, { personal: Concert[]; remote: RemoteConcert[] }> = {}

    filteredPersonalEvents.forEach(c => {
      const dateKey = normalizeDate(c.date)
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = { personal: [], remote: [] }
        map[dateKey].personal.push(c)
      }
    })

    filteredRemoteEvents.forEach(c => {
      const dateKey = normalizeDate(c.date)
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = { personal: [], remote: [] }
        map[dateKey].remote.push(c)
      }
    })

    return map
  }, [filteredPersonalEvents, filteredRemoteEvents])

  // 4. Calendar grid math
  const gridDays = useMemo(() => {
    // First day of current month
    const firstDayInstance = new Date(year, month, 1)
    const startDayOfWeek = firstDayInstance.getDay() // 0 (Sun) - 6 (Sat)
    
    // Total days in current month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    
    // Total days in previous month
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate()

    const days: Array<{
      dayNum: number
      isCurrentMonth: boolean
      dateStr: string
    }> = []

    // Fills previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = totalDaysInPrevMonth - i
      const prevDate = new Date(year, month - 1, prevDay)
      days.push({
        dayNum: prevDay,
        isCurrentMonth: false,
        dateStr: `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`,
      })
    }

    // Fills current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      })
    }

    // Fills next month padding to make it a perfect grid of 6 rows (42 days)
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i)
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateStr: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`,
      })
    }

    return days
  }, [year, month])

  // 5. Selected date details
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || { personal: [], remote: [] }
  }, [eventsByDate, selectedDateStr])

  // 6. Chronological list of all events (for list view)
  const allChronologicalEvents = useMemo(() => {
    const list: Array<{
      type: 'personal' | 'remote'
      id: string
      date: string
      title: string
      subtitle: string
      venue: string
      city: string
      rawObject: any
    }> = []

    concerts.forEach(c => {
      list.push({
        type: 'personal',
        id: c.id,
        date: normalizeDate(c.date),
        title: c.artist,
        subtitle: c.concertName,
        venue: c.venueName,
        city: c.venueCity,
        rawObject: c
      })
    })

    remoteConcerts.forEach(c => {
      list.push({
        type: 'remote',
        id: c.id,
        date: normalizeDate(c.date),
        title: c.name,
        subtitle: c.source ? `售票來源：${c.source}` : '',
        venue: c.venue_name || c.venue_raw || '地點待確認',
        city: c.city,
        rawObject: c
      })
    })

    // Sort by date ascending
    return list
      .filter(item => {
        // Filter by currently active month (year & month)
        const targetPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
        if (!item.date.startsWith(targetPrefix)) return false

        // Apply search query
        const query = searchQuery.trim().toLowerCase()
        if (query !== '') {
          const match = item.title.toLowerCase().includes(query) ||
            item.subtitle.toLowerCase().includes(query) ||
            item.venue.toLowerCase().includes(query) ||
            item.city.toLowerCase().includes(query)
          if (!match) return false
        }
        // Apply filter
        if (eventFilter === 'record' && item.type !== 'personal') return false
        if (eventFilter === 'ticket' && item.type !== 'remote') return false
        return true
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [concerts, remoteConcerts, searchQuery, eventFilter, year, month])

  return (
    <div className="calendar-view-container">
      {/* Calendar Header with Navigation and Filters */}
      <div className="calendar-header-panel">
        <div className="calendar-title-nav">
          <div className="month-selector-buttons">
            <button className="cal-nav-btn" onClick={handlePrevMonth} title="上個月">
              &lt;
            </button>
            <div className="current-month-selects">
              <span className="cal-year-label">{year} 年</span>
              <select 
                value={month} 
                onChange={handleMonthChange} 
                className="cal-select cal-select-month"
                title="選擇月份"
              >
                {Array.from({ length: 12 }, (_, i) => i).map(m => (
                  <option key={m} value={m}>{m + 1} 月</option>
                ))}
              </select>
              <select 
                value={selectedDayNum} 
                onChange={handleDayChange} 
                className="cal-select cal-select-day"
                title="選擇日期"
              >
                {daysInMonthArray.map(d => (
                  <option key={d} value={d}>{d} 日</option>
                ))}
              </select>
            </div>
            <button className="cal-nav-btn" onClick={handleNextMonth} title="下個月">
              &gt;
            </button>
            <button className="cal-today-btn" onClick={handleGoToday}>
              今天
            </button>
          </div>

          <div className="view-mode-tabs">
            <button
              className={`view-mode-tab ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <CalendarIcon style={{ marginRight: '6px' }} /> 月曆視圖
            </button>
            <button
              className={`view-mode-tab ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <ClipboardIcon style={{ marginRight: '6px' }} /> 清單視圖
            </button>
          </div>
        </div>

        <div className="calendar-filters-row">
          <div className="calendar-search-box">
            <span className="icon"><SearchIcon /></span>
            <input
              type="text"
              placeholder="搜尋行事曆中的活動、歌手、場館..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <CloseIcon />
              </button>
            )}
          </div>

          <div className="event-filter-buttons">
            <button
              className={`filter-btn ${eventFilter === 'all' ? 'active' : ''}`}
              onClick={() => setEventFilter('all')}
            >
              全活動
            </button>
            <button
              className={`filter-btn filter-ticket ${eventFilter === 'ticket' ? 'active' : ''}`}
              onClick={() => setEventFilter('ticket')}
            >
              <TicketIcon style={{ marginRight: '6px' }} /> 售票活動
            </button>
            <button
              className={`filter-btn filter-record ${eventFilter === 'record' ? 'active' : ''}`}
              onClick={() => setEventFilter('record')}
            >
              <StarIcon style={{ marginRight: '6px' }} /> 我的記錄
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="calendar-grid-layout">
          {/* Weekday Headers */}
          <div className="calendar-week-headers">
            {['週日', '週一', '週二', '週三', '週四', '週五', '週六'].map((day) => (
              <div key={day} className="week-header-cell">
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="calendar-cells-grid">
            {gridDays.map((cell) => {
              const dateEvents = eventsByDate[cell.dateStr] || { personal: [], remote: [] }
              const hasPersonal = dateEvents.personal.length > 0
              const hasRemote = dateEvents.remote.length > 0
              const isSelected = selectedDateStr === cell.dateStr
              
              // Determine if it's today
              const today = new Date()
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              const isToday = cell.dateStr === todayStr

              return (
                <div
                  key={cell.dateStr}
                  className={`calendar-day-cell ${cell.isCurrentMonth ? 'current-month' : 'adjacent-month'} ${
                    isSelected ? 'selected' : ''
                  } ${isToday ? 'today' : ''}`}
                  onClick={() => {
                    setSelectedDateStr(cell.dateStr)
                    setIsMobileDrawerOpen(true)
                  }}
                >
                  <div className="day-cell-header">
                    <span className="day-number">{cell.dayNum}</span>
                    <button
                      className="quick-add-event-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDateStr(cell.dateStr)
                        onAddEventClick(cell.dateStr)
                      }}
                      title="在此日期新增活動"
                    >
                      ＋
                    </button>
                  </div>

                  {/* Indicator Dots for Events */}
                  <div className="day-cell-dots-container">
                    {hasPersonal && <span className="dot dot-personal" />}
                    {hasRemote && <span className="dot dot-remote" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="calendar-list-view">
          {allChronologicalEvents.length === 0 ? (
            <div className="calendar-list-empty">
              沒有符合過濾或搜尋條件的活動。
            </div>
          ) : (
            <div className="calendar-list-timeline">
              {allChronologicalEvents.map((event) => {
                const isPast = new Date(event.date) < new Date(new Date().setHours(0,0,0,0))
                return (
                  <div
                    key={`${event.type}-${event.id}`}
                    className={`timeline-card ${event.type} ${isPast ? 'past' : ''}`}
                    onClick={() => {
                      if (event.type === 'personal') {
                        onOpenConcertDetail(event.id)
                      } else {
                        onOpenTicketDetail(event.rawObject)
                      }
                    }}
                  >
                    <div className="card-date-badge">
                      <span className="date-text">{event.date}</span>
                      <span className="status-badge">{isPast ? '已結束' : '即將到來'}</span>
                    </div>

                    <div className="card-main-content">
                      <div className="card-type-icon">
                        {event.type === 'personal' ? (
                          <StarIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
                        ) : (
                          <TicketIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
                        )}
                      </div>
                      <div className="card-details">
                        <h3 className="card-title">{event.title}</h3>
                        {event.subtitle && <p className="card-subtitle">{event.subtitle}</p>}
                        <div className="card-location">
                          <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {event.city} · {event.venue}
                        </div>
                      </div>
                    </div>

                    <div className="card-action-arrow">
                      <span>查看詳情</span>
                      {event.type === 'personal' && (
                        <button
                          className="delete-card-btn"
                          onClick={(e) => onDeleteConcert(event.id, e)}
                          title="刪除此記錄"
                        >
                          <TrashIcon size="1em" style={{ verticalAlign: 'middle' }} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Day Info Drawer Backdrop */}
      {viewMode === 'grid' && isMobileDrawerOpen && (
        <div 
          className="calendar-drawer-backdrop" 
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Selected Day Info Drawer (Shown always below the calendar in grid mode) */}
      {viewMode === 'grid' && (
        <div className={`selected-day-details-drawer ${isMobileDrawerOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <h3>
              <CalendarIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {selectedDateStr} 活動清單
            </h3>
            <div className="drawer-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <button
                className="drawer-add-event-btn"
                onClick={() => onAddEventClick(selectedDateStr)}
              >
                ＋ 新增此日活動
              </button>
              <button
                className="drawer-close-btn"
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                title="關閉"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="drawer-events-list">
            {selectedDateEvents.personal.length === 0 && selectedDateEvents.remote.length === 0 ? (
              <div className="drawer-empty-state">
                此日期目前沒有登錄任何活動。點擊「新增此日活動」來規劃你的行程吧！
              </div>
            ) : (
              <div className="drawer-cards-grid">
                {selectedDateEvents.personal.map((event) => (
                  <div
                    key={`drawer-personal-${event.id}`}
                    className="drawer-event-card personal"
                    onClick={() => onOpenConcertDetail(event.id)}
                  >
                    <div className="card-badge">
                      <StarIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      我的自訂記錄
                    </div>
                    <h4 className="event-title">{event.artist}</h4>
                    {event.concertName && <p className="event-name">{event.concertName}</p>}
                    <p className="event-venue">
                      <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {event.venueCity} · {event.venueName}
                    </p>
                    {event.seat && (
                      <p className="event-seat">
                        <TicketIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        位置：{event.seat}
                      </p>
                    )}
                    
                    <div className="card-footer">
                      <span className="card-more-action">查看心得筆記 &gt;</span>
                      <button
                        className="delete-card-btn"
                        onClick={(e) => onDeleteConcert(event.id, e)}
                        title="刪除此記錄"
                      >
                        <TrashIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 刪除
                      </button>
                    </div>
                  </div>
                ))}

                {selectedDateEvents.remote.map((event) => (
                  <div
                    key={`drawer-remote-${event.id}`}
                    className="drawer-event-card remote"
                    onClick={() => onOpenTicketDetail(event)}
                  >
                    <div className="card-badge">
                      <TicketIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      公開售票活動 ({event.source})
                    </div>
                    <h4 className="event-title">{event.name}</h4>
                    <p className="event-venue">
                      <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {event.city} · {event.venue_name || event.venue_raw || '地點待確認'}
                    </p>
                    {event.price && (
                      <p className="event-price">
                        <DollarIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        票價：{event.price}
                      </p>
                    )}
                    
                    <div className="card-footer">
                      <span className="card-more-action">查看售票詳情 &gt;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
