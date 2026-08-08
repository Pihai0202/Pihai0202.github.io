import type { RemoteConcert } from '../types'

const EXCLUDE_KEYWORDS = [
  '展覽', '特展', '快閃店', 'POP-UP', 'POP UP', '博覽會', '畫展', '攝影展', '藝術展', '博物館', '美術館',
  '喜劇', '脫口秀', '漫才', '相聲', '短劇', '搞笑', '喜劇演員', 'COMEDY', 'STAND-UP', 'STAND UP', '脫口',
  '舞台劇', '戲劇', '劇團', '劇院', '音樂劇', '話劇', '歌舞劇', '舞劇', '芭蕾', '舞蹈', '舞團', '兒童劇', '巧虎', '佩佩豬', '劇本殺', '馬戲團',
  '演講', '講座', '工作坊', '研討會', '說明會', 'MEETUP', 'COSCUP', 'DEVFEST', 'PYCON', 'JSCONF', 'WELCOME-PARTY', 'RELAUNCH PARTY', 'BIRTHDAY CAFE', '生日應援', '應援咖啡',
  '電影', '試映會', '特映會', '影展', '紀錄片', '電影院',
  '羽球', '籃球', '足球', '桌球', '排球', '路跑', '馬拉松', '賽車', 'F1', '電競', 'LCP ', 'PCS ', '傳說對決', '英雄聯盟', '賽事票房', '排球賽'
]

const ALLOW_KEYWORDS = [
  '演唱會', '音樂會', '見面會', '簽售', '簽名會', '簽頁會', '棒球', '職棒', 'CPBL', '例行賽', '總冠軍賽', '季後賽', '明星賽',
  'LIVE', 'CONCERT', 'TOUR', 'FAN MEETING', 'FANMEETING', 'FAN-MEETING', '巡迴', '巡演', '專場', '音樂祭', '音樂節', '祭典', '聽歌會', '發表會', '影音會', 'DJ', 'PARTY', '派對', '樂團', 'BAND', 'ACOUSTIC', 'LIVEHOUSE', 'LIVE HOUSE', '演奏'
]

/**
 * Filter event to ensure it belongs to:
 * - 演唱會 (Concerts)
 * - 見面會 (Fan Meetings)
 * - 簽售 / 簽名會 (Fan Signs)
 * - 棒球賽 (Baseball Games)
 */
export function isTargetEventCategory(event: Partial<RemoteConcert>): boolean {
  const name = (event.name || '').toUpperCase()
  const source = (event.source || '').toUpperCase()
  const venue = (event.venue_name || event.venue_raw || '').toUpperCase()

  // 1. CPBL / Baseball is always allowed
  if (
    source.includes('棒球') ||
    source === '中華職棒' ||
    name.includes('中華職棒') ||
    name.includes('CPBL') ||
    name.includes('棒球')
  ) {
    return true
  }

  // 2. Check exclusion keywords FIRST
  for (const kw of EXCLUDE_KEYWORDS) {
    if (name.includes(kw)) {
      return false
    }
  }

  // 3. Check allowed keywords
  for (const kw of ALLOW_KEYWORDS) {
    if (name.includes(kw)) {
      return true
    }
  }

  // 4. If from iNDIEVOX or music livehouse venue, default to true
  if (
    source === 'INDIEVOX' ||
    venue.includes('LEGACY') ||
    venue.includes('ZEPP') ||
    venue.includes('THE WALL') ||
    venue.includes('PIPE') ||
    venue.includes('CORNER HOUSE') ||
    venue.includes('CLAPPER')
  ) {
    return true
  }

  // 5. Default to false for non-conforming events
  return false
}
