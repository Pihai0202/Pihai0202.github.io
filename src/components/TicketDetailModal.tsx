import { useState, useEffect } from 'react'
import type { RemoteConcert, SpotifyItem } from '../types'
import { useTranslation, translateVenueName } from '../utils/i18n.tsx'
import { LazyImage } from './LazyImage'
import { db } from '../firebase'
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore'
import {
  CalendarIcon,
  MapPinIcon,
  BanknoteIcon,
  TicketIcon,
  StarIcon,
  MusicIcon,
  LightbulbIcon,
  PauseIcon,
  PlayIcon,
  CommentIcon,
  RocketIcon
} from './Icons'
import { BaseballIcon, TrophyIcon, RefreshIcon, ShieldIcon } from './SvgIcon'
import { shortenCpblTeamName, resolveCpblPlayerName } from '../utils/cpblUtils'

interface TicketDetailModalProps {
  ticket: RemoteConcert
  onClose: () => void
  spotifyTokenFetcher: (forceRefresh?: boolean) => Promise<string | null>
  onPlayMusicBar?: (url: string) => void
  onLogAsPersonal?: (ticket: RemoteConcert) => void
  onRefreshScore?: () => void
  isScoreRefreshing?: boolean
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

type ExtractedQueryResult = {
  artist: string
  tourName: string
}

function extractArtistQuery(title: string): ExtractedQueryResult {
  if (!title) return { artist: '', tourName: '' }

  let raw = title.trim()

  // 1. Extract tour/album/song name from 《...》 or 「...」
  let tourName = ''
  const quoteMatch = raw.match(/《([^》]+)》|「([^」]+)」/)
  if (quoteMatch) {
    tourName = (quoteMatch[1] || quoteMatch[2] || '').trim()
  }

  // 2. Strip bracket expressions
  let clean = raw
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/《[^》]*》/g, ' ')
    .replace(/「[^」]*」/g, ' ')

  // 3. Filter out sponsors, bank names, ticketing platform names
  const sponsors = [
    '國泰世華銀行', '國泰世華', '中國信託商業銀行', '中國信託銀行', '中國信託', '中信銀', '中信',
    '富邦金控', '台北富邦銀行', '富邦銀行', '富邦', '華南商業銀行', '華南銀行', '華南',
    '台新國際商業銀行', '台新銀行', '台新', '玉山商業銀行', '玉山銀行', '玉山',
    '遠東國際商業銀行', '遠東商銀', '兆豐國際商業銀行', '兆豐銀行', '兆豐',
    '合作金庫商業銀行', '合作金庫', '合庫', '第一商業銀行', '第一銀行', '聯邦商業銀行', '聯邦銀行',
    '永豐商業銀行', '永豐銀行', '永豐', '星展銀行', '渣打銀行', '花旗銀行', '新光銀行', '元大銀行',
    '獨家贊助', '冠名贊助', '榮譽贊助', '特別贊助', '贊助呈獻', '贊助', '冠名', '呈獻', '主辦', '協辦', '承辦',
    'KKTIX', 'ibon', '拓元', '寬宏售票', '寬宏', '遠雄'
  ]
  for (const sp of sponsors) {
    clean = clean.split(sp).join(' ')
  }

  // 4. Filter out common event descriptors and noise words
  const noiseRegexes = [
    /202\d[年/.-]?/g,
    /巡迴演唱會/g,
    /世界巡迴/g,
    /巡迴音樂會/g,
    /巡迴/g,
    /演唱會/g,
    /音樂會/g,
    /演奏會/g,
    /粉絲見面會/g,
    /見面會/g,
    /專場/g,
    /旗艦場/g,
    /最終場/g,
    /特別場/g,
    /加場/g,
    /加開/g,
    /台北站/g,
    /高雄站/g,
    /台中站/g,
    /桃園站/g,
    /台南站/g,
    /週年紀念/g,
    /周年紀念/g,
    /週年/g,
    /周年/g,
    /WORLD\s+TOUR/gi,
    /LIVE\s+TOUR/gi,
    /LIVE/gi,
    /TOUR/gi,
    /CONCERT/gi,
    /FAN\s+MEETING/gi,
    /IN\s+TAIPEI/gi,
    /IN\s+KAOHSIUNG/gi,
    /TAIPEI/gi,
    /KAOHSIUNG/gi,
  ]

  for (const regex of noiseRegexes) {
    clean = clean.replace(regex, ' ')
  }

  // 5. Clean punctuation and spaces
  clean = clean.replace(/[-|:：★◆▲▼♦]/g, ' ')
  clean = clean.replace(/\s+/g, ' ').trim()

  // Fallback if empty
  if (!clean) {
    clean = title.split('《')[0].replace(/【[^】]+】/g, '').trim()
  }

  return {
    artist: clean,
    tourName: tourName
  }
}

export function TicketDetailModal({
  ticket,
  onClose,
  spotifyTokenFetcher,
  onPlayMusicBar,
  onLogAsPersonal,
  onRefreshScore,
  isScoreRefreshing = false
}: TicketDetailModalProps) {
  const { lang } = useTranslation()
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

    let unsubscribeFallback: (() => void) | null = null

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TicketComment[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        if (data.hidden === true || data.status === 'hidden' || data.isHided === true || data.isHide === true) {
          return
        }
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
      unsubscribeFallback = onSnapshot(fallbackQuery, (snapshot) => {
        const list: TicketComment[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          if (data.hidden === true || data.status === 'hidden' || data.isHided === true || data.isHide === true) {
            return
          }
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

    return () => {
      unsubscribe()
      if (unsubscribeFallback) {
        unsubscribeFallback()
      }
    }
  }, [ticket.id])

  // 2. Fetch Spotify tracks for this artist
  useEffect(() => {
    const searchTracks = async () => {
      const { artist: cleanArtist, tourName } = extractArtistQuery(ticket.name)
      if (!cleanArtist && !tourName) return

      setSpotifyLoading(true)
      try {
        let token = await spotifyTokenFetcher()

        const fetchSpotifyUrl = async (queryStr: string, limit = 10) => {
          const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(queryStr)}&type=track&limit=${limit}&market=TW`
          let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          if (res.status === 401) {
            token = await spotifyTokenFetcher(true)
            res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          }
          if (!res.ok) return []
          const data = await res.json()
          return data.tracks?.items ?? []
        }

        let rawTracks: any[] = []

        // Stage 1: Artist-specific search (artist:"歌手名稱")
        if (cleanArtist) {
          rawTracks = await fetchSpotifyUrl(`artist:"${cleanArtist}"`, 8)
        }

        // Stage 2: Search with artist + tour/song name
        if (rawTracks.length === 0 && cleanArtist && tourName) {
          rawTracks = await fetchSpotifyUrl(`${cleanArtist} ${tourName}`, 8)
        }

        // Stage 3: Search with tour/song name alone
        if (rawTracks.length === 0 && tourName) {
          rawTracks = await fetchSpotifyUrl(tourName, 8)
        }

        // Stage 4: General keyword search
        if (rawTracks.length === 0 && cleanArtist) {
          rawTracks = await fetchSpotifyUrl(cleanArtist, 8)
        }

        const normalized: (SpotifyItem & { artistNames: string })[] = rawTracks
          .map((track: any) => ({
            type: 'track' as const,
            id: track.id,
            name: track.name,
            sub: `${track.artists?.map((a: any) => a.name).join('、') || '未知藝人'} · ${track.album?.name || ''}`,
            img: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || '',
            url: track.external_urls?.spotify,
            artistNames: (track.artists?.map((a: any) => a.name.toLowerCase()) || []).join(' ')
          }))
          .filter((t: any) => t.url)

        // Strict Artist Relevance Check: filter out tracks from completely unrelated artists
        let verifiedTracks = normalized
        if (cleanArtist) {
          const lowerArtist = cleanArtist.toLowerCase()
          const matched = normalized.filter((t) => {
            return t.artistNames.includes(lowerArtist) || lowerArtist.includes(t.artistNames)
          })
          if (matched.length > 0) {
            verifiedTracks = matched
          }
        }

        const finalTracks: SpotifyItem[] = verifiedTracks.slice(0, 5).map(({ artistNames, ...rest }) => rest)

        setSpotifyTracks(finalTracks)
        if (finalTracks.length > 0) {
          setSelectedTrack(finalTracks[0])
          if (autoPlay && onPlayMusicBar) {
            onPlayMusicBar(finalTracks[0].url)
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
      alert(lang === 'zh-TW' ? '無法發佈留言，請檢查網路連線！' : lang === 'ja' ? 'コメントの投稿に失敗しました。接続を確認してください！' : lang === 'ko' ? '댓글을 게시할 수 없습니다. 네트워크 연결을 확인하세요!' : 'Failed to post comment, please check your connection!')
    } finally {
      setIsSubmitting(false)
    }
  }


  const translateSource = (src: string): string => {
    if (lang === 'zh-TW') return src
    const srcMap: Record<string, Record<string, string>> = {
      '中華職棒': { en: 'CPBL', ja: '中華職棒 (台湾プロ野球)', ko: '대만 프로야구 (CPBL)' },
      '拓元售票': { en: 'tixCraft', ja: 'tixCraft', ko: '티스 크래프트 (tixCraft)' },
      '寬宏售票': { en: 'Kham Ticketing', ja: 'Kham售票', ko: '캄 티케팅 (Kham)' },
      '年代售票': { en: 'Era Ticket', ja: 'Era售票', ko: '에라 티켓 (Era)' },
      'ibon售票': { en: 'ibon Ticketing', ja: 'ibon售票', ko: '이본 티케팅 (ibon)' },
      'FamiTicket': { en: 'FamiTicket', ja: 'FamiTicket', ko: '패미티켓 (FamiTicket)' },
      'KKTIX': { en: 'KKTIX', ja: 'KKTIX', ko: 'KKTIX' },
      '遠大售票': { en: 'Ticket Plus', ja: 'Ticket Plus', ko: '티켓 플러스 (Ticket Plus)' },
      '主辦官網': { en: 'Official Site', ja: '主催者公式サイト', ko: '공식 웹사이트' },
    }
    return srcMap[src]?.[lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'] || src
  }

  const translatePrice = (price: string): string => {
    if (!price) return ''
    if (price === '依官網/主辦公告為準') {
      return lang === 'zh-TW' 
        ? '依官網/主辦公告為準' 
        : lang === 'ja' 
          ? '公式サイトまたは主催者の発表に準ずる' 
          : lang === 'ko' 
            ? '공식 홈페이지/주최측 공지 기준' 
            : 'Subject to official website/organizer announcement'
    }
    return price
  }

  return (
    <div className="ticket-detail-container">
      {/* 頂部售票資訊介紹 */}
      <div className="ticket-info-header">
        {ticket.image && (
          <div className="ticket-poster-container">
            <LazyImage
              src={ticket.image}
              alt={ticket.name}
              className="ticket-poster-hero"
              fallback={<div className="ticket-poster-fallback">LIVE</div>}
            />
          </div>
        )}
        <div className="ticket-source-badge">
          {ticket.source ? translateSource(ticket.source) : (lang === 'zh-TW' ? '售票資訊' : lang === 'en' ? 'Ticketing Info' : lang === 'ja' ? 'チケット情報' : '티켓팅 정보')}
        </div>
        <h2 className="ticket-title">{ticket.name}</h2>
        <div className="ticket-meta-grid">
          <div className="meta-item">
            <span className="icon" style={{ color: '#64b5f6' }}><CalendarIcon /></span>
            <span className="text">
              {lang === 'zh-TW' ? '演出日期：' : lang === 'en' ? 'Event Date: ' : lang === 'ja' ? '公演日：' : '공연 날짜: '}
              <strong>{ticket.date || (lang === 'zh-TW' ? '日期未定' : lang === 'en' ? 'TBA' : lang === 'ja' ? '日程未定' : '날짜 미정')}</strong>
            </span>
          </div>
          <div className="meta-item">
            <span className="icon" style={{ color: 'var(--accent)' }}><MapPinIcon /></span>
            <span className="text">
              {lang === 'zh-TW' ? '演出場館：' : lang === 'en' ? 'Venue: ' : lang === 'ja' ? '会場：' : '공연장: '}
              <strong>{translateVenueName(ticket.venue_raw || ticket.venue_name || '', lang) || (lang === 'zh-TW' ? '地點待確認' : lang === 'en' ? 'Location TBA' : lang === 'ja' ? '開催地未定' : '장소 미정')}</strong>
            </span>
          </div>
          {ticket.price && (
            <div className="meta-item">
              <span className="icon" style={{ color: 'var(--teal)' }}><BanknoteIcon /></span>
              <span className="text">
                {lang === 'zh-TW' ? '票價估計：' : lang === 'en' ? 'Price Estimate: ' : lang === 'ja' ? '予想料金：' : '예상 티켓가: '}
                <strong>{translatePrice(ticket.price)}</strong>
              </span>
            </div>
          )}
        </div>

        {ticket.game_score && (
          <div className={`cpbl-scoreboard-card ${ticket.game_score.status || 'scheduled'}`}>
            <div className="scoreboard-status-header">
              <div className="scoreboard-status-left">
                <span className={`status-badge status-${ticket.game_score.status || 'scheduled'}`}>
                  {ticket.game_score.status === 'live' && <span className="live-pulsing-dot" />}
                  {ticket.game_score.status_text || '職棒賽事'}
                </span>
                {onRefreshScore && (
                  <button
                    type="button"
                    className={`score-refresh-btn ${isScoreRefreshing ? 'spinning' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRefreshScore()
                    }}
                    title={lang === 'zh-TW' ? '刷新即時比分' : 'Refresh Live Score'}
                    disabled={isScoreRefreshing}
                    aria-label="Refresh Score"
                  >
                    <RefreshIcon size="0.85em" />
                    <span className="refresh-btn-text">
                      {isScoreRefreshing
                        ? (lang === 'zh-TW' ? '更新中...' : 'Updating...')
                        : (lang === 'zh-TW' ? '刷新比分' : 'Refresh')}
                    </span>
                  </button>
                )}
              </div>
              <span className="game-type-label">
                <BaseballIcon size="0.9em" style={{ verticalAlign: 'middle', marginRight: '4px', opacity: 0.85 }} />
                中華職棒 CPBL
              </span>
            </div>

            <div className="scoreboard-teams-row">
              <div className={`team-box visiting ${Number(ticket.game_score.visiting_score) > Number(ticket.game_score.home_score) ? 'is-winner' : ''}`}>
                <div className="team-meta">
                  <span className="team-label">客隊</span>
                  <span className="team-name">{shortenCpblTeamName(ticket.game_score.visiting_team) || '客隊'}</span>
                </div>
                {ticket.game_score.status !== 'scheduled' && (
                  <span className="team-score">{ticket.game_score.visiting_score ?? '-'}</span>
                )}
              </div>

              <div className="scoreboard-vs-divider">
                <span className="vs-text">
                  {ticket.game_score.status === 'finished' ? 'FINAL' : ticket.game_score.status === 'live' ? 'LIVE' : 'VS'}
                </span>
              </div>

              <div className={`team-box home ${Number(ticket.game_score.home_score) > Number(ticket.game_score.visiting_score) ? 'is-winner' : ''}`}>
                {ticket.game_score.status !== 'scheduled' && (
                  <span className="team-score">{ticket.game_score.home_score ?? '-'}</span>
                )}
                <div className="team-meta home-meta">
                  <span className="team-name">{shortenCpblTeamName(ticket.game_score.home_team) || '主隊'}</span>
                  <span className="team-label">主隊</span>
                </div>
              </div>
            </div>

            {/* 先發投手資訊 (Starting Pitchers) */}
            {(ticket.game_score.visiting_pitcher || ticket.game_score.home_pitcher || ticket.game_score.status === 'scheduled' || ticket.game_score.status === 'live') && (
              <div className="scoreboard-starting-pitchers">
                <div className="pitcher-cell">
                  <span className="pitcher-label">
                    <BaseballIcon size="0.85em" style={{ marginRight: '3px', opacity: 0.75 }} />
                    客先發
                  </span>
                  <strong className="pitcher-name">
                    {resolveCpblPlayerName(ticket.game_score.visiting_pitcher) || (ticket.game_score.status === 'finished' ? '未登錄' : '賽前公告')}
                  </strong>
                </div>
                <div className="pitcher-divider" />
                <div className="pitcher-cell">
                  <span className="pitcher-label">
                    <BaseballIcon size="0.85em" style={{ marginRight: '3px', opacity: 0.75 }} />
                    主先發
                  </span>
                  <strong className="pitcher-name">
                    {resolveCpblPlayerName(ticket.game_score.home_pitcher) || (ticket.game_score.status === 'finished' ? '未登錄' : '賽前公告')}
                  </strong>
                </div>
              </div>
            )}

            {/* 完賽勝敗投、救援與 MVP (Game Results Grid) */}
            {ticket.game_score.status === 'finished' && (ticket.game_score.winning_pitcher || ticket.game_score.losing_pitcher || ticket.game_score.closer || ticket.game_score.mvp) && (
              <div className="scoreboard-results-grid">
                {ticket.game_score.winning_pitcher && (
                  <div className="result-chip win-chip">
                    <span className="chip-label">
                      <TrophyIcon size="0.95em" style={{ color: 'var(--gold, #ffbe0b)' }} />
                      勝投
                    </span>
                    <strong className="chip-val">{resolveCpblPlayerName(ticket.game_score.winning_pitcher)}</strong>
                  </div>
                )}
                {ticket.game_score.losing_pitcher && (
                  <div className="result-chip lose-chip">
                    <span className="chip-label">
                      <BaseballIcon size="0.85em" style={{ opacity: 0.6 }} />
                      敗投
                    </span>
                    <strong className="chip-val">{resolveCpblPlayerName(ticket.game_score.losing_pitcher)}</strong>
                  </div>
                )}
                {ticket.game_score.closer && (
                  <div className="result-chip closer-chip">
                    <span className="chip-label">
                      <ShieldIcon size="0.9em" style={{ color: '#2dd4bf' }} />
                      救援
                    </span>
                    <strong className="chip-val">{resolveCpblPlayerName(ticket.game_score.closer)}</strong>
                  </div>
                )}
                {ticket.game_score.mvp && (
                  <div className="result-chip mvp-chip">
                    <span className="chip-label">
                      <StarIcon style={{ width: '0.95em', height: '0.95em', color: 'var(--gold, #ffbe0b)' }} />
                      MVP
                    </span>
                    <strong className="chip-val">{resolveCpblPlayerName(ticket.game_score.mvp)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
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
                <TicketIcon /> {
                  lang === 'zh-TW' ? (link.name.includes('賽程') ? `前往 ${link.name} ↗` : `前往 ${link.name} 購票 ↗`) :
                  lang === 'en' ? (link.name.includes('賽程') || link.name.toLowerCase().includes('schedule') ? `Go to ${translateSource(link.name)} ↗` : `Buy on ${translateSource(link.name)} ↗`) :
                  lang === 'ja' ? (link.name.includes('賽程') ? `${translateSource(link.name)}へ ↗` : `${translateSource(link.name)}でチケット購入 ↗`) :
                  (link.name.includes('賽程') ? `${translateSource(link.name)} 바로가기 ↗` : `${translateSource(link.name)}에서 예매하기 ↗`)
                }
              </a>
            ))}
          </div>
        )}
        
        {onLogAsPersonal && (
          <button
            type="button"
            className="ticket-log-personal-btn"
            onClick={() => onLogAsPersonal(ticket)}
          >
            <StarIcon /> {
              lang === 'zh-TW' ? '登錄為我的演唱會記錄 / 自訂活動' :
              lang === 'en' ? 'Register as My Concert Record / Custom Event' :
              lang === 'ja' ? 'コンサート履歴 / カスタムイベントに登録' :
              '내 콘서트 기록 / 맞춤 이벤트로 등록'
            }
          </button>
        )}
      </div>

      {/* 音樂播放與選項整合區 */}
      <div className="ticket-music-section">
        <div className="section-title-row">
          <h3><MusicIcon style={{ color: '#ba68c8', marginRight: '0.4rem' }} /> {
            lang === 'zh-TW' ? '演出歌手精選音樂' :
            lang === 'en' ? 'Featured Artist Music' :
            lang === 'ja' ? '出演アーティストの厳選音楽' :
            '출연 아티스트 추천 음악'
          }</h3>
          <div className="autoplay-control">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoPlay}
                onChange={(e) => handleAutoPlayToggle(e.target.checked)}
              />
              <span className="slider" />
            </label>
            <span className="toggle-label">{
              lang === 'zh-TW' ? '自動播放音樂' :
              lang === 'en' ? 'Auto-play Music' :
              lang === 'ja' ? '自動再生' :
              '자동 재생'
            }</span>
          </div>
        </div>

        {spotifyLoading && <div className="spotify-loader">{
          lang === 'zh-TW' ? '正在尋找 Spotify 歌手曲目...' :
          lang === 'en' ? 'Searching Spotify artist tracks...' :
          lang === 'ja' ? 'Spotifyでアーティストの曲を検索中...' :
          'Spotify에서 아티스트 곡을 검색 중...'
        }</div>}

        {!spotifyLoading && spotifyTracks.length === 0 && (
          <div className="spotify-no-tracks">
            {
              lang === 'zh-TW' ? '找不到與演出者相關的 Spotify 曲目。' :
              lang === 'en' ? 'No Spotify tracks found for this artist.' :
              lang === 'ja' ? 'アーティストに関連するSpotifyの曲が見つかりませんでした。' :
              '아티스트와 관련된 Spotify 곡을 찾을 수 없습니다.'
            }
          </div>
        )}

        {spotifyTracks.length > 0 && (
          <div className="music-player-grid">
            {/* Tracks Options Select */}
            <div className="music-selector-panel">
              <span className="selector-title">{
                lang === 'zh-TW' ? '選擇播放曲目：' :
                lang === 'en' ? 'Select track to play:' :
                lang === 'ja' ? '再生曲を選択：' :
                '재생할 곡 선택:'
              }</span>
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
                    {track.img && <LazyImage src={track.img} alt="" className="track-thumb" />}
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
                  <span className="playing-label">{
                    lang === 'zh-TW' ? '正在播放 (頁面下方)' :
                    lang === 'en' ? 'Now Playing (Bottom of page)' :
                    lang === 'ja' ? '再生中 (ページ下部)' :
                    '재생 중 (페이지 하단)'
                  }</span>
                </div>
                <div className="playing-track-card">
                  {selectedTrack.img && <LazyImage src={selectedTrack.img} alt="" className="playing-track-thumb" />}
                  <div className="playing-track-detail">
                    <div className="playing-track-name">{selectedTrack.name}</div>
                    <div className="playing-track-sub">{selectedTrack.sub}</div>
                  </div>
                  <a
                    href={selectedTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="track-spotify-link-btn"
                    title={lang === 'zh-TW' ? '在 Spotify 開啟' : lang === 'en' ? 'Open in Spotify' : lang === 'ja' ? 'Spotifyで開く' : 'Spotify에서 열기'}
                  >
                    ↗
                  </a>
                </div>
                <div className="player-instructions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <LightbulbIcon style={{ color: 'var(--gold)', flexShrink: 0 }} />
                  <span>{
                    lang === 'zh-TW' ? '音樂已在下方主播放器啟動，關閉此彈窗可繼續聆聽。' :
                    lang === 'en' ? 'Music has started in the main player below. Close this popup to continue listening.' :
                    lang === 'ja' ? '音楽は下部のメインプレイヤーで再生されています。このポップアップを閉じても聴き続けられます。' :
                    '음악이 하단의 메인 플레이어에서 재생되었습니다. 이 팝업을 닫아도 계속 들으실 수 있습니다.'
                  }</span>
                </div>
              </div>
            )}
            
            {!autoPlay && (
              <div className="embedded-player-placeholder">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PauseIcon style={{ color: 'var(--muted)' }} /> {
                    lang === 'zh-TW' ? '已暫停自動播放' :
                    lang === 'en' ? 'Auto-play paused' :
                    lang === 'ja' ? '自動再生一時停止中' :
                    '자동 재생 일시 정지됨'
                  }
                </span>
                <button
                  type="button"
                  className="play-now-btn"
                  onClick={() => handleAutoPlayToggle(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {lang === 'zh-TW' ? '立即播放' : lang === 'en' ? 'Play Now' : lang === 'ja' ? '今すぐ再生' : '지금 재생'} <PlayIcon />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 售票資訊留言牆 */}
      <div className="ticket-comments-section">
        <h3><CommentIcon style={{ color: 'var(--teal)', marginRight: '0.4rem' }} /> {
          lang === 'zh-TW' ? '售票討論留言牆' :
          lang === 'en' ? 'Ticketing Discussion Board' :
          lang === 'ja' ? 'チケット販売ディスカッションボード' :
          '티켓팅 토론 게시판'
        }</h3>
        
        {/* Comments List */}
        <div className="comments-scroll-area">
          {commentsLoading ? (
            <div className="comments-status-msg">{
              lang === 'zh-TW' ? '讀取留言中...' :
              lang === 'en' ? 'Loading comments...' :
              lang === 'ja' ? 'コメントを読み込み中...' :
              '댓글을 불러오는 중...'
            }</div>
          ) : comments.length === 0 ? (
            <div className="comments-empty-state">
              {
                lang === 'zh-TW' ? '目前還沒有留言，快來搶頭香，一起討論買票攻略吧！' :
                lang === 'en' ? 'No comments yet. Be the first to share your ticketing strategy!' :
                lang === 'ja' ? 'コメントはまだありません。チケット購入の攻略法について最初にコメントしましょう！' :
                '아직 댓글이 없습니다. 첫 댓글을 남겨서 티켓팅 팁을 공유해 보세요!'
              }
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
                        {new Date(comment.createdAt).toLocaleString(lang === 'zh-TW' ? 'zh-TW' : lang === 'ja' ? 'ja-JP' : lang === 'ko' ? 'ko-KR' : 'en-US', {
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
              placeholder={
                lang === 'zh-TW' ? '您的暱稱 (預設: 匿名樂迷)' :
                lang === 'en' ? 'Your Nickname (Default: Anonymous Fan)' :
                lang === 'ja' ? 'ニックネーム (デフォルト: 匿名のファン)' :
                '닉네임 (기본값: 익명 팬)'
              }
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={15}
            />
          </div>
          <div className="comment-textarea-row">
            <textarea
              className="comment-textarea"
              placeholder={
                lang === 'zh-TW' ? '分享關於此活動的售票資訊、討論排隊策略或求讓票討論...' :
                lang === 'en' ? 'Share ticketing info, queuing strategy or ticket exchange discussions for this event...' :
                lang === 'ja' ? 'このイベントのチケット情報、並び方の攻略、またはチケット譲渡について共有してください...' :
                '이 이벤트의 티켓팅 정보, 대기 전략 또는 티켓 양도에 대한 의견을 나누어 보세요...'
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={250}
              required
            />
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              {isSubmitting ? (lang === 'zh-TW' ? '傳送中' : lang === 'en' ? 'Sending...' : lang === 'ja' ? '送信中...' : '전송 중...') : (
                <>{lang === 'zh-TW' ? '發佈留言' : lang === 'en' ? 'Post Comment' : lang === 'ja' ? 'コメント投稿' : '댓글 게시'} <RocketIcon /></>
              )}
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
          {lang === 'zh-TW' ? '關閉視窗 ×' : lang === 'en' ? 'Close Window ×' : lang === 'ja' ? '閉じる ×' : '닫기 ×'}
        </button>
      </div>
    </div>
  )
}
