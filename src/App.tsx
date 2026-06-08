import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import './App.css'

type Venue = {
  id: string
  name: string
  city: string
  capacity: string
  x: number
  y: number
}

type ConcertMedia = {
  name: string
  dataUrl: string
  type: string
}

type Concert = {
  id: string
  venueId: string
  venueName: string
  venueCity: string
  artist: string
  concertName: string
  date: string
  seat: string
  notes: string
  spotifyUrl?: string
  media: ConcertMedia[]
  createdAt: string
}

type TicketLink = {
  platform: string
  name: string
  url: string
}

type RemoteConcert = {
  id: string
  source: string
  name: string
  venue_raw: string
  venue_id: string | null
  venue_name: string | null
  city: string
  date: string
  image: string
  url: string
  price: string
  ticket_links: TicketLink[]
}

type RemoteConcertPayload = {
  updated_at?: string
  count?: number
  sources?: string[]
  events?: RemoteConcert[]
}

type ConcertForm = {
  artist: string
  concertName: string
  date: string
  seat: string
  notes: string
  spotifyUrl: string
}

type SpotifyItem = {
  type: 'artist' | 'album' | 'track'
  id: string
  name: string
  sub: string
  img?: string
  url: string
}

const VENUES: Venue[] = [
  { id: 'taipei-dome', name: '台北大巨蛋', city: '台北', capacity: '40,000', x: 248, y: 178 },
  { id: 'taipei-arena', name: '台北小巨蛋', city: '台北', capacity: '10,000', x: 262, y: 168 },
  { id: 'nangang', name: '南港展覽館', city: '台北', capacity: '30,000', x: 272, y: 185 },
  { id: 'taoyuan-arena', name: '桃園國際棒球場', city: '桃園', capacity: '25,000', x: 218, y: 215 },
  { id: 'hsinchu', name: '新竹棒球場', city: '新竹', capacity: '12,000', x: 210, y: 245 },
  { id: 'taichung-dome', name: '台中洲際棒球場', city: '台中', capacity: '25,000', x: 205, y: 305 },
  { id: 'taichung-venue', name: '台中國家歌劇院', city: '台中', capacity: '2,000', x: 218, y: 315 },
  { id: 'changhua', name: '彰化縣立體育場', city: '彰化', capacity: '20,000', x: 198, y: 335 },
  { id: 'tainan', name: '台南市立棒球場', city: '台南', capacity: '12,000', x: 195, y: 400 },
  { id: 'kaohsiung-dome', name: '高雄巨蛋', city: '高雄', capacity: '15,000', x: 192, y: 438 },
  { id: 'kaohsiung-natl', name: '高雄國家體育場（世運主場館）', city: '高雄', capacity: '55,000', x: 205, y: 450 },
  { id: 'kaohsiung-music-center', name: '高雄流行音樂中心', city: '高雄', capacity: '6,000', x: 185, y: 455 },
  { id: 'hualien', name: '花蓮縣立體育場', city: '花蓮', capacity: '8,000', x: 310, y: 295 },
  { id: 'taitung', name: '台東棒球場', city: '台東', capacity: '8,000', x: 298, y: 398 },
]

const STORAGE_KEY = 'tw-concerts'
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
  const selectedVenueRemoteConcerts = useMemo(
    () =>
      remoteConcerts
        .filter((concert) => concert.venue_id === selectedVenueId)
        .sort((a, b) => Date.parse(a.date || '9999') - Date.parse(b.date || '9999')),
    [remoteConcerts, selectedVenueId],
  )
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
  const visibleRemoteConcerts = remoteConcerts.filter((concert) => concert.venue_id)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(concerts))
    } catch {
      alert('儲存空間不足，請清理一些照片再試。')
    }
  }, [concerts])

  useEffect(() => {
    let isMounted = true

    fetch(`${import.meta.env.BASE_URL}concerts.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('concerts.json not found')
        return response.json() as Promise<RemoteConcertPayload>
      })
      .then((data) => {
        if (!isMounted) return
        const events = Array.isArray(data.events) ? data.events : []
        setRemoteConcerts(events)
        setRemoteUpdatedAt(data.updated_at ?? null)
        setRemoteStatus(events.length ? '' : '目前沒有抓到近期售票活動')
      })
      .catch(() => {
        if (!isMounted) return
        setRemoteConcerts([])
        setRemoteUpdatedAt(null)
        setRemoteStatus('近期售票活動暫時讀取失敗')
      })

    return () => {
      isMounted = false
    }
  }, [])

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
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => setIsAddModalOpen(false)
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

  return (
    <>
      <header>
        <div className="logo">
          <div className="logo-icon">🎵</div>
          <div className="logo-text">
            <h1>台灣演唱會地圖</h1>
            <span>TAIWAN CONCERT LOG</span>
          </div>
        </div>
        <div className="stats-bar">
          <Stat number={concerts.length} label="演唱會" />
          <Stat number={visitedVenueCount} label="場館" />
          <Stat number={visibleRemoteConcerts.length} label="售票" />
          <Stat number={totalMedia} label="照片/影片" />
        </div>
      </header>

      <main className="main-layout">
        <section className="map-container" aria-label="台灣場館地圖">
          <div className="map-bg" />
          <TaiwanMap
            concerts={concerts}
            selectedVenueId={selectedVenueId}
            onSelectVenue={setSelectedVenueId}
          />

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
            venue={selectedVenue}
            concertCount={selectedVenueConcerts.length}
            onAddConcert={openAddModal}
          />
          <div className="concert-list-area">
            <UpcomingConcerts
              concerts={selectedVenueRemoteConcerts}
              hasSelectedVenue={Boolean(selectedVenue)}
              status={remoteStatus}
              updatedAt={remoteUpdatedAt}
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
            <label htmlFor="input-notes">心得筆記</label>
            <textarea
              id="input-notes"
              value={form.notes}
              placeholder="記下難忘的時刻..."
              onChange={(event) => updateForm('notes', event.target.value)}
            />
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
  hasSelectedVenue,
  status,
  updatedAt,
}: {
  concerts: RemoteConcert[]
  hasSelectedVenue: boolean
  status: string
  updatedAt: string | null
}) {
  if (!hasSelectedVenue) return null

  return (
    <section className="upcoming-section" aria-label="近期售票活動">
      <div className="section-title">— 近期售票活動 —</div>
      {updatedAt && <div className="remote-updated">更新：{formatRemoteDate(updatedAt)}</div>}
      {status && <div className="empty-state compact">{status}</div>}
      {!status && concerts.length === 0 && (
        <div className="empty-state compact">這個場館目前沒有近期售票資料</div>
      )}
      {concerts.slice(0, 4).map((concert) => (
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
              {concert.venue_raw || concert.venue_name || '場館待確認'}
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
    </section>
  )
}

function Stat({ number, label }: { number: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-num">{number}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function TaiwanMap({
  concerts,
  selectedVenueId,
  onSelectVenue,
}: {
  concerts: Concert[]
  selectedVenueId: string | null
  onSelectVenue: (venueId: string) => void
}) {
  return (
    <svg id="taiwan-map" viewBox="0 0 500 700" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1a3e" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="250" cy="350" rx="200" ry="280" fill="url(#mapGlow)" />
      <path
        d="M 225,95 L 232,88 L 248,82 L 262,78 L 278,76 L 292,78 L 305,84 L 315,92 L 322,104 L 325,118 L 323,134 L 318,150 L 310,165 L 320,178 L 330,195 L 335,215 L 334,235 L 328,255 L 318,272 L 310,290 L 305,310 L 302,332 L 298,355 L 292,378 L 282,400 L 270,420 L 256,438 L 240,452 L 225,462 L 212,468 L 198,472 L 185,472 L 172,468 L 162,460 L 155,448 L 152,434 L 154,420 L 160,405 L 168,390 L 172,374 L 170,358 L 164,344 L 156,330 L 150,316 L 148,302 L 150,288 L 156,274 L 162,260 L 165,244 L 162,228 L 156,212 L 152,196 L 154,178 L 162,160 L 172,143 L 182,128 L 194,114 L 206,103 L 216,97 L 225,95 Z"
        fill="#1e2040"
        stroke="#2a2a60"
        strokeWidth="1.5"
        opacity="0.9"
      />
      <path
        d="M 220,200 Q 240,190 260,205 Q 275,220 265,240 Q 250,255 235,248 Q 218,238 215,220 Q 212,207 220,200 Z"
        fill="none"
        stroke="#2a2a55"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <path
        d="M 218,195 Q 245,182 268,200 Q 285,218 272,244 Q 256,262 236,254 Q 212,243 208,222 Q 205,204 218,195 Z"
        fill="none"
        stroke="#2a2a55"
        strokeWidth="0.6"
        opacity="0.3"
      />
      <path
        d="M 230,150 L 250,110 L 268,145 L 280,125 L 295,160 L 285,185 L 265,200 L 245,205 L 228,190 Z"
        fill="#1a1a35"
        stroke="#252545"
        strokeWidth="1"
        opacity="0.6"
      />
      <circle cx="120" cy="330" r="12" fill="#1e2040" stroke="#2a2a60" strokeWidth="1" />
      <circle cx="108" cy="320" r="7" fill="#1e2040" stroke="#2a2a60" strokeWidth="1" />
      <circle cx="128" cy="315" r="5" fill="#1e2040" stroke="#2a2a60" strokeWidth="1" />
      <text x="110" y="348" fill="#4a4a70" fontSize="9" textAnchor="middle">
        澎湖
      </text>
      <circle cx="355" cy="450" r="8" fill="#1e2040" stroke="#2a2a60" strokeWidth="1" />
      <rect x="58" y="280" width="25" height="15" rx="4" fill="#1e2040" stroke="#2a2a60" strokeWidth="1" />
      <text x="70" y="306" fill="#4a4a70" fontSize="9" textAnchor="middle">
        金門
      </text>

      <g>
        {VENUES.map((venue) => {
          const hasVisits = concerts.some((concert) => concert.venueId === venue.id)
          const isActive = selectedVenueId === venue.id

          return (
            <g
              key={venue.id}
              className={`venue-dot${hasVisits ? ' visited' : ''}${isActive ? ' active' : ''}`}
              transform={`translate(${venue.x},${venue.y})`}
              onClick={() => onSelectVenue(venue.id)}
            >
              <circle className="pulse-ring" r="8" cx="0" cy="0" />
              <circle className="bg" r="16" cx="0" cy="0" />
              <circle className="core" r="6" cx="0" cy="0" />
              <text className="venue-label" x="12" y="4">
                {venue.name}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="legend-item">
      <div className="legend-dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}

function VenueInfo({
  venue,
  concertCount,
  onAddConcert,
}: {
  venue: Venue | null
  concertCount: number
  onAddConcert: () => void
}) {
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
    <div className="venue-info">
      <div className="venue-city">{venue.city}</div>
      <div className="venue-header">
        <div className="venue-name">{venue.name}</div>
        <div className={`venue-count${concertCount > 0 ? ' has-visits' : ''}`}>
          {concertCount > 0 ? `✓ ${concertCount} 場` : '未造訪'}
        </div>
      </div>
      <div className="venue-capacity">容量：{venue.capacity} 人</div>
      <button className="add-concert-btn" type="button" onClick={onAddConcert}>
        ＋ 新增演唱會記錄
      </button>
    </div>
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

function ConcertDetail({
  concert,
  onOpenLightbox,
}: {
  concert: Concert
  onOpenLightbox: (mediaIndex: number) => void
}) {
  return (
    <>
      <div className="concert-detail-header">
        <div className="detail-artist">{concert.artist}</div>
        <div className="detail-meta">
          {concert.date && <span className="detail-tag tag-date">📅 {concert.date}</span>}
          <span className="detail-tag tag-venue">📍 {concert.venueName}</span>
          {concert.seat && <span className="detail-tag tag-seat">🎫 {concert.seat}</span>}
        </div>
        {concert.concertName && <div className="detail-concert-name">{concert.concertName}</div>}
      </div>
      {concert.spotifyUrl && <SpotifyEmbed url={concert.spotifyUrl} />}
      {concert.notes && <div className="detail-notes">{concert.notes}</div>}
      {concert.media.length > 0 && (
        <>
          <div className="section-title">— 照片 / 影片 —</div>
          <div className="media-gallery">
            {concert.media.map((item, index) => (
              <button
                className="gallery-item"
                type="button"
                key={`${item.name}-${index}`}
                onClick={() => onOpenLightbox(index)}
              >
                {item.type.startsWith('image') ? (
                  <img src={item.dataUrl} alt={item.name} />
                ) : (
                  <>
                    <video src={item.dataUrl} />
                    <div className="video-overlay">▶</div>
                  </>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </>
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

function SpotifyEmbed({ url }: { url: string }) {
  const embedUrl = parseSpotifyEmbedUrl(url)
  if (!embedUrl) return null

  const height = url.includes('/track/') || url.includes('/episode/') ? 152 : 352

  return (
    <>
      <div className="detail-spotify">
        <iframe
          src={embedUrl}
          height={height}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify detail player"
        />
      </div>
      <a className="spotify-open-btn" href={url} target="_blank" rel="noopener noreferrer">
        <span>在 Spotify 開啟</span> ↗
      </a>
    </>
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

function parseSpotifyEmbedUrl(url: string | null | undefined) {
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

export default App
