import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import { marked } from 'marked'
import './App.css'

import type {
  Concert,
  ConcertMedia,
  RemoteConcert,
  RemoteConcertPayload,
  ConcertForm,
  SpotifyItem
} from './types'

import { VENUES } from './constants/venues'
import { TaiwanMap, Stat, LegendItem } from './components/TaiwanMap'
import { VenueInfo } from './components/VenueInfo'
import { VenueWeather } from './components/VenueWeather'
import { ConcertDetail } from './components/ConcertDetail'
import { ShareBoard } from './components/ShareBoard'
import { LoginPage } from './components/LoginPage'
import { collection, addDoc } from 'firebase/firestore'
import { db } from './firebase'

const STORAGE_KEY = 'tw-concerts'
const REMOTE_CONCERT_REFRESH_MS = 60_000
const EMPTY_FORM: ConcertForm = {
  artist: '',
  concertName: '',
  date: '',
  seat: '',
  notes: '',
  spotifyUrl: '',
}

const SPOTIFY_CLIENT_ID = 'cf537ab8a23b4365876e09a0071554df'
const SPOTIFY_CLIENT_SECRET = '5a30e4bec5994805b5d82573a105e814'
const SPOTIFY_TYPE_LABELS: Record<SpotifyItem['type'], string> = {
  artist: '歌手',
  album: '專輯',
  track: '歌曲',
}

let spotifyToken: string | null = null
let spotifyTokenExpiry = 0

function loadConcerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Concert[]
  } catch {
    return []
  }
}

function App() {
  const [concerts, setConcerts] = useState<Concert[]>(loadConcerts)
  const [remoteConcerts, setRemoteConcerts] = useState<RemoteConcert[]>([])
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<string | null>(null)
  const [remoteStatus, setRemoteStatus] = useState('正在讀取近期售票活動...')
  const [isRemoteRefreshing, setIsRemoteRefreshing] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAllModalOpen, setIsAllModalOpen] = useState(false)
  const [detailConcertId, setDetailConcertId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ concertId: string; mediaIndex: number } | null>(null)
  const [form, setForm] = useState<ConcertForm>(EMPTY_FORM)
  const [pendingMedia, setPendingMedia] = useState<ConcertMedia[]>([])
  const [spotifyQuery, setSpotifyQuery] = useState('')
  const [spotifyResults, setSpotifyResults] = useState<SpotifyItem[]>([])
  const [spotifyTab, setSpotifyTab] = useState<SpotifyItem['type']>('artist')
  const [spotifyStatus, setSpotifyStatus] = useState('')
  const [selectedSpotify, setSelectedSpotify] = useState<SpotifyItem | null>(null)
  const [isSpotifySearching, setIsSpotifySearching] = useState(false)
  const [isMusicBarVisible, setIsMusicBarVisible] = useState(false)
  const [musicBarUrl, setMusicBarUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.75)
  const [notesActiveTab, setNotesActiveTab] = useState<'edit' | 'preview'>('edit')
  const [view, setView] = useState<'map' | 'board' | 'login'>('map')
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [publishingConcert, setPublishingConcert] = useState<Concert | null>(null)
  const [nickname, setNickname] = useState(() => localStorage.getItem('tw-nickname') || '')
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('tw-logged-in') === 'true')
  const [currentUser, setCurrentUser] = useState<{ nickname: string; email?: string } | null>(() => {
    const stored = localStorage.getItem('tw-user-info')
    return stored ? JSON.parse(stored) : null
  })

  const selectedVenue = useMemo(
    () => VENUES.find((venue) => venue.id === selectedVenueId) ?? null,
    [selectedVenueId],
  )
  const selectedVenueConcerts = useMemo(
    () =>
      concerts
        .filter((concert) => concert.venueId === selectedVenueId)
        .sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0')),
    [concerts, selectedVenueId],
  )
  const sortedRemoteConcerts = useMemo(
    () => [...remoteConcerts].sort((a, b) => Date.parse(a.date || '9999') - Date.parse(b.date || '9999')),
    [remoteConcerts],
  )
  const filteredRemoteConcerts = useMemo(() => {
    if (!selectedVenueId) return sortedRemoteConcerts
    return sortedRemoteConcerts.filter((concert) => {
      if (concert.venue_id === selectedVenueId) return true
      if (selectedVenue) {
        const nameMatch = concert.venue_name && concert.venue_name.toLowerCase().includes(selectedVenue.name.toLowerCase())
        const rawMatch = concert.venue_raw && concert.venue_raw.toLowerCase().includes(selectedVenue.name.toLowerCase())
        return nameMatch || rawMatch
      }
      return false
    })
  }, [sortedRemoteConcerts, selectedVenueId, selectedVenue])
  const notesPreviewHtml = useMemo(() => {
    if (!form.notes) return '<p style="color: var(--muted); font-style: italic; font-size: 0.85rem; padding: 1rem 0;">（輸入心得後可在此預覽 Markdown 效果）</p>'
    try {
      return marked.parse(form.notes) as string
    } catch {
      return form.notes
    }
  }, [form.notes])
  const sortedConcerts = useMemo(
    () => [...concerts].sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0')),
    [concerts],
  )
  const detailConcert = concerts.find((concert) => concert.id === detailConcertId) ?? null
  const lightboxConcert = lightbox ? concerts.find((concert) => concert.id === lightbox.concertId) : null
  const lightboxMedia = lightbox && lightboxConcert ? lightboxConcert.media[lightbox.mediaIndex] : null
  const visitedVenueCount = new Set(concerts.map((concert) => concert.venueId)).size
  const totalMedia = concerts.reduce((sum, concert) => sum + concert.media.length, 0)
  const musicBarEmbedUrl = parseSpotifyEmbedUrl(musicBarUrl)

  const loadRemoteConcerts = useCallback(async () => {
    setIsRemoteRefreshing(true)

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}concerts.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('concerts.json not found')

      const data = (await response.json()) as RemoteConcertPayload
      const events = Array.isArray(data.events) ? data.events : []
      setRemoteConcerts(events)
      setRemoteUpdatedAt(data.updated_at ?? null)
      setRemoteStatus(events.length ? '' : '目前沒有抓到近期售票活動')
    } catch {
      setRemoteConcerts([])
      setRemoteUpdatedAt(null)
      setRemoteStatus('近期售票活動暫時讀取失敗')
    } finally {
      setIsRemoteRefreshing(false)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(concerts))
    } catch {
      alert('儲存空間不足，請清理一些照片再試。')
    }
  }, [concerts])

  useEffect(() => {
    loadRemoteConcerts()
    const timer = window.setInterval(loadRemoteConcerts, REMOTE_CONCERT_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [loadRemoteConcerts])

  useEffect(() => {
    document.body.classList.toggle('player-open', isMusicBarVisible)

    return () => {
      document.body.classList.remove('player-open')
    }
  }, [isMusicBarVisible])

  const openAddModal = () => {
    if (!selectedVenue) return
    setForm(EMPTY_FORM)
    setPendingMedia([])
    setSpotifyQuery('')
    setSpotifyResults([])
    setSpotifyStatus('')
    setSelectedSpotify(null)
    setSpotifyTab('artist')
    setNotesActiveTab('edit')
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => {
    setNotesActiveTab('edit')
    setIsAddModalOpen(false)
  }
  const closeDetailModal = () => setDetailConcertId(null)
  const closeAllModal = () => setIsAllModalOpen(false)

  const updateForm = (field: keyof ConcertForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleMediaUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        setPendingMedia((current) => [
          ...current,
          { name: file.name, dataUrl: reader.result as string, type: file.type },
        ])
      }
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  const saveConcert = () => {
    if (!selectedVenue) return
    const artist = form.artist.trim()

    if (!artist) {
      alert('請輸入演出者名稱')
      return
    }

    const concert: Concert = {
      id: Date.now().toString(),
      venueId: selectedVenue.id,
      venueName: selectedVenue.name,
      venueCity: selectedVenue.city,
      artist,
      concertName: form.concertName.trim(),
      date: form.date,
      seat: form.seat.trim(),
      notes: form.notes.trim(),
      spotifyUrl: form.spotifyUrl.trim(),
      media: pendingMedia,
      createdAt: new Date().toISOString(),
    }

    setConcerts((current) => [...current, concert])
    setIsAddModalOpen(false)
  }

  const deleteConcert = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!confirm('確定要刪除這筆記錄嗎？')) return
    setConcerts((current) => current.filter((concert) => concert.id !== id))
  }

  const handlePublishToBoard = async (authorName: string) => {
    if (!publishingConcert) return
    const author = authorName.trim() || '匿名樂迷'
    localStorage.setItem('tw-nickname', author)
    setNickname(author)

    try {
      await addDoc(collection(db, 'reviews'), {
        artist: publishingConcert.artist,
        concertName: publishingConcert.concertName || '未命名演唱會',
        venueName: publishingConcert.venueName || '未指定場館',
        venueCity: publishingConcert.venueCity || '其他',
        date: publishingConcert.date || '',
        author: author,
        notes: publishingConcert.notes,
        likes: 0,
        createdAt: new Date().toISOString(),
      })

      setIsPublishModalOpen(false)
      setPublishingConcert(null)
      setTimeout(() => {
        alert('🎉 發佈成功！已將您的觀後感分享至社群牆。')
        setView('board')
        setDetailConcertId(null)
      }, 100)
    } catch (error) {
      console.error('Firebase write error:', error)
      alert('❌ 發佈失敗，請檢查網路連線或 Firebase 設定！')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('tw-logged-in')
    localStorage.removeItem('tw-user-info')
    setIsLoggedIn(false)
    setCurrentUser(null)
    setView('map')
    alert('👋 您已成功登出！')
  }

  const removePendingMedia = (index: number) => {
    setPendingMedia((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const searchSpotify = async (queryOverride?: string) => {
    const query = (queryOverride ?? spotifyQuery).trim()
    if (!query) return

    setIsSpotifySearching(true)
    setSpotifyStatus(`搜尋中 ${query}...`)

    try {
      const token = await getSpotifyToken()
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query,
      )}&type=artist,album,track&limit=5&market=TW`
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Spotify search failed')
      const data = await response.json()
      const results = normalizeSpotifyResults(data)

      setSpotifyResults(results)
      setSpotifyStatus(results.length === 0 ? `找不到「${query}」的結果` : '')
    } catch {
      setSpotifyResults([])
      setSpotifyStatus('搜尋失敗，請稍後再試')
    } finally {
      setIsSpotifySearching(false)
    }
  }

  const selectSpotifyItem = (item: SpotifyItem) => {
    setSelectedSpotify(item)
    setForm((current) => ({ ...current, spotifyUrl: item.url }))
    setSpotifyResults([])
  }

  const clearSpotifySelection = () => {
    setSelectedSpotify(null)
    setForm((current) => ({ ...current, spotifyUrl: '' }))
    setSpotifyQuery('')
    setSpotifyResults([])
    setSpotifyStatus('')
  }

  const openConcertDetail = (concertId: string) => {
    const concert = concerts.find((item) => item.id === concertId)
    setDetailConcertId(concertId)

    if (concert?.spotifyUrl && parseSpotifyEmbedUrl(concert.spotifyUrl)) {
      setMusicBarUrl(concert.spotifyUrl)
      setIsMusicBarVisible(true)
    }
  }

  const handleHeaderClick = () => {
    setView('map')
    setSelectedVenueId(null) // Return to home (deselect venue)

    // Scroll window/document
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
    try {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      document.documentElement.scrollTop = 0
    }
    try {
      document.body.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      document.body.scrollTop = 0
    }

    // Scroll sidebar
    const sidebarScroll = document.querySelector('.concert-list-area')
    if (sidebarScroll) {
      try {
        sidebarScroll.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        sidebarScroll.scrollTop = 0
      }
    }
  }

  return (
    <>
      <header>
        <div className="logo" onClick={handleHeaderClick}>
          <div className="logo-icon">🎵</div>
          <div className="logo-text">
            <h1>台灣演唱會地圖</h1>
            <span>TAIWAN CONCERT LOG</span>
          </div>
        </div>
        <div className="header-right">
          <div className="stats-bar">
            <Stat number={concerts.length} label="演唱會" />
            <Stat number={visitedVenueCount} label="場館" />
            <Stat number={remoteConcerts.length} label="售票" />
            <Stat number={totalMedia} label="照片/影片" />
          </div>
          <button
            className="nav-toggle-btn"
            type="button"
            onClick={() => setView(view === 'map' ? 'board' : 'map')}
          >
            {view === 'map' ? '💬 社群分享牆' : '🗺️ 返回場館地圖'}
          </button>
          {isLoggedIn && currentUser ? (
            <div className="user-profile-menu" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="user-name" style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 700 }}>
                👤 {currentUser.nickname}
              </span>
              <button className="nav-toggle-btn logout-btn" type="button" onClick={handleLogout} style={{ border: '1px solid rgba(230, 57, 70, 0.4)', color: 'var(--accent)' }}>
                登出
              </button>
            </div>
          ) : (
            <button
              className="nav-toggle-btn login-trigger-btn"
              type="button"
              onClick={() => setView('login')}
            >
              🔑 登入
            </button>
          )}
        </div>
      </header>

      {view === 'map' ? (
        <main className="main-layout">
          <section className="map-container" aria-label="台灣場館地圖">
            <div className="map-bg" onClick={() => setSelectedVenueId(null)} />

            <div className="venue-chips-container">
              <div className="venue-chips">
                {VENUES.map((v) => {
                  const isActive = selectedVenueId === v.id
                  const hasVisits = concerts.some((c) => c.venueId === v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`venue-chip${isActive ? ' active' : ''}${hasVisits ? ' visited' : ''}`}
                      onClick={() => setSelectedVenueId(v.id)}
                    >
                      <span className="dot" />
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <TaiwanMap
              concerts={concerts}
              selectedVenueId={selectedVenueId}
              onSelectVenue={setSelectedVenueId}
              onClearVenue={() => setSelectedVenueId(null)}
              zoom={zoom}
              onZoomChange={setZoom}
            />

            {selectedVenue && (
              <div className="map-weather-overlay">
                <VenueWeather
                  latitude={selectedVenue.latitude}
                  longitude={selectedVenue.longitude}
                  cityName={selectedVenue.city}
                  onClose={() => setSelectedVenueId(null)}
                />
              </div>
            )}

            <div className="map-zoom-control">
              <span className="zoom-icon">🔍</span>
              <input
                type="range"
                min="0.7"
                max="2.5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                title="地圖縮放"
              />
              <span className="zoom-value">{Math.round(zoom * 100)}%</span>
              <button className="zoom-reset-btn" type="button" onClick={() => setZoom(0.75)} title="重設縮放">
                ⟲
              </button>
            </div>

            <div className="map-legend">
              <LegendItem color="var(--accent)" label="尚未造訪" />
              <LegendItem color="var(--teal)" label="已去過" />
              <LegendItem color="var(--gold)" label="選取中" />
            </div>

            <button className="all-concerts-btn" type="button" onClick={() => setIsAllModalOpen(true)}>
              📋 全部記錄
            </button>
          </section>

          <aside className="sidebar">
            <VenueInfo
              key={selectedVenue?.id ?? 'empty'}
              venue={selectedVenue}
              concertCount={selectedVenueConcerts.length}
              onAddConcert={openAddModal}
              onClearVenue={() => setSelectedVenueId(null)}
            />
            <div className="concert-list-area">
              <TransitStatusBoard />
              <UpcomingConcerts
                concerts={filteredRemoteConcerts}
                status={remoteStatus}
                updatedAt={remoteUpdatedAt}
                isRefreshing={isRemoteRefreshing}
                onRefresh={loadRemoteConcerts}
              />
              <ConcertList
                concerts={selectedVenueConcerts}
                hasSelectedVenue={Boolean(selectedVenue)}
                onOpenDetail={openConcertDetail}
                onDelete={deleteConcert}
              />
            </div>
          </aside>
        </main>
      ) : view === 'board' ? (
        <ShareBoard />
      ) : (
        <LoginPage
          onLoginSuccess={(user) => {
            setIsLoggedIn(true)
            setCurrentUser(user)
            localStorage.setItem('tw-logged-in', 'true')
            localStorage.setItem('tw-user-info', JSON.stringify(user))
            localStorage.setItem('tw-nickname', user.nickname)
            setNickname(user.nickname)
            setView('map')
            alert(`🎉 歡迎回來，${user.nickname}！`)
          }}
          onCancel={() => setView('map')}
        />
      )}

      {isAddModalOpen && selectedVenue && (
        <Modal onClose={closeAddModal}>
          <h2>新增演唱會記錄</h2>
          <div className="modal-venue-name">
            {selectedVenue.name} · {selectedVenue.city}
          </div>

          <div className="form-group">
            <label htmlFor="input-artist">演出者 / 團體</label>
            <input
              id="input-artist"
              type="text"
              value={form.artist}
              placeholder="e.g. 周杰倫、五月天..."
              onChange={(event) => updateForm('artist', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-concert-name">演唱會名稱</label>
            <input
              id="input-concert-name"
              type="text"
              value={form.concertName}
              placeholder="e.g. 魔天倫世界巡迴演唱會"
              onChange={(event) => updateForm('concertName', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-date">日期</label>
            <input
              id="input-date"
              type="date"
              value={form.date}
              onChange={(event) => updateForm('date', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-seat">座位 / 區域</label>
            <input
              id="input-seat"
              type="text"
              value={form.seat}
              placeholder="e.g. 搖滾區 A3 排"
              onChange={(event) => updateForm('seat', event.target.value)}
            />
          </div>
          <div className="form-group">
            <div className="notes-label-row">
              <label htmlFor="input-notes">心得筆記 (支援 Markdown)</label>
              <div className="notes-tabs">
                <button
                  type="button"
                  className={`notes-tab-btn${notesActiveTab === 'edit' ? ' active' : ''}`}
                  onClick={() => setNotesActiveTab('edit')}
                >
                  編輯
                </button>
                <button
                  type="button"
                  className={`notes-tab-btn${notesActiveTab === 'preview' ? ' active' : ''}`}
                  onClick={() => setNotesActiveTab('preview')}
                >
                  預覽
                </button>
              </div>
            </div>
            {notesActiveTab === 'edit' ? (
              <textarea
                id="input-notes"
                value={form.notes}
                placeholder="記下難忘的時刻... (支援 Markdown 語法如 # 標題, **粗體**, - 清單)"
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            ) : (
              <div
                className="notes-preview-box markdown-body"
                dangerouslySetInnerHTML={{ __html: notesPreviewHtml }}
              />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="input-spotify-query">Spotify 音樂連結</label>
            <div className="spotify-search-box">
              <div className="spotify-search-row">
                <input
                  id="input-spotify-query"
                  type="text"
                  value={spotifyQuery}
                  placeholder="搜尋歌手、專輯或歌曲..."
                  onChange={(event) => setSpotifyQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      searchSpotify()
                    }
                  }}
                />
                <button
                  className="sp-search-btn"
                  type="button"
                  disabled={isSpotifySearching}
                  onClick={() => searchSpotify()}
                >
                  搜尋
                </button>
              </div>
              <input
                id="input-spotify"
                type="hidden"
                value={form.spotifyUrl}
                onChange={(event) => updateForm('spotifyUrl', event.target.value)}
              />
              <div className="spotify-hint">
                搜尋後選擇一個 Spotify 項目，之後點擊演唱會卡片即可載入播放器。
              </div>
              {selectedSpotify && (
                <div className="spotify-selected-preview">
                  {selectedSpotify.img && (
                    <img
                      className={`sp-selected-img${selectedSpotify.type === 'artist' ? ' round' : ''}`}
                      src={selectedSpotify.img}
                      alt=""
                    />
                  )}
                  <div className="sp-selected-info">
                    <div className="sp-selected-name">{selectedSpotify.name}</div>
                    <div className="sp-selected-sub">
                      已選擇 · {SPOTIFY_TYPE_LABELS[selectedSpotify.type]}
                    </div>
                  </div>
                  <button className="sp-selected-clear" type="button" onClick={clearSpotifySelection}>
                    ✕
                  </button>
                </div>
              )}
              {(spotifyStatus || spotifyResults.length > 0) && (
                <SpotifyResults
                  results={spotifyResults}
                  status={spotifyStatus}
                  activeTab={spotifyTab}
                  onChangeTab={setSpotifyTab}
                  onSelect={selectSpotifyItem}
                />
              )}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="input-media">照片 / 影片</label>
            <div className="media-upload-area">
              <div className="upload-icon">📷</div>
              <div className="upload-text">點擊或拖曳上傳</div>
              <div className="upload-sub">支援 JPG, PNG, MP4, MOV</div>
              <input
                id="input-media"
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleMediaUpload}
              />
            </div>
            <MediaPreviewGrid media={pendingMedia} onRemove={removePendingMedia} />
          </div>

          <button className="modal-submit" type="button" onClick={saveConcert}>
            儲存記錄 ✓
          </button>
        </Modal>
      )}

      {detailConcert && (
        <Modal className="detail-modal" onClose={closeDetailModal}>
          <ConcertDetail
            concert={detailConcert}
            onOpenLightbox={(mediaIndex) => setLightbox({ concertId: detailConcert.id, mediaIndex })}
            onPublishToBoard={() => {
              setPublishingConcert(detailConcert)
              setIsPublishModalOpen(true)
              setDetailConcertId(null) // Close detail modal immediately
            }}
          />
        </Modal>
      )}

      {isAllModalOpen && (
        <Modal className="all-modal" onClose={closeAllModal}>
          <h2 className="all-modal-title">所有演唱會記錄</h2>
          <div className="all-modal-kicker">ALL CONCERT LOGS</div>
          {sortedConcerts.length === 0 ? (
            <div className="empty-state">還沒有任何記錄，點擊地圖上的場館開始新增！</div>
          ) : (
            sortedConcerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={concert}
                showVenue
                onOpenDetail={openConcertDetail}
              />
            ))
          )}
        </Modal>
      )}

      {lightboxMedia && (
        <div className="lightbox active" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" type="button" onClick={() => setLightbox(null)}>
            ×
          </button>
          {lightboxMedia.type.startsWith('image') ? (
            <img src={lightboxMedia.dataUrl} alt={lightboxMedia.name} />
          ) : (
            <video src={lightboxMedia.dataUrl} controls autoPlay />
          )}
        </div>
      )}

      {isPublishModalOpen && publishingConcert && (
        <Modal className="publish-modal" onClose={() => {
          setIsPublishModalOpen(false)
          setDetailConcertId(publishingConcert.id) // Restore detail modal
          setPublishingConcert(null)
        }}>
          <h2>📢 分享觀後感至社群牆</h2>
          <p className="publish-prompt">
            您即將把關於 <strong>{publishingConcert.artist} - {publishingConcert.concertName || '未命名演唱會'}</strong> 的觀後心得發佈至公開分享牆！
          </p>
          <div className="form-group">
            <label htmlFor="input-nickname">請輸入您的暱稱 (將公開顯示)</label>
            <input
              id="input-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. 搖滾區小精靈 (留空則以「匿名樂迷」發佈)"
              maxLength={20}
              autoFocus
            />
          </div>
          <div className="publish-actions">
            <button
              className="publish-submit-btn"
              type="button"
              onClick={() => handlePublishToBoard(nickname)}
            >
              確認發佈 🚀
            </button>
            <button
              className="publish-cancel-btn"
              type="button"
              onClick={() => {
                setIsPublishModalOpen(false)
                setDetailConcertId(publishingConcert.id) // Restore detail modal
                setPublishingConcert(null)
              }}
            >
              取消
            </button>
          </div>
        </Modal>
      )}

      <button
        className="music-bar-toggle"
        type="button"
        onClick={() => setIsMusicBarVisible((visible) => !visible)}
      >
        <div className="spotify-icon" />
        <span>{isMusicBarVisible ? '收起播放器' : '音樂播放器'}</span>
      </button>

      <div className={`music-bar${isMusicBarVisible ? ' visible' : ''}`}>
        <div className="music-bar-content">
          {musicBarEmbedUrl ? (
            <iframe
              src={musicBarEmbedUrl}
              height="90"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Spotify player"
            />
          ) : (
            <div className="music-bar-placeholder">
              <span className="sp-logo">🎵</span>
              <span>在演唱會記錄中加入 Spotify 連結，點擊卡片即可在此播放</span>
            </div>
          )}
        </div>
        <button className="music-bar-close" type="button" onClick={() => setIsMusicBarVisible(false)}>
          ✕
        </button>
      </div>
    </>
  )
}

function UpcomingConcerts({
  concerts,
  status,
  updatedAt,
  isRefreshing,
  onRefresh,
}: {
  concerts: RemoteConcert[]
  status: string
  updatedAt: string | null
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const displayedConcerts = isExpanded ? concerts : concerts.slice(0, 8)

  return (
    <section className="upcoming-section" aria-label="售票資訊">
      <div className="section-row">
        <div>
          <div className="section-title">— 售票資訊 —</div>
          {updatedAt && <div className="remote-updated">更新：{formatRemoteDate(updatedAt)}</div>}
        </div>
        <button className="refresh-events-btn" type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? '更新中' : '更新'}
        </button>
      </div>
      {status && <div className="empty-state compact">{status}</div>}
      {!status && concerts.length === 0 && (
        <div className="empty-state compact">目前沒有近期售票資料</div>
      )}
      {displayedConcerts.map((concert) => (
        <a
          className="remote-card"
          href={concert.url}
          target="_blank"
          rel="noopener noreferrer"
          key={concert.id}
        >
          {concert.image ? <img src={concert.image} alt="" /> : <div className="remote-card-fallback">LIVE</div>}
          <div className="remote-card-body">
            <div className="remote-card-top">
              <span>{concert.source || '售票資訊'}</span>
              <span>{concert.date || '日期未定'}</span>
            </div>
            <div className="remote-card-name">{concert.name}</div>
            <div className="remote-card-meta">
              {concert.venue_raw || concert.venue_name || concert.city || '地點待確認'}
              {concert.price ? ` · ${concert.price}` : ''}
            </div>
            {concert.ticket_links?.length > 0 && (
              <div className="ticket-links">
                {concert.ticket_links.slice(0, 3).map((link) => (
                  <span key={`${concert.id}-${link.platform}`}>{link.name}</span>
                ))}
              </div>
            )}
          </div>
        </a>
      ))}
      {concerts.length > 8 && (
        <button
          className="show-more-btn"
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '收起售票資訊 ▴' : `顯示所有售票資訊 (還有 ${concerts.length - 8} 筆) ▾`}
        </button>
      )}
    </section>
  )
}



function ConcertList({
  concerts,
  hasSelectedVenue,
  onOpenDetail,
  onDelete,
}: {
  concerts: Concert[]
  hasSelectedVenue: boolean
  onOpenDetail: (concertId: string) => void
  onDelete: (concertId: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  if (!hasSelectedVenue) {
    return <div className="empty-state">選擇場館後顯示演唱會記錄</div>
  }

  if (concerts.length === 0) {
    return <div className="empty-state">這個場館還沒有記錄，快去新增吧！</div>
  }

  return (
    <>
      <div className="section-title">— 演唱會記錄 —</div>
      {concerts.map((concert) => (
        <ConcertCard
          key={concert.id}
          concert={concert}
          onOpenDetail={onOpenDetail}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

function ConcertCard({
  concert,
  showVenue = false,
  onOpenDetail,
  onDelete,
}: {
  concert: Concert
  showVenue?: boolean
  onOpenDetail: (concertId: string) => void
  onDelete?: (concertId: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="concert-card" onClick={() => onOpenDetail(concert.id)}>
      {onDelete && (
        <button
          className="delete-btn"
          type="button"
          title="刪除"
          onClick={(event) => onDelete(concert.id, event)}
        >
          ✕
        </button>
      )}
      <div className="concert-card-header">
        <div className="concert-artist">{concert.artist}</div>
        <div className="concert-date">{concert.date || '日期未知'}</div>
      </div>
      {showVenue && (
        <div className="concert-venue-tag">
          📍 {concert.venueName} · {concert.venueCity}
        </div>
      )}
      {concert.concertName && <div className="concert-venue-tag">{concert.concertName}</div>}
      {concert.seat && <div className="concert-venue-tag seat-tag">座位：{concert.seat}</div>}
      <MediaStrip media={concert.media} />
    </div>
  )
}

function MediaStrip({ media }: { media: ConcertMedia[] }) {
  if (!media.length) return null

  const visibleMedia = media.slice(0, 3)
  const extra = media.length - visibleMedia.length

  return (
    <div className="concert-media-preview">
      {visibleMedia.map((item, index) =>
        item.type.startsWith('image') ? (
          <img className="media-thumb" key={`${item.name}-${index}`} src={item.dataUrl} alt="" />
        ) : (
          <div className="media-thumb-video" key={`${item.name}-${index}`}>
            ▶
          </div>
        ),
      )}
      {extra > 0 && <div className="more-media">+{extra}</div>}
    </div>
  )
}

function MediaPreviewGrid({
  media,
  onRemove,
}: {
  media: ConcertMedia[]
  onRemove: (index: number) => void
}) {
  if (!media.length) return null

  return (
    <div className="preview-grid">
      {media.map((item, index) => (
        <div className="preview-item" key={`${item.name}-${index}`}>
          {item.type.startsWith('image') ? (
            <img src={item.dataUrl} alt={item.name} />
          ) : (
            <>
              <video src={item.dataUrl} />
              <div className="video-preview-overlay">▶</div>
            </>
          )}
          <button className="remove-media" type="button" onClick={() => onRemove(index)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}



function SpotifyResults({
  results,
  status,
  activeTab,
  onChangeTab,
  onSelect,
}: {
  results: SpotifyItem[]
  status: string
  activeTab: SpotifyItem['type']
  onChangeTab: (tab: SpotifyItem['type']) => void
  onSelect: (item: SpotifyItem) => void
}) {
  const counts = {
    artist: results.filter((item) => item.type === 'artist').length,
    album: results.filter((item) => item.type === 'album').length,
    track: results.filter((item) => item.type === 'track').length,
  }
  const visibleResults = results.filter((item) => item.type === activeTab)

  return (
    <div className="spotify-results">
      {results.length > 0 && (
        <div className="sp-tabs">
          {(['artist', 'album', 'track'] as const).map((type) => (
            <button
              key={type}
              className={`sp-tab${activeTab === type ? ' active' : ''}`}
              type="button"
              onClick={() => onChangeTab(type)}
            >
              {SPOTIFY_TYPE_LABELS[type]} ({counts[type]})
            </button>
          ))}
        </div>
      )}

      {status && <div className="sp-search-status">{status}</div>}

      {results.length > 0 &&
        (visibleResults.length > 0 ? (
          visibleResults.map((item) => (
            <button
              className="sp-result-item"
              type="button"
              key={`${item.type}-${item.id}`}
              onClick={() => onSelect(item)}
            >
              {item.img ? (
                <img
                  className={`sp-result-img${item.type === 'artist' ? ' round' : ''}`}
                  src={item.img}
                  alt=""
                />
              ) : (
                <div className={`sp-result-img${item.type === 'artist' ? ' round' : ''}`} />
              )}
              <div className="sp-result-info">
                <div className="sp-result-name">{item.name}</div>
                <div className="sp-result-sub">{item.sub}</div>
              </div>
              <span className={`sp-result-type sp-type-${item.type}`}>
                {SPOTIFY_TYPE_LABELS[item.type]}
              </span>
            </button>
          ))
        ) : (
          <div className="sp-search-status">此分類無結果</div>
        ))}
    </div>
  )
}



function Modal({
  children,
  className = '',
  onClose,
}: {
  children: ReactNode
  className?: string
  onClose: () => void
}) {
  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) throw new Error('Unable to get Spotify token')

  const data = await response.json()
  spotifyToken = data.access_token
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return spotifyToken
}

function normalizeSpotifyResults(data: any): SpotifyItem[] {
  const artists = data.artists?.items ?? []
  const albums = data.albums?.items ?? []
  const tracks = data.tracks?.items ?? []

  return [
    ...artists.map((artist: any) => ({
      type: 'artist' as const,
      id: artist.id,
      name: artist.name,
      sub: artist.genres?.slice(0, 2).join('、') || '音樂人',
      img: artist.images?.[1]?.url || artist.images?.[0]?.url,
      url: artist.external_urls?.spotify,
    })),
    ...albums.map((album: any) => ({
      type: 'album' as const,
      id: album.id,
      name: album.name,
      sub: `${album.artists?.map((artist: any) => artist.name).join('、') || '未知藝人'} · ${(
        album.release_date || ''
      ).slice(0, 4)}`,
      img: album.images?.[1]?.url || album.images?.[0]?.url,
      url: album.external_urls?.spotify,
    })),
    ...tracks.map((track: any) => ({
      type: 'track' as const,
      id: track.id,
      name: track.name,
      sub: `${track.artists?.map((artist: any) => artist.name).join('、') || '未知藝人'} · ${
        track.album?.name || ''
      }`,
      img: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url,
      url: track.external_urls?.spotify,
    })),
  ].filter((item) => item.url)
}

export function parseSpotifyEmbedUrl(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsedUrl = new URL(url)
    if (!parsedUrl.hostname.includes('spotify.com')) return null
    return `https://open.spotify.com/embed${parsedUrl.pathname}?utm_source=generator&theme=0`
  } catch {
    return null
  }
}

function formatRemoteDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

type TransitService = {
  id: string
  name: string
  url: string
  statusUrl: string
  icon: string
  searchPatterns: string[]
}

const TRANSIT_SERVICES: TransitService[] = [
  {
    id: 'trtc',
    name: '台北捷運',
    url: 'https://www.metro.taipei/',
    statusUrl: 'https://www.metro.taipei/',
    icon: '🚇',
    searchPatterns: ['全線正常營運', '正常營運', '營運正常'],
  },
  {
    id: 'krtc',
    name: '高雄捷運',
    url: 'https://www.krtc.com.tw/',
    statusUrl: 'https://www.krtc.com.tw/',
    icon: '🚇',
    searchPatterns: ['營運正常', '正常營運', '今日全線正常營運'],
  },
  {
    id: 'tmrt',
    name: '台中捷運',
    url: 'https://www.tmrt.com.tw/',
    statusUrl: 'https://www.tmrt.com.tw/',
    icon: '🚇',
    searchPatterns: ['全線正常營運', '正常營運', '營運正常'],
  },
  {
    id: 'thsr',
    name: '台灣高鐵',
    url: 'https://www.thsrc.com.tw/',
    statusUrl: 'https://www.thsrc.com.tw/',
    icon: '🚄',
    searchPatterns: ['全線正常營運', '正常營運', '營運正常'],
  },
  {
    id: 'tra',
    name: '台灣鐵路',
    url: 'https://www.railway.gov.tw/',
    statusUrl: 'https://tip.railway.gov.tw/tra-tip-web/tip/tip007/tip711/blockList',
    icon: '🚂',
    searchPatterns: ['正常', '營運正常', '正常營運', '各線列車正常營運'],
  },
]

type TransitStatusData = {
  name: string
  status: string
  isNormal: boolean
  detail: string
  updatedAt: string
}

type TransitPayload = {
  updated_at: string
  statuses: Record<string, TransitStatusData>
}

function TransitStatusBoard() {
  const [selectedId, setSelectedId] = useState('trtc')
  const [statuses, setStatuses] = useState<Record<string, TransitStatusData>>({})
  const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}transit-status.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('transit-status.json not found')
      const data = (await response.json()) as TransitPayload
      if (data && data.statuses) {
        setStatuses(data.statuses)
      }
    } catch (e) {
      console.error('Failed to fetch transit status:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchStatus, 300_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const service = TRANSIT_SERVICES.find((s) => s.id === selectedId) || TRANSIT_SERVICES[0]
  const current = statuses[selectedId] || {
    name: service.name,
    status: '🟢 營運正常 (預估)',
    isNormal: true,
    detail: '無法連接即時伺服器取得資訊，請點擊下方按鈕前往官方網站查看最新營運通阻。',
    updatedAt: '',
  }

  const formatStatusTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <section className="transit-board" aria-label="大眾運輸即時動態">
      <div className="section-row" style={{ marginBottom: '0.6rem' }}>
        <div className="section-title" style={{ padding: '0.2rem 0.5rem 0' }}>— 交通即時動態 —</div>
        <button
          className="refresh-events-btn"
          type="button"
          disabled={loading}
          onClick={fetchStatus}
        >
          {loading ? '讀取中' : '重新整理 ↻'}
        </button>
      </div>

      <div className="transit-selector-row">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="transit-select"
        >
          {TRANSIT_SERVICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="transit-card">
        <div className="transit-card-header">
          <div className="transit-service-name">
            <span className="transit-icon">{service.icon}</span>
            <span>{service.name}</span>
          </div>
          <div className={`transit-badge${current.isNormal ? ' normal' : ' warning'}${loading ? ' loading' : ''}`}>
            {current.status}
          </div>
        </div>
        <p className="transit-detail">{current.detail}</p>
        {current.updatedAt && (
          <div className="transit-updated">
            最後更新：{formatStatusTime(current.updatedAt)}
          </div>
        )}
        <a
          href={service.statusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="transit-link-btn"
        >
          🧭 前往官方網站查看即時動態 ↗
        </a>
      </div>
    </section>
  )
}

export default App
