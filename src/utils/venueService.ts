import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { VENUES as STATIC_VENUES } from '../constants/venues'
import type { Venue } from '../types'

const COLLECTION_NAME = 'venues'
const CACHE_KEY = 'tw_cached_venues_v1'

/**
 * 取得初始場館資料（優先讀取本機快取，若無則回傳靜態預設資料）
 */
export function getInitialVenues(): Venue[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Venue[]
      }
    }
  } catch (e) {
    console.warn('Failed to read cached venues from localStorage:', e)
  }
  return STATIC_VENUES
}

/**
 * 將場館資料存入本機快取
 */
export function saveVenuesToLocalCache(venues: Venue[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(venues))
  } catch (e) {
    console.warn('Failed to save venues to localStorage:', e)
  }
}

/**
 * 將 38 個預設場館批次寫入 Firestore (若 Firestore 內無任何場館時自動執行)
 */
export async function seedDefaultVenuesToFirestore(): Promise<void> {
  try {
    const batch = writeBatch(db)
    STATIC_VENUES.forEach((venue) => {
      const docRef = doc(db, COLLECTION_NAME, venue.id)
      batch.set(docRef, venue, { merge: true })
    })
    await batch.commit()
    console.log(`[VenueService] Successfully seeded ${STATIC_VENUES.length} default venues to Firestore.`)
  } catch (err) {
    console.error('[VenueService] Failed to seed default venues to Firestore:', err)
  }
}

/**
 * 從 Firebase Firestore 載入所有場館
 * 若資料庫為空，會自動進行一鍵初始寫入 (Seed)
 */
export async function fetchVenuesFromFirestore(): Promise<Venue[]> {
  try {
    const colRef = collection(db, COLLECTION_NAME)
    const snapshot = await getDocs(colRef)

    if (snapshot.empty) {
      console.log('[VenueService] Firestore venues collection is empty. Auto-seeding initial venues...')
      await seedDefaultVenuesToFirestore()
      saveVenuesToLocalCache(STATIC_VENUES)
      return STATIC_VENUES
    }

    const fetchedVenues: Venue[] = []
    snapshot.forEach((docSnap) => {
      const data = docSnap.data()
      fetchedVenues.push({
        id: docSnap.id,
        name: data.name || '',
        city: data.city || '',
        capacity: String(data.capacity || ''),
        x: typeof data.x === 'number' ? data.x : 0,
        y: typeof data.y === 'number' ? data.y : 0,
        address: data.address || '',
        transit: data.transit || '',
        latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
        longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
      })
    })

    // 依原始清單順序排序（若有在 STATIC_VENUES 內的保持原本順序，新加入的排在後面）
    const staticIdOrder = new Map(STATIC_VENUES.map((v, i) => [v.id, i]))
    fetchedVenues.sort((a, b) => {
      const orderA = staticIdOrder.has(a.id) ? staticIdOrder.get(a.id)! : 999
      const orderB = staticIdOrder.has(b.id) ? staticIdOrder.get(b.id)! : 999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name, 'zh-Hant')
    })

    saveVenuesToLocalCache(fetchedVenues)
    return fetchedVenues
  } catch (err) {
    console.warn('[VenueService] Failed to fetch venues from Firestore, falling back to cache/static:', err)
    return getInitialVenues()
  }
}
