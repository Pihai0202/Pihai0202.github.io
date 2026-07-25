import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'zh-TW' | 'en' | 'ja' | 'ko'

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations: Record<Language, Record<string, string>> = {
  'zh-TW': {
    // Header
    title: '台灣演唱會地圖',
    subtitle: 'TAIWAN CONCERT LOG',
    searchPlaceholder: '搜尋歌手、售票或場館...',
    statConcerts: '演唱會',
    statVenues: '場館',
    statTickets: '售票',
    statMedia: '照片',
    tabMap: '場館地圖',
    tabList: '活動列表',
    tabSearch: '搜尋活動',
    tabCalendar: '活動行事曆',
    tabCommunity: '社群分享牆',
    siteTour: '網站導覽',
    login: '登入',
    profile: '個人資料',
    logout: '登出',
    langToggle: '🌐 EN',
    langTitle: '切換為英文',

    // Map Panel
    searchVenue: '搜尋場館...',
    noVenues: '找不到符合的場館',
    北部地區: '北部地區',
    中部地區: '中部地區',
    南部地區: '南部地區',
    東部地區: '東部地區',
    其他地區: '其他地區',
    unvisited: '尚未造訪',
    visited: '已去過',
    selected: '選取中',
    allLogs: '全部記錄',
    visitedBadgeText: '✓ 已拜訪過此場館',
    countyVenuesCount: '🏟️ {count} 個演唱會場館',
    capacityPeople: '{capacity} 人',
    shuangbeiCluster: '雙北場館',

    // Calendar Panel
    myRecords: '我的記錄',
    upcomingTickets: '近期售票',
    all: '全部',
    searchCalendar: '搜尋日期、演出或場館...',
    gridMode: '行事曆',
    listMode: '清單',
    addEventTitle: '在此日期新增活動',
    addEventBtn: '＋ 新增此日活動',
    noEventsDate: '此日期目前沒有登錄任何活動。',
    price: '票價',
    venue: '場館',
    date: '日期',
    time: '時間',
    deleteBtn: '刪除',
    confirmDelete: '確認要刪除此筆演唱會記錄嗎？',
    loadingTickets: '正在讀取近期售票活動...',
    noTicketsFound: '目前沒有近期售票資料',
    ticketUpdate: '更新：{time}',
    clearVenueFilter: '(清除場館看全台)',
    showAllTickets: '顯示所有售票資訊 (還有 {count} 筆) ▾',
    hideAllTickets: '收起售票資訊 ▴',
    concertCountUnit: '查看此場館的演唱會記錄 ({count} 次)',

    // Add Concert Modal
    addConcertTitle: '新增演唱會 / 自訂活動',
    formVenue: '活動場館',
    selectVenuePlaceholder: '-- 請選擇場館 --',
    customVenueOpt: '其他 / 自訂場館',
    customVenueLabel: '自訂場館名稱',
    customVenuePlaceholder: 'e.g. 國家音樂廳、Legacy Mini...',
    customCityLabel: '縣市',
    artistLabel: '演出者 / 團體',
    artistPlaceholder: 'e.g. 周杰倫、五月天...',
    concertNameLabel: '演唱會名稱',
    concertNamePlaceholder: 'e.g. 魔天倫世界巡迴演唱會',
    dateLabel: '日期',
    seatLabel: '座位 / 區域',
    seatPlaceholder: 'e.g. 特A區、2樓黃2C區、搖滾區35號...',
    notesLabel: '觀後心得 & 心情手札 (支援 Markdown)',
    notesPlaceholder: '寫下你的心得、歌單、或任何感動的瞬間...\n支援 Markdown 語法 (如: # 標題, **粗體**, - 清單)\n小提示: 可以在下方搜尋並加入 Spotify 歌手或專輯連結，讓心得更生動！',
    spotifySearchLabel: '搜尋並加入 Spotify 連結 (選填)',
    spotifySearchPlaceholder: '輸入歌手或專輯名稱...',
    spotifySearchBtn: '搜尋',
    spotifyTypeArtist: '歌手',
    spotifyTypeAlbum: '專輯',
    spotifyTypeTrack: '歌曲',
    spotifySearchEmpty: '找不到相關音樂，請嘗試其他關鍵字',
    uploadPhotoLabel: '上傳活動照片 (選填，最多 3 張，限制每張 5MB)',
    uploadPhotoHint: '支援 jpg, png, gif。相片可加在社群分享牆中！',
    saveBtn: '儲存紀錄',
    cancelBtn: '取消',

    // Ticket Details Modal
    ticketDetailTitle: '售票活動詳情',
    buyTicketBtn: '立即購票',
    activitySource: '活動來源',
    priceInfo: '票價資訊',
    activityDate: '活動時間',
    activityVenue: '活動場館',
    logThisConcert: '將此活動加入我的演唱會紀錄',

    // Profile Page
    myProfile: '我的個人資料',
    fanStats: '樂迷足跡統計',
    visitedVenues: '已造訪場館 ({count} 個)',
    avatarLabel: '樂迷頭像',
    nicknameLabel: '樂迷暱稱',
    nicknamePlaceholder: '輸入您的暱稱...',
    updateProfileBtn: '更新個人資料 💾',
    profileLogCount: '演唱會紀錄：{count} 次',
    profileMediaCount: '照片數量：{count} 張',
    myConcertLogs: '我的演唱會記錄清單',
    noLogsProfile: '還沒有任何記錄，點擊地圖上的場館開始新增！',
    backBtn: '返回地圖',
    changeAvatarHint: '點擊頭像可隨機切換角色圖案喔！',

    // Login Page
    joinApp: '加入台灣演唱會地圖',
    loginApp: '登入您的帳戶',
    signUpSubtitle: '註冊以開啟發佈功能，分享專屬樂迷心得！',
    signInSubtitle: '登入帳戶，記錄與分享你的音樂現場足跡',
    nicknameForm: '暱稱',
    emailForm: '電子信箱',
    passwordForm: '密碼',
    passwordPlaceholder: '至少 6 位密碼',
    signInBtn: '登入',
    signUpBtn: '註冊',
    googleSignIn: '使用 Google 帳戶登入',
    toSignUpPrompt: '還沒有帳戶？立即註冊',
    toSignInPrompt: '已經有帳戶了？立即登入',
    emailFormatError: '請輸入格式正確的信箱！',
    passwordLengthError: '密碼長度必須至少為 6 個字元！',
    nicknameEmptyError: '請輸入暱稱！',

    // Transit Page
    transitTitle: '大眾運輸即時動態',
    highSpeedRail: '台灣高鐵',
    taiwanRailway: '台鐵火車',
    metroTransit: '捷運系統',
    hsrSearch: '高鐵時刻查詢 🚄',
    traSearch: '台鐵時刻查詢 🚂',
    metroTaipei: '台北捷運 🚇',
    metroNewTaipei: '新北捷運 🚇',
    metroTaoyuan: '桃園捷運 🚇',
    metroTaichung: '台中捷運 🚇',
    metroKaohsiung: '高雄捷運 🚇',
    busSearch: '全台公車動態 🚌',
    ubikeSearch: 'YouBike 單車查詢 🚲',
    transitTip: '💡 小提示：大螢幕演唱會散場時，建議提前查詢末班車時間或使用行動支付進站，以節省排隊時間。',

    // Spotify bar
    spotifyPlayerTitle: '音樂播放器',
    spotifyPlayerPlaceholder: '在演唱會記錄中加入 Spotify 連結，點擊卡片即可在此播放',
    spotifyPlayerCollapse: '收起播放器',

    // Weather Panel
    weatherTitle: '即時天氣預報',
    feelsLike: '體感溫度',
    humidity: '相對濕度',
    windSpeed: '當前風速',
    windUnit: 'km/h',
    aqiLabel: '空氣品質指數',
    aqiStatus: 'AQI',
    sevenDayForecast: '七日天氣預報',
    viewDetails: '查看場館詳情 ➔',
    weatherClose: '關閉',
    todayConcertsTitle: '🔥 今日在此場館演出：',

    // Share Board
    socialWallTitle: '樂迷分享牆',
    socialWallSubtitle: 'FAN COMMUNITY BOARD',
    postCountTip: '共 {count} 則樂迷分享',
    likeBtn: '讚 {count}',
    shareLogBtn: '分享觀後感',
    postAuthor: '樂迷 {author}',
    anonymousAuthor: '匿名樂迷',
    postConcertDetail: '關於 {artist} - {concert}',
    shareConfirmTitle: '分享觀後感至社群牆',
    shareConfirmPrompt: '您即將把關於 {artist} - {concert} 的觀後心得發佈至公開分享牆！',
    shareNicknameLabel: '請輸入您的暱稱 (將公開顯示)',
    shareNicknamePlaceholder: 'e.g. 搖滾區小精靈 (留空則以「匿名樂迷」發佈)',
    shareSubmitBtn: '確認發佈',

    // Suspension
    suspensionTitle: '天然災害停班停課公告',
    suspensionSource: '行政院人事行政總處 (更新時間：{time})',
    suspensionStop: '停止上班上課縣市',
    suspensionNormal: '照常上班上課縣市 ({count})',
    suspensionDismiss: '本日不再顯示',
    suspensionClose: '關閉',
  },
  en: {
    // Header
    title: 'Taiwan Concert Map',
    subtitle: 'TAIWAN CONCERT LOG',
    searchPlaceholder: 'Search artists, tickets, or venues...',
    statConcerts: 'Concerts',
    statVenues: 'Venues',
    statTickets: 'Tickets',
    statMedia: 'Photos',
    tabMap: 'Venue Map',
    tabList: 'Concert List',
    tabSearch: 'Search Events',
    tabCalendar: 'Calendar',
    tabCommunity: 'Community',
    siteTour: 'Site Tour',
    login: 'Login',
    profile: 'Profile',
    logout: 'Logout',
    langToggle: '🌐 繁中',
    langTitle: 'Switch to Chinese',

    // Map Panel
    searchVenue: 'Search venues...',
    noVenues: 'No matching venues found',
    北部地區: 'North',
    中部地區: 'Central',
    南部地區: 'South',
    東部地區: 'East',
    其他地區: 'Others',
    unvisited: 'Unvisited',
    visited: 'Visited',
    selected: 'Selected',
    allLogs: 'All Logs',
    visitedBadgeText: '✓ Visited this venue',
    countyVenuesCount: '🏟️ {count} venues',
    capacityPeople: '{capacity} capacity',
    shuangbeiCluster: 'Shuangbei',

    // Calendar Panel
    myRecords: 'My Logs',
    upcomingTickets: 'Upcoming Tickets',
    all: 'All',
    searchCalendar: 'Search dates, artists, or venues...',
    gridMode: 'Calendar',
    listMode: 'List',
    addEventTitle: 'Add event on this date',
    addEventBtn: '＋ Add event',
    noEventsDate: 'No events registered for this date.',
    price: 'Price',
    venue: 'Venue',
    date: 'Date',
    time: 'Time',
    deleteBtn: 'Delete',
    confirmDelete: 'Are you sure you want to delete this concert log?',
    loadingTickets: 'Loading ticketing events...',
    noTicketsFound: 'No upcoming tickets found',
    ticketUpdate: 'Updated: {time}',
    clearVenueFilter: '(Show Taiwan)',
    showAllTickets: 'Show all tickets ({count} more) ▾',
    hideAllTickets: 'Hide tickets ▴',
    concertCountUnit: 'Concert logs at this venue ({count} times)',

    // Add Concert Modal
    addConcertTitle: 'Add Concert / Custom Event',
    formVenue: 'Venue',
    selectVenuePlaceholder: '-- Select Venue --',
    customVenueOpt: 'Other / Custom Venue',
    customVenueLabel: 'Custom Venue Name',
    customVenuePlaceholder: 'e.g. National Concert Hall, Legacy Mini...',
    customCityLabel: 'City',
    artistLabel: 'Artist / Band',
    artistPlaceholder: 'e.g. Jay Chou, Mayday...',
    concertNameLabel: 'Concert Name',
    concertNamePlaceholder: 'e.g. Opus Jay World Tour',
    dateLabel: 'Date',
    seatLabel: 'Seat / Section',
    seatPlaceholder: 'e.g. Floor VIP, 2F Yellow 2C, GA 35...',
    notesLabel: 'Notes & Diary (Supports Markdown)',
    notesPlaceholder: 'Write your thoughts, setlists, or unforgettable moments...\nSupports Markdown (e.g. # Title, **Bold**, - List)\nTip: Search and insert a Spotify link below to make it lively!',
    spotifySearchLabel: 'Search & Link Spotify (Optional)',
    spotifySearchPlaceholder: 'Enter artist or album name...',
    spotifySearchBtn: 'Search',
    spotifyTypeArtist: 'Artist',
    spotifyTypeAlbum: 'Album',
    spotifyTypeTrack: 'Track',
    spotifySearchEmpty: 'No results found. Try other keywords.',
    uploadPhotoLabel: 'Upload Photos (Optional, max 3, 5MB each)',
    uploadPhotoHint: 'Supports jpg, png, gif. Photos can be shared to Community!',
    saveBtn: 'Save Log',
    cancelBtn: 'Cancel',

    // Ticket Details Modal
    ticketDetailTitle: 'Ticket Details',
    buyTicketBtn: 'Buy Ticket',
    activitySource: 'Source',
    priceInfo: 'Price Info',
    activityDate: 'Event Date',
    activityVenue: 'Event Venue',
    logThisConcert: 'Add this to my concert logs',

    // Profile Page
    myProfile: 'My Profile',
    fanStats: 'Fan Stats',
    visitedVenues: 'Visited Venues ({count})',
    avatarLabel: 'Avatar',
    nicknameLabel: 'Nickname',
    nicknamePlaceholder: 'Enter your nickname...',
    updateProfileBtn: 'Update Profile 💾',
    profileLogCount: 'Concert Logs: {count} times',
    profileMediaCount: 'Photos: {count}',
    myConcertLogs: 'My Concert Log List',
    noLogsProfile: 'No records yet. Click a venue on the map to add!',
    backBtn: 'Back to Map',
    changeAvatarHint: 'Click the avatar to randomly switch characters!',

    // Login Page
    joinApp: 'Join Taiwan Concert Map',
    loginApp: 'Log In to Your Account',
    signUpSubtitle: 'Register to unlock sharing features and fan reviews!',
    signInSubtitle: 'Log in to record and share your live music footprint',
    nicknameForm: 'Nickname',
    emailForm: 'Email',
    passwordForm: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    signInBtn: 'Sign In',
    signUpBtn: 'Sign Up',
    googleSignIn: 'Sign In with Google',
    toSignUpPrompt: "Don't have an account? Sign Up",
    toSignInPrompt: 'Already have an account? Sign In',
    emailFormatError: 'Please enter a valid email address!',
    passwordLengthError: 'Password must be at least 6 characters long!',
    nicknameEmptyError: 'Please enter a nickname!',

    // Transit Page
    transitTitle: 'Real-time Transit Info',
    highSpeedRail: 'High Speed Rail (HSR)',
    taiwanRailway: 'TRA Train',
    metroTransit: 'MRT Metro Systems',
    hsrSearch: 'HSR Timetable 🚄',
    traSearch: 'TRA Timetable 🚂',
    metroTaipei: 'Taipei MRT 🚇',
    metroNewTaipei: 'New Taipei MRT 🚇',
    metroTaoyuan: 'Taoyuan MRT 🚇',
    metroTaichung: 'Taichung MRT 🚇',
    metroKaohsiung: 'Kaohsiung MRT 🚇',
    busSearch: 'Bus Dynamic Info 🚌',
    ubikeSearch: 'YouBike Station Query 🚲',
    transitTip: '💡 Tip: When concerts end, check last train times or use mobile ticketing beforehand to avoid long queues.',

    // Spotify bar
    spotifyPlayerTitle: 'Music Player',
    spotifyPlayerPlaceholder: 'Add a Spotify link to your concert logs and click to play here',
    spotifyPlayerCollapse: 'Collapse Player',

    // Weather Panel
    weatherTitle: 'Real-time Weather',
    feelsLike: 'Feels Like',
    humidity: 'Humidity',
    windSpeed: 'Wind Speed',
    windUnit: 'km/h',
    aqiLabel: 'Air Quality Index',
    aqiStatus: 'AQI',
    sevenDayForecast: '7-Day Forecast',
    viewDetails: 'View Venue Details ➔',
    weatherClose: 'Close',
    todayConcertsTitle: '🔥 Performing here today:',

    // Share Board
    socialWallTitle: 'Fan Community Board',
    socialWallSubtitle: 'FAN COMMUNITY BOARD',
    postCountTip: '{count} fan posts in total',
    likeBtn: 'Like {count}',
    shareLogBtn: 'Share My Review',
    postAuthor: 'Fan {author}',
    anonymousAuthor: 'Anonymous Fan',
    postConcertDetail: 'On {artist} - {concert}',
    shareConfirmTitle: 'Share Review to Community',
    shareConfirmPrompt: 'You are going to publish your review of {artist} - {concert} to the community board!',
    shareNicknameLabel: 'Please enter your nickname (publicly displayed)',
    shareNicknamePlaceholder: 'e.g. Rock精靈 (Leave empty to publish anonymously)',
    shareSubmitBtn: 'Confirm & Publish',

    // Suspension
    suspensionTitle: 'Natural Disaster Work & School Suspension Announcement',
    suspensionSource: 'Directorate-General of Personnel Administration, Executive Yuan (Updated: {time})',
    suspensionStop: 'Work and Class Suspended',
    suspensionNormal: 'Work and Class as Usual ({count})',
    suspensionDismiss: "Don't show again today",
    suspensionClose: 'Close',
  },
  'ja': {
    // Header
    title: '台湾コンサートマップ',
    subtitle: 'TAIWAN CONCERT LOG',
    searchPlaceholder: 'アーティスト、チケット、会場を検索...',
    statConcerts: 'コンサート',
    statVenues: '会場',
    statTickets: 'チケット販売',
    statMedia: '写真',
    tabMap: '会場マップ',
    tabList: 'イベント一覧',
    tabSearch: 'イベント検索',
    tabCalendar: 'イベントカレンダー',
    tabCommunity: 'コミュニティ掲示板',
    siteTour: 'サイトガイド',
    login: 'ログイン',
    profile: 'プロフィール',
    logout: 'ログアウト',
    langToggle: '🌐 日本語',
    langTitle: '日本語に切り替え',

    // Map Panel
    searchVenue: '会場を検索...',
    noVenues: '該当する会場が見つかりません',
    北部地區: '北部地区',
    中部地區: '中部地区',
    南部地區: '南部地区',
    東部地區: '東部地区',
    其他地區: 'その他の地区',
    unvisited: '未訪問',
    visited: '訪問済み',
    selected: '選択中',
    allLogs: 'すべての記録',
    visitedBadgeText: '✓ この会場を訪問しました',
    countyVenuesCount: '🏟️ {count} 個の会場',
    capacityPeople: '{capacity} 人',
    shuangbeiCluster: '双北会場',

    // Calendar Panel
    myRecords: 'マイログ',
    upcomingTickets: '近日発売チケット',
    all: 'すべて',
    searchCalendar: '日付、アーティスト、会場を検索...',
    gridMode: 'カレンダー',
    listMode: 'リスト',
    addEventTitle: 'この日付にイベントを追加',
    addEventBtn: '＋ イベントを追加',
    noEventsDate: 'この日付に登録されたイベントはありません。',
    price: 'チケット料金',
    venue: '会場',
    date: '日付',
    time: '時間',
    deleteBtn: '削除',
    confirmDelete: 'このコンサート記録を削除しますか？',
    loadingTickets: '近日発売のチケット情報を読み込み中...',
    noTicketsFound: '現在、近日発売のチケット情報はありません',
    ticketUpdate: '更新：{time}',
    clearVenueFilter: '(全国を表示)',
    showAllTickets: 'すべてのチケット情報を表示 (あと {count} 件) ▾',
    hideAllTickets: 'チケット情報を閉じる ▴',
    concertCountUnit: 'この会場でのコンサート記録 ({count} 回)',

    // Add Concert Modal
    addConcertTitle: 'コンサート/カスタムイベントの追加',
    formVenue: 'イベント会場',
    selectVenuePlaceholder: '-- 会場を選択 --',
    customVenueOpt: 'その他 / カスタム会場',
    customVenueLabel: 'カスタム会場名',
    customVenuePlaceholder: 'e.g. 国家音楽庁、Legacy Mini...',
    customCityLabel: '市区町村',
    artistLabel: 'アーティスト / グループ',
    artistPlaceholder: 'e.g. 周杰倫、五月天...',
    concertNameLabel: 'コンサート名',
    concertNamePlaceholder: 'e.g. Opus Jay World Tour',
    dateLabel: '日付',
    seatLabel: '座席 / エリア',
    seatPlaceholder: 'e.g. アリーナA区、2階黄2C区、立ち見35番...',
    notesLabel: 'ライブレポ & 日記 (Markdown対応)',
    notesPlaceholder: '感想、セットリスト、感動した瞬間を書き留めましょう...\nMarkdown形式に対応 (例: # 見出し, **太字**, - リスト)\nヒント: 下部でSpotifyのアーティストやアルバムを検索して追加すると、より鮮やかになります！',
    spotifySearchLabel: 'Spotifyリンクを検索して追加 (任意)',
    spotifySearchPlaceholder: 'アーティストやアルバム名を入力...',
    spotifySearchBtn: '検索',
    spotifyTypeArtist: 'アーティスト',
    spotifyTypeAlbum: 'アルバム',
    spotifyTypeTrack: '楽曲',
    spotifySearchEmpty: '関連する音楽が見つかりません。他のキーワードを試してください。',
    uploadPhotoLabel: 'イベント写真のアップロード (任意、最大3枚、各5MB制限)',
    uploadPhotoHint: 'jpg, png, gifに対応。写真はコミュニティ掲示板で共有されます！',
    saveBtn: '記録を保存',
    cancelBtn: 'キャンセル',

    // Ticket Details Modal
    ticketDetailTitle: 'チケット詳細',
    buyTicketBtn: 'チケットを購入',
    activitySource: 'イベントソース',
    priceInfo: '料金情報',
    activityDate: '開催日時',
    activityVenue: 'イベント会場',
    logThisConcert: 'このイベントをマイログに追加する',

    // Profile Page
    myProfile: 'マイプロフィール',
    fanStats: 'ファン統計',
    visitedVenues: '訪問した会場 ({count} 箇所)',
    avatarLabel: 'アバター',
    nicknameLabel: 'ニックネーム',
    nicknamePlaceholder: 'ニックネームを入力...',
    updateProfileBtn: 'プロフィールを更新 💾',
    profileLogCount: 'コンサート記録：{count} 回',
    profileMediaCount: '写真枚数：{count} 枚',
    myConcertLogs: 'コンサート記録一覧',
    noLogsProfile: 'まだ記録がありません。マップ上の会場をクリックして追加しましょう！',
    backBtn: 'マップに戻る',
    changeAvatarHint: 'アバターをクリックするとランダムにキャラクターが切り替わります！',

    // Login Page
    joinApp: '台湾コンサートマップに参加',
    loginApp: 'アカウントにログイン',
    signUpSubtitle: '会員登録して投稿機能を開放し、ファン同士で感想を共有しましょう！',
    signInSubtitle: 'ログインして、あなたのライブ現場の足跡を記録・共有しましょう',
    nicknameForm: 'ニック네임',
    emailForm: 'メールアドレス',
    passwordForm: 'パスワード',
    passwordPlaceholder: '6文字以上のパスワード',
    signInBtn: 'ログイン',
    signUpBtn: '登録',
    googleSignIn: 'Googleアカウントでログイン',
    toSignUpPrompt: 'アカウントをお持ちでないですか？今すぐ登録',
    toSignInPrompt: '既にアカウントをお持ちですか？ログイン',
    emailFormatError: '正しい形式のメールアドレスを入力してください！',
    passwordLengthError: 'パスワードは6文字以上にする必要があります！',
    nicknameEmptyError: 'ニックネームを入力してください！',

    // Transit Page
    transitTitle: '公共交通機関リアルタイム運行情報',
    highSpeedRail: '台湾高鉄 (新幹線)',
    taiwanRailway: '台湾鉄道 (在来線)',
    metroTransit: 'メトロ (MRT) システム',
    hsrSearch: '新幹線時刻表検索 🚄',
    traSearch: '在来線時刻表検索 🚂',
    metroTaipei: '台北メトロ 🚇',
    metroNewTaipei: '新北メトロ 🚇',
    metroTaoyuan: '桃園メトロ 🚇',
    metroTaichung: '台中メトロ 🚇',
    metroKaohsiung: '高雄メトロ 🚇',
    busSearch: 'バスリアルタイム情報 🚌',
    ubikeSearch: 'YouBike 自転車空き状況 🚲',
    transitTip: '💡 ヒント: 終演時は混잡するため、あらかじめ最終電車の時間を確認したり、モバイル乗車券を用意しておくことをお勧めします。',

    // Spotify bar
    spotifyPlayerTitle: '音楽プレーヤー',
    spotifyPlayerPlaceholder: 'コンサート記録にSpotifyリンクを追加し、カードをクリックするとここで再生されます',
    spotifyPlayerCollapse: 'プレーヤーを閉じる',

    // Weather Panel
    weatherTitle: 'リアルタイム天気予報',
    feelsLike: '体感温度',
    humidity: '相対湿度',
    windSpeed: '現在の風速',
    windUnit: 'km/h',
    aqiLabel: '空気質指数',
    aqiStatus: 'AQI',
    sevenDayForecast: '7日間天気予報',
    viewDetails: '会場の詳細を表示 ➔',
    weatherClose: '閉じる',
    todayConcertsTitle: '🔥 本日この会場で開催される公演：',

    // Share Board
    socialWallTitle: 'ファン共有掲示板',
    socialWallSubtitle: 'FAN COMMUNITY BOARD',
    postCountTip: '合計 {count} 件の投稿',
    likeBtn: 'いいね {count}',
    shareLogBtn: '感想を共有する',
    postAuthor: 'ファン {author}',
    anonymousAuthor: '匿名ファン',
    postConcertDetail: '{artist} - {concert} について',
    shareConfirmTitle: '掲示板に感想を共有',
    shareConfirmPrompt: '{artist} - {concert} の感想を共有掲示板に公開しますか？',
    shareNicknameLabel: 'ニックネームを入力してください (公開されます)',
    shareNicknamePlaceholder: 'e.g. Rock精靈 (空欄の場合は「匿名ファン」として投稿されます)',
    shareSubmitBtn: '投稿する',

    // Suspension
    suspensionTitle: '自然災害に伴う出勤・登校の停止公告',
    suspensionSource: '行政院人事行政総処 (更新時間：{time})',
    suspensionStop: '出勤・登校停止の自治体',
    suspensionNormal: '通常通り出勤・登校の自治体 ({count})',
    suspensionDismiss: '本日は再表示しない',
    suspensionClose: '閉じる',
  },
  'ko': {
    // Header
    title: '대만 콘서트 지도',
    subtitle: 'TAIWAN CONCERT LOG',
    searchPlaceholder: '아티스트, 티켓, 공연장 검색...',
    statConcerts: '콘서트',
    statVenues: '공연장',
    statTickets: '티켓 판매',
    statMedia: '사진',
    tabMap: '공연장 지도',
    tabList: '이벤트 목록',
    tabSearch: '이벤트 검색',
    tabCalendar: '이벤트 캘린더',
    tabCommunity: '커뮤니티 공유판',
    siteTour: '사이트 안내',
    login: '로그인',
    profile: '프로필',
    logout: '로그아웃',
    langToggle: '🌐 한국어',
    langTitle: '한국어로 전환',

    // Map Panel
    searchVenue: '공연장 검색...',
    noVenues: '일치하는 공연장을 찾을 수 없습니다',
    北部地區: '북부 지역',
    中部地區: '중부 지역',
    南部地區: '남부 지역',
    東部地區: '동부 지역',
    其他地區: '기타 지역',
    unvisited: '미방문',
    visited: '방문함',
    selected: '선택됨',
    allLogs: '전체 기록',
    visitedBadgeText: '✓ 이 공연장을 방문했습니다',
    countyVenuesCount: '🏟️ {count}개 공연장',
    capacityPeople: '{capacity}명',
    shuangbeiCluster: '쌍북 공연장',

    // Calendar Panel
    myRecords: '내 기록',
    upcomingTickets: '최근 예매 티켓',
    all: '전체',
    searchCalendar: '날짜, 아티스트, 공연장 검색...',
    gridMode: '캘린더',
    listMode: '리스트',
    addEventTitle: '이 날짜에 이벤트 추가',
    addEventBtn: '＋ 이벤트 추가',
    noEventsDate: '이 날짜에 등록된 이벤트가 없습니다.',
    price: '티켓 가격',
    venue: '공연장',
    date: '날짜',
    time: '시간',
    deleteBtn: '삭제',
    confirmDelete: '이 콘서트 기록을 삭제하시겠습니까?',
    loadingTickets: '예매 티켓 정보를 불러오는 중...',
    noTicketsFound: '현재 예매 정보가 없습니다',
    ticketUpdate: '업데이트: {time}',
    clearVenueFilter: '(전국 보기)',
    showAllTickets: '모든 티켓 정보 표시 (남은 {count}건) ▾',
    hideAllTickets: '티켓 정보 접기 ▴',
    concertCountUnit: '이 공연장 콘서트 기록 ({count}회)',

    // Add Concert Modal
    addConcertTitle: '콘서트 / 커스텀 이벤트 추가',
    formVenue: '이벤트 공연장',
    selectVenuePlaceholder: '-- 공연장 선택 --',
    customVenueOpt: '기타 / 직접 입력',
    customVenueLabel: '직접 입력한 공연장 이름',
    customVenuePlaceholder: '예: 국립극장, Legacy Mini...',
    customCityLabel: '시/도',
    artistLabel: '아티스트 / 그룹',
    artistPlaceholder: '예: 주걸륜, 오월천...',
    concertNameLabel: '콘서트 이름',
    concertNamePlaceholder: '예: Opus Jay World Tour',
    dateLabel: '날짜',
    seatLabel: '좌석 / 구역',
    seatPlaceholder: '예: 그라운드 A구역, 2층 Yellow 2C구역, 스탠딩 35번...',
    notesLabel: '공연 후기 & 다이어리 (Markdown 지원)',
    notesPlaceholder: '후기, 셋리스트, 감동적인 순간을 적어보세요...\nMarkdown 지원 (예: # 제목, **굵게**, - 목록)\n팁: 아래에서 Spotify 아티스트나 앨범을 검색해서 추가하면 더욱 생생하게 기록할 수 있습니다!',
    spotifySearchLabel: 'Spotify 링크 검색 및 추가 (선택)',
    spotifySearchPlaceholder: '아티스트 또는 앨범명 입력...',
    spotifySearchBtn: '검색',
    spotifyTypeArtist: '아티스트',
    spotifyTypeAlbum: '앨범',
    spotifyTypeTrack: '곡',
    spotifySearchEmpty: '관련 음악을 찾을 수 없습니다. 다른 키워드로 검색해 보세요.',
    uploadPhotoLabel: '사진 업로드 (선택, 최대 3장, 장당 5MB 제한)',
    uploadPhotoHint: 'jpg, png, gif 지원. 업로드한 사진은 공유판에 노출될 수 있습니다!',
    saveBtn: '기록 저장',
    cancelBtn: '취소',

    // Ticket Details Modal
    ticketDetailTitle: '티켓 세부 정보',
    buyTicketBtn: '예매하러 가기',
    activitySource: '출처',
    priceInfo: '티켓 가격 정보',
    activityDate: '이벤트 시간',
    activityVenue: '이벤트 공연장',
    logThisConcert: '이 이벤트를 내 콘서트 기록에 추가',

    // Profile Page
    myProfile: '내 프로필',
    fanStats: '팬 활동 통계',
    visitedVenues: '방문한 공연장 ({count}개)',
    avatarLabel: '아바타',
    nicknameLabel: '닉네임',
    nicknamePlaceholder: '닉네임 입력...',
    updateProfileBtn: '프로필 업데이트 💾',
    profileLogCount: '콘서트 기록: {count}회',
    profileMediaCount: '사진 개수: {count}개',
    myConcertLogs: '내 콘서트 기록 목록',
    noLogsProfile: '기록이 없습니다. 지도에서 공연장을 선택하고 기록을 남겨보세요!',
    backBtn: '지도로 돌아가기',
    changeAvatarHint: '아바타를 클릭하면 무작위로 캐릭터가 변경됩니다!',

    // Login Page
    joinApp: '대만 콘서트 지도 가입',
    loginApp: '계정 로그인',
    signUpSubtitle: '회원가입하고 커뮤니티 공유판에 후기를 남겨보세요!',
    signInSubtitle: '로그인하여 콘서트 현장의 발자취를 기록하고 공유해 보세요',
    nicknameForm: '닉네임',
    emailForm: '이메일 주소',
    passwordForm: '비밀번호',
    passwordPlaceholder: '최소 6자리 비밀번호',
    signInBtn: '로그인',
    signUpBtn: '회원가입',
    googleSignIn: 'Google 계정으로 로그인',
    toSignUpPrompt: '계정이 없으신가요? 회원가입',
    toSignInPrompt: '이미 계정이 있으신가요? 로그인',
    emailFormatError: '올바른 형식의 이메일을 입력하세요!',
    passwordLengthError: '비밀번호는 최소 6자 이상이어야 합니다!',
    nicknameEmptyError: '닉네임을 입력하세요!',

    // Transit Page
    transitTitle: '대중교통 실시간 정보',
    highSpeedRail: '대만 고속철도 (HSR)',
    taiwanRailway: '일반 열차 (TRA)',
    metroTransit: '도시철도 (MRT) 시스템',
    hsrSearch: '고속철도 시간표 검색 🚄',
    traSearch: '일반열차 시간표 검색 🚂',
    metroTaipei: '타이베이 MRT 🚇',
    metroNewTaipei: '신베이 MRT 🚇',
    metroTaoyuan: '타오위안 MRT 🚇',
    metroTaichung: '타이중 MRT 🚇',
    metroKaohsiung: '가오슝 MRT 🚇',
    busSearch: '실시간 버스 정보 🚌',
    ubikeSearch: 'YouBike 자전거 대여 정보 🚲',
    transitTip: '💡 팁: 공연이 끝난 뒤에는 매우 혼잡하므로 마지막 열차 시간을 미리 확인하고, 교통카드를 준비해 승차 대기 시간을 줄이세요.',

    // Spotify bar
    spotifyPlayerTitle: '음악 플레이어',
    spotifyPlayerPlaceholder: '콘서트 기록에 Spotify 링크를 등록하고 카드를 클릭하면 여기서 재생됩니다',
    spotifyPlayerCollapse: '플레이어 닫기',

    // Weather Panel
    weatherTitle: '실시간 날씨 예보',
    feelsLike: '체감 온도',
    humidity: '상대 습도',
    windSpeed: '현재 풍속',
    windUnit: 'km/h',
    aqiLabel: '대기질 지수',
    aqiStatus: 'AQI',
    sevenDayForecast: '7일 날씨 예보',
    viewDetails: '공연장 세부 정보 보기 ➔',
    weatherClose: '닫기',
    todayConcertsTitle: '🔥 오늘 이 공연장에서 열리는 공연:',

    // Share Board
    socialWallTitle: '팬 공유판',
    socialWallSubtitle: 'FAN COMMUNITY BOARD',
    postCountTip: '총 {count}개의 게시물',
    likeBtn: '좋아요 {count}',
    shareLogBtn: '후기 공유하기',
    postAuthor: '팬 {author}',
    anonymousAuthor: '익명 팬',
    postConcertDetail: '{artist} - {concert}에 관한 후기',
    shareConfirmTitle: '공유판에 후기 공유',
    shareConfirmPrompt: '{artist} - {concert}에 대한 후기를 공개 공유판에 게시하시겠습니까?',
    shareNicknameLabel: '닉네임을 입력하세요 (공개 표시됨)',
    shareNicknamePlaceholder: '예: 搖滾區小精靈 (비워두면 익명 팬으로 게시)',
    shareSubmitBtn: '게시하기',

    // Suspension
    suspensionTitle: '자연재해로 인한 휴업 및 휴교 안내',
    suspensionSource: '행정원 인사행정총처 (업데이트 시간: {time})',
    suspensionStop: '휴업 및 휴교 지역',
    suspensionNormal: '정상 근무 및 등교 지역 ({count})',
    suspensionDismiss: '오늘 하루 동안 보지 않기',
    suspensionClose: '닫기',
  },
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tw-concert-lang')
      if (saved === 'zh-TW' || saved === 'en' || saved === 'ja' || saved === 'ko') {
        return saved
      }
    }
    return 'zh-TW'
  })

  useEffect(() => {
    localStorage.setItem('tw-concert-lang', lang)
  }, [lang])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
  }

  const t = (key: string, variables?: Record<string, string | number>): string => {
    let text = translations[lang][key] || translations['zh-TW'][key] || key
    
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
      })
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useTranslation = () => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}

export const translateVenueName = (name: string, lang: string): string => {
  if (lang === 'zh-TW') return name
  const venueMap: Record<string, Record<string, string>> = {
    '台北大巨蛋': { en: 'Taipei Dome', ja: '台北大巨蛋 (台北ドーム)', ko: '타이베이 돔' },
    '台北小巨蛋': { en: 'Taipei Arena', ja: '台北小巨蛋 (台北アリーナ)', ko: '타이베이 아레나' },
    '南港展覽館': { en: 'Nangang Exhibition Center', ja: '南港展覧館', ko: '난강 전람관' },
    '台北流行音樂中心': { en: 'Taipei Music Center', ja: '台北流行音楽センター', ko: '타이베이 뮤직 센터' },
    'Zepp New Taipei': { en: 'Zepp New Taipei', ja: 'Zepp New Taipei', ko: 'Zepp New Taipei' },
    'Legacy Taipei': { en: 'Legacy Taipei', ja: 'Legacy Taipei', ko: 'Legacy Taipei' },
    'The Wall Live House': { en: 'The Wall Live House', ja: 'The Wall Live House', ko: 'The Wall Live House' },
    '桃園國際棒球場': { en: 'Rakuten Taoyuan Baseball Stadium', ja: '桃園国際棒球場 (桃園野球場)', ko: '타오위안 국제야구장' },
    '新竹棒球場': { en: 'Hsinchu Baseball Stadium', ja: '新竹棒球場 (新竹野球場)', ko: '신주 야구장' },
    '天母棒球場': { en: 'Tianmu Baseball Stadium', ja: '天母棒球場 (天母野球場)', ko: '티엔무 야구장' },
    '新莊棒球場': { en: 'Xinzhuang Baseball Stadium', ja: '新庄棒球場 (新庄野球場)', ko: '신좡 야구장' },
    '高雄國家體育場': { en: 'Kaohsiung National Stadium', ja: '高雄国家体育場 (高雄スタジアム)', ko: '가오슝 국가체육장' },
    '高雄巨蛋': { en: 'Kaohsiung Arena', ja: '高雄巨蛋 (高雄アリーナ)', ko: '가오슝 아레나' },
    '高雄流行音樂中心': { en: 'Kaohsiung Music Center', ja: '高雄流行音楽センター', ko: '가오슝 뮤직 센터' },
    '駁二 Live Warehouse': { en: 'Pier-2 LIVE WAREHOUSE', ja: '駁二 LIVE WAREHOUSE', ko: '피어-2 라이브 웨어하우스' },
    '台中國際展覽館': { en: 'Taichung International Exhibition Center', ja: '台中国際展覧館', ko: '타이중 국제전시장' },
    '台中國家歌劇院': { en: 'National Taichung Theater', ja: '台中国家歌劇院 (ナショナル・タイチュン・シアター)', ko: '국립타이중극장' },
    '台中洲際棒球場': { en: 'Taichung Intercontinental Baseball Stadium', ja: '台中洲際棒球場 (台中インターコンチネンタル野球場)', ko: '타이중 인터컨티넨탈 야구장' },
    '彰化縣立體育場': { en: 'Changhua County Stadium', ja: '彰化県立体育場', ko: '창화 현립체육장' },
    '高雄國家體育場（世運主場館）': { en: 'Kaohsiung National Stadium (World Games Main Stadium)', ja: '高雄国家体育場 (世運主場館)', ko: '가오슝 국가체육장 (월드게임 메인 스타디움)' },
    '斗六棒球場': { en: 'Douliu Baseball Stadium', ja: '斗六棒球場 (斗六野球場)', ko: '두류 야구장' },
    'Legacy Taichung': { en: 'Legacy Taichung', ja: 'Legacy Taichung', ko: 'Legacy Taichung' },
    '圓滿戶外劇場': { en: 'Fulfillment Amphitheatre', ja: '円満屋外劇場', ko: '원만 야외극장' },
    '嘉義市棒球場': { en: 'Chiayi City Baseball Stadium', ja: '嘉義市棒球場 (嘉義野球場)', ko: '자이시 야구장' },
    '台南市立棒球場': { en: 'Tainan Municipal Baseball Stadium', ja: '台南市立棒球場 (台南野球場)', ko: '타이남 시립야구장' },
    '花蓮縣立體育場': { en: 'Hualien County Stadium', ja: '花蓮県立体育場', ko: '화롄 현립체육관' },
    '後台 Backstage Live': { en: 'Backstage Live', ja: '後台 Backstage Live', ko: '백스테이지 라이브' },
    '亞太國際棒球訓練中心成棒主球場': { en: 'Asia-Pacific International Baseball Stadium', ja: '亞太国際棒球場', ko: '아시아태평양 국제야구장' },
    '澄清湖棒球場': { en: 'Chengqing Lake Baseball Stadium', ja: '澄清湖棒球場 (澄清湖野球場)', ko: '청칭후 야구장' },
    '台東棒球場': { en: 'Taitung Baseball Stadium', ja: '台東棒球場 (台東野球場)', ko: '타이둥 야구장' },
    // Renamed Venues
    '臺北大巨蛋': { en: 'Taipei Dome', ja: '臺北大巨蛋 (台北ドーム)', ko: '타이베이 돔' },
    '臺北小巨蛋': { en: 'Taipei Arena', ja: '臺北小巨蛋 (台北アリーナ)', ko: '타이베이 아레나' },
    '南港展覽館 1 館': { en: 'Nangang Exhibition Center Hall 1', ja: '南港展覧館1号館', ko: '난강 전람관 1관' },
    '樂天桃園棒球場': { en: 'Rakuten Taoyuan Baseball Stadium', ja: '楽天桃猿棒球場 (桃園野球場)', ko: '라쿠텐 타오위안 야구장' },
    'K-ARENA 高雄巨蛋': { en: 'K-ARENA Kaohsiung Arena', ja: 'K-ARENA 高雄巨蛋 (高雄アリーナ)', ko: 'K-ARENA 가오슝 아레나' },
    // 4.0 & 5.0 New Venues
    'TICC 台北國際會議中心': { en: 'Taipei International Convention Center (TICC)', ja: 'TICC 台北国際會議中心', ko: '타이베이 국제회의센터 (TICC)' },
    '信義劇場 Legacy MAX': { en: 'Legacy MAX Sinyi', ja: '信義劇場 Legacy MAX', ko: '신이 극장 Legacy MAX' },
    '台大體育館 (1樓多功能球場 / 3樓主球場)': { en: 'NTU Sports Center (1F / 3F)', ja: '台大体育館 (1F多目的アリーナ / 3Fメインアリーナ)', ko: '대만대 체육관 (1층 다목적 경기장 / 3층 메인 경기장)' },
    'Clapper Studio': { en: 'Clapper Studio', ja: 'Clapper Studio', ko: 'Clapper Studio' },
    '新莊體育館': { en: 'Xinzhuang Gymnasium', ja: '新荘体育館', ko: '신좡 체육관' },
    '新北市工商展覽中心': { en: 'New Taipei City Exhibition Hall', ja: '新北市工商展覧センター', ko: '신베이시 공상전람센터' },
    '新北市政府多功能集會堂': { en: 'New Taipei City Hall Multi-purpose Assembly Hall', ja: '新北市政府多機能集会堂', ko: '신베이시청 다목적 집회장' },
    '林口體育館': { en: 'National Taiwan Sport University Arena (Linkou Arena)', ja: '林口体育館', ko: '린커우 체육관' },
    '女巫店': { en: 'Witch House', ja: '女巫店 (ウィッチハウス)', ko: '마녀의 집 (Witch House)' },
    '飄丿白鷺': { en: 'Piau Piau Egret Live House', ja: '飄丿白鷺 (ライブハウス)', ko: '피아오 피아오 백로 (Livehouse)' },
    '飄丿白鷺 Live House': { en: 'Piau Piau Egret Live House', ja: '飄丿白鷺 (ライブハウス)', ko: '피아오 피아오 백로 (Livehouse)' },
    '漂丿白鷺 Live House': { en: 'Piau Piau Egret Live House', ja: '飄丿白鷺 (ライブハウス)', ko: '피아오 피아오 백로 (Livehouse)' },
    'TCRC Livehouse': { en: 'TCRC Livehouse', ja: 'TCRC Livehouse', ko: 'TCRC 라이브하우스' },
    '高雄 LIVE WAREHOUSE': { en: 'LIVE WAREHOUSE (Kaohsiung)', ja: '高雄 LIVE WAREHOUSE', ko: '가오슝 라이브 웨어하우스' },
  }
  return venueMap[name]?.[lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'] || name
}

export const translateCityName = (city: string, lang: string): string => {
  if (lang === 'zh-TW') return city
  const cityMap: Record<string, Record<string, string>> = {
    '台北': { en: 'Taipei', ja: '台北', ko: '타이베이' },
    '新北': { en: 'New Taipei', ja: '新北', ko: '신베이' },
    '基隆': { en: 'Keelung', ja: '基隆', ko: '지룽' },
    '桃園': { en: 'Taoyuan', ja: '桃園', ko: '타오위안' },
    '新竹': { en: 'Hsinchu', ja: '新竹', ko: '신주' },
    '苗栗': { en: 'Miaoli', ja: '苗栗', ko: '먀오리' },
    '台中': { en: 'Taichung', ja: '台中', ko: '타이중' },
    '彰化': { en: 'Changhua', ja: '彰化', ko: '창화' },
    '南投': { en: 'Nantou', ja: '南投', ko: '남토' },
    '雲林': { en: 'Yunlin', ja: '雲林', ko: '윈린' },
    '嘉義': { en: 'Chiayi', ja: '嘉義', ko: '자이' },
    '台南': { en: 'Tainan', ja: '台南', ko: '타이난' },
    '高雄': { en: 'Kaohsiung', ja: '高雄', ko: '가오슝' },
    '屏東': { en: 'Pingtung', ja: '屏東', ko: '핑둥' },
    '宜蘭': { en: 'Yilan', ja: '宜蘭', ko: '이란' },
    '花蓮': { en: 'Hualien', ja: '花蓮', ko: '화롄' },
    '台東': { en: 'Taitung', ja: '台東', ko: '타이동' },
    '澎湖': { en: 'Penghu', ja: '澎湖', ko: '펑후' },
    '金門': { en: 'Kinmen', ja: '金門', ko: '진먼' },
    '連江': { en: 'Lienchiang', ja: '連江', ko: '롄장' },
  }
  return cityMap[city]?.[lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'] || city
}

export const translateSuspensionStatus = (status: string, lang: string): string => {
  if (lang === 'zh-TW') return status
  
  // Exact matches
  const exactMap: Record<string, Record<string, string>> = {
    '照常上班、照常上課。': {
      en: 'Work and classes as usual.',
      ja: '通常通り出勤・登校。',
      ko: '정상 근무 및 등교.'
    },
    '今天停止上班、停止上課。': {
      en: 'Work and classes suspended today.',
      ja: '本日出勤・登校停止。',
      ko: '오늘 휴업 및 휴교.'
    },
    '明天停止上班、停止上課。': {
      en: 'Work and classes suspended tomorrow.',
      ja: '明日出勤・登校停止。',
      ko: '내일 휴업 및 휴교.'
    }
  }

  const langKey = lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'
  if (exactMap[status]?.[langKey]) {
    return exactMap[status][langKey]
  }

  // Substring replacement or just return as is (with some key terms translated if possible)
  let result = status
  if (lang === 'en') {
    result = result
      .replace(/今天/g, 'Today ')
      .replace(/明天/g, 'Tomorrow ')
      .replace(/停止上班、停止上課。/g, 'Work and classes suspended. ')
      .replace(/照常上班、照常上課。/g, 'Work and classes as usual. ')
      .replace(/停止上班/g, 'Work suspended')
      .replace(/停止上課/g, 'Classes suspended')
      .replace(/照常上班/g, 'Work as usual')
      .replace(/照常上課/g, 'Classes as usual')
  } else if (lang === 'ja') {
    result = result
      .replace(/今天/g, '本日 ')
      .replace(/明天/g, '明日 ')
      .replace(/停止上班、停止上課。/g, '出勤・登校停止。')
      .replace(/照常上班、照常上課。/g, '通常通り出勤・登校。')
      .replace(/停止上班/g, '出勤停止')
      .replace(/停止上課/g, '登校停止')
      .replace(/照常上班/g, '通常通り出勤')
      .replace(/照常上課/g, '通常通り登校')
  } else if (lang === 'ko') {
    result = result
      .replace(/今天/g, '오늘 ')
      .replace(/明天/g, '내일 ')
      .replace(/停止上班、停止上課。/g, '휴업 및 휴교.')
      .replace(/照常上班、照常上課。/g, '정상 근무 및 등교.')
      .replace(/停止上班/g, '휴업')
      .replace(/停止上課/g, '휴교')
      .replace(/照常上班/g, '정상 근무')
      .replace(/照常上課/g, '정상 등교')
  }
  return result
}

