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
  coverUrl?: string
  media: ConcertMedia[]
  createdAt: string
}

export type TicketLink = {
  platform: string
  name: string
  url: string
}

export type GamePitcherBox = {
  order?: number
  playerNumber?: string
  playerName?: string
  IPOuts?: number
  NP?: number
  BF?: number
  H?: number
  HR?: number
  BB?: number
  SO?: number
  R?: number
  ER?: number
}

export type GameBatterBox = {
  order?: number
  playerNumber?: string
  playerName?: string
  pos?: string
  PA?: number
  AB?: number
  R?: number
  H?: number
  RBI?: number
  HR?: number
  BB?: number
  SO?: number
}

export type GameScore = {
  visiting_team?: string
  home_team?: string
  visiting_score?: number | string
  home_score?: number | string
  visiting_scores?: string[]  // 每局得分 (如 ["3", "0", "0", "0", ...])
  home_scores?: string[]      // 每局得分 (如 ["0", "0", "1", "1", ...])
  visiting_hits?: number      // 客隊安打數 H
  home_hits?: number          // 主隊安打數 H
  visiting_errors?: number    // 客隊失誤數 E
  home_errors?: number        // 主隊失誤數 E
  visiting_pitcher?: string
  home_pitcher?: string
  status?: 'scheduled' | 'live' | 'finished' | 'postponed'
  status_text?: string
  mvp?: string
  winning_pitcher?: string
  losing_pitcher?: string
  closer?: string
  awayPitcherBox?: GamePitcherBox[]
  homePitcherBox?: GamePitcherBox[]
  awayBatterBox?: GameBatterBox[]
  homeBatterBox?: GameBatterBox[]
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
  category?: string
  game_score?: GameScore
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
  coverUrl?: string
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
  hidden?: boolean
  status?: string
}

export interface SuspensionItem {
  city: string
  status: string
}

export interface SuspensionInfo {
  updateTime: string
  items: SuspensionItem[]
}

