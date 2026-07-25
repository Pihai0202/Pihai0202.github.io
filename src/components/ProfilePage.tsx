import { useState, useMemo, useEffect, useRef } from 'react'
import type { Concert } from '../types'
import { useTranslation } from '../utils/i18n.tsx'
import { db } from '../firebase'
import {
  ArrowLeftIcon,
  LogoutIcon,
  EditIcon,
  MailIcon,
  MicIcon,
  PinIcon,
  FlameIcon,
  BuildingIcon,
  ActivityIcon,
  MegaphoneIcon,
  HeartFilledIcon,
  MusicIcon,
  GuitarIcon,
  PianoIcon,
  HeadphonesIcon,
  DrumIcon,
  DancerIcon,
  DiscoIcon,
  SparklesIcon,
  RockIcon,
  TicketIcon,
  CameraIcon,
  TrashIcon,
  SearchIcon,
  LinkIcon
} from './SvgIcon'

const EMOJI_TO_AVATAR_KEY: Record<string, string> = {
  '🎵': 'music',
  '🎤': 'mic',
  '🎸': 'guitar',
  '🎹': 'piano',
  '🎧': 'headphones',
  '🥁': 'drum',
  '💃': 'dancer',
  '🕺': 'disco',
  '✨': 'sparkles',
  '🔥': 'fire',
  '🤘': 'rock',
  '🎟️': 'ticket',
  '🎫': 'ticket',
}

const PRESET_AVATAR_MAP: Record<string, React.ComponentType<{ size?: string | number }>> = {
  music: MusicIcon,
  mic: MicIcon,
  guitar: GuitarIcon,
  piano: PianoIcon,
  headphones: HeadphonesIcon,
  drum: DrumIcon,
  dancer: DancerIcon,
  disco: DiscoIcon,
  sparkles: SparklesIcon,
  fire: FlameIcon,
  rock: RockIcon,
  ticket: TicketIcon,
}

const PRESET_AVATAR_KEYS = [
  'music',
  'mic',
  'guitar',
  'piano',
  'headphones',
  'drum',
  'dancer',
  'disco',
  'sparkles',
  'fire',
  'rock',
  'ticket',
]
import { collection, query, where, getDocs } from 'firebase/firestore'
import type { SpotifyItem } from '../types'
import { parseSpotifyEmbedUrl, getSpotifyToken, normalizeSpotifyResults } from '../App'
import { SafeIframe } from './SafeIframe'

interface ProfilePageProps {
  user: { nickname: string; email?: string; avatarUrl?: string; spotifyUrl?: string }
  concerts: Concert[]
  onUpdateNickname: (newNickname: string) => void
  onUpdateAvatar: (newAvatar: string) => void
  onUpdateSpotifyUrl?: (newSpotifyUrl: string) => void
  onPlaySpotifyTrack?: (url: string) => void
  onLogout: () => void
  onBack: () => void
  onOpenConcertDetail: (id: string) => void
}

interface UserReview {
  id: string
  artist: string
  concertName: string
  venueName: string
  date: string
  likes: number
  createdAt: string
}

export function ProfilePage({
  user,
  concerts,
  onUpdateNickname,
  onUpdateAvatar,
  onUpdateSpotifyUrl,
  onPlaySpotifyTrack,
  onLogout,
  onBack,
  onOpenConcertDetail
}: ProfilePageProps) {
  const { t, lang } = useTranslation()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNickname, setEditNickname] = useState(user.nickname)
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false)
  const [spotifyInputUrl, setSpotifyInputUrl] = useState(user.spotifyUrl || '')
  
  // Spotify Search & Tabs State
  const [spotifyModalTab, setSpotifyModalTab] = useState<'search' | 'paste'>('search')
  const [spotifySearchQuery, setSpotifySearchQuery] = useState('')
  const [spotifySearchResults, setSpotifySearchResults] = useState<SpotifyItem[]>([])
  const [isSpotifySearching, setIsSpotifySearching] = useState(false)
  const [spotifySearchStatus, setSpotifySearchStatus] = useState('')

  const handleDoSpotifySearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? spotifySearchQuery).trim()
    if (!q) return
    setIsSpotifySearching(true)
    setSpotifySearchStatus(lang === 'zh-TW' ? `搜尋中「${q}」...` : `Searching "${q}"...`)
    try {
      let token = await getSpotifyToken()
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist,album,track&limit=6&market=TW`
      let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (response.status === 401) {
        token = await getSpotifyToken(true)
        response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const results = normalizeSpotifyResults(data)
      setSpotifySearchResults(results)
      setSpotifySearchStatus(results.length === 0 ? (lang === 'zh-TW' ? `找不到「${q}」的結果` : `No results found for "${q}"`) : '')
    } catch (err: any) {
      console.error('Spotify modal search error:', err)
      setSpotifySearchResults([])
      setSpotifySearchStatus(lang === 'zh-TW' ? '搜尋失敗，請檢查網路或稍後再試' : 'Search failed, please try again')
    } finally {
      setIsSpotifySearching(false)
    }
  }
  const [myReviews, setMyReviews] = useState<UserReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [showRecordsModal, setShowRecordsModal] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = base64Str
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 120
        const MAX_HEIGHT = 120
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        } else {
          resolve(base64Str)
        }
      }
      img.onerror = () => {
        resolve(base64Str)
      }
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      if (base64) {
        const compressed = await compressImage(base64)
        onUpdateAvatar(compressed)
        setIsAvatarModalOpen(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSelectEmoji = (emoji: string) => {
    onUpdateAvatar(emoji)
    setIsAvatarModalOpen(false)
  }

  const handleResetAvatar = () => {
    onUpdateAvatar('')
    setIsAvatarModalOpen(false)
  }

  // 1. Calculate Statistics
  const stats = useMemo(() => {
    const totalCount = concerts.length
    const uniqueVenues = new Set(concerts.map((c) => c.venueId)).size

    // Favorite Artist
    const artistCounts: Record<string, number> = {}
    concerts.forEach((c) => {
      if (c.artist) {
        artistCounts[c.artist] = (artistCounts[c.artist] || 0) + 1
      }
    })
    let favoriteArtist = '無資料'
    let maxArtistCount = 0
    Object.entries(artistCounts).forEach(([name, count]) => {
      if (count > maxArtistCount) {
        maxArtistCount = count
        favoriteArtist = name
      }
    })

    // Most Visited Venue
    const venueCounts: Record<string, { count: number; name: string }> = {}
    concerts.forEach((c) => {
      if (c.venueId && c.venueName) {
        if (!venueCounts[c.venueId]) {
          venueCounts[c.venueId] = { count: 0, name: c.venueName }
        }
        venueCounts[c.venueId].count++
      }
    })
    let favoriteVenue = '無資料'
    let maxVenueCount = 0
    Object.values(venueCounts).forEach(({ count, name }) => {
      if (count > maxVenueCount) {
        maxVenueCount = count
        favoriteVenue = name
      }
    })

    return {
      totalCount,
      uniqueVenues,
      favoriteArtist: favoriteArtist + (maxArtistCount > 1 ? ` (${maxArtistCount}次)` : ''),
      favoriteVenue: favoriteVenue + (maxVenueCount > 1 ? ` (${maxVenueCount}次)` : '')
    }
  }, [concerts])

  // 2. Filter user's local footprints
  const filteredConcerts = useMemo(() => {
    if (!searchQuery.trim()) return concerts
    const q = searchQuery.toLowerCase().trim()
    return concerts.filter(
      (c) =>
        c.artist.toLowerCase().includes(q) ||
        (c.concertName && c.concertName.toLowerCase().includes(q)) ||
        c.venueName.toLowerCase().includes(q) ||
        c.venueCity.toLowerCase().includes(q)
    )
  }, [concerts, searchQuery])

  // 3. Fetch user's reviews from Firestore
  useEffect(() => {
    const fetchMyReviews = async () => {
      if (!user.nickname) return
      setReviewsLoading(true)
      try {
        const q = query(collection(db, 'reviews'), where('author', '==', user.nickname))
        const snapshot = await getDocs(q)
        const list: UserReview[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          list.push({
            id: doc.id,
            artist: data.artist || '',
            concertName: data.concertName || '',
            venueName: data.venueName || '',
            date: data.date || '',
            likes: data.likes || 0,
            createdAt: data.createdAt || ''
          })
        })
        list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        setMyReviews(list)
      } catch (err) {
        console.error('Failed to load my reviews:', err)
      } finally {
        setReviewsLoading(false)
      }
    }
    fetchMyReviews()
  }, [user.nickname])

  const handleUpdateName = () => {
    const trimmed = editNickname.trim()
    if (!trimmed) return
    onUpdateNickname(trimmed)
    setIsEditingName(false)
  }

  // Generate deterministic background style from email/name
  const avatarBg = useMemo(() => {
    const str = user.email || user.nickname
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 60%, 40%)`
  }, [user.email, user.nickname])

  const footprintsSection = (
    <section className="profile-content-section">
      <div className="section-header-row">
        <h3>
          <ActivityIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {lang === 'zh-TW' ? '我的音樂現場足跡' : 'My Live Music Footprint'}
        </h3>
        <input
          type="text"
          placeholder={lang === 'zh-TW' ? '搜尋我的記錄...' : 'Search my logs...'}
          className="profile-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="profile-concert-table-wrapper">
        {filteredConcerts.length === 0 ? (
          <div className="profile-empty-state">
            {searchQuery ? (lang === 'zh-TW' ? '找不到符合的記錄' : 'No matching records found') : (lang === 'zh-TW' ? '還沒有任何記錄，點擊地圖上的場館來新增吧！' : 'No records yet. Click venues on the map to add!')}
          </div>
        ) : (
          <table className="profile-concert-table">
            <thead>
              <tr>
                <th>{lang === 'zh-TW' ? '歌手 / 演出者' : 'Artist'}</th>
                <th>{lang === 'zh-TW' ? '演唱會名稱' : 'Concert Name'}</th>
                <th>{lang === 'zh-TW' ? '日期' : 'Date'}</th>
                <th>{lang === 'zh-TW' ? '場館 / 地點' : 'Venue'}</th>
                <th>{lang === 'zh-TW' ? '操作' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredConcerts.map((c) => (
                <tr key={c.id}>
                  <td className="bold-text">{c.artist}</td>
                  <td>{c.concertName || '—'}</td>
                  <td className="mono-text">{c.date || '—'}</td>
                  <td>{c.venueName} · {c.venueCity}</td>
                  <td>
                    <button
                      type="button"
                      className="profile-table-view-btn"
                      onClick={() => {
                        onOpenConcertDetail(c.id);
                        setShowRecordsModal(false);
                      }}
                    >
                      {lang === 'zh-TW' ? '檢視' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );

  return (
    <div className="profile-board-container">
      {/* 頂部導航 */}
      <div className="profile-header-actions">
        <button className="profile-back-btn" type="button" onClick={onBack}>
          <ArrowLeftIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {t('backBtn')}
        </button>
        <button className="profile-logout-btn" type="button" onClick={onLogout}>
          <LogoutIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {t('logout')}
        </button>
      </div>

      <div className="profile-layout-grid">
        {/* 左側：個人名片與統計資料 */}
        <aside className="profile-sidebar-card">
          <div className="profile-card-header">
            <button 
              type="button"
              className="profile-avatar-large editable" 
              style={{ backgroundColor: avatarBg, padding: 0, border: '3px solid rgba(255, 255, 255, 0.1)' }}
              onClick={() => setIsAvatarModalOpen(true)}
              title={lang === 'zh-TW' ? '點擊更換頭像' : 'Click to change avatar'}
            >
              {user.avatarUrl ? (
                user.avatarUrl.startsWith('data:image') || user.avatarUrl.startsWith('http') ? (
                  <img src={user.avatarUrl} alt="Avatar" className="avatar-img" />
                ) : (
                  <span className="avatar-emoji">
                    {(() => {
                      const key = EMOJI_TO_AVATAR_KEY[user.avatarUrl] || user.avatarUrl
                      const SvgComponent = PRESET_AVATAR_MAP[key]
                      return SvgComponent ? <SvgComponent size="1em" /> : user.avatarUrl
                    })()}
                  </span>
                )
              ) : (
                user.nickname.charAt(0).toUpperCase()
              )}
              <div className="avatar-overlay">
                <span>{lang === 'zh-TW' ? '更換頭像' : 'Change Avatar'}</span>
              </div>
            </button>
            {isEditingName ? (
              <div className="edit-nickname-row">
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  maxLength={15}
                  required
                />
                <button type="button" onClick={handleUpdateName} className="save-name-btn">
                  {lang === 'zh-TW' ? '儲存' : 'Save'}
                </button>
                <button type="button" onClick={() => setIsEditingName(false)} className="cancel-name-btn">
                  {lang === 'zh-TW' ? '取消' : 'Cancel'}
                </button>
              </div>
            ) : (
              <div className="nickname-display-row">
                <h2>{user.nickname}</h2>
                <button type="button" onClick={() => setIsEditingName(true)} className="edit-name-trigger">
                  <EditIcon size="0.9em" style={{ verticalAlign: 'middle' }} />
                </button>
              </div>
            )}
            <p className="profile-email-badge">
              <MailIcon size="0.9em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {user.email || (lang === 'zh-TW' ? '訪客模式' : 'Guest Mode')}
            </p>

            {/* 個人主題曲區塊 / Theme Song Section */}
            <div className="profile-theme-music-box">
              <div className="theme-music-header">
                <span className="theme-music-title">
                  <MusicIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle', color: '#1db954' }} />
                  {lang === 'zh-TW' ? '個人主題曲' : 'Theme Song'}
                </span>
                <button
                  type="button"
                  className="edit-theme-music-btn"
                  onClick={() => {
                    setSpotifyInputUrl(user.spotifyUrl || '')
                    setIsSpotifyModalOpen(true)
                  }}
                  title={lang === 'zh-TW' ? '設定 / 更換主題曲' : 'Set / Edit Theme Song'}
                >
                  <EditIcon size="0.85em" style={{ verticalAlign: 'middle' }} />
                  <span>{user.spotifyUrl ? (lang === 'zh-TW' ? '編輯' : 'Edit') : (lang === 'zh-TW' ? '新增' : 'Add')}</span>
                </button>
              </div>

              {user.spotifyUrl && parseSpotifyEmbedUrl(user.spotifyUrl) ? (
                <div>
                  {/* 快捷播放控制按鈕區 (單一簡潔播放鈕) */}
                  <div className="theme-music-controls-row">
                    {onPlaySpotifyTrack && (
                      <button
                        type="button"
                        className="theme-play-main-btn"
                        onClick={() => onPlaySpotifyTrack(user.spotifyUrl!)}
                      >
                        ▶ {lang === 'zh-TW' ? '播放主題曲' : 'Play Theme Song'}
                      </button>
                    )}
                    <a
                      href={user.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="theme-open-spotify-btn"
                    >
                      ↗ Spotify
                    </a>
                  </div>

                  {/* 內嵌播放器 (僅顯示歌曲縮圖卡片，不含底部靜態進度條) */}
                  <div className="theme-music-player-wrapper">
                    <SafeIframe
                      src={parseSpotifyEmbedUrl(user.spotifyUrl)!}
                      height={80}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      title="Profile Theme Song"
                      scrolling="no"
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="theme-music-placeholder-btn"
                  onClick={() => {
                    setSpotifyInputUrl(user.spotifyUrl || '')
                    setIsSpotifyModalOpen(true)
                  }}
                >
                  <MusicIcon size="1.2em" style={{ color: '#1db954', opacity: 0.8 }} />
                  <span>{lang === 'zh-TW' ? '+ 點擊設定 Spotify 主題曲' : '+ Click to add Spotify theme song'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="profile-stats-card-list">
            <div className="profile-stat-box">
              <span className="stat-icon">
                <MicIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.totalCount}</div>
                <div className="stat-label">{lang === 'zh-TW' ? '演唱會記錄' : 'Concert Logs'}</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <PinIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.uniqueVenues}</div>
                <div className="stat-label">{lang === 'zh-TW' ? '造訪場館' : 'Visited Venues'}</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <FlameIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.favoriteArtist}</div>
                <div className="stat-label">{lang === 'zh-TW' ? '最常看歌手' : 'Top Artist'}</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <BuildingIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.favoriteVenue}</div>
                <div className="stat-label">{lang === 'zh-TW' ? '最常去場館' : 'Top Venue'}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* 右側：詳細記錄與社群分享足跡 */}
        <main className="profile-main-content">
          {/* 手機版：顯示查看足跡按鈕，點擊開啟彈窗 */}
          {isMobile ? (
            <button
              className="view-records-mobile-btn"
              type="button"
              onClick={() => setShowRecordsModal(true)}
            >
              <ActivityIcon size="1.2em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              <span>{lang === 'zh-TW' ? '查看我的音樂現場足跡' : 'View My Live Music Footprints'}</span>
            </button>
          ) : (
            /* 電腦版：直接嵌入足跡列表 */
            footprintsSection
          )}

          {/* 社群分享牆發佈 */}
          <section className="profile-content-section">
            <h3>
              <MegaphoneIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {lang === 'zh-TW' ? '我在社群牆發佈的觀後感' : 'My Community Board Posts'}
            </h3>
            <div className="profile-reviews-wrapper">
              {reviewsLoading ? (
                <div className="profile-empty-state">{lang === 'zh-TW' ? '載入發佈列表中...' : 'Loading community posts...'}</div>
              ) : myReviews.length === 0 ? (
                <div className="profile-empty-state">
                  {lang === 'zh-TW' ? '目前尚未分享任何觀後感到社群牆。' : 'No reviews shared on the community wall yet.'}
                </div>
              ) : (
                <div className="profile-reviews-grid">
                  {myReviews.map((rev) => (
                    <div className="profile-review-card" key={rev.id}>
                      <div className="review-card-header">
                        <h4>{rev.artist}</h4>
                        <span className="review-card-likes">
                          <HeartFilledIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          {rev.likes}
                        </span>
                      </div>
                      <p className="review-card-sub">{rev.concertName}</p>
                      <div className="review-card-footer">
                        <span>
                          <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          {rev.venueName}
                        </span>
                        <span>{rev.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {isAvatarModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsAvatarModalOpen(false)}>
          <div className="modal publish-modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setIsAvatarModalOpen(false)}>
              ✕
            </button>
            <h2 style={{ fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', fontSize: '1.25rem', color: 'var(--gold)', marginBottom: '1rem' }}>
              {lang === 'zh-TW' ? '自訂個人頭像' : 'Customize Avatar'}
            </h2>
            
            <div className="avatar-selection-grid">
              {PRESET_AVATAR_KEYS.map((key) => {
                const SvgComponent = PRESET_AVATAR_MAP[key]
                return (
                  <button
                    key={key}
                    type="button"
                    className="avatar-option-btn"
                    onClick={() => handleSelectEmoji(key)}
                  >
                    {SvgComponent && <SvgComponent size="1em" />}
                  </button>
                )
              })}
            </div>

            <div className="avatar-upload-row">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CameraIcon size="1.1em" />
                {lang === 'zh-TW' ? '上傳自訂照片' : 'Upload Custom Photo'}
              </button>
              {user.avatarUrl && (
                <button
                  type="button"
                  className="avatar-reset-btn"
                  onClick={handleResetAvatar}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <TrashIcon size="1.1em" />
                  {lang === 'zh-TW' ? '清除並恢復預設' : 'Clear & Reset'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 手機版足跡彈窗 */}
      {isMobile && showRecordsModal && (
        <div className="records-modal-overlay" onClick={() => setShowRecordsModal(false)}>
          <div className="records-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="records-modal-header">
              <h4>
                <ActivityIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {lang === 'zh-TW' ? '我的音樂現場足跡' : 'My Live Music Footprint'}
              </h4>
              <button className="close-records-modal-btn" onClick={() => setShowRecordsModal(false)}>
                &times;
              </button>
            </div>
            <div className="records-modal-body">
              {footprintsSection}
            </div>
          </div>
        </div>
      )}

      {/* 個人主題曲編輯彈窗 (支援 查詢歌曲 / 貼上連結 雙模式) */}
      {isSpotifyModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsSpotifyModalOpen(false)}>
          <div className="modal spotify-edit-modal" style={{ maxWidth: '460px', padding: '1.8rem', borderRadius: '20px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setIsSpotifyModalOpen(false)}>
              ✕
            </button>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MusicIcon style={{ color: '#1db954' }} />
              {lang === 'zh-TW' ? '設定個人主題曲' : 'Set Profile Theme Song'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: '1.5' }}>
              {lang === 'zh-TW'
                ? '搜尋或貼上 Spotify 歌曲連結，其他人造訪您的個人頁時就能直接聆聽您的主題音樂！'
                : 'Search or paste a Spotify song link to share your theme music!'}
            </p>

            {/* 分頁開關 (搜尋歌曲 / 貼上連結) */}
            <div className="spotify-modal-tabs">
              <button
                type="button"
                className={`spotify-modal-tab-btn ${spotifyModalTab === 'search' ? 'active' : ''}`}
                onClick={() => setSpotifyModalTab('search')}
              >
                <SearchIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                <span>{lang === 'zh-TW' ? '搜尋歌曲' : 'Search Music'}</span>
              </button>
              <button
                type="button"
                className={`spotify-modal-tab-btn ${spotifyModalTab === 'paste' ? 'active' : ''}`}
                onClick={() => setSpotifyModalTab('paste')}
              >
                <LinkIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                <span>{lang === 'zh-TW' ? '貼上網址' : 'Paste Link'}</span>
              </button>
            </div>

            {spotifyModalTab === 'search' ? (
              <div>
                {/* 對齊的搜尋列 */}
                <div className="spotify-search-form-row">
                  <input
                    type="text"
                    placeholder={lang === 'zh-TW' ? '輸入歌手、歌曲或專輯名稱...' : 'Artist, track, or album...'}
                    value={spotifySearchQuery}
                    onChange={(e) => setSpotifySearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDoSpotifySearch()}
                  />
                  <button
                    type="button"
                    className="spotify-do-search-btn"
                    onClick={() => handleDoSpotifySearch()}
                    disabled={isSpotifySearching}
                  >
                    <SearchIcon size="1em" style={{ verticalAlign: 'middle' }} />
                    <span>{isSpotifySearching ? (lang === 'zh-TW' ? '搜尋中...' : 'Searching...') : (lang === 'zh-TW' ? '搜尋' : 'Search')}</span>
                  </button>
                </div>

                {/* 搜尋狀態說明 */}
                {spotifySearchStatus && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.6rem', textAlign: 'center' }}>
                    {spotifySearchStatus}
                  </div>
                )}

                {/* 搜尋結果列表 */}
                {spotifySearchResults.length > 0 && (
                  <div className="spotify-search-results-list">
                    {spotifySearchResults.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`spotify-search-result-item ${spotifyInputUrl === item.url ? 'selected' : ''}`}
                        onClick={() => {
                          if (item.url) {
                            setSpotifyInputUrl(item.url)
                          }
                        }}
                      >
                        {item.img ? (
                          <img src={item.img} alt={item.name} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MusicIcon size="1.2em" />
                          </div>
                        )}
                        <div className="item-info">
                          <div className="item-title">{item.name}</div>
                          <div className="item-sub">{item.sub}</div>
                        </div>
                        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'rgba(29, 185, 84, 0.15)', color: '#1db954', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {item.type === 'track' ? (lang === 'zh-TW' ? '歌曲' : 'Track') : item.type === 'album' ? (lang === 'zh-TW' ? '專輯' : 'Album') : (lang === 'zh-TW' ? '歌手' : 'Artist')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                  {lang === 'zh-TW' ? 'Spotify 網址連結' : 'Spotify URL Link'}
                </label>
                <input
                  type="url"
                  className="profile-search-input"
                  style={{ width: '100%', boxSizing: 'border-box', height: '42px', padding: '0 1rem', fontSize: '0.88rem', borderRadius: '10px' }}
                  placeholder="https://open.spotify.com/track/..."
                  value={spotifyInputUrl}
                  onChange={(e) => setSpotifyInputUrl(e.target.value)}
                />
              </div>
            )}

            {/* 歌曲即時預覽 / Live Preview */}
            {spotifyInputUrl.trim() && parseSpotifyEmbedUrl(spotifyInputUrl) && (
              <div style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: '#1db954', marginBottom: '0.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MusicIcon size="1em" />
                  {lang === 'zh-TW' ? '已選擇主題曲預覽：' : 'Selected Song Preview:'}
                </div>
                <SafeIframe
                  src={parseSpotifyEmbedUrl(spotifyInputUrl)!}
                  height={spotifyInputUrl.includes('/track/') || spotifyInputUrl.includes('/episode/') ? 80 : 152}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  title="Theme Song Preview"
                  style={{ width: '100%', border: 'none', borderRadius: '8px' }}
                />
              </div>
            )}

            {/* 對齊的底部按鈕專屬列 (Aligned Footer Action Buttons) */}
            <div className="spotify-modal-actions">
              <button
                type="button"
                className="spotify-action-btn save"
                onClick={() => {
                  const trimmed = spotifyInputUrl.trim()
                  if (onUpdateSpotifyUrl) {
                    onUpdateSpotifyUrl(trimmed)
                  }
                  setIsSpotifyModalOpen(false)
                }}
              >
                {lang === 'zh-TW' ? '儲存主題曲' : 'Save Theme Song'}
              </button>

              {user.spotifyUrl && (
                <button
                  type="button"
                  className="spotify-action-btn remove"
                  onClick={() => {
                    setSpotifyInputUrl('')
                    if (onUpdateSpotifyUrl) {
                      onUpdateSpotifyUrl('')
                    }
                    setIsSpotifyModalOpen(false)
                  }}
                >
                  {lang === 'zh-TW' ? '移除' : 'Remove'}
                </button>
              )}

              <button
                type="button"
                className="spotify-action-btn cancel"
                onClick={() => setIsSpotifyModalOpen(false)}
              >
                {lang === 'zh-TW' ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
