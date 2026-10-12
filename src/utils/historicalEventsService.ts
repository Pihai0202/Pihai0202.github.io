import { collection, getDocs, limit as firestoreLimit, query as firestoreQuery, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { HistoricalEvent, HistoricalEventPayload } from '../types'

let inMemoryEvents: HistoricalEvent[] | null = null
let loadPromise: Promise<HistoricalEvent[]> | null = null

/**
 * Fetch historical events with smart fallback (local / static json)
 */
export async function getHistoricalEvents(): Promise<HistoricalEvent[]> {
  if (inMemoryEvents && inMemoryEvents.length > 0) {
    return inMemoryEvents
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = (async () => {
    let events: HistoricalEvent[] = []

    // 1. Load from historical-events.json (fast, zero quota consumption)
    try {
      const baseUrl = import.meta.env.BASE_URL || '/'
      const localUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}historical-events.json?t=${Date.now()}`
      let res = await fetch(localUrl, { cache: 'no-store' }).catch(() => null)
      if (!res || !res.ok) {
        res = await fetch(`/historical-events.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
      }
      if (!res || !res.ok) {
        res = await fetch(
          `https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/historical-events.json?t=${Date.now()}`,
          { cache: 'no-store' }
        ).catch(() => null)
      }
      if (res && res.ok) {
        const json = (await res.json()) as HistoricalEventPayload
        if (Array.isArray(json.events)) {
          events = json.events
        }
      }
    } catch (e) {
      console.warn('Failed to load historical-events.json:', e)
    }

    // 2. If static JSON fails, fallback to Firestore `archived_events`
    if (events.length === 0) {
      try {
        const q = firestoreQuery(collection(db, 'archived_events'), firestoreLimit(100))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const firestoreList: HistoricalEvent[] = []
          snapshot.forEach((doc) => {
            const data = doc.data() as HistoricalEvent
            firestoreList.push({
              ...data,
              id: data.id || doc.id,
            })
          })
          if (firestoreList.length > 0) {
            events = firestoreList
          }
        }
      } catch {
        // Fallback silently if offline
      }
    }

    inMemoryEvents = events
    loadPromise = null
    return inMemoryEvents
  })()

  return loadPromise
}

/**
 * Query Firestore archived_events on-demand by keyword / artist
 */
export async function searchFirestoreArchivedEvents(keyword: string, limitCount = 10): Promise<HistoricalEvent[]> {
  const term = keyword.trim().toLowerCase()
  if (!term || term.length < 2) return []

  try {
    const q = firestoreQuery(
      collection(db, 'archived_events'),
      where('artist_keywords', 'array-contains', term),
      firestoreLimit(limitCount)
    )
    const snapshot = await getDocs(q)
    const list: HistoricalEvent[] = []
    snapshot.forEach((doc) => {
      const data = doc.data() as HistoricalEvent
      list.push({
        ...data,
        id: data.id || doc.id,
      })
    })
    return list
  } catch (err) {
    return []
  }
}

export interface HistoricalSearchFilter {
  query?: string
  artist?: string
  year?: string
  category?: string
  city?: string
  limit?: number
}

/**
 * Fast search and filter on historical events with high precision artist matching
 */
export async function searchHistoricalEvents(
  filter: HistoricalSearchFilter = {}
): Promise<{ totalMatches: number; events: HistoricalEvent[] }> {
  const all = await getHistoricalEvents()
  const { query = '', artist = '', year = 'all', category = 'all', city = 'all', limit = 40 } = filter

  const queryTerms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const targetArtist = artist.toLowerCase().trim()

  const filtered = all.filter((ev) => {
    // 0. Exclude any potential shuttle bus
    const name = ev.name || ''
    const venue = ev.venue_name || ''
    if (name.includes('專車') || name.includes('接駁') || venue.includes('專車') || venue.includes('搭車點')) {
      return false
    }

    // 1. Year filter
    if (year !== 'all' && ev.date) {
      if (!ev.date.startsWith(year)) {
        return false
      }
    }

    // 2. Category filter
    if (category !== 'all') {
      const cat = ev.category || 'music'
      if (category === 'sport' && cat !== 'sport' && ev.source !== '中華職棒') return false
      if (category === 'music' && cat === 'sport') return false
    }

    // 3. City filter
    if (city !== 'all') {
      const c = ev.city || ''
      if (!c.includes(city) && !city.includes(c)) return false
    }

    // 4. Specific Artist filter
    if (targetArtist) {
      const evArtist = (ev.artist || '').toLowerCase()
      const evKeywords = ev.artist_keywords || []
      const evName = name.toLowerCase()

      const matchArtist =
        (evArtist.length > 0 && (evArtist.includes(targetArtist) || targetArtist.includes(evArtist))) ||
        evKeywords.some((k) => k && k.trim().length >= 2 && (k.toLowerCase().includes(targetArtist) || targetArtist.includes(k.toLowerCase()))) ||
        evName.includes(targetArtist)

      if (!matchArtist) return false
    }

    // 5. Query terms matching (searches name, artist, venue, city, keywords)
    if (queryTerms.length > 0) {
      const evArtist = (ev.artist || '').toLowerCase()
      const evKeywords = (ev.artist_keywords || []).join(' ')
      const evVenue = (ev.venue_name || '').toLowerCase()
      const evCity = (ev.city || '').toLowerCase()
      const evSource = (ev.source || '').toLowerCase()
      const evName = name.toLowerCase()

      const matchesAllTerms = queryTerms.every((term) => {
        return (
          evName.includes(term) ||
          evArtist.includes(term) ||
          evKeywords.includes(term) ||
          evVenue.includes(term) ||
          evCity.includes(term) ||
          evSource.includes(term)
        )
      })

      if (!matchesAllTerms) return false
    }

    return true
  })

  // Prioritize exact artist match at the top if artist or query given
  if (targetArtist || query.trim()) {
    const qLower = (targetArtist || query).toLowerCase().trim()
    filtered.sort((a, b) => {
      const aExact = (a.artist || '').toLowerCase() === qLower ? 1 : 0
      const bExact = (b.artist || '').toLowerCase() === qLower ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      return b.date.localeCompare(a.date)
    })
  } else {
    filtered.sort((a, b) => b.date.localeCompare(a.date))
  }

  // Deduplicate on-the-fly to ensure diverse dates and zero redundant ticket-zone rows
  const seenDateKey = new Set<string>()
  const distinctEvents: HistoricalEvent[] = []
  for (const ev of filtered) {
    const sessionTag = /午場|早安場|下午場|晚安場/.test(ev.name)
      ? (ev.name.match(/午場|早安場|下午場|晚安場/)?.[0] || '')
      : ''
    let normVenue = (ev.venue_name || ev.city || '').replace(/臺/g, '台').toLowerCase().replace(/[\s\-_]+/g, '')
    if (normVenue === '小巨蛋' || normVenue.includes('台北小巨蛋')) {
      normVenue = '台北小巨蛋'
    } else if (normVenue === '大巨蛋' || normVenue.includes('台北大巨蛋')) {
      normVenue = '台北大巨蛋'
    } else if (normVenue.includes('世運') || normVenue.includes('國家體育場')) {
      normVenue = '高雄國家體育場'
    } else if (normVenue.includes('高雄巨蛋')) {
      normVenue = '高雄巨蛋'
    }
    const key = `${ev.date}|${(ev.artist || '').toLowerCase()}|${normVenue}|${sessionTag}`
    if (!seenDateKey.has(key)) {
      seenDateKey.add(key)
      distinctEvents.push(ev)
    }
  }

  return {
    totalMatches: distinctEvents.length,
    events: distinctEvents.slice(0, limit),
  }
}

