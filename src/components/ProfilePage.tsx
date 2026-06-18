import { useState, useMemo, useEffect } from 'react'
import type { Concert } from '../types'
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
  HeartFilledIcon
} from './SvgIcon'
import { collection, query, where, getDocs } from 'firebase/firestore'

interface ProfilePageProps {
  user: { nickname: string; email?: string }
  concerts: Concert[]
  onUpdateNickname: (newNickname: string) => void
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
  onLogout,
  onBack,
  onOpenConcertDetail
}: ProfilePageProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNickname, setEditNickname] = useState(user.nickname)
  const [myReviews, setMyReviews] = useState<UserReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

  return (
    <div className="profile-board-container">
      {/* 頂部導航 */}
      <div className="profile-header-actions">
        <button className="profile-back-btn" type="button" onClick={onBack}>
          <ArrowLeftIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          返回場館地圖
        </button>
        <button className="profile-logout-btn" type="button" onClick={onLogout}>
          <LogoutIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          登出帳戶
        </button>
      </div>

      <div className="profile-layout-grid">
        {/* 左側：個人名片與統計資料 */}
        <aside className="profile-sidebar-card">
          <div className="profile-card-header">
            <div className="profile-avatar-large" style={{ backgroundColor: avatarBg }}>
              {user.nickname.charAt(0).toUpperCase()}
            </div>
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
                  儲存
                </button>
                <button type="button" onClick={() => setIsEditingName(false)} className="cancel-name-btn">
                  取消
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
              {user.email || '訪客模式'}
            </p>
          </div>

          <div className="profile-stats-card-list">
            <div className="profile-stat-box">
              <span className="stat-icon">
                <MicIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.totalCount}</div>
                <div className="stat-label">演唱會記錄</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <PinIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.uniqueVenues}</div>
                <div className="stat-label">造訪場館</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <FlameIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.favoriteArtist}</div>
                <div className="stat-label">最常看歌手</div>
              </div>
            </div>
            <div className="profile-stat-box">
              <span className="stat-icon">
                <BuildingIcon size="1.2em" style={{ verticalAlign: 'middle' }} />
              </span>
              <div className="stat-content">
                <div className="stat-value">{stats.favoriteVenue}</div>
                <div className="stat-label">最常去場館</div>
              </div>
            </div>
          </div>
        </aside>

        {/* 右側：詳細記錄與社群分享足跡 */}
        <main className="profile-main-content">
          {/* 足跡管理 */}
          <section className="profile-content-section">
            <div className="section-header-row">
              <h3>
                <ActivityIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                我的音樂現場足跡
              </h3>
              <input
                type="text"
                placeholder="搜尋我的記錄..."
                className="profile-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="profile-concert-table-wrapper">
              {filteredConcerts.length === 0 ? (
                <div className="profile-empty-state">
                  {searchQuery ? '找不到符合的記錄' : '還沒有任何記錄，點擊地圖上的場館來新增吧！'}
                </div>
              ) : (
                <table className="profile-concert-table">
                  <thead>
                    <tr>
                      <th>歌手 / 演出者</th>
                      <th>演唱會名稱</th>
                      <th>日期</th>
                      <th>場館 / 地點</th>
                      <th>操作</th>
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
                            onClick={() => onOpenConcertDetail(c.id)}
                          >
                            檢視
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* 社群分享牆發佈 */}
          <section className="profile-content-section">
            <h3>
              <MegaphoneIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              我在社群牆發佈的觀後感
            </h3>
            <div className="profile-reviews-wrapper">
              {reviewsLoading ? (
                <div className="profile-empty-state">載入發佈列表中...</div>
              ) : myReviews.length === 0 ? (
                <div className="profile-empty-state">
                  目前尚未分享任何觀後感到社群牆。
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
    </div>
  )
}
