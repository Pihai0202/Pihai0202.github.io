import { useMemo } from 'react'
import { marked } from 'marked'
import type { Concert, ConcertMedia } from '../types'
import { ShareMenu } from './ShareMenu'
import { parseSpotifyEmbedUrl } from '../App'
import { CalendarIcon, PinIcon, TicketIcon } from './SvgIcon'
import { SafeIframe } from './SafeIframe'

interface SpotifyEmbedProps {
  url: string
}

export function SpotifyEmbed({ url }: SpotifyEmbedProps) {
  const embedUrl = parseSpotifyEmbedUrl(url)
  if (!embedUrl) return null

  const height = url.includes('/track/') || url.includes('/episode/') ? 152 : 352

  return (
    <>
      <div className="detail-spotify">
        <SafeIframe
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

interface ConcertDetailProps {
  concert: Concert
  onOpenLightbox: (mediaIndex: number) => void
  onPublishToBoard: () => void
  onEditConcert: (concert: Concert) => void
  onDeleteConcert: (id: string) => void
  lang?: string
}

export function ConcertDetail({
  concert,
  onOpenLightbox,
  onPublishToBoard,
  onEditConcert,
  onDeleteConcert,
  lang = 'zh-TW',
}: ConcertDetailProps) {
  const renderedHtml = useMemo(() => {
    if (!concert.notes) return ''
    try {
      return marked.parse(concert.notes) as string
    } catch (err) {
      console.error('Markdown parse error:', err)
      return concert.notes
    }
  }, [concert.notes])

  return (
    <>
      <div className="concert-detail-header">
        <div className="detail-artist">{concert.artist}</div>
        <div className="detail-meta">
          {concert.date && <span className="detail-tag tag-date"><CalendarIcon style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {concert.date}</span>}
          <span className="detail-tag tag-venue"><PinIcon style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {concert.venueName}</span>
          {concert.seat && <span className="detail-tag tag-seat"><TicketIcon style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {concert.seat}</span>}
        </div>
        {concert.concertName && <div className="detail-concert-name">{concert.concertName}</div>}
      </div>

      {concert.spotifyUrl && <SpotifyEmbed url={concert.spotifyUrl} />}

      {concert.notes && (
        <div className="detail-notes-section">
          <div className="notes-header-row">
            <div className="section-title" style={{ paddingLeft: 0 }}>— 觀後心得 —</div>
            <ShareMenu concert={concert} onPublishToBoard={onPublishToBoard} />
          </div>
          <div
            className="detail-notes markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      )}

      {concert.media && concert.media.length > 0 && (
        <>
          <div className="section-title">— 照片 / 影片 —</div>
          <div className="media-gallery">
            {(concert.media || []).map((item: ConcertMedia, index: number) => (
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

      <div className="detail-actions-row">
        <button
          className="detail-action-btn detail-edit-btn"
          type="button"
          onClick={() => onEditConcert(concert)}
        >
          {lang === 'zh-TW' ? '編輯記錄' : 'Edit Log'}
        </button>
        <button
          className="detail-action-btn detail-delete-btn"
          type="button"
          onClick={() => onDeleteConcert(concert.id)}
        >
          {lang === 'zh-TW' ? '刪除記錄' : 'Delete Log'}
        </button>
      </div>
    </>
  )
}
