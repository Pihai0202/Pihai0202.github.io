import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

const historicalJsonPath = join(projectRoot, 'public', 'historical-events.json')
const concertsJsonPath = join(projectRoot, 'public', 'concerts.json')

console.log('🚀 開始執行歷年演唱會資料庫清洗、去專車與歌手智慧標註程序...')

// 1. 歌手對照字典 (涵蓋華語、西洋、日韓流行、獨立樂團與 CPBL)
const ARTIST_DICT = [
  // 華語天王天后與樂團
  { primary: '五月天', keywords: ['五月天', 'mayday', '阿信', '怪獸', '石頭', '瑪莎', '冠佑'] },
  { primary: '周杰倫', keywords: ['周杰倫', 'jay chou', '周董'] },
  { primary: '張惠妹', keywords: ['張惠妹', 'amei', 'a-mei', '阿妹', 'asmr'] },
  { primary: '蔡依林', keywords: ['蔡依林', 'jolin tsai', 'jolin'] },
  { primary: '告五人', keywords: ['告五人', 'accusefive', '潘雲安', '犬青', '哲謙'] },
  { primary: '伍佰 & China Blue', keywords: ['伍佰', 'china blue', '吳俊霖'] },
  { primary: '田馥甄', keywords: ['田馥甄', 'hebe'] },
  { primary: 'S.H.E', keywords: ['s.h.e', 's.h.e.'] },
  { primary: '蘇打綠', keywords: ['蘇打綠', 'sodagreen', '魚丁糸', 'oaeen', '青峰', '吳青峰'] },
  { primary: '陶喆', keywords: ['陶喆', 'david tao'] },
  { primary: '林俊傑', keywords: ['林俊傑', 'jj lin', 'jj'] },
  { primary: '陳奕迅', keywords: ['陳奕迅', 'eason chan', 'eason'] },
  { primary: '張學友', keywords: ['張學友', 'jacky cheung'] },
  { primary: '劉德華', keywords: ['劉德華', 'andy lau'] },
  { primary: '郭富城', keywords: ['郭富城', 'aaron kwok'] },
  { primary: '黎明', keywords: ['黎明', 'leon lai'] },
  { primary: '梁靜茹', keywords: ['梁靜茹', 'fish leong'] },
  { primary: '王心凌', keywords: ['王心凌', 'cyndi wang', 'cyndi'] },
  { primary: '蔡健雅', keywords: ['蔡健雅', 'tanya chua', 'tanya'] },
  { primary: '韋禮安', keywords: ['韋禮安', 'weibird'] },
  { primary: '盧廣仲', keywords: ['盧廣仲', 'crowd lu'] },
  { primary: '滅火器', keywords: ['滅火器', 'fire ex'] },
  { primary: '落日飛車', keywords: ['落日飛車', 'sunset rollercoaster'] },
  { primary: '麋先生', keywords: ['麋先生', 'mixer'] },
  { primary: '宇宙人', keywords: ['宇宙人', 'cosmos people'] },
  { primary: '瘦子 E.SO', keywords: ['瘦子', 'e.so', 'eso'] },
  { primary: '頑童 MJ116', keywords: ['頑童', 'mj116', 'mj 116'] },
  { primary: '八三夭', keywords: ['八三夭', '831'] },
  { primary: '理想混蛋', keywords: ['理想混蛋', 'bestards'] },
  { primary: '茄子蛋', keywords: ['茄子蛋', 'eggplantegg'] },
  { primary: '魏如萱', keywords: ['魏如萱', 'waa wei', 'waa'] },
  { primary: '9m88', keywords: ['9m88'] },
  { primary: '高爾宣', keywords: ['高爾宣', 'osn'] },
  { primary: '婁峻碩', keywords: ['婁峻碩', 'shou'] },
  { primary: '派偉俊', keywords: ['派偉俊', 'patrick brasca'] },
  { primary: '戴佩妮', keywords: ['戴佩妮', 'penny tai'] },
  { primary: '李宗盛', keywords: ['李宗盛', 'jonathan lee'] },
  { primary: '羅志祥', keywords: ['羅志祥', 'show lo'] },
  { primary: '蕭敬騰', keywords: ['蕭敬騰', 'jam hsiao'] },
  { primary: '鄧紫棋', keywords: ['鄧紫棋', 'g.e.m.', 'gem'] },
  { primary: '楊丞琳', keywords: ['楊丞琳', 'rainie yang'] },
  { primary: '孫燕姿', keywords: ['孫燕姿', 'stefanie sun'] },
  { primary: '動力火車', keywords: ['動力火車', 'power station'] },
  { primary: '草蜢', keywords: ['草蜢', 'grasshopper'] },
  { primary: '草東沒有派對', keywords: ['草東沒有派對', 'no party for cao dong', '草東'] },
  { primary: '老王樂隊', keywords: ['老王樂隊', 'your woman sleep with others'] },
  { primary: '血肉果汁機', keywords: ['血肉果汁機', 'flesh juicer'] },
  { primary: '美秀集團', keywords: ['美秀集團', 'amazing show'] },
  { primary: '拍謝少年', keywords: ['拍謝少年', 'sorry youth'] },
  { primary: '芒果醬', keywords: ['芒果醬', 'mango jump'] },
  { primary: 'Ozone', keywords: ['ozone'] },
  { primary: 'U:NUS', keywords: ['u:nus', 'unus'] },
  { primary: 'FEniX', keywords: ['fenix'] },
  { primary: 'AcQUA源少年', keywords: ['acqua源少年', 'acqua'] },
  { primary: '原子少年', keywords: ['原子少年', 'atomboyz'] },
  { primary: '冰球樂團', keywords: ['冰球樂團', 'icedtea'] },
  { primary: '溫蒂漫步', keywords: ['溫蒂漫步', 'wendy wander'] },
  { primary: '甜約翰', keywords: ['甜約翰', 'sweet john'] },
  { primary: '康士坦的變化球', keywords: ['康士坦的變化球', 'ksob'] },
  { primary: '怕胖團', keywords: ['怕胖團', 'papun band'] },
  { primary: '旺福', keywords: ['旺福', 'wonfu'] },
  { primary: '玖壹壹', keywords: ['玖壹壹', '911'] },
  { primary: '艾怡良', keywords: ['艾怡良', 'eve ai'] },
  { primary: '孫盛希', keywords: ['孫盛希', 'shi shi'] },
  { primary: '鄭宜農', keywords: ['鄭宜農', 'enno cheng'] },
  { primary: '熱狗 MC HotDog', keywords: ['熱狗', 'mc hotdog', 'mchotdog'] },
  { primary: '蛋堡', keywords: ['蛋堡', 'soft lipa'] },
  { primary: '熊仔', keywords: ['熊仔', 'kumachan'] },
  { primary: '李英宏', keywords: ['李英宏', 'dj didilong'] },
  { primary: '彭佳慧', keywords: ['彭佳慧', 'julia peng'] },
  { primary: '宋念宇', keywords: ['宋念宇', '小宇 宋念宇', '小宇'] },
  { primary: '蕭煌奇', keywords: ['蕭煌奇', 'ricky hsiao'] },
  { primary: '盧宣竹', keywords: ['盧宣竹'] },
  { primary: '品冠', keywords: ['品冠'] },
  { primary: '光良', keywords: ['光良'] },
  { primary: '任賢齊', keywords: ['任賢齊', 'richie jen'] },
  { primary: '張震嶽', keywords: ['張震嶽', 'ayal komod'] },
  { primary: '王若琳', keywords: ['王若琳', 'joanna wang'] },
  { primary: '家家', keywords: ['家家', 'jiajia'] },
  { primary: '丁噹', keywords: ['丁噹', 'della'] },
  { primary: '白安', keywords: ['白安', 'ann'] },
  { primary: '鼓鼓 呂思緯', keywords: ['鼓鼓', '呂思緯', 'gboyswag'] },
  { primary: '蕭秉治', keywords: ['蕭秉治', 'tingting'] },
  { primary: '陳零九', keywords: ['陳零九', 'nine chen'] },
  { primary: '邱鋒澤', keywords: ['邱鋒澤', 'feng ze'] },
  { primary: '黃偉晉', keywords: ['黃偉晉', 'wayne huang'] },
  { primary: '五堅情', keywords: ['五堅情', 'w0lf(s)', 'wolfs'] },

  // 西洋西洋天團與巨星
  { primary: 'Bruno Mars', keywords: ['bruno mars', '火星人布魯諾', '布魯諾'] },
  { primary: 'Coldplay', keywords: ['coldplay', '酷玩樂團', '酷玩'] },
  { primary: 'Ed Sheeran', keywords: ['ed sheeran', '紅髮艾德'] },
  { primary: 'Taylor Swift', keywords: ['taylor swift', '泰勒絲'] },
  { primary: 'Post Malone', keywords: ['post malone', '波斯特馬龍'] },
  { primary: 'Maroon 5', keywords: ['maroon 5', '魔力紅'] },
  { primary: 'Lady Gaga', keywords: ['lady gaga', '女神卡卡'] },
  { primary: 'Dua Lipa', keywords: ['dua lipa', '杜娃黎波'] },
  { primary: 'Imagine Dragons', keywords: ['imagine dragons', '謎幻樂團'] },
  { primary: 'LANY', keywords: ['lany'] },
  { primary: 'OneRepublic', keywords: ['onerepublic', '共和時代'] },
  { primary: 'The Chainsmokers', keywords: ['the chainsmokers', '老菸民雙人組'] },
  { primary: 'Alan Walker', keywords: ['alan walker', '艾倫沃克'] },
  { primary: 'Sam Smith', keywords: ['sam smith', '山姆史密斯'] },
  { primary: 'Charlie Puth', keywords: ['charlie puth', 'CP查理'] },
  { primary: 'Lauv', keywords: ['lauv'] },
  { primary: 'Keshi', keywords: ['keshi'] },
  { primary: 'HONNE', keywords: ['honne'] },
  { primary: 'Cigarettes After Sex', keywords: ['cigarettes after sex', '事後菸樂團'] },
  { primary: 'Westlife', keywords: ['westlife', '西城男孩'] },
  { primary: 'Backstreet Boys', keywords: ['backstreet boys', '新好男孩'] },

  // 韓流 K-POP
  { primary: 'IU 李知恩', keywords: ['iu', '李知恩', '아이유'] },
  { primary: 'BLACKPINK', keywords: ['blackpink', 'jisoo', 'jennie', 'rosé', 'lisa'] },
  { primary: 'BTS 防彈少年團', keywords: ['bts', '防彈少年團', '방탄소년단', 'jungkook', '田柾國', 'jimin', 'suga', 'j-hope'] },
  { primary: 'TWICE', keywords: ['twice', '트와이스', '周子瑜', 'tzuyu'] },
  { primary: 'aespa', keywords: ['aespa', 'karina', 'giselle', 'ningning', '柳智敏', '金旼炡'] },
  { primary: 'NewJeans', keywords: ['newjeans', '뉴진스'] },
  { primary: 'IVE', keywords: ['ive', '아이브', '張員瑛', 'wonyoung', 'yujin'] },
  { primary: 'LE SSERAFIM', keywords: ['le sserafim', '르세라핌'] },
  { primary: '(G)I-DLE', keywords: ['(g)i-dle', 'gidle', 'i-dle', '葉舒華', 'shuhua', 'soyeon', 'yuqi', 'minnie', 'miyeon'] },
  { primary: 'Stray Kids', keywords: ['stray kids', 'skz', '스트레이 키즈'] },
  { primary: 'SEVENTEEN', keywords: ['seventeen', 'svt', '세븐틴'] },
  { primary: 'Super Junior', keywords: ['super junior', 'suju', '슈퍼주니어'] },
  { primary: 'NCT', keywords: ['nct', 'nct 127', 'nct dream', 'wayv'] },
  { primary: 'TXT', keywords: ['txt', 'tomorrow x together'] },
  { primary: 'ENHYPEN', keywords: ['enhypen', '엔하이픈'] },
  { primary: 'TREASURE', keywords: ['treasure', '트레저'] },
  { primary: 'RIIZE', keywords: ['riize', '라이즈'] },
  { primary: 'BABYMONSTER', keywords: ['babymonster', '베이비몬스터'] },
  { primary: '2NE1', keywords: ['2ne1', '투애니원', 'park bom', '朴春', 'sandara', 'minzy'] },
  { primary: 'BIGBANG', keywords: ['bigbang', 'g-dragon', 'taeyang', 'daesung'] },
  { primary: 'EXO', keywords: ['exo', '엑소', 'baekhyun', 'd.o.', 'suho', 'chanyeol', '金鍾仁'] },
  { primary: 'SHINee', keywords: ['shinee', '샤이니', 'taemin', '金起範', 'minho', 'onew'] },
  { primary: 'Girls\' Generation 少女時代', keywords: ['girls\' generation', '少女時代', 'taeyeon', '太妍', 'yoona'] },
  { primary: 'Red Velvet', keywords: ['red velvet', '레드벨벳', 'irene', 'seulgi', 'wendy', '朴秀英', 'yeri'] },
  { primary: 'MAMAMOO', keywords: ['mamamoo', 'hwasa', '頌樂', '金容仙', 'moonbyul', 'wheein', '華莎'] },
  { primary: 'CNBLUE', keywords: ['cnblue', '鄭容和', 'yonghwa'] },
  { primary: 'DAY6', keywords: ['day6', '데이식스'] },

  // 東洋 J-POP / 動漫
  { primary: '宇多田光', keywords: ['宇多田光', 'hikaru utada', 'utada'] },
  { primary: 'YOASOBI', keywords: ['yoasobi', 'ikura', 'ayase'] },
  { primary: 'Ado', keywords: ['ado'] },
  { primary: '愛繆 Aimyon', keywords: ['aimyon', '愛繆'] },
  { primary: 'RADWIMPS', keywords: ['radwimps'] },
  { primary: 'ONE OK ROCK', keywords: ['one ok rock', 'oor', 'taka'] },
  { primary: 'King Gnu', keywords: ['king gnu'] },
  { primary: 'Official髭男dism', keywords: ['official髭男dism', 'higedan'] },
  { primary: 'milet', keywords: ['milet'] },
  { primary: 'Aimer', keywords: ['aimer'] },
  { primary: 'LiSA', keywords: ['lisa (織部里沙)', 'lisa'] },
  { primary: '米津玄師', keywords: ['米津玄師', 'kenshi yonezu'] },
  { primary: '藤井風', keywords: ['藤井風', 'fujii kaze'] },
  { primary: 'back number', keywords: ['back number'] },
  { primary: '緑黄色社会', keywords: ['緑黄色社会', 'ryokushaka'] },
  { primary: 'BABYMETAL', keywords: ['babymetal'] },
  { primary: '星野源', keywords: ['星野源', 'gen hoshino'] },

  // 運動賽事
  { primary: '中華職棒', keywords: ['中華職棒', 'cpbl', '中信兄弟', '統一7-eleven獅', '樂天桃猿', '富邦悍將', '味全龍', '台鋼雄鷹'] },
  { primary: '世界棒球12強賽', keywords: ['世界棒球12強賽', 'premier12', '12強', '中華台北 vs', '世界12強'] },
]

// 專車與無效黑名單關鍵字
const BUS_EXCLUDE_REGEX = /返鄉專車|歌迷專車|接駁專車|接駁車|搭車點|專車/
const JUNK_KEYWORDS = [
  '企業說明會', '說明會', '研討會', '工作坊', '訓練營', 
  '中野製藥課程', '製藥課程', '玻璃工坊', '黑客松', 
  '商機媒合', '線上會議', '技術交流', '展銷會', '招生說明',
  '歌唱診療室', 'AI爽'
]

// 寬宏售票將售票開賣/預購/刷卡優惠日誤抓為演出日之黑名單
const KHAM_PHANTOM_IDS = new Set([
  // 蕭煌奇 售票預購/開賣假場次
  'kham-8274271', // 2026-08-11
  'kham-131397',  // 2026-08-16
  'kham-9916610', // 2026-08-17

  // 彭佳慧 售票預購/開賣假場次與錯誤場館 (僅保留 10/03 台北小巨蛋 與 11/21 高雄巨蛋)
  'kham-5839925', 'kham-9557914', 'kham-14536375', 'kham-6179292',
  'kham-157857', 'kham-13018085', 'kham-1055293', 'kham-15278033',
  'kham-15574488', 'kham-1700909',

  // 宋念宇 售票開賣假場次 (僅保留 11/07 北流演出)
  'kham-130722', 'kham-11229727', 'kham-5238243', 'kham-2730902', 'kham-15859778',

  // 梁文音 售票開賣假場次 (僅保留 09/06 台中演出)
  'kham-12432890', 'kham-2283643', 'kham-1188484', 'kham-3602564', 'kham-8450466',

  // 郭子&浮花樂隊 售票開賣假場次 (僅保留 10/16 演出)
  'kham-9931169', 'kham-5167681', 'kham-4649395', 'kham-993728', 'kham-9104585',

  // EPEX 售票開賣假場次 (僅保留 09/12 演出)
  'kham-396250', 'kham-11035181', 'kham-2645151', 'kham-8910361', 'kham-11903608',

  // FEniX 售票開賣假場次 (僅保留 10/02 演出)
  'kham-721135', 'kham-13275829', 'kham-918412', 'kham-3696592', 'kham-10094411',
  'kham-10072578', 'kham-5441495', 'kham-15803679', 'kham-7759275', 'kham-12576770',

  // MUSIC EXPO 售票開賣假場次 (僅保留 10/24 演出)
  'kham-3090246', 'kham-6336989', 'kham-2888357',

  // 李國修《半里長城》售票開賣假場次 (僅保留 08/28, 08/29, 08/30 演出)
  'kham-13820193', 'kham-13982693', 'kham-2478413', 'kham-680257',
  'kham-14817600', 'kham-11056402', 'kham-9531971', 'kham-11080680',
  'kham-129873', 'kham-14056837', 'kham-11868199',

  // 舞台劇〈你來的時候〉售票開賣假場次 (僅保留 09/23, 09/24, 09/26 演出)
  'kham-9442470', 'kham-2329779', 'kham-6282366', 'kham-16488892',
  'kham-692061', 'kham-8785384', 'kham-14571350', 'kham-5363168',
  'kham-14662445', 'kham-10015566', 'kham-6757746', 'kham-14444611',
  'kham-16147414', 'kham-4214710', 'kham-13533099', 'kham-5313709',
  'kham-5704987', 'kham-5505311',
])

function isShuttleBusOrJunk(ev) {
  const name = ev.name || ''
  const venue = ev.venue_name || ev.venue_raw || ''
  const dateStr = (ev.date || '').split(' ')[0]
  
  if (BUS_EXCLUDE_REGEX.test(name) || BUS_EXCLUDE_REGEX.test(venue)) {
    return true
  }

  for (const junk of JUNK_KEYWORDS) {
    if (name.includes(junk)) return true
  }

  // 徹底剔除非官方且已被廢棄之 webbboxx 行事曆來源假活動（包含猜測/非官方日期）
  if (ev.source === 'webbboxx 行事曆' || (ev.id && String(ev.id).startsWith('webbboxx-'))) {
    return true
  }

  if (KHAM_PHANTOM_IDS.has(ev.id)) {
    return true
  }

  // 蕭煌奇 2026 BRAVO 演唱會非 09/18、09/19 之幽靈售票日
  if (name.includes('蕭煌奇') && name.includes('BRAVO') && !['2026-09-18', '2026-09-19'].includes(dateStr)) {
    return true
  }

  return false
}

function matchKeyword(text, kw) {
  if (!text || !kw) return false
  const trimmed = kw.trim()
  if (trimmed.length === 0) return false
  // Alphanumeric keywords (like 'iu', 'bts', 'v', 'rm') must match word boundaries
  if (/^[a-zA-Z0-9\s&.\-]+$/.test(trimmed)) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i')
    return regex.test(text)
  }
  // Chinese or mixed keywords
  return text.toLowerCase().includes(trimmed.toLowerCase())
}

function extractArtistFromName(name, existingArtist = '', category = '', source = '') {
  if (!name) return existingArtist || ''

  // 0. 中華職棒與賽事優先判定
  if (category === 'sport' || source === '中華職棒' || /中華職棒|例行賽|季後賽|總冠軍賽|明星賽/.test(name)) {
    if (/12強|premier12/i.test(name)) return '世界棒球12強賽'
    return '中華職棒'
  }

  // 1. 比對歌手字典
  for (const item of ARTIST_DICT) {
    if (item.primary === '中華職棒' || item.primary === '世界棒球12強賽') continue
    for (const kw of item.keywords) {
      if (matchKeyword(name, kw)) {
        return item.primary
      }
    }
  }

  if (existingArtist && existingArtist.trim().length > 0) {
    const normName = name.toLowerCase()
    const normArt = existingArtist.toLowerCase()
    if (normName.includes(normArt) || normArt.split(/\s+/).some((part) => part.length >= 2 && normName.includes(part))) {
      return existingArtist.trim()
    }
  }

  // 2. 標題正則抽詞:
  // e.g. "XXX 2024 巡迴演唱會"、"XXX《...》"、"XXX Live in Taipei"
  let clean = name
    .replace(/【[^】]+】/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/（[^）]+）/g, ' ')
    .replace(/\([^)]+\)/g, ' ')
    .trim()

  const tourMatch = clean.match(/^([\u4e00-\u9fa5A-Za-z0-9\s&.]{2,16}?)\s*(?:世界巡迴|巡迴演唱會|個人演唱會|演唱會|音樂會|專場|見面會|LIVE TOUR|Live in|World Tour|Concert|Fan Meeting)/i)
  if (tourMatch && tourMatch[1]) {
    const candidate = tourMatch[1].replace(/202\d/g, '').trim()
    if (candidate.length >= 2 && candidate.length <= 15) {
      return candidate
    }
  }

  const sepMatch = clean.match(/^([\u4e00-\u9fa5A-Za-z0-9\s&.]{2,15}?)\s*[《「：:–—\-]/)
  if (sepMatch && sepMatch[1]) {
    const candidate = sepMatch[1].replace(/202\d/g, '').trim()
    if (candidate.length >= 2 && candidate.length <= 15) {
      return candidate
    }
  }

  return ''
}

function generateKeywords(artist, name, venueName, city) {
  const set = new Set()
  if (artist) {
    set.add(artist.toLowerCase())
    artist.toLowerCase().split(/\s+/).forEach((w) => w && set.add(w))
  }
  if (name) {
    set.add(name.toLowerCase())
    // extract key terms
    name.toLowerCase().split(/[\s\-_:：【】\[\]《》（）()]+/).forEach((w) => {
      if (w.length >= 2 && w.length <= 12) set.add(w)
    })
  }
  if (venueName) set.add(venueName.toLowerCase())
  if (city) set.add(city.toLowerCase())
  return Array.from(set).slice(0, 15)
}

// 載入現有歷年活動
let eventsMap = new Map()
if (existsSync(historicalJsonPath)) {
  const raw = readFileSync(historicalJsonPath, 'utf-8')
  const data = JSON.parse(raw)
  if (Array.isArray(data.events)) {
    data.events.forEach((ev) => {
      if (ev && ev.id) eventsMap.set(ev.id, ev)
    })
  }
}

// 載入現有 concerts.json 過去與現在的活動
if (existsSync(concertsJsonPath)) {
  const raw = readFileSync(concertsJsonPath, 'utf-8')
  const data = JSON.parse(raw)
  if (Array.isArray(data.events)) {
    data.events.forEach((ev) => {
      if (ev && ev.id && !eventsMap.has(ev.id)) {
        eventsMap.set(ev.id, ev)
      }
    })
  }
}

console.log(`📦 原始活動總數：${eventsMap.size} 場`)

// 3. 擴充指標級歷史演唱會 (Iconic Landmarks)
const ICONIC_LANDMARKS = [
  // --- 五月天 Mayday ---
  // 5525+2 台北大巨蛋 (2026年7月)
  { id: 'mayday-5525p2-tp-2026-07-03', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-04', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-04', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-05', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-08', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-10', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-10', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-11', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-11', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-12', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525p2-tp-2026-07-13', name: 'MAYDAY #5525+2 LIVE TOUR 五月天 [ #5525+2 回到那一天 ] 25週年巡迴演唱會 台北大巨蛋 (收官場)', artist: '五月天', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2026-07-13', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  // 5525 桃園棒球場 新年特別版 (2024-2025)
  { id: 'mayday-5525-ty-2024-12-28', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 新年特別版', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2024-12-28', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-ty-2024-12-29', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 新年特別版', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2024-12-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-ty-2024-12-31', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 跨年演唱會', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2024-12-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-ty-2025-01-01', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 元旦演唱會', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2025-01-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-ty-2025-01-04', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 新年特別版', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2025-01-04', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-ty-2025-01-05', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 桃園棒球場 新年特別版', artist: '五月天', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2025-01-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  // 5525 高雄世運 (2024年3月)
  { id: 'mayday-5525-kh-2024-03-23', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-03-23', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-kh-2024-03-24', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-03-24', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-kh-2024-03-29', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 高雄世運成軍日', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-03-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-kh-2024-03-30', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-03-30', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-kh-2024-03-31', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 高雄世運 (高雄收官場)', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-03-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  // 5525 台中洲際棒球場 (2023-2024)
  { id: 'mayday-5525-tc-2023-12-31', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場 跨年首演', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2023-12-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-tc-2024-01-01', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場 元旦場', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2024-01-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-tc-2024-01-02', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2024-01-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-tc-2024-01-05', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2024-01-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-tc-2024-01-06', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2024-01-06', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  { id: 'mayday-5525-tc-2024-01-07', name: 'MAYDAY #5525 LIVE TOUR 五月天 [ 回到那一天 ] 25週年巡迴演唱會 台中洲際棒球場', artist: '五月天', venue_id: 'taichung-stadium', venue_name: '台中洲際棒球場', city: '台中', date: '2024-01-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_mayday_802778ba7a541604a80628a8677c7f1a.jpg', source: '拓元售票' },
  // 諾亞方舟 高雄世運 (2023年3-4月)
  { id: 'mayday-noah-kh-2023-03-29', name: 'MAYDAY 2023 諾亞方舟 10週年進化 復刻限定版演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_mayday_84b72ef2161f4fa9b0e1e07bdfa5a043.jpg', source: '拓元售票' },
  { id: 'mayday-noah-kh-2023-03-31', name: 'MAYDAY 2023 諾亞方舟 10週年進化 復刻限定版演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_mayday_84b72ef2161f4fa9b0e1e07bdfa5a043.jpg', source: '拓元售票' },
  { id: 'mayday-noah-kh-2023-04-01', name: 'MAYDAY 2023 諾亞方舟 10週年進化 復刻限定版演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-04-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_mayday_84b72ef2161f4fa9b0e1e07bdfa5a043.jpg', source: '拓元售票' },
  { id: 'mayday-noah-kh-2023-04-02', name: 'MAYDAY 2023 諾亞方舟 10週年進化 復刻限定版演唱會 高雄世運', artist: '五月天', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-04-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_mayday_84b72ef2161f4fa9b0e1e07bdfa5a043.jpg', source: '拓元售票' },

  // --- 周杰倫 Jay Chou ---
  { id: 'jay-chou-carnival-2024-12-05', name: '周杰倫「嘉年華」世界巡迴演唱會 台北大巨蛋', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-06', name: '周杰倫「嘉年華」世界巡迴演唱會 台北大巨蛋', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-06', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-07', name: '周杰倫「嘉年華」世界巡迴演唱會 台北大巨蛋', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },
  { id: 'jay-chou-carnival-2024-12-08', name: '周杰倫「嘉年華」世界巡迴演唱會 台北大巨蛋', artist: '周杰倫', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jaychou_a5f2ec49e49c7161b9a9f24e93bbdbff.jpg', source: '拓元售票' },

  // --- 張惠妹 aMEI ---
  // ASMR Maxxx 台北大巨蛋 (2024年12月)
  { id: 'amei-asmr-2024-12-21', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-21', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-22', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-22', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-28', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-28', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-29', name: 'ASMR Maxxx @ Taipei Dome 世界巡迴演唱會', artist: '張惠妹', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-2024-12-31', name: 'ASMR Maxxx @ Taipei Dome 跨年世界巡迴演唱會', artist: '張惠妹', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-12-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  // aMEI ASMR 高雄巨蛋 (2023年3-4月 10場)
  { id: 'amei-asmr-kh-2023-03-31', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-03-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-01', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-03', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-04', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-04', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-05', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-08', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-09', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-14', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-14', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-15', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-15', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },
  { id: 'amei-asmr-kh-2023-04-16', name: 'aMEI ASMR 世界巡迴演唱會 高雄巨蛋 (高雄收官場)', artist: '張惠妹', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-04-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_amei_546fc4eb4f0d61122bfbb6d1cf778941.jpg', source: '拓元售票' },

  // --- 蔡依林 Jolin Tsai (Ugly Beauty FINALE 台北小巨蛋 6場完整) ---
  { id: 'jolin-ugly-beauty-2022-12-31', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場 (跨年夜)', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-12-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  { id: 'jolin-ugly-beauty-2023-01-01', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場 (元旦首演)', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  { id: 'jolin-ugly-beauty-2023-01-02', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  { id: 'jolin-ugly-beauty-2023-01-06', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-06', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  { id: 'jolin-ugly-beauty-2023-01-07', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },
  { id: 'jolin-ugly-beauty-2023-01-08', name: '蔡依林 Ugly Beauty 2022-2023 世界巡迴演唱會 FINALE 台北最終場 (巡迴收官場)', artist: '蔡依林', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-01-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jolin_8299fe8d9046c8ae397c8d9be9e71b29.jpg', source: '拓元售票' },

  // --- 陳奕迅 Eason Chan (FEAR and DREAMS 台北小巨蛋 7場完整) ---
  { id: 'eason-fad-2023-07-15', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-15', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-16', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-18', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-18', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-19', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-19', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-21', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-21', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-22', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-22', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },
  { id: 'eason-fad-2023-07-23', name: '陳奕迅 FEAR and DREAMS 世界巡迴演唱會 台北小巨蛋站 (台北收官場)', artist: '陳奕迅', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-07-23', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_eason_715978a632e92c6c039db4959db62531.jpg', source: '拓元售票' },

  // --- 張學友 Jacky Cheung (60+ 台北小巨蛋 6場) ---
  { id: 'jacky-cheung-60p-2024-05-31', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-05-31', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },
  { id: 'jacky-cheung-60p-2024-06-01', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-06-01', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },
  { id: 'jacky-cheung-60p-2024-06-02', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-06-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },
  { id: 'jacky-cheung-60p-2024-06-14', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-06-14', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },
  { id: 'jacky-cheung-60p-2024-06-15', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-06-15', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },
  { id: 'jacky-cheung-60p-2024-06-16', name: '張學友 60+ 巡迴演唱會 台北站 台北小巨蛋', artist: '張學友', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-06-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_jacky_cover.jpg', source: '拓元售票' },

  // --- 劉德華 Andy Lau (台北小巨蛋 4場包含颱風補場) ---
  { id: 'andy-lau-2024-11-01', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北小巨蛋 (首場)', artist: '劉德華', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-01', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-02-noon', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北小巨蛋 (12:00 午場/補唱10/31颱風停辦場)', artist: '劉德華', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-02', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-02-night', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北小巨蛋 (19:00 原定晚場)', artist: '劉德華', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-02', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },
  { id: 'andy-lau-2024-11-03', name: 'Today…is the Day 劉德華巡迴演唱會 2024 台北小巨蛋 (收官場)', artist: '劉德華', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-03', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240801123456_andylau.jpg', source: '遠大售票' },

  // --- 田馥甄 Hebe (一一巡迴 台北小巨蛋 5場完整) ---
  { id: 'hebe-one-after-another-2023-08-05', name: '田馥甄 一一巡迴演唱會 台北小巨蛋最終場 (首場)', artist: '田馥甄', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-08-05', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_hebe_cover.jpg', source: '拓元售票' },
  { id: 'hebe-one-after-another-2023-08-06', name: '田馥甄 一一巡迴演唱會 台北小巨蛋最終場', artist: '田馥甄', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-08-06', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_hebe_cover.jpg', source: '拓元售票' },
  { id: 'hebe-one-after-another-2023-08-11', name: '田馥甄 一一巡迴演唱會 台北小巨蛋最終場', artist: '田馥甄', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-08-11', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_hebe_cover.jpg', source: '拓元售票' },
  { id: 'hebe-one-after-another-2023-08-12', name: '田馥甄 一一巡迴演唱會 台北小巨蛋最終場', artist: '田馥甄', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-08-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_hebe_cover.jpg', source: '拓元售票' },
  { id: 'hebe-one-after-another-2023-08-13', name: '田馥甄 一一巡迴演唱會 台北小巨蛋最終場 (收官場)', artist: '田馥甄', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-08-13', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_hebe_cover.jpg', source: '拓元售票' },

  // --- 告五人 Accusefive ---
  { id: 'accusefive-yilan-2024-03-16', name: '告五人 [宇宙超有趣] 2024 SUPER LIVE TOUR 宜蘭家場', artist: '告五人', venue_id: null, venue_name: '宜蘭運動公園複合劇場', city: '宜蘭', date: '2024-03-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_afive_762cb058e5746761ebf7c00e62d47ea5.jpg', source: '拓元售票' },
  { id: 'accusefive-yilan-2024-03-17', name: '告五人 [宇宙超有趣] 2024 SUPER LIVE TOUR 宜蘭家場 (加場)', artist: '告五人', venue_id: null, venue_name: '宜蘭運動公園複合劇場', city: '宜蘭', date: '2024-03-17', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_afive_762cb058e5746761ebf7c00e62d47ea5.jpg', source: '拓元售票' },
  { id: 'accusefive-kh-2023-07-29', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】高雄巨蛋', artist: '告五人', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-07-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-kh-2023-07-30', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】高雄巨蛋 (加場)', artist: '告五人', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2023-07-30', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-arena-2023-04-08', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】台北小巨蛋', artist: '告五人', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },
  { id: 'accusefive-arena-2023-04-09', name: '告五人 第一次新世界巡迴演唱會【宇宙的有趣】台北小巨蛋 (加場)', artist: '告五人', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_accuse_88c750e685f0ef3071bb21015694a971.jpg', source: '拓元售票' },

  // --- 林俊傑 JJ Lin (JJ20 桃園棒球場 2場) ---
  { id: 'jjlin-jj20-2022-12-03', name: '林俊傑 JJ 林俊傑《JJ20》世界巡迴演唱會 台北站', artist: '林俊傑', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2022-12-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jjlin_cover.jpg', source: 'KKTIX' },
  { id: 'jjlin-jj20-2022-12-04', name: '林俊傑 JJ 林俊傑《JJ20》世界巡迴演唱會 台北站 (收官場)', artist: '林俊傑', venue_id: 'taoyuan-stadium', venue_name: '樂天桃園棒球場', city: '桃園', date: '2022-12-04', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_jjlin_cover.jpg', source: 'KKTIX' },

  // --- 王心凌 Cyndi Wang ---
  { id: 'cyndi-sugar-high-2-2024-10-12', name: '王心凌 SUGAR HIGH 2.0 世界巡迴演唱會 台北小巨蛋', artist: '王心凌', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_cyndi_cover.jpg', source: '寬宏售票' },
  { id: 'cyndi-sugar-high-2-2024-10-13', name: '王心凌 SUGAR HIGH 2.0 世界巡迴演唱會 台北小巨蛋', artist: '王心凌', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-13', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_cyndi_cover.jpg', source: '寬宏售票' },
  { id: 'cyndi-sugar-high-2023-09-23', name: '王心凌 SUGAR HIGH 世界巡迴演唱會 台北小巨蛋', artist: '王心凌', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-09-23', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_cyndi_cover.jpg', source: '寬宏售票' },
  { id: 'cyndi-sugar-high-2023-09-24', name: '王心凌 SUGAR HIGH 世界巡迴演唱會 台北小巨蛋 (加場)', artist: '王心凌', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-09-24', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_cyndi_cover.jpg', source: '寬宏售票' },

  // --- 陶喆 David Tao ---
  { id: 'david-tao-2024-11-09', name: '陶喆 Soul Power II 世界巡迴演唱會 台北小巨蛋站', artist: '陶喆', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_davidtao_417ee9bf89e7c5b651586a3d6d5ebbf2.jpg', source: 'KKTIX' },
  { id: 'david-tao-2024-11-10', name: '陶喆 Soul Power II 世界巡迴演唱會 台北小巨蛋站 (加場)', artist: '陶喆', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-11-10', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_davidtao_417ee9bf89e7c5b651586a3d6d5ebbf2.jpg', source: 'KKTIX' },

  // --- 郭富城 Aaron Kwok ---
  { id: 'aaron-kwok-iconic-2024-12-27', name: '郭富城 ICONIC 世界巡迴演唱會 2024 台北小巨蛋', artist: '郭富城', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-12-27', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240920_aaron.jpg', source: '遠大售票' },
  { id: 'aaron-kwok-iconic-2024-12-28', name: '郭富城 ICONIC 世界巡迴演唱會 2024 台北小巨蛋', artist: '郭富城', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-12-28', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240920_aaron.jpg', source: '遠大售票' },
  { id: 'aaron-kwok-iconic-2024-12-29', name: '郭富城 ICONIC 世界巡迴演唱會 2024 台北小巨蛋 (收官場)', artist: '郭富城', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-12-29', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240920_aaron.jpg', source: '遠大售票' },

  // --- 伍佰 & China Blue ---
  { id: 'wubai-rockstar-2023-06-16', name: '伍佰 & China Blue Rock Star 2023 巡迴演唱會 台北小巨蛋', artist: '伍佰 & China Blue', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-06-16', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20230301100000_wubai.jpg', source: '拓元售票' },
  { id: 'wubai-rockstar-2023-06-17', name: '伍佰 & China Blue Rock Star 2023 巡迴演唱會 台北小巨蛋 (加場)', artist: '伍佰 & China Blue', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-06-17', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20230301100000_wubai.jpg', source: '拓元售票' },
  { id: 'wubai-rockstar-kh-2024-10-19', name: '伍佰 & China Blue Rock Star 2024 巡迴演唱會 高雄巨蛋', artist: '伍佰 & China Blue', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2024-10-19', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20230301100000_wubai.jpg', source: '拓元售票' },

  // --- 蘇打綠 / 魚丁糸 ---
  { id: 'sodagreen-20-2025-02-22', name: '蘇打綠《二十年一刻》巡迴演唱會 台北小巨蛋站', artist: '蘇打綠', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2025-02-22', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_sodagreen_cover.jpg', source: '拓元售票' },
  { id: 'sodagreen-20-2025-02-23', name: '蘇打綠《二十年一刻》巡迴演唱會 台北小巨蛋站', artist: '蘇打綠', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2025-02-23', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_sodagreen_cover.jpg', source: '拓元售票' },
  { id: 'oaeen-pond-2023-02-18', name: '魚丁糸《池堂影夜》演唱會 台北小巨蛋', artist: '蘇打綠', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-02-18', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_oaeen_cover.jpg', source: 'KKTIX' },
  { id: 'oaeen-pond-2023-02-19', name: '魚丁糸《池堂影夜》演唱會 台北小巨蛋', artist: '蘇打綠', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-02-19', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_oaeen_cover.jpg', source: 'KKTIX' },

  // --- BLACKPINK ---
  { id: 'blackpink-kh-2023-03-18', name: 'BLACKPINK WORLD TOUR [BORN PINK] KAOHSIUNG 高雄世運', artist: 'BLACKPINK', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-18', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_blackpink_241f874bc0505b38a05c19799da0da81.jpg', source: '拓元售票' },
  { id: 'blackpink-kh-2023-03-19', name: 'BLACKPINK WORLD TOUR [BORN PINK] KAOHSIUNG 高雄世運 (加場)', artist: 'BLACKPINK', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-03-19', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_blackpink_241f874bc0505b38a05c19799da0da81.jpg', source: '拓元售票' },

  // --- Coldplay ---
  { id: 'coldplay-kh-2023-11-11', name: 'Coldplay: Music of the Spheres World Tour 酷玩樂團 高雄世運演唱會', artist: 'Coldplay', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-11-11', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_coldplay_7fbb5c645bc8ba36ee8b0ae49a71a396.jpg', source: '拓元售票' },
  { id: 'coldplay-kh-2023-11-12', name: 'Coldplay: Music of the Spheres World Tour 酷玩樂團 高雄世運演唱會 (加場)', artist: 'Coldplay', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2023-11-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_coldplay_7fbb5c645bc8ba36ee8b0ae49a71a396.jpg', source: '拓元售票' },

  // --- Bruno Mars ---
  { id: 'bruno-mars-kh-2024-09-07', name: 'Bruno Mars Live in Kaohsiung 火星人布魯諾 高雄世運演唱會', artist: 'Bruno Mars', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-09-07', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_brunomars_d09fb8bfa2e405f6e5e8e8ce7d995371.jpg', source: '拓元售票' },
  { id: 'bruno-mars-kh-2024-09-08', name: 'Bruno Mars Live in Kaohsiung 火星人布魯諾 高雄世運演唱會 (加場)', artist: 'Bruno Mars', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-09-08', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_brunomars_d09fb8bfa2e405f6e5e8e8ce7d995371.jpg', source: '拓元售票' },

  // --- Ed Sheeran ---
  { id: 'ed-sheeran-kh-2024-02-03', name: 'Ed Sheeran ＋－＝÷ × 2024 TOUR 紅髮艾德 高雄國家體育場', artist: 'Ed Sheeran', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-02-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_edsheeran_7a5ee0a8276f7f2b6e15dcbaf5a999db.jpg', source: '拓元售票' },

  // --- 宇多田光 Hikaru Utada ---
  { id: 'utada-hikaru-2024-08-10', name: 'HIKARU UTADA SCIENCE FICTION TOUR 2024 台北小巨蛋', artist: '宇多田光', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-10', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240412152815_utada.jpg', source: '遠大售票' },
  { id: 'utada-hikaru-2024-08-11', name: 'HIKARU UTADA SCIENCE FICTION TOUR 2024 台北小巨蛋 (加場)', artist: '宇多田光', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-11', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240412152815_utada.jpg', source: '遠大售票' },

  // --- IU 李知恩 ---
  { id: 'iu-her-2024-04-06', name: '2024 IU H.E.R. WORLD TOUR CONCERT IN TAIPEI 台北小巨蛋', artist: 'IU 李知恩', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-04-06', category: 'music', image: 'https://kktix.com/files/events/iu-her-2024/cover.jpg', source: 'KKTIX' },
  { id: 'iu-her-2024-04-07', name: '2024 IU H.E.R. WORLD TOUR CONCERT IN TAIPEI 台北小巨蛋 (加場)', artist: 'IU 李知恩', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-04-07', category: 'music', image: 'https://kktix.com/files/events/iu-her-2024/cover.jpg', source: 'KKTIX' },

  // --- YOASOBI ---
  { id: 'yoasobi-zepp-2024-01-21', name: 'YOASOBI ASIA TOUR 2023-2024 LIVE IN TAIPEI', artist: 'YOASOBI', venue_id: null, venue_name: 'Zepp New Taipei', city: '新北', date: '2024-01-21', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20231023_yoasobi.jpg', source: '遠大售票' },

  // --- King Gnu ---
  { id: 'king-gnu-2024-04-06', name: 'King Gnu Asia Tour 『THE GREATEST UNKNOWN』 in Taipei', artist: 'King Gnu', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-04-06', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240105_kinggnu.jpg', source: '遠大售票' },
  { id: 'king-gnu-2024-04-07', name: 'King Gnu Asia Tour 『THE GREATEST UNKNOWN』 in Taipei (加場)', artist: 'King Gnu', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-04-07', category: 'music', image: 'https://ticketplus.com.tw/upload/activity/20240105_kinggnu.jpg', source: '遠大售票' },

  // --- ONE OK ROCK ---
  { id: 'oor-kh-2024-09-21', name: 'ONE OK ROCK 2024 PREMONITION WORLD TOUR KAOHSIUNG', artist: 'ONE OK ROCK', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-09-21', category: 'music', image: 'https://kktix.com/files/events/oor-2024/cover.jpg', source: 'KKTIX' },
  { id: 'oor-tp-2023-09-16', name: 'ONE OK ROCK LUXURY DISEASE ASIA TOUR 2023 IN TAIPEI', artist: 'ONE OK ROCK', venue_id: null, venue_name: '南港展覽館一館', city: '台北', date: '2023-09-16', category: 'music', image: 'https://kktix.com/files/events/oor-2023/cover.jpg', source: 'KKTIX' },
  { id: 'oor-tp-2023-09-17', name: 'ONE OK ROCK LUXURY DISEASE ASIA TOUR 2023 IN TAIPEI (加場)', artist: 'ONE OK ROCK', venue_id: null, venue_name: '南港展覽館一館', city: '台北', date: '2023-09-17', category: 'music', image: 'https://kktix.com/files/events/oor-2023/cover.jpg', source: 'KKTIX' },

  // --- Super Junior ---
  { id: 'suju-spinoff-2024-08-16', name: '2024 SUPER JUNIOR <SPIN-OFF : Halftime> in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-16', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_suju_cover.jpg', source: '拓元售票' },
  { id: 'suju-spinoff-2024-08-17', name: '2024 SUPER JUNIOR <SPIN-OFF : Halftime> in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-17', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_suju_cover.jpg', source: '拓元售票' },
  { id: 'suju-spinoff-2024-08-18', name: '2024 SUPER JUNIOR <SPIN-OFF : Halftime> in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-08-18', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_suju_cover.jpg', source: '拓元售票' },
  { id: 'suju-ss9-2022-11-25', name: 'SUPER JUNIOR WORLD TOUR - SUPER SHOW 9: ROAD in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-11-25', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_suju_cover.jpg', source: '拓元售票' },
  { id: 'suju-ss9-2022-11-26', name: 'SUPER JUNIOR WORLD TOUR - SUPER SHOW 9: ROAD in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-11-26', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_suju_cover.jpg', source: '拓元售票' },
  { id: 'suju-ss9-2022-11-27', name: 'SUPER JUNIOR WORLD TOUR - SUPER SHOW 9: ROAD in TAIPEI 台北小巨蛋', artist: 'Super Junior', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-11-27', category: 'music', image: 'https://static.tixcraft.com/images/activity/22_suju_cover.jpg', source: '拓元售票' },

  // --- (G)I-DLE ---
  { id: 'gidle-idol-2024-10-04', name: '2024 (G)I-DLE WORLD TOUR [i-DOL] IN TAIPEI 台北小巨蛋', artist: '(G)I-DLE', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-04', category: 'music', image: 'https://kktix.com/files/events/gidle-2024/cover.jpg', source: 'KKTIX' },
  { id: 'gidle-idol-2024-10-05', name: '2024 (G)I-DLE WORLD TOUR [i-DOL] IN TAIPEI 台北小巨蛋', artist: '(G)I-DLE', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-05', category: 'music', image: 'https://kktix.com/files/events/gidle-2024/cover.jpg', source: 'KKTIX' },
  { id: 'gidle-idol-2024-10-06', name: '2024 (G)I-DLE WORLD TOUR [i-DOL] IN TAIPEI 台北小巨蛋', artist: '(G)I-DLE', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2024-10-06', category: 'music', image: 'https://kktix.com/files/events/gidle-2024/cover.jpg', source: 'KKTIX' },
  { id: 'gidle-freety-2023-07-01', name: '2023 (G)I-DLE WORLD TOUR [I am FREE-TY] IN TAIPEI 台北流行音樂中心', artist: '(G)I-DLE', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2023-07-01', category: 'music', image: 'https://kktix.com/files/events/gidle-2023/cover.jpg', source: 'KKTIX' },
  { id: 'gidle-freety-2023-07-02', name: '2023 (G)I-DLE WORLD TOUR [I am FREE-TY] IN TAIPEI 台北流行音樂中心', artist: '(G)I-DLE', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2023-07-02', category: 'music', image: 'https://kktix.com/files/events/gidle-2023/cover.jpg', source: 'KKTIX' },

  // --- aespa ---
  { id: 'aespa-synk-2024-08-09', name: '2024 aespa LIVE TOUR - SYNK : PARALLEL LINE - in TAIPEI 林口體育館', artist: 'aespa', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2024-08-09', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_aespa_cover.jpg', source: '拓元售票' },
  { id: 'aespa-synk-2024-08-10', name: '2024 aespa LIVE TOUR - SYNK : PARALLEL LINE - in TAIPEI 林口體育館', artist: 'aespa', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2024-08-10', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_aespa_cover.jpg', source: '拓元售票' },
  { id: 'aespa-synk-2024-08-11', name: '2024 aespa LIVE TOUR - SYNK : PARALLEL LINE - in TAIPEI 林口體育館', artist: 'aespa', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2024-08-11', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_aespa_cover.jpg', source: '拓元售票' },

  // --- IVE ---
  { id: 'ive-show-2024-03-02', name: '2024 IVE THE 1ST WORLD TOUR <SHOW WHAT I HAVE> IN TAIPEI 林口體育館', artist: 'IVE', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2024-03-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_ive_cover.jpg', source: '拓元售票' },
  { id: 'ive-show-2024-03-03', name: '2024 IVE THE 1ST WORLD TOUR <SHOW WHAT I HAVE> IN TAIPEI 林口體育館', artist: 'IVE', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2024-03-03', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_ive_cover.jpg', source: '拓元售票' },

  // --- Stray Kids ---
  { id: 'stray-kids-kh-2024-11-02', name: 'Stray Kids World Tour <dominATE KAOHSIUNG> 高雄國家體育場', artist: 'Stray Kids', venue_id: 'kaohsiung-natl', venue_name: '高雄國家體育場', city: '高雄', date: '2024-11-02', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_skz_cover.jpg', source: '拓元售票' },

  // --- Post Malone ---
  { id: 'post-malone-tp-2023-09-20', name: 'Post Malone: If Y\'all Weren\'t Here, I\'d Be Crying Tour in Taipei', artist: 'Post Malone', venue_id: null, venue_name: '南港展覽館一館', city: '台北', date: '2023-09-20', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_postmalone_cover.jpg', source: '拓元售票' },

  // --- 動力火車 Power Station ---
  { id: 'powerstation-2023-04-22', name: '動力火車「都是因為愛」世界巡迴演唱會 台北安可場 台北小巨蛋', artist: '動力火車', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-22', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_power_cover.jpg', source: '拓元售票' },
  { id: 'powerstation-2023-04-23', name: '動力火車「都是因為愛」世界巡迴演唱會 台北安可場 台北小巨蛋', artist: '動力火車', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-04-23', category: 'music', image: 'https://static.tixcraft.com/images/activity/23_power_cover.jpg', source: '拓元售票' },
  { id: 'powerstation-2024-04-20', name: '動力火車「都是因為愛」世界巡迴演唱會 高雄安可場 高雄巨蛋', artist: '動力火車', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2024-04-20', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_power_cover.jpg', source: '拓元售票' },
  { id: 'powerstation-2024-04-21', name: '動力火車「都是因為愛」世界巡迴演唱會 高雄安可場 高雄巨蛋', artist: '動力火車', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2024-04-21', category: 'music', image: 'https://static.tixcraft.com/images/activity/24_power_cover.jpg', source: '拓元售票' },

  // --- 草東沒有派對 ---
  { id: 'caodong-2024-05-24', name: '草東沒有派對《不介意的》巡迴演唱會 台北流行音樂中心', artist: '草東沒有派對', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-05-24', category: 'music', image: 'https://kktix.com/files/events/caodong-2024/cover.jpg', source: 'KKTIX' },
  { id: 'caodong-2024-05-25', name: '草東沒有派對《不介意的》巡迴演唱會 台北流行音樂中心', artist: '草東沒有派對', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-05-25', category: 'music', image: 'https://kktix.com/files/events/caodong-2024/cover.jpg', source: 'KKTIX' },
  { id: 'caodong-2024-05-26', name: '草東沒有派對《不介意的》巡迴演唱會 台北流行音樂中心', artist: '草東沒有派對', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-05-26', category: 'music', image: 'https://kktix.com/files/events/caodong-2024/cover.jpg', source: 'KKTIX' },

  // --- 韋禮安 ---
  { id: 'weibird-2022-09-10', name: '韋禮安 如果可以，我想和你明天再見 台北小巨蛋演唱會', artist: '韋禮安', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-09-10', category: 'music', image: 'https://kktix.com/files/events/weibird-2022/cover.jpg', source: 'KKTIX' },
  { id: 'weibird-2022-09-11', name: '韋禮安 如果可以，我想和你明天再見 台北小巨蛋演唱會 (加場)', artist: '韋禮安', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-09-11', category: 'music', image: 'https://kktix.com/files/events/weibird-2022/cover.jpg', source: 'KKTIX' },
  { id: 'weibird-2023-11-11', name: '韋禮安 如果可以，我想和你明天再見 台北小巨蛋安可場', artist: '韋禮安', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2023-11-11', category: 'music', image: 'https://kktix.com/files/events/weibird-2023/cover.jpg', source: 'KKTIX' },

  // --- 世界棒球12強賽 (Premier12 台北大巨蛋 5場) ---
  { id: 'wbsc-p12-2024-11-13', name: '2024 WBSC 第3屆世界12強棒球錦標賽：中華台北 vs 韓國', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-13', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-14', name: '2024 WBSC 第3屆世界12強棒球錦標賽：中華台北 vs 多明尼加', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-14', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-16', name: '2024 WBSC 第3屆世界12強棒球錦標賽：日本 vs 中華台北', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-16', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  { id: 'wbsc-p12-2024-11-17', name: '2024 WBSC 第3屆世界12強棒球錦標賽：中華台北 vs 澳洲', artist: '世界棒球12強賽', venue_id: 'taipei-dome', venue_name: '臺北大巨蛋', city: '台北', date: '2024-11-17', category: 'sport', image: 'https://static.tixcraft.com/images/activity/24_premier12_741bb87cb66922dca84988188ea6aa5a.jpg', source: '拓元售票' },
  // --- 蕭煌奇 Ricky Hsiao ---
  { id: 'hsiao-bravo-2026-09-18', name: '蕭煌奇2026〈BRAVO〉演唱會 台北小巨蛋 (加演場)', artist: '蕭煌奇', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2026-09-18', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1BG3E05_Large.JPG?v=202609161207', source: '寬宏售票' },
  { id: 'hsiao-bravo-2026-09-19', name: '蕭煌奇2026〈BRAVO〉演唱會 台北小巨蛋', artist: '蕭煌奇', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2026-09-19', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1BG3E05_Large.JPG?v=202609161207', source: '寬宏售票' },
  { id: 'hsiao-friend-2022-12-24', name: '蕭煌奇「朋友你現在好嗎？」20週年演唱會 台北小巨蛋', artist: '蕭煌奇', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-12-24', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1BG3E05_Large.JPG?v=202609161207', source: '寬宏售票' },
  { id: 'hsiao-friend-2022-12-25', name: '蕭煌奇「朋友你現在好嗎？」20週年演唱會 台北小巨蛋 (加場)', artist: '蕭煌奇', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2022-12-25', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1BG3E05_Large.JPG?v=202609161207', source: '寬宏售票' },
  { id: 'hsiao-theater-2019-11-30', name: '蕭煌奇「人生劇場放映中」小巨蛋演唱會 台北小巨蛋', artist: '蕭煌奇', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2019-11-30', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1BG3E05_Large.JPG?v=202609161207', source: '寬宏售票' },

  // --- 彭佳慧 Julia Peng ---
  { id: 'julia-peng-2026-10-03', name: '國泰世華銀行 彭佳慧《數著時間的日子》巡迴演唱會 台北小巨蛋', artist: '彭佳慧', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2026-10-03', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1B94C8Q_Large.JPG', source: '寬宏售票' },
  { id: 'julia-peng-2026-11-21', name: '國泰世華銀行 彭佳慧《數著時間的日子》巡迴演唱會 高雄巨蛋', artist: '彭佳慧', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2026-11-21', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1B94C8Q_Large.JPG', source: '寬宏售票' },

  // --- 宋念宇 (小宇) ---
  { id: 'xiaoyu-2026-11-07', name: '2026 小宇 宋念宇《不，完美的人》演唱會', artist: '宋念宇', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2026-11-07', category: 'music', image: 'https://imgs2.utiki.com.tw/Data/KHAM/Images/UTK2401/P1C62H76_Large.JPG', source: '寬宏售票' },

  // --- BABYMONSTER ---
  { id: 'babymonster-choom-2026-11-21', name: '2026-27 BABYMONSTER WORLD TOUR [춤(CHOOM)] IN TAIPEI 台北小巨蛋', artist: 'BABYMONSTER', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2026-11-21', category: 'music', image: 'https://static.ticketplus.com.tw/event/75a694bf61cb28f0e24835916cfae36e/picBigHomeThumbnail_1790679036685.jpeg', source: '遠大售票', url: 'https://ticketplus.com.tw/activity/75a694bf61cb28f0e24835916cfae36e', price: '400 - 6780' },
  { id: 'babymonster-choom-2026-11-22', name: '2026-27 BABYMONSTER WORLD TOUR [춤(CHOOM)] IN TAIPEI 台北小巨蛋', artist: 'BABYMONSTER', venue_id: 'taipei-arena', venue_name: '臺北小巨蛋', city: '台北', date: '2026-11-22', category: 'music', image: 'https://static.ticketplus.com.tw/event/75a694bf61cb28f0e24835916cfae36e/picBigHomeThumbnail_1790679036685.jpeg', source: '遠大售票', url: 'https://ticketplus.com.tw/activity/75a694bf61cb28f0e24835916cfae36e', price: '400 - 6780' },
  { id: 'babymonster-hello-2025-06-28', name: '2025 BABYMONSTER 1st WORLD TOUR <HELLO MONSTERS> IN TAIPEI 林口體育館', artist: 'BABYMONSTER', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2025-06-28', category: 'music', image: 'https://static.tixcraft.com/images/activity/25_babymonster_cover.jpg', source: '拓元售票', url: 'https://tixcraft.com/', price: '' },
  { id: 'babymonster-hello-2025-06-29', name: '2025 BABYMONSTER 1st WORLD TOUR <HELLO MONSTERS> IN TAIPEI 林口體育館', artist: 'BABYMONSTER', venue_id: null, venue_name: '國立體育大學綜合體育館(林口體育館)', city: '桃園', date: '2025-06-29', category: 'music', image: 'https://static.tixcraft.com/images/activity/25_babymonster_cover.jpg', source: '拓元售票', url: 'https://tixcraft.com/', price: '' },
  { id: 'babymonster-see-you-2024-06-23', name: '[BABYMONSTER PRESENTS : SEE YOU THERE] IN TAIPEI 台北流行音樂中心', artist: 'BABYMONSTER', venue_id: null, venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2024-06-23', category: 'music', image: 'https://kktix.com/files/events/babymonster-2024/cover.jpg', source: 'KKTIX', url: 'https://kktix.com/', price: '' },

  // --- SEVENTEEN DxS (DK & 勝寛) ---
  { id: 'svt-dxs-kh-2026-07-24', name: 'DxS [SERENADE] ON STAGE - KAOHSIUNG 高雄巨蛋', artist: 'SEVENTEEN', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2026-07-24', category: 'music', image: 'https://static.tixcraft.com/images/activity/26_dxs_cover.jpg', source: '拓元售票' },
  { id: 'svt-dxs-kh-2026-07-25', name: 'DxS [SERENADE] ON STAGE - KAOHSIUNG 高雄巨蛋', artist: 'SEVENTEEN', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2026-07-25', category: 'music', image: 'https://static.tixcraft.com/images/activity/26_dxs_cover.jpg', source: '拓元售票' },
  { id: 'svt-dxs-kh-2026-07-26', name: 'DxS [SERENADE] ON STAGE - KAOHSIUNG 高雄巨蛋', artist: 'SEVENTEEN', venue_id: 'kaohsiung-dome', venue_name: 'K-ARENA 高雄巨蛋', city: '高雄', date: '2026-07-26', category: 'music', image: 'https://static.tixcraft.com/images/activity/26_dxs_cover.jpg', source: '拓元售票' },

  // --- 潘越雲 ---
  { id: 'michelle-pan-2026-09-12', name: '潘越雲《坐看雲起時》演唱會 台北流行音樂中心', artist: '潘越雲', venue_id: 'taipei-music-center', venue_name: '台北流行音樂中心 表演廳', city: '台北', date: '2026-09-12', category: 'music', image: 'https://static.tixcraft.com/images/activity/26_michelle_cover.jpg', source: '拓元售票' },
]

for (const lm of ICONIC_LANDMARKS) {
  eventsMap.set(lm.id, {
    ...eventsMap.get(lm.id),
    ...lm,
  })
}

// 4. 清洗與去重 (Deduplication)
let excludedBusCount = 0
let excludedJunkCount = 0
let duplicateCount = 0

const dedupMap = new Map()

for (const [id, ev] of eventsMap.entries()) {
  if (!ev || !ev.name || !ev.date) continue

  if (isShuttleBusOrJunk(ev)) {
    if (BUS_EXCLUDE_REGEX.test(ev.name || '') || BUS_EXCLUDE_REGEX.test(ev.venue_name || '')) {
      excludedBusCount++
    } else {
      excludedJunkCount++
    }
    continue
  }

  // 規範日期格式為 YYYY-MM-DD（剔除如 2024-05-26 17:05 的時間尾綴）
  const cleanDate = String(ev.date).split(' ')[0].trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    continue
  }

  const artist = extractArtistFromName(ev.name, ev.artist, ev.category, ev.source)

  // 統一標題，剔除售票專區後綴與冠名，避免同場重複
  let cleanName = ev.name
    .replace(/^玉山銀行冠名贊助\s*/, '')
    .replace(/\s*玉山卡友專區$/, '')
    .replace(/\s*親子套票專區$/, '')
    .replace(/\s*國泰世華CUBE卡友專區$/, '')
    .replace(/\s*卡友專區$/, '')
    .trim()

  // 場館名稱正規化 (臺 -> 台，簡稱統一對齊)
  let normVenue = (ev.venue_name || ev.venue_raw || ev.city || 'venue').replace(/臺/g, '台').toLowerCase().replace(/[\s\-_]+/g, '')
  if (normVenue === '小巨蛋' || normVenue === 'taipeiarena' || normVenue.includes('台北小巨蛋')) {
    normVenue = '台北小巨蛋'
  } else if (normVenue === '大巨蛋' || normVenue === 'taipeidome' || normVenue.includes('台北大巨蛋')) {
    normVenue = '台北大巨蛋'
  } else if (normVenue.includes('世運') || normVenue.includes('國家體育場')) {
    normVenue = '高雄國家體育場'
  } else if (normVenue.includes('高雄巨蛋') || normVenue.includes('k-arena')) {
    normVenue = '高雄巨蛋'
  } else if (normVenue.includes('流行音樂中心') || normVenue.includes('北流')) {
    normVenue = '台北流行音樂中心'
  }
  const normArtist = (artist || 'unknown').toLowerCase()

  // 區分特殊同日午晚場 (如劉德華 11/02 午場與晚場、盧廣仲 早安場與晚安場)
  const sessionTag = /午場|早安場|下午場|晚安場/.test(cleanName)
    ? (cleanName.match(/午場|早安場|下午場|晚安場/)?.[0] || '')
    : ''

  // 核心去重 Key：歌手 + 日期 + 場館 + 場次標記
  const dedupKey = `${normArtist}|${cleanDate}|${normVenue}|${sessionTag}`

  const docId = String(ev.id || `${ev.source || 'ev'}-${cleanDate}-${cleanName}`).replace(/[\/\s#?]+/g, '-')

  const formattedEvent = {
    id: docId,
    name: cleanName,
    artist: artist,
    artist_keywords: generateKeywords(artist, cleanName, ev.venue_name || ev.venue_raw, ev.city),
    venue_id: ev.venue_id || null,
    venue_name: ev.venue_name || ev.venue_raw || null,
    city: ev.city || '',
    date: cleanDate,
    category: ev.category || (ev.source === '中華職棒' ? 'sport' : 'music'),
    image: ev.image || '',
    source: ev.source || '',
    url: ev.url || '',
    price: ev.price || '',
  }

  if (!dedupMap.has(dedupKey)) {
    dedupMap.set(dedupKey, formattedEvent)
  } else {
    duplicateCount++
    const existing = dedupMap.get(dedupKey)
    // 若既有紀錄缺圖或來源為第三方行事曆，優先升級為官方售票來源/含圖片之紀錄
    if (!existing.image && formattedEvent.image) {
      existing.image = formattedEvent.image
    }
    if (!existing.venue_name && formattedEvent.venue_name) {
      existing.venue_name = formattedEvent.venue_name
    }
    if (existing.source === 'webbboxx 行事曆' && formattedEvent.source !== 'webbboxx 行事曆') {
      existing.name = formattedEvent.name
      existing.source = formattedEvent.source
      if (formattedEvent.image) existing.image = formattedEvent.image
      if (formattedEvent.url) existing.url = formattedEvent.url
      if (formattedEvent.venue_id) existing.venue_id = formattedEvent.venue_id
    }
    // 指標歷史演唱會命名與正規場館優先於爬蟲抓取之簡稱
    if (
      formattedEvent.id.startsWith('hsiao-') ||
      formattedEvent.id.startsWith('julia-') ||
      formattedEvent.id.startsWith('mayday-') ||
      formattedEvent.id.startsWith('babymonster-') ||
      formattedEvent.id.startsWith('svt-') ||
      formattedEvent.id.startsWith('michelle-')
    ) {
      existing.name = formattedEvent.name
      if (formattedEvent.venue_name) existing.venue_name = formattedEvent.venue_name
      if (formattedEvent.venue_id) existing.venue_id = formattedEvent.venue_id
    }
  }
}

const cleanEvents = Array.from(dedupMap.values())
cleanEvents.sort((a, b) => b.date.localeCompare(a.date))

const artistWithCount = cleanEvents.filter(e => e.artist).length

console.log(`\n================= 洗滌成果統計 =================`)
console.log(`✅ 最終純淨且獨立場次筆數：${cleanEvents.length} 場`)
console.log(`🔄 成功整併/消除重複票種與場次：${duplicateCount} 場`)
console.log(`🚫 成功過濾專車/接駁：${excludedBusCount} 場（已全數剔除）`)
console.log(`🚫 成功過濾非活動無效雜項：${excludedJunkCount} 場`)
console.log(`🎤 成功標註/識別歌手比例：${artistWithCount} 場 (${(artistWithCount / cleanEvents.length * 100).toFixed(1)}%)`)
console.log(`================================================\n`)

// 寫入 public/historical-events.json
const payload = {
  updated_at: new Date().toISOString(),
  count: cleanEvents.length,
  events: cleanEvents,
}

writeFileSync(historicalJsonPath, JSON.stringify(payload, null, 2), 'utf-8')
console.log(`💾 成功儲存更新至 ${historicalJsonPath}`)
