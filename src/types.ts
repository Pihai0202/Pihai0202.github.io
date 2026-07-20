export type Venue = {
  id: string
  name: string
  city: string
  capacity: string
  x: number
  y: number
  address?: string
  transit?: string
  latitude?: number
  longitude?: number
}

export type ConcertMedia = {
  id?: string
  name: string
  dataUrl: string
  type: string
  isUploading?: boolean
}

export type Concert = {
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

export type TicketLink = {
  platform: string
  name: string
  url: string
}

export type RemoteConcert = {
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

export type RemoteConcertPayload = {
  updated_at?: string
  count?: number
  sources?: string[]
  events?: RemoteConcert[]
}

export type ConcertForm = {
  artist: string
  concertName: string
  date: string
  seat: string
  notes: string
  spotifyUrl: string
}

export type SpotifyItem = {
  type: 'artist' | 'album' | 'track'
  id: string
  name: string
  sub: string
  img?: string
  url: string
}

export type SharedNote = {
  id: string
  artist: string
  concertName: string
  venueName: string
  venueCity: string
  date: string
  author: string
  notes: string
  likes: number
  createdAt: string
}

export interface SuspensionItem {
  city: string
  status: string
}

export interface SuspensionInfo {
  updateTime: string
  items: SuspensionItem[]
}

