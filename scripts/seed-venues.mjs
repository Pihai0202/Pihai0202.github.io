/**
 * Seed venues to Firestore using Firebase Web SDK (v9 modular)
 * Run: node scripts/seed-venues.mjs
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, writeBatch, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCvf5JUMIF_EpkZjAdm10ajlgwEafW3E10',
  authDomain: 'concert-c399d.firebaseapp.com',
  projectId: 'concert-c399d',
  storageBucket: 'concert-c399d.firebasestorage.app',
  messagingSenderId: '1033610614230',
  appId: '1:1033610614230:web:86c8759ebd033e12dd0077',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const VENUES = [
  { id: 'taipei-dome', name: '臺北大巨蛋', city: '台北', capacity: '40,000', x: 242, y: 174, address: '台北市信義區忠孝東路四段515號', transit: '捷運板南線「國父紀念館站」5 號出口直達', latitude: 25.0440, longitude: 121.5606 },
  { id: 'taipei-arena', name: '臺北小巨蛋', city: '台北', capacity: '10,000', x: 252, y: 146, address: '台北市松山區南京東路四段2號', transit: '捷運松山新店線「台北小巨蛋站」2 號出口直達', latitude: 25.0510, longitude: 121.5502 },
  { id: 'nangang', name: '南港展覽館 1 館', city: '台北', capacity: '30,000', x: 290, y: 175, address: '台北市南港區經貿二路1號', transit: '捷運板南線/文湖線「南港展覽館站」1 號/2 號出口即達', latitude: 25.0569, longitude: 121.6189 },
  { id: 'taipei-music-center', name: '台北流行音樂中心', city: '台北', capacity: '5,000', x: 268, y: 182, address: '台北市南港區市民大道八段99號', transit: '捷運板南線「昆陽站」4 號出口步行約 8 分鐘，或「南港站」1A 出口步行約 8 分鐘', latitude: 25.0483, longitude: 121.5977 },
]

// Read full venue list from the source file
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const venueFileContent = readFileSync(join(__dirname, '..', 'src', 'constants', 'venues.ts'), 'utf-8')

// Parse all venues from the TS file
function parseVenues(content) {
  const venues = []
  // Match each venue object block
  const objectRegex = /\{[^}]*id:\s*'([^']+)'[^}]*\}/gs
  let match
  while ((match = objectRegex.exec(content)) !== null) {
    const block = match[0]
    const get = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*'([^']*)'`))
      return m ? m[1] : ''
    }
    const getNum = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*([\\d.]+)`))
      return m ? parseFloat(m[1]) : undefined
    }
    venues.push({
      id: get('id'),
      name: get('name'),
      city: get('city'),
      capacity: get('capacity'),
      x: getNum('x') || 0,
      y: getNum('y') || 0,
      address: get('address'),
      transit: get('transit'),
      latitude: getNum('latitude'),
      longitude: getNum('longitude'),
    })
  }
  return venues
}

const allVenues = parseVenues(venueFileContent)
console.log(`Parsed ${allVenues.length} venues from venues.ts`)

async function seed() {
  // Check if already seeded
  const colRef = collection(db, 'venues')
  const snapshot = await getDocs(colRef)
  
  if (!snapshot.empty) {
    console.log(`Firestore already has ${snapshot.size} venues. Overwriting...`)
  }

  // Firestore writeBatch supports max 500 operations per batch
  const batch = writeBatch(db)
  for (const venue of allVenues) {
    const docRef = doc(db, 'venues', venue.id)
    batch.set(docRef, venue, { merge: true })
  }
  
  await batch.commit()
  console.log(`✅ Successfully seeded ${allVenues.length} venues to Firestore!`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Failed to seed venues:', err)
  process.exit(1)
})
