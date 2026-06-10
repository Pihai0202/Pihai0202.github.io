import { useState, useEffect } from 'react'
import type { RemoteConcert, SpotifyItem } from '../types'
import { db } from '../firebase'
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore'

interface TicketDetailModalProps {
  ticket: RemoteConcert
  onClose: () => void
  spotifyTokenFetcher: () => Promise<string | null>
  onPlayMusicBar?: (url: string) => void
}

interface TicketComment {
  id: string
  ticketId: string
  author: string
  content: string
  createdAt: string
  avatarColor: string
}

const AVATAR_COLORS = [
  '#ff5a5f', '#3f51b5', '#4caf50', '#ffeb3b', '#e91e63', 
  '#9c27b0', '#00bcd4', '#ff9800', '#795548', '#607d8b'
]

function getHashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function extractArtistQuery(title: string): string {
  // Remove prefixes in brackets
  let clean = title.replace(/【[^】]+】/g, '')
  clean = clean.replace(/\[[^\]]+\]/g, '')
  clean = clean.replace(/\([^)]+\)/g, '')
  clean = clean.replace(/（[^）]+）/g, '')
  
  // Split by common separators
  const separators = ['《', '<', ' - ', '—', '|', '：', ':', '★']
  for (const sep of separators) {
    if (clean.includes(sep)) {
      clean = clean.split(sep)[0]
    }
  }
  
  // Filter out year if present
  clean = clean.replace(/202\d/g, '')
  
  return clean.trim()
}

export function TicketDetailModal({
  ticket,
  onClose,
  spotifyTokenFetcher,
  onPlayMusicBar
}: TicketDetailModalProps) {
  const [comments, setComments] = useState<TicketComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('tw-nickname') || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(true)

  // Spotify state
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyItem[]>([])
  const [selectedTrack, setSelectedTrack] = useState<SpotifyItem | null>(null)
  const [autoPlay, setAutoPlay] = useState(() => {
    const cached = localStorage.getItem('tw-autoplay-music')
    return cached === null ? true : cached === 'true'
  })
  const [spotifyLoading, setSpotifyLoading] = useState(false)

  // Create a guaranteed list of links to render
  const linksToRender = ticket.ticket_links && ticket.ticket_links.length > 0
    ? ticket.ticket_links
    : [{ platform: 'official', name: ticket.source || '官方售票', url: ticket.url }]

  // 1. Fetch comments in real-time from Firestore
  useEffect(() => {
    setCommentsLoading(true)
    const q = query(
      collection(db, 'ticket_comments'),
      where('ticketId', '==', ticket.id),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TicketComment[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        list.push({
          id: doc.id,
          ticketId: data.ticketId || ticket.id,
          author: data.author || '匿名樂迷',
          content: data.content || '',
          createdAt: data.createdAt || new Date().toISOString(),
          avatarColor: data.avatarColor || '#607d8b'
        })
      })
      // Sort client-side too to handle potential lack of index latency
      list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      setComments(list)
      setCommentsLoading(false)
    }, (error) => {
      console.warn('Comments query failed or missing indexes. Falling back to un-ordered query.', error)
      // Fallback query without orderBy to avoid index requirement block
      const fallbackQuery = query(
        collection(db, 'ticket_comments'),
        where('ticketId', '==', ticket.id)
      )
      onSnapshot(fallbackQuery, (snapshot) => {
        const list: TicketComment[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          list.push({
            id: doc.id,
            ticketId: data.ticketId || ticket.id,
            author: data.author || '匿名樂迷',
            content: data.content || '',
            createdAt: data.createdAt || new Date().toISOString(),
            avatarColor: data.avatarColor || '#607d8b'
          })
        })
        list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        setComments(list)
        setCommentsLoading(false)
      })
    })

    return () => unsubscribe()
  }, [ticket.id])

  // 2. Fetch Spotify tracks for this artist
  useEffect(() => {
    const searchTracks = async () => {
      const artistQuery = extractArtistQuery(ticket.name)
      if (!artistQuery) return

      setSpotifyLoading(true)
      try {
        const token = await spotifyTokenFetcher()
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          artistQuery
        )}&type=track&limit=5&market=TW`
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) throw new Error('Spotify API failure')
        
        const data = await response.json()
        const tracks = data.tracks?.items ?? []
        
        const normalized: SpotifyItem[] = tracks.map((track: any) => ({
          type: 'track' as const,
          id: track.id,
          name: track.name,
          sub: `${track.artists?.map((a: any) => a.name).join('、') || '未知藝人'} · ${track.album?.name || ''}`,
          img: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || '',
          url: track.external_urls?.spotify
        })).filter((t: any) => t.url)

        setSpotifyTracks(normalized)
        if (normalized.length > 0) {
          setSelectedTrack(normalized[0])
          // Sync with bottom player if requested
          if (autoPlay && onPlayMusicBar) {
            onPlayMusicBar(normalized[0].url)
          }
        }
      } catch (err) {
        console.error('Failed to search Spotify tracks in modal:', err)
      } finally {
        setSpotifyLoading(false)
      }
    }

    searchTracks()
  }, [ticket.id, spotifyTokenFetcher])

  // Save autoplay toggle setting
  const handleAutoPlayToggle = (val: boolean) => {
    setAutoPlay(val)
    localStorage.setItem('tw-autoplay-music', String(val))
    if (val && selectedTrack && onPlayMusicBar) {
      onPlayMusicBar(selectedTrack.url)
    }
  }

  // Handle posting comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = newComment.trim()
    const author = authorName.trim() || '匿名樂迷'

    if (!content) return

    setIsSubmitting(true)
    try {
      localStorage.setItem('tw-nickname', author)
      setAuthorName(author)

      await addDoc(collection(db, 'ticket_comments'), {
        ticketId: ticket.id,
        author,
        content,
        createdAt: new Date().toISOString(),
        avatarColor: getHashColor(author)
      })

      setNewComment('')
    } catch (err) {
      console.error('Failed to add comment:', err)
      alert('無法發佈留言，請檢查網路連線！')
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <div className="ticket-detail-container">
      {/* 頂部售票資訊介紹 */}
      <div className="ticket-info-header">
        <div className="ticket-source-badge">{ticket.source || '售票資訊'}</div>
        <h2 className="ticket-title">{ticket.name}</h2>
        <div className="ticket-meta-grid">
          <div className="meta-item">
            <span className="icon">📅</span>
            <span className="text">演出日期：<strong>{ticket.date || '日期未定'}</strong></span>
          </div>
          <div className="meta-item">
            <span className="icon">📍</span>
            <span className="text">演出場館：<strong>{ticket.venue_raw || ticket.venue_name || '地點待確認'}</strong></span>
          </div>
          {ticket.price && (
            <div className="meta-item">
              <span className="icon">💵</span>
              <span className="text">票價估計：<strong>{ticket.price}</strong></span>
            </div>
          )}
        </div>
        
        {linksToRender.length > 0 && (
          <div className="ticket-link-buttons">
            {linksToRender.map((link, idx) => (
              <a
                key={`${link.platform}-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-buy-btn"
              >
                🎟️ 前往 {link.name} 購票 ↗
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 音樂播放與選項整合區 */}
      <div className="ticket-music-section">
        <div className="section-title-row">
          <h3>🎵 演出歌手精選音樂</h3>
          <div className="autoplay-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoPlay}
                onChange={(e) => handleAutoPlayToggle(e.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">自動播放音樂</span>
          </div>
        </div>

        {spotifyLoading && <div className="spotify-loader">正在尋找 Spotify 歌手曲目...</div>}

        {!spotifyLoading && spotifyTracks.length === 0 && (
          <div className="spotify-no-tracks">
            找不到與演出者相關的 Spotify 曲目。
          </div>
        )}

        {spotifyTracks.length > 0 && (
          <div className="music-player-grid">
            {/* Tracks Options Select */}
            <div className="music-selector-panel">
              <span className="selector-title">選擇播放曲目：</span>
              <div className="track-options-list">
                {spotifyTracks.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    className={`track-option-item${selectedTrack?.id === track.id ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedTrack(track)
                      if (autoPlay && onPlayMusicBar) {
                        onPlayMusicBar(track.url)
                      }
                    }}
                  >
                    {track.img && <img src={track.img} alt="" className="track-thumb" />}
                    <div className="track-info">
                      <div className="track-name">{track.name}</div>
                      <div className="track-artist">{track.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Visualizer to prevent double audio playback */}
            {autoPlay && selectedTrack && (
              <div className="modal-player-visualizer">
                <div className="now-playing-header">
                  <div className="equalizer-waves">
                    <span className="wave-bar bar1" />
                    <span className="wave-bar bar2" />
                    <span className="wave-bar bar3" />
                    <span className="wave-bar bar4" />
                  </div>
                  <span className="playing-label">正在播放 (頁面下方)</span>
                </div>
                <div className="playing-track-card">
                  {selectedTrack.img && <img src={selectedTrack.img} alt="" className="playing-track-thumb" />}
                  <div className="playing-track-detail">
                    <div className="playing-track-name">{selectedTrack.name}</div>
                    <div className="playing-track-sub">{selectedTrack.sub}</div>
                  </div>
                  <a
                    href={selectedTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="track-spotify-link-btn"
                    title="在 Spotify 開啟"
                  >
                    ↗
                  </a>
                </div>
                <div className="player-instructions">
                  💡 音樂已在下方主播放器啟動，關閉此彈窗可繼續聆聽。
                </div>
              </div>
            )}
            
            {!autoPlay && (
              <div className="embedded-player-placeholder">
                <span>⏸ 已暫停自動播放</span>
                <button
                  type="button"
                  className="play-now-btn"
                  onClick={() => handleAutoPlayToggle(true)}
                >
                  立即播放 ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 購票連結快捷區 */}
      {linksToRender.length > 0 && (
        <div className="ticket-purchase-banner">
          <span className="banner-title">🎟️ 購票/活動連結資訊：</span>
          <div className="banner-buttons-row">
            {linksToRender.map((link, idx) => (
              <a
                key={`${link.platform}-banner-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-buy-btn-large"
              >
                立即前往 {link.name} 購票/活動網頁 ➔
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 售票資訊留言牆 */}
      <div className="ticket-comments-section">
        <h3>💬 售票討論留言牆</h3>
        
        {/* Comments List */}
        <div className="comments-scroll-area">
          {commentsLoading ? (
            <div className="comments-status-msg">讀取留言中...</div>
          ) : comments.length === 0 ? (
            <div className="comments-empty-state">
              目前還沒有留言，快來搶頭香，一起討論買票攻略吧！
            </div>
          ) : (
            <div className="comments-list">
              {comments.map((comment) => (
                <div className="comment-item" key={comment.id}>
                  <div
                    className="comment-avatar"
                    style={{ backgroundColor: comment.avatarColor }}
                  >
                    {comment.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="comment-bubble">
                    <div className="comment-bubble-header">
                      <span className="comment-author">{comment.author}</span>
                      <span className="comment-date">
                        {new Date(comment.createdAt).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="comment-text">{comment.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Input Form */}
        <form onSubmit={handlePostComment} className="comment-form-panel">
          <div className="comment-input-row">
            <input
              type="text"
              className="comment-nickname-input"
              placeholder="您的暱稱 (預設: 匿名樂迷)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={15}
            />
          </div>
          <div className="comment-textarea-row">
            <textarea
              className="comment-textarea"
              placeholder="分享關於此活動的售票資訊、討論排隊策略或求讓票討論..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={250}
              required
            />
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? '傳送中' : '發佈留言 🚀'}
            </button>
          </div>
        </form>
      </div>

      {/* 底部關閉按鈕 */}
      <div className="ticket-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', flexShrink: 0 }}>
        <button
          type="button"
          className="ticket-close-action-btn"
          onClick={onClose}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            padding: '0.55rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          關閉視窗 ×
        </button>
      </div>
    </div>
  )
}
