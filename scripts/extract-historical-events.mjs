import { execSync } from 'child_process'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🔍 Fetching git commit history for public/concerts.json...')

let commits = []
try {
  commits = execSync('git log --format=%H -- public/concerts.json', {
    cwd: projectRoot,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(Boolean)
} catch (e) {
  console.error('Failed to get git log:', e)
  process.exit(1)
}

console.log(`Found ${commits.length} commits.`)

const outputPath = join(projectRoot, 'public', 'historical-events.json')
const eventsMap = new Map()
const today = new Date().toISOString().slice(0, 10)

const args = process.argv.slice(2)
const isDeep = args.includes('--deep')

if (existsSync(outputPath) && !isDeep) {
  console.log('⚡ Existing historical-events.json found. Loading existing data...')
  try {
    const existingData = JSON.parse(readFileSync(outputPath, 'utf-8'))
    if (Array.isArray(existingData.events)) {
      for (const ev of existingData.events) {
        if (ev && ev.id) eventsMap.set(ev.id, ev)
      }
      console.log(`Loaded ${eventsMap.size} existing events.`)
    }
  } catch (err) {
    console.warn('Failed to parse existing historical-events.json:', err)
  }
}

if (eventsMap.size === 0 || isDeep) {
  // Sample commits to be fast while getting dense coverage:
  const selectedCommitSet = new Set()
  for (let i = 0; i < commits.length; i += 5) {
    selectedCommitSet.add(commits[i])
  }
  for (let i = 0; i < Math.min(20, commits.length); i++) {
    selectedCommitSet.add(commits[i])
  }
  for (let i = Math.max(0, commits.length - 20); i < commits.length; i++) {
    selectedCommitSet.add(commits[i])
  }

  const sampledCommits = Array.from(selectedCommitSet)
  console.log(`Sampling ${sampledCommits.length} commits across the repository history...`)

  let processedCount = 0
  for (const commit of sampledCommits) {
  try {
    const raw = execSync(`git show ${commit}:public/concerts.json`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 25 * 1024 * 1024,
    })
    const data = JSON.parse(raw)
    if (data && Array.isArray(data.events)) {
      for (const ev of data.events) {
        if (!ev || !ev.id || !ev.name || !ev.date) continue
        // If the event happened in the past (date < today)
        if (ev.date < today) {
          // Keep the best version (if already exists, keep the one with image/venue if missing)
          if (!eventsMap.has(ev.id)) {
            eventsMap.set(ev.id, ev)
          } else {
            const existing = eventsMap.get(ev.id)
            if (!existing.image && ev.image) existing.image = ev.image
            if (!existing.venue_name && ev.venue_name) existing.venue_name = ev.venue_name
            if (!existing.city && ev.city) existing.city = ev.city
          }
        }
      }
    }
  } catch (err) {
    // some commits might not have valid JSON or other errors
  }
  processedCount++
  if (processedCount % 50 === 0 || processedCount === sampledCommits.length) {
    console.log(`Progress: ${processedCount}/${sampledCommits.length} commits processed... (Found ${eventsMap.size} past events so far)`)
  }
}

// Also check current public/concerts.json for any past events
try {
  const currentConcertsPath = join(projectRoot, 'public', 'concerts.json')
  if (existsSync(currentConcertsPath)) {
    const currData = JSON.parse(readFileSync(currentConcertsPath, 'utf-8'))
    if (currData && Array.isArray(currData.events)) {
      for (const ev of currData.events) {
        if (ev && ev.id && ev.name && ev.date && ev.date < today) {
          if (!eventsMap.has(ev.id)) {
            eventsMap.set(ev.id, ev)
          }
        }
      }
    }
  }
} catch (e) {
  console.warn('Could not read current concerts.json:', e)
}
}

const ICONIC_LANDMARKS = [
  // 周杰倫
  { id: 'jay-chou-carnival-2024-12-05', name: '周杰倫「嘉年華」世界巡迴演唱會', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-06', name: '周杰倫「嘉年華」世界巡迴演唱會', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-06', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-07', name: '周杰倫「嘉年華」世界巡迴演唱會', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-08', name: '周杰倫「嘉年華」世界巡迴演唱會', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  // 張惠妹
  { id: 'amei-asmr-2024-12-21', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹 aMEI', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-21', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-22', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹 aMEI', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-22', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-28', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹 aMEI', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-28', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-29', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹 aMEI', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-31', name: 'ASMR Maxxx @ Taipei Dome 跨年世界巡迴演唱會', artist: '張惠妹 aMEI', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  // 告五人
  { id: 'accusefive-arena-2023-04-08', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】台北小巨蛋', artist: '告五人 Accusefive', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-arena-2023-04-09', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】台北小巨蛋', artist: '告五人 Accusefive', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-kh-2023-07-29', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】高雄巨蛋', artist: '告五人 Accusefive', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-07-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-yilan-2024-03-16', name: '告五人 [宇宙超有趣] 2024 SUPER LIVE TOUR 宜蘭家場', artist: '告五人 Accusefive', venue_id: null, venue_name: '宜蘭運動公園複合劇場', city: '宜蘭', date: '2024-03-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_afive_762cb058e5746761ebf7c00e62d47ea5.jpg', source: '拓元售票' },
  { id: 'accusefive-yilan-2024-03-17', name: '告五人 [宇宙超有趣] 2024 SUPER LIVE TOUR 宜蘭家場', artist: '告五人 Accusefive', venue_id: null, venue_name: '宜蘭運動公園複合劇場', city: '宜蘭', date: '2024-03-17', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_afive_762cb058e5746761ebf7c00e62d47ea5.jpg', source: '拓元售票' },
  // 蔡依林
  { id: 'jolin-ugly-beauty-2023-01-08', name: '蔡依林 Ugly Beauty 2023 世界巡迴演唱會 FINALE 台北最終場', artist: '蔡依林 Jolin Tsai', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  // 宇多田光
  { id: 'utada-hikaru-2024-08-10', name: 'HIKARU UTADA SCIENCE FICTION TOUR 2024 台北小巨蛋', artist: '宇多田光 Hikaru Utada', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-10', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240412152815_utada.jpg', source: '遠大售票' },
  { id: 'utada-hikaru-2024-08-11', name: 'HIKARU UTADA SCIENCE FICTION TOUR 2024 台北小巨蛋', artist: '宇多田光 Hikaru Utada', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-11', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240412152815_utada.jpg', source: '遠大售票' },
  // Bruno Mars
  { id: 'bruno-mars-kh-2024-09-07', name: 'Bruno Mars Live in Kaohsiung 火星人布魯諾 高雄演唱會', artist: 'Bruno Mars', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-09-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_brunomars_d09fb8bfa2e405f6e5e8e8ce7d995371.jpg', source: '拓元售票' },
  { id: 'bruno-mars-kh-2024-09-08', name: 'Bruno Mars Live in Kaohsiung 火星人布魯諾 高雄演唱會', artist: 'Bruno Mars', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-09-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_brunomars_d09fb8bfa2e405f6e5e8e8ce7d995371.jpg', source: '拓元售票' },
  // Coldplay
  { id: 'coldplay-kh-2023-11-11', name: 'Coldplay: Music of the Spheres World Tour 高雄演唱會', artist: 'Coldplay 酷玩樂團', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-11-11', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_coldplay_7fbb5c645bc8ba36ee8b0ae49a71a396.jpg', source: '拓元售票' },
  { id: 'coldplay-kh-2023-11-12', name: 'Coldplay: Music of the Spheres World Tour 高雄演唱會', artist: 'Coldplay 酷玩樂團', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-11-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_coldplay_7fbb5c645bc8ba36ee8b0ae49a71a396.jpg', source: '拓元售票' },
  // Ed Sheeran
  { id: 'ed-sheeran-kh-2024-02-03', name: 'Ed Sheeran ＋－＝÷ × 2024 TOUR 高雄國家體育場', artist: 'Ed Sheeran 紅髮艾德', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-02-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_edsheeran_7a5ee0a8276f7f2b6e15dcbaf5a999db.jpg', source: '拓元售票' },
  // BLACKPINK
  { id: 'blackpink-kh-2023-03-18', name: 'BLACKPINK WORLD TOUR [BORN PINK] KAOHSIUNG', artist: 'BLACKPINK', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-18', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_blackpink_241f874bc0505b38a05c19799da0da81.jpg', source: '拓元售票' },
  { id: 'blackpink-kh-2023-03-19', name: 'BLACKPINK WORLD TOUR [BORN PINK] KAOHSIUNG', artist: 'BLACKPINK', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-19', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_blackpink_241f874bc0505b38a05c19799da0da81.jpg', source: '拓元售票' },
  // IU
  { id: 'iu-her-2024-04-06', name: '2024 IU H.E.R. WORLD TOUR CONCERT IN TAIPEI', artist: 'IU 李知恩', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-04-06', category: 'music', image: 'https://kktix.com/files/events/iu-her-2024/cover.jpg', source: 'KKTIX' },
  { id: 'iu-her-2024-04-07', name: '2024 IU H.E.R. WORLD TOUR CONCERT IN TAIPEI', artist: 'IU 李知恩', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-04-07', category: 'music', image: 'https://kktix.com/files/events/iu-her-2024/cover.jpg', source: 'KKTIX' },
  // 棒球 12強賽
  { id: 'wbsc-p12-2024-11-13', name: '2024 WBSC 第3屆世界12強棒球錦標賽：中華台北 vs 韓國', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-13', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-14', name: '2024 WBSC 第3屆世界12強棒球錦標賽：中華台北 vs 多明尼加', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-14', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-16', name: '2024 WBSC 第3屆世界12強棒球錦標賽：日本 vs 中華台北', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-16', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-17', name: '2024 WBSC 第3屆世界12強棒球錦標賽：澳洲 vs 中華台北', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-17', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-18', name: '2024 WBSC 第3屆世界12強棒球錦標賽：古巴 vs 中華台北', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-18', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  // 陶喆
  { id: 'david-tao-2024-11-09', name: '陶喆 Soul Power II 世界巡迴演唱會 台北站', artist: '陶喆 David Tao', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_davidtao_417ee9bf89e7c5b651586a3d6d5ebbf2.jpg', source: 'KKTIX' },
  { id: 'david-tao-2024-11-10', name: '陶喆 Soul Power II 世界巡迴演唱會 台北站', artist: '陶喆 David Tao', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-10', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_davidtao_417ee9bf89e7c5b651586a3d6d5ebbf2.jpg', source: 'KKTIX' },
  // 劉德華
  { id: 'andy-lau-2024-10-31', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北站', artist: '劉德華 Andy Lau', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-31', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-01', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北站', artist: '劉德華 Andy Lau', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-01', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-02', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北站', artist: '劉德華 Andy Lau', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-02', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-03', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北站', artist: '劉德華 Andy Lau', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-03', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
]

for (const landmark of ICONIC_LANDMARKS) {
  eventsMap.set(landmark.id, landmark)
}

// Convert map to sorted list
const allPastEvents = Array.from(eventsMap.values()).map((ev) => {
  // Clean up and standardize properties
  return {
    id: ev.id,
    name: ev.name,
    artist: ev.artist || '',
    venue_id: ev.venue_id || null,
    venue_name: ev.venue_name || ev.venue_raw || null,
    city: ev.city || '',
    date: ev.date,
    category: ev.category || 'music',
    image: ev.image || '',
    source: ev.source || '',
    url: ev.url || '',
    price: ev.price || '',
  }
})

// Sort descending by date (most recent past events first)
allPastEvents.sort((a, b) => b.date.localeCompare(a.date))

console.log(`\n🎉 Total unique past events extracted: ${allPastEvents.length}`)
console.log('Earliest past event date:', allPastEvents[allPastEvents.length - 1]?.date)
console.log('Most recent past event date:', allPastEvents[0]?.date)

// Save to public/historical-events.json
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      updated_at: new Date().toISOString(),
      count: allPastEvents.length,
      events: allPastEvents,
    },
    null,
    2
  ),
  'utf-8'
)

console.log(`💾 Saved to ${outputPath}`)
