/**
 * Seed historical/archived events to Firestore using Firebase Web SDK
 * Run: node scripts/seed-archived-events.mjs
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, writeBatch, getDocs, limit, query } from 'firebase/firestore'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

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

async function seedArchivedEvents() {
  const jsonPath = join(projectRoot, 'public', 'historical-events.json')
  if (!existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}. Run extract-historical-events.mjs first!`)
    process.exit(1)
  }

  const raw = readFileSync(jsonPath, 'utf-8')
  const data = JSON.parse(raw)
  let events = data.events || []

  // Check arguments for --limit or --all
  const args = process.argv.slice(2)
  const isAll = args.includes('--all')
  const limitArgIndex = args.indexOf('--limit')
  let limitCount = isAll ? events.length : 500
  if (limitArgIndex !== -1 && args[limitArgIndex + 1]) {
    limitCount = parseInt(args[limitArgIndex + 1], 10) || 500
  }

  events = events.slice(0, limitCount)
  console.log(`📦 Loaded ${events.length} historical events to seed (limit: ${limitCount}, isAll: ${isAll}).`)

  if (events.length === 0) {
    console.log('No events to seed.')
    return
  }

  console.log('🚀 Seeding historical events to Firestore `archived_events` collection...')

  // Firestore writeBatch max is 500 operations
  const BATCH_SIZE = 400
  let totalBatches = Math.ceil(events.length / BATCH_SIZE)

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const chunk = events.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const ev of chunk) {
      // Use clean doc ID (replace slashes or invalid characters if any)
      const docId = String(ev.id || `${ev.source || 'ev'}-${ev.date}-${ev.name}`).replace(/[\/\s#?]+/g, '-')
      const docRef = doc(db, 'archived_events', docId)

      // Ensure minimal clean payload
      const payload = {
        id: docId,
        original_id: ev.id || '',
        name: ev.name || '',
        artist: ev.artist || '',
        venue_id: ev.venue_id || null,
        venue_name: ev.venue_name || null,
        city: ev.city || '',
        date: ev.date || '',
        category: ev.category || 'music',
        image: ev.image || '',
        source: ev.source || '',
        url: ev.url || '',
        archived_at: new Date().toISOString(),
      }

      batch.set(docRef, payload, { merge: true })
    }

    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    process.stdout.write(`  Writing batch ${batchIndex}/${totalBatches}... `)
    await batch.commit()
    console.log('✅ Done')
  }

  console.log(`\n🎉 Successfully seeded ${events.length} historical events into Firestore \`archived_events\`!`)
  process.exit(0)
}

seedArchivedEvents().catch((err) => {
  console.error('❌ Failed to seed archived events:', err)
  process.exit(1)
})
