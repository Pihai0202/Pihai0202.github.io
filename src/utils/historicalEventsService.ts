import { collection, getDocs, limit as firestoreLimit, query as firestoreQuery } from 'firebase/firestore'
import { db } from '../firebase'
import type { HistoricalEvent, HistoricalEventPayload } from '../types'

let inMemoryEvents: HistoricalEvent[] | null = null
let loadPromise: Promise<HistoricalEvent[]> | null = null

/**
 * Fetch historical events from Firestore or fallback to historical-events.json
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

    // 1. Try Firestore `archived_events` collection first if online
    try {
      const q = firestoreQuery(collection(db, 'archived_events'), firestoreLimit(500))
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
      // If Firestore rules deny or offline, fallback smoothly
    }

    // 2. If Firestore had few/no events or in local environment, load from historical-events.json
    if (events.length === 0) {
      try {
        let res: Response | null = null
        if (import.meta.env.DEV) {
          res = await fetch(`/historical-events.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
        }
        if (!res || !res.ok) {
          res = await fetch(
            `https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/historical-events.json?t=${Date.now()}`,
            { cache: 'no-store' }
          ).catch(() => null)
        }
        if (!res || !res.ok) {
          res = await fetch(`/historical-events.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
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
    }

    inMemoryEvents = events
    loadPromise = null
    return inMemoryEvents
  })()

  return loadPromise
}

export interface HistoricalSearchFilter {
  query?: string
  year?: string
  category?: string
  city?: string
  limit?: number
}

/**
 * Fast search and filter on historical events
 */
export async function searchHistoricalEvents(
  filter: HistoricalSearchFilter = {}
): Promise<{ totalMatches: number; events: HistoricalEvent[] }> {
  const all = await getHistoricalEvents()
  const { query = '', year = 'all', category = 'all', city = 'all', limit = 40 } = filter

  const queryTerms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const filtered = all.filter((ev) => {
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

    // 4. Query terms matching
    if (queryTerms.length > 0) {
      const name = (ev.name || '').toLowerCase()
      const artist = (ev.artist || '').toLowerCase()
      const venue = (ev.venue_name || '').toLowerCase()
      const evCity = (ev.city || '').toLowerCase()
      const source = (ev.source || '').toLowerCase()

      const matchesAllTerms = queryTerms.every((term) => {
        return (
          name.includes(term) ||
          artist.includes(term) ||
          venue.includes(term) ||
          evCity.includes(term) ||
          source.includes(term)
        )
      })

      if (!matchesAllTerms) return false
    }

    return true
  })

  return {
    totalMatches: filtered.length,
    events: filtered.slice(0, limit),
  }
}
