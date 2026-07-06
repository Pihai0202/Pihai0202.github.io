import React, { useState } from 'react'
import { useTranslation } from '../utils/i18n.tsx'
import {
  MapIcon,
  CalendarIcon,
  MessageIcon,
  MusicIcon,
  SunIcon,
  CloseIcon,
  SparklesIcon,
  PlusIcon,
  ImageIcon
} from './SvgIcon'

// Custom Train icon if not exported from SvgIcon
function TrainIcon({ size = '1em', ...props }: { size?: string | number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: 'middle', display: 'inline-block' }}
      {...props}
    >
      <rect x="4" y="3" width="16" height="16" rx="2" />
      <path d="M4 11h16" />
      <path d="M12 3v8" />
      <path d="m8 19-2 3" />
      <path d="m16 19 2 3" />
      <circle cx="8" cy="15" r="1" />
      <circle cx="16" cy="15" r="1" />
    </svg>
  )
}

interface GuideModalProps {
  onClose: () => void
}

interface GuideStep {
  title: string
  subtitle: string
  icon: React.ReactNode
  description: string
  details: string[]
}

export function GuideModal({ onClose }: GuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showScreenshotMobile, setShowScreenshotMobile] = useState(false)

  const { lang } = useTranslation()

  const zhSteps: GuideStep[] = [
    {
      title: '互動式台灣 SVG 地圖與場館指南',
      subtitle: 'TaiwanMap Venue Explorer',
      icon: <MapIcon size="2rem" />,
      description: '結合台灣 26+ 個指標性音樂與運動場館的互動探索地圖。',
      details: [
        '地圖縮放功能：支援滑鼠拖拽與雙指縮放 (Pinch-to-zoom)，縮放範圍可自訂為 70% 至 500%。',
        '自適應版面：支援手機端自適應的抽屜式面版，可自由向上拖拽展開或收合。',
        '足跡標記：您參戰過或去過的場館會在列表與地圖上呈現「已造訪 (✓)」標記。',
        '類別過濾：支援依「音樂會/演唱會 (Concert)」或「運動賽事 (Sport)」對場館進行篩選。'
      ]
    },
    {
      title: '即時大眾交通與即時路況板',
      subtitle: 'TransitInfoBoard Traffic Assistant',
      icon: <TrainIcon size="2rem" />,
      description: '串接交通部 TDX API，為您提供最即時的活動散場與通勤指引。',
      details: [
        '多系統整合：一鍵查詢台北捷運、新北捷運、桃園捷運、台中捷運、高雄捷運與台灣高鐵的即時狀態。',
        '即時到站看板：提供捷運即時到站倒數時間與發車時刻表。',
        '台鐵與高鐵查詢：支援高鐵與台鐵的每日車次、時刻表與運行狀態查詢。',
        '公車動態 (ETA)：支援台灣各大縣市公車路線搜尋及即時站牌到站時間估算。'
      ]
    },
    {
      title: '場館即時天氣與 7 天預報',
      subtitle: 'VenueWeather Environmental Monitor',
      icon: <SunIcon size="2rem" />,
      description: '精準預測活動場館周邊的天氣與空氣品質，出門參戰免煩惱。',
      details: [
        '定位天氣資訊：根據場館經緯度取得即時氣溫、體感溫度、濕度、風力與天氣狀態。',
        '空品監測 (AQI)：顯示即時 PM2.5 與 PM10 數據，並提供貼心的健康防護建議。',
        '一週預報與防颱通知：提供 7 天氣象變化，並設置 5 分鐘快取機制，保障查詢流暢不中斷。'
      ]
    },
    {
      title: '售票活動探索與分類',
      subtitle: 'Upcoming Ticket Exploration',
      icon: <MusicIcon size="2rem" />,
      description: '彙整各大售票平台的最新搶票與活動動態。',
      details: [
        '活動聚合：整合 KKTIX、拓元、年代、ibon 等平台的售票活動。',
        '分類與過濾：支援依「演唱會」與「中華職棒」等運動賽事分類過濾。',
        '即時更新：點選「更新」按鈕可立即重新載入最新的售票資訊清單。'
      ]
    },
    {
      title: '搶票指引與歌手精選音樂',
      subtitle: 'TicketDetailModal & Spotify Playback',
      icon: <MusicIcon size="2rem" />,
      description: '活動詳細頁面提供購票按鈕、討論留言牆與音樂播放器。',
      details: [
        '智慧連結修正：自動偵測拓元等平台通用連結，並智慧導向至具體活動搶票頁面。',
        'Spotify 音樂試聽：自動搜尋歌手熱門曲目，支援在網頁下方播放器直接試聽。',
        '討論留言牆：與其他正在搶票的同好在線上進行即時心得與資訊交流。',
        '登錄參戰：一鍵將該活動登錄至個人已參與紀錄，隨時納入行事曆。'
      ]
    },
    {
      title: '社群心得與日記分享看板',
      subtitle: 'ShareBoard Review Diary',
      icon: <MessageIcon size="2rem" />,
      description: '專屬樂迷的心得社群分享牆，寫下您的音樂日記，與同好交流。',
      details: [
        '即時日記發布：支援隨手撰寫心得筆記，透過 Firebase Firestore 即時儲存與發布。',
        'Markdown 語法編輯：提供 Markdown 語法支援與「編輯 / 預覽」雙分頁即時排版效果。',
        '社群點讚與回覆：可以對其他樂迷的心得按讚 (Like) 或留言回覆 (Reply) 進行深度交流。'
      ]
    },
    {
      title: '記錄參戰回憶與自訂活動',
      subtitle: 'Add Concert Record',
      icon: <PlusIcon size="2rem" />,
      description: '在探索活動時，一鍵記錄您熱血的參戰回憶，自訂您的演唱會小本本。',
      details: [
        '記錄欄位：可登錄演出者、演唱會名稱、日期、座位區域與個人心得筆記。',
        '音樂連結綁定：支援搜尋歌手、專輯或歌曲，並在首頁播放器一鍵加載 Spotify 歌曲。',
        '雲端備份同步：登入後可隨時備份並在不同裝置間同步您的所有參戰歷史紀錄。'
      ]
    },
    {
      title: '雙模式行事曆與個人足跡統計',
      subtitle: 'CalendarView & ProfilePage statistics',
      icon: <CalendarIcon size="2rem" />,
      description: '完整的參戰行事曆與大數據儀表板，記錄您熱血的音樂足跡。',
      details: [
        '行事曆雙模式：提供「月份網格」與「時間軸清單」雙重視圖，搶票提醒與紀錄一目了然。',
        '個人成就儀表板：分析展示您的累計參戰場數、踏足城市數、打卡場館數及上傳媒體數。',
        '自訂專屬檔案：支援上傳個人頭像（自動 Base64 壓縮）與修改樂迷暱稱。',
        '停班停課特報：自動爬取全台停班停課狀態，颱風天活動變更第一時間預警彈出。'
      ]
    }
  ]

  const enSteps: GuideStep[] = [
    {
      title: 'Interactive Taiwan Venue Map',
      subtitle: 'TaiwanMap Venue Explorer',
      icon: <MapIcon size="2rem" />,
      description: 'An interactive exploration map of 26+ iconic music and sports venues in Taiwan.',
      details: [
        'Zoom controls: Supports mouse dragging and pinch-to-zoom (70% to 500%).',
        'Responsive layout: Adaptive bottom sheet drawer for mobile screens.',
        'Concert footprints: Checkmarks (✓) for venues you have visited.',
        'Category filters: Filter venues by "Concerts" or "Sports Events".'
      ]
    },
    {
      title: 'Real-time Transport & Commute Info',
      subtitle: 'TransitInfoBoard Traffic Assistant',
      icon: <TrainIcon size="2rem" />,
      description: 'Integrates Ministry of Transportation API to provide real-time updates and departure timetables.',
      details: [
        'MRT integration: Timely status updates for Taipei MRT, New Taipei MRT, Taoyuan MRT, Taichung MRT, and Kaohsiung MRT.',
        'Real-time boards: Subway counts and countdown departures.',
        'TRA & HSR timetables: Search schedules and live status of TRA train and High Speed Rail.',
        'Bus dynamic (ETA): Real-time bus search and estimated time of arrivals.'
      ]
    },
    {
      title: 'Real-time Weather & 7-Day Forecast',
      subtitle: 'VenueWeather Environmental Monitor',
      icon: <SunIcon size="2rem" />,
      description: 'Accurate weather and air quality forecast around the venue.',
      details: [
        'Localized weather: Precise temperature, feels-like, humidity, and wind based on venue coordinates.',
        'Air Quality (AQI): Monitors PM2.5 and PM10 index with outdoor recommendations.',
        '7-day forecast: Weekly weather change forecast with 5-minute caching mechanism.'
      ]
    },
    {
      title: 'Upcoming Ticketing Information',
      subtitle: 'Upcoming Ticket Exploration',
      icon: <MusicIcon size="2rem" />,
      description: 'Aggregates upcoming tickets and ticketing status across platforms.',
      details: [
        'Ticket feeds: Aggregates ticketing events from KKTIX, tixCraft, ERA, ibon, etc.',
        'Category filters: Sort and filter by "Concerts" and "CPBL Sports".',
        'Manual refresh: Click refresh to immediately load the latest listings.'
      ]
    },
    {
      title: 'Ticket Details & Spotify Playback',
      subtitle: 'TicketDetailModal & Spotify Playback',
      icon: <MusicIcon size="2rem" />,
      description: 'Detail views with ticket URLs, discussion board, and music playback.',
      details: [
        'Smart link correction: Directs generic platform links to specific concert booking pages.',
        'Spotify audition: Searches hot tracks and listens on the web player.',
        'Discussion board: Exchange reviews and live concert information with fellow fans.',
        'Save log: Add ticket event directly into personal calendar list.'
      ]
    },
    {
      title: 'Fan Review Community Board',
      subtitle: 'ShareBoard Review Diary',
      icon: <MessageIcon size="2rem" />,
      description: 'Concert reviews and music diary wall for the fan community.',
      details: [
        'Publish reviews: Write concert reviews stored in Firebase Firestore instantly.',
        'Markdown support: Dual panels supporting Markdown edit and live preview.',
        'Likes and replies: Interact with reviews by liking and commenting.'
      ]
    },
    {
      title: 'Add Concert Footprints',
      subtitle: 'Add Concert Record',
      icon: <PlusIcon size="2rem" />,
      description: 'Record your live music footprint and build your custom concert log.',
      details: [
        'Log fields: Fill out artist, concert name, date, seat section, and reviews.',
        'Attach music: Search Spotify tracks and bind them to your logs.',
        'Cloud backup: Sync all your concert logs across devices using Firebase Auth.'
      ]
    },
    {
      title: 'Calendar and Footprint Statistics',
      subtitle: 'CalendarView & ProfilePage statistics',
      icon: <CalendarIcon size="2rem" />,
      description: 'Complete concert calendar and statistics of your music footprint.',
      details: [
        'Dual modes: Toggle between monthly grid view and chronological list timeline.',
        'Stats dashboard: Visually tracks your total concerts, cities, venues, and media.',
        'Customize profile: Change nickname and select random avatars.',
        'Typhoon alerts: Automatic weather/work/class suspension alerts during typhoons.'
      ]
    }
  ]

  const steps = lang === 'zh-TW' ? zhSteps : enSteps

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const step = steps[currentStep]

  return (
    <div className="modal-overlay active guide-modal-overlay" onClick={onClose}>
      <div 
        className="modal guide-modal-container" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="modal-close guide-modal-close" 
          type="button" 
          onClick={onClose}
          aria-label="關閉導覽"
        >
          <CloseIcon size="1.5rem" />
        </button>

        <div className="guide-modal-layout">
          {/* Left Column: Visual Showcase (desktop only) */}
          <div className="guide-modal-visual desktop-only-visual">
            <div className="guide-visual-header">
              <span className="sparkle-spark"><SparklesIcon size="1.2rem" /></span>
              <span>台灣演唱會地圖 ─ 功能特色指南</span>
            </div>
            <div className="guide-screenshot-frame">
              {currentStep === 0 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img1.png`} 
                  alt="互動式台灣 SVG 地圖與場館指南" 
                  className="guide-modal-image"
                  style={{ objectFit: 'cover' }}
                />
              )}
              {currentStep === 1 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img2.png`} 
                  alt="即時大眾交通與即時路況板" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 2 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img3.png`} 
                  alt="場館即時天氣與 7 天預報" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 3 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img4.png`} 
                  alt="售票活動探索與分類" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 4 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img5.png`} 
                  alt="搶票指引與歌手精選音樂" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 5 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img6a.png`} 
                  alt="社群心得與日記分享看板" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 6 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img6b.png`} 
                  alt="記錄參戰回憶與自訂活動" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              {currentStep === 7 && (
                <img 
                  src={`${import.meta.env.BASE_URL}guide_img7.png`} 
                  alt="雙模式行事曆與個人足跡統計" 
                  className="guide-modal-image"
                  style={{ objectFit: 'contain', padding: '10px' }}
                />
              )}
              <div className="guide-image-overlay">
                <span className="step-badge">STEP {currentStep + 1} / {steps.length}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Text & Navigation */}
          <div className="guide-modal-info">
            <div className="guide-info-header">
              <div className="guide-step-icon-wrapper">
                {step.icon}
              </div>
              <div className="guide-step-title-group">
                <h3>{step.title}</h3>
                <span className="guide-step-subtitle">{step.subtitle}</span>
              </div>
            </div>

            {/* Mobile screenshot view trigger */}
            <button 
              type="button" 
              className="guide-mobile-screenshot-trigger" 
              onClick={() => setShowScreenshotMobile(true)}
            >
              <ImageIcon size="1.2rem" /> {lang === 'zh-TW' ? '檢視功能畫面截圖' : 'View Feature Screenshot'}
            </button>

            <p className="guide-step-desc">{step.description}</p>

            <ul className="guide-step-details">
              {step.details.map((detail, index) => {
                const parts = detail.split(/：|:/)
                if (parts.length > 1) {
                  return (
                    <li key={index}>
                      <strong>{parts[0]}{lang === 'zh-TW' ? '：' : ': '}</strong>
                      {parts.slice(1).join(lang === 'zh-TW' ? '：' : ': ')}
                    </li>
                  )
                }
                return <li key={index}>{detail}</li>
              })}
            </ul>

            {/* Navigation controls */}
            <div className="guide-modal-nav">
              <div className="guide-nav-dots">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`guide-nav-dot${idx === currentStep ? ' active' : ''}`}
                    onClick={() => setCurrentStep(idx)}
                    title={lang === 'zh-TW' ? `第 ${idx + 1} 步` : `Step ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="guide-nav-buttons">
                {currentStep > 0 && (
                  <button 
                    className="guide-btn guide-btn-secondary" 
                    type="button" 
                    onClick={handlePrev}
                  >
                    {lang === 'zh-TW' ? '上一步' : 'Prev'}
                  </button>
                )}
                
                <button 
                  className="guide-btn guide-btn-primary" 
                  type="button" 
                  onClick={handleNext}
                >
                  {currentStep === steps.length - 1 ? (lang === 'zh-TW' ? '開始探索' : 'Get Started') : (lang === 'zh-TW' ? '下一步' : 'Next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Mobile Screenshot Popup */}
      {showScreenshotMobile && (
        <div className="guide-screenshot-lightbox" onClick={() => setShowScreenshotMobile(false)}>
          <div className="guide-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="guide-lightbox-close" 
              onClick={() => setShowScreenshotMobile(false)}
              type="button"
              aria-label={lang === 'zh-TW' ? '關閉截圖' : 'Close Screenshot'}
            >
              <CloseIcon size="1.2rem" />
            </button>
            <div className="guide-lightbox-header">
              <span>{step.title} ─ {lang === 'zh-TW' ? '畫面截圖' : 'Screenshot'}</span>
            </div>
            <div className="guide-lightbox-body">
              {currentStep === 0 && <img src={`${import.meta.env.BASE_URL}guide_img1.png`} alt={step.title} />}
              {currentStep === 1 && <img src={`${import.meta.env.BASE_URL}guide_img2.png`} alt={step.title} />}
              {currentStep === 2 && <img src={`${import.meta.env.BASE_URL}guide_img3.png`} alt={step.title} />}
              {currentStep === 3 && <img src={`${import.meta.env.BASE_URL}guide_img4.png`} alt={step.title} />}
              {currentStep === 4 && <img src={`${import.meta.env.BASE_URL}guide_img5.png`} alt={step.title} />}
              {currentStep === 5 && <img src={`${import.meta.env.BASE_URL}guide_img6a.png`} alt={step.title} />}
              {currentStep === 6 && <img src={`${import.meta.env.BASE_URL}guide_img6b.png`} alt={step.title} />}
              {currentStep === 7 && <img src={`${import.meta.env.BASE_URL}guide_img7.png`} alt={step.title} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
