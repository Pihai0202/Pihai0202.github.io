import { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react'
import type { ChangeEvent, MouseEvent, ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import { marked } from 'marked'
import './App.css'

import type {
  Concert,
  ConcertMedia,
  RemoteConcert,
  RemoteConcertPayload,
  ConcertForm,
  SpotifyItem,
  SuspensionInfo,
  SuspensionItem
} from './types'

import { VENUES } from './constants/venues'
import { TaiwanMap, Stat, LegendItem } from './components/TaiwanMap'
import { VenueInfo } from './components/VenueInfo'
import { VenueWeather } from './components/VenueWeather'
import { ConcertDetail } from './components/ConcertDetail'
import { getCitySuspensionStatus } from './utils/suspensionHelper'
import { ShareBoard } from './components/ShareBoard'
import { LoginPage } from './components/LoginPage'
import { TicketDetailModal } from './components/TicketDetailModal'
import { CalendarView } from './components/CalendarView'
import { ProfilePage } from './components/ProfilePage'
import { TransitInfoBoard } from './components/TransitInfoBoard'
import { GuideModal } from './components/GuideModal'
import { SafeIframe } from './components/SafeIframe'
import { LazyImage } from './components/LazyImage'
import { useTranslation, translateVenueName, translateCityName, translateSuspensionStatus } from './utils/i18n.tsx'
import { isTargetEventCategory } from './utils/eventFilterHelper'
import { collection, addDoc, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { db, logCustomEvent, auth } from './firebase'
import { deleteLocalMedia, saveLocalMedia } from './utils/indexedDB'
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth'
import {
  MenuIcon,
  CloseIcon,
  SunIcon,
  MoonIcon,
  PaletteIcon,
  CheckIcon,
  WarningIcon,
  SparklesIcon,
  BaseballIcon,
  MapIcon,
  CalendarIcon,
  MessageIcon,
  UserIcon,
  MusicIcon,
  SearchIcon,
  CameraIcon,
  PinIcon,
  PlayIcon,
  PlusIcon,
  TaiwanIcon,
  KeyIcon,
  LogoutIcon,
  ClipboardIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  TicketIcon,
  TrainIcon,
  GlobeIcon,
  VolumeXIcon,
  MegaphoneIcon,
  RocketIcon,
  TrashIcon,
  RefreshIcon
} from './components/SvgIcon'

const STORAGE_KEY = 'tw-concerts'
const REMOTE_CONCERT_REFRESH_MS = 60_000
const EMPTY_FORM: ConcertForm = {
  artist: '',
  concertName: '',
  date: '',
  seat: '',
  notes: '',
  spotifyUrl: '',
}

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'cf537ab8a23b4365876e09a0071554df'
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || '5a30e4bec5994805b5d82573a105e814'
const SPOTIFY_TYPE_LABELS: Record<SpotifyItem['type'], string> = {
  artist: '歌手',
  album: '專輯',
  track: '歌曲',
}

function getRegionForCity(city: string): string {
  if (['台北', '新北', '桃園', '新竹'].includes(city)) return '北部地區'
  if (['台中', '彰化', '雲林', '嘉義'].includes(city)) return '中部地區'
  if (['台南', '高雄'].includes(city)) return '南部地區'
  if (['花蓮', '台東'].includes(city)) return '東部地區'
  return '其他地區'
}

let spotifyToken: string | null = null
let spotifyTokenExpiry = 0


function loadInitialConcerts() {
  try {
    const loggedIn = localStorage.getItem('tw-logged-in') === 'true'
    const storedUser = localStorage.getItem('tw-user-info')
    if (loggedIn && storedUser) {
      const user = JSON.parse(storedUser)
      const email = user.email
      if (email) {
        const cached = localStorage.getItem(`tw-concerts-${email}`)
        if (cached) {
          return JSON.parse(cached) as Concert[]
        }
        return []
      }
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Concert[]
  } catch {
    return []
  }
}

function resolveTixcraftUrls(list: RemoteConcert[]): RemoteConcert[] {
  const specificUrls = new Map<string, string>()
  
  const normalize = (s: string) => {
    return s.replace(/[\s\-_【】「」（）()、，,!！]/g, '').toLowerCase()
  }
  
  list.forEach((c) => {
    if (c.source === '拓元售票' && c.url && c.url.includes('/activity/detail/')) {
      specificUrls.set(normalize(c.name), c.url)
    }
    if (c.ticket_links) {
      c.ticket_links.forEach((lk) => {
        if (lk.platform === 'tixcraft' && lk.url && lk.url.includes('/activity/detail/')) {
          specificUrls.set(normalize(c.name), lk.url)
        }
      })
    }
  })

  return list.map((c) => {
    const isGenericUrl = (u?: string) => {
      if (!u) return false
      const lower = u.toLowerCase()
      return lower.includes('tixcraft.com') && !lower.includes('/activity/')
    }
    
    let updatedUrl = c.url
    let updatedLinks = c.ticket_links ? [...c.ticket_links] : []
    let matchedUrl: string | null = null

    const hasGeneric = isGenericUrl(c.url) || updatedLinks.some((lk) => isGenericUrl(lk.url))

    if (hasGeneric) {
      const normName = normalize(c.name)
      if (specificUrls.has(normName)) {
        matchedUrl = specificUrls.get(normName)!
      } else {
        for (const [key, url] of specificUrls.entries()) {
          if (key.includes(normName) || normName.includes(key) || (key.length > 5 && normName.substring(0, 8) === key.substring(0, 8))) {
            matchedUrl = url
            break
          }
        }
      }

      if (matchedUrl) {
        if (isGenericUrl(c.url)) {
          updatedUrl = matchedUrl
        }
        updatedLinks = updatedLinks.map((lk) => {
          if (lk.platform === 'tixcraft' && isGenericUrl(lk.url)) {
            return { ...lk, url: matchedUrl! }
          }
          return lk
        })
      } else {
        // Fallback: Clean event name for site search
        let cleanName = c.name.replace(/【[^】]+】/g, '')
        cleanName = cleanName.replace(/\[[^\]]+\]/g, '')
        cleanName = cleanName.replace(/\([^)]+\)/g, '')
        cleanName = cleanName.replace(/（[^）]+）/g, '')
        cleanName = cleanName.replace(/202\d/g, '')
        cleanName = cleanName.trim()

        const fallbackUrl = `https://www.google.com/search?q=site:tixcraft.com/activity/detail+${encodeURIComponent(cleanName)}`

        if (isGenericUrl(c.url)) {
          updatedUrl = fallbackUrl
        }
        updatedLinks = updatedLinks.map((lk) => {
          if (lk.platform === 'tixcraft' && isGenericUrl(lk.url)) {
            return { ...lk, url: fallbackUrl }
          }
          return lk
        })
      }
    }

    return {
      ...c,
      url: updatedUrl,
      ticket_links: updatedLinks
    }
  })
}

function extractArtistFromTitle(title: string): string {
  let clean = title.replace(/【[^】]+】/g, '')
  clean = clean.replace(/\[[^\]]+\]/g, '')
  clean = clean.replace(/\([^)]+\)/g, '')
  clean = clean.replace(/（[^）]+）/g, '')
  
  const separators = ['《', '<', ' - ', '—', '|', '：', ':', '★']
  for (const sep of separators) {
    if (clean.includes(sep)) {
      clean = clean.split(sep)[0]
    }
  }
  return clean.replace(/202\d/g, '').trim()
}

const APP_VERSION = '1.2.0'

const getDefaultZoom = () => {
  if (typeof window !== 'undefined') {
    const isPortrait = window.innerHeight > window.innerWidth
    const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024
    if (isTablet && isPortrait) {
      return 1.45 // 145% default zoom for tablet portrait
    }
    if (window.innerWidth <= 1200) {
      return 0.95
    }
  }
  return 1.1
}

function App() {
  const { t, lang, setLang } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; notes: string } | null>(null)

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const storedTheme = localStorage.getItem('theme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
    return 'dark'
  })

  const [colorPalette, setColorPalette] = useState<'sage' | 'volcano'>(() => {
    const storedPalette = localStorage.getItem('color-palette')
    if (storedPalette === 'volcano' || storedPalette === 'sage') {
      return storedPalette
    }
    return 'sage'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { preferredTheme: theme }, { merge: true }).catch(() => {})
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', colorPalette)
    localStorage.setItem('color-palette', colorPalette)
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), { preferredPalette: colorPalette }, { merge: true }).catch(() => {})
    }
  }, [colorPalette])

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setTheme(nextTheme)
      })
    } else {
      setTheme(nextTheme)
    }
  }, [theme])

  const toggleColorPalette = useCallback(() => {
    setColorPalette((prev) => (prev === 'sage' ? 'volcano' : 'sage'))
  }, [])

  const [concerts, setConcerts] = useState<Concert[]>(loadInitialConcerts)
  const [remoteConcerts, setRemoteConcerts] = useState<RemoteConcert[]>([])
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<string | null>(null)
  const [remoteStatus, setRemoteStatus] = useState('正在讀取近期售票活動...')
  const [isRemoteRefreshing, setIsRemoteRefreshing] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const drawerHeaderRef = useRef<HTMLDivElement | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAllModalOpen, setIsAllModalOpen] = useState(false)
  const [suspensionData, setSuspensionData] = useState<SuspensionInfo | null>(null)
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false)
  const [detailConcertId, setDetailConcertId] = useState<string | null>(null)
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lightbox, setLightbox] = useState<{ concertId: string; mediaIndex: number } | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<RemoteConcert | null>(null)
  const [form, setForm] = useState<ConcertForm>(EMPTY_FORM)
  const [formVenueId, setFormVenueId] = useState<string>('')
  const [formVenueName, setFormVenueName] = useState<string>('')
  const [formVenueCity, setFormVenueCity] = useState<string>('')
  const [pendingMedia, setPendingMedia] = useState<ConcertMedia[]>([])
  const [spotifyQuery, setSpotifyQuery] = useState('')
  const [spotifyResults, setSpotifyResults] = useState<SpotifyItem[]>([])
  const [spotifyTab, setSpotifyTab] = useState<SpotifyItem['type']>('artist')
  const [spotifyStatus, setSpotifyStatus] = useState('')
  const [selectedSpotify, setSelectedSpotify] = useState<SpotifyItem | null>(null)
  const [isSpotifySearching, setIsSpotifySearching] = useState(false)
  const [isMusicBarVisible, setIsMusicBarVisible] = useState(false)
  const [playerReloadKey, setPlayerReloadKey] = useState(0)
  const [musicBarUrl, setMusicBarUrl] = useState<string | null>(null)
  const handleReloadPlayer = useCallback(() => setPlayerReloadKey((k) => k + 1), [])
  const [zoom, setZoom] = useState(() => getDefaultZoom())
  const [notesActiveTab, setNotesActiveTab] = useState<'edit' | 'preview'>('edit')
  const [view, setView] = useState<'map' | 'board' | 'calendar' | 'login' | 'profile'>('map')

  const bottomNavRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    transform: 'translate3d(0, 0, 0)',
    width: 0,
    height: 0,
    opacity: 0,
  })

  useEffect(() => {
    const updateIndicator = () => {
      if (!bottomNavRef.current) return
      const activeEl = bottomNavRef.current.querySelector('.bottom-nav-item.active') as HTMLElement
      if (activeEl) {
        setIndicatorStyle({
          transform: `translate3d(${activeEl.offsetLeft}px, ${activeEl.offsetTop}px, 0)`,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight,
          opacity: 1,
        })
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }))
      }
    }

    updateIndicator()
    
    // Brief delay for window rendering to settle
    const timer = setTimeout(updateIndicator, 50)

    window.addEventListener('resize', updateIndicator)
    return () => {
      window.removeEventListener('resize', updateIndicator)
      clearTimeout(timer)
    }
  }, [view, lang])

  const [isDraggingNav, setIsDraggingNav] = useState(false)

  const cachedButtonsRef = useRef<{
    el: HTMLElement;
    left: number;
    right: number;
    offsetLeft: number;
    offsetTop: number;
    offsetWidth: number;
    offsetHeight: number;
  }[]>([])

  const lastTargetLeftRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const startClientXRef = useRef<number>(0)
  const didDragRef = useRef<boolean>(false)
  const containerLeftRef = useRef<number>(0)
  const containerWidthRef = useRef<number>(0)
  const indicatorWidthRef = useRef<number>(60)

  const getButtonFromX = useCallback((clientX: number) => {
    for (const item of cachedButtonsRef.current) {
      if (clientX >= item.left && clientX <= item.right) {
        return item.el
      }
    }
    if (!bottomNavRef.current) return null
    const buttons = (Array.from(bottomNavRef.current.querySelectorAll('.bottom-nav-item')) as HTMLElement[])
      .filter((btn) => btn.offsetWidth > 0)
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        return btn
      }
    }
    return null
  }, [])

  const snapIndicatorToActive = useCallback(() => {
    if (!bottomNavRef.current) return
    const activeEl = bottomNavRef.current.querySelector('.bottom-nav-item.active') as HTMLElement
    if (activeEl) {
      setIndicatorStyle({
        transform: `translate3d(${activeEl.offsetLeft}px, ${activeEl.offsetTop}px, 0)`,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        opacity: 1,
      })

      // Force direct DOM style reset to clear any drag deformation scale/skew!
      const indicator = bottomNavRef.current.querySelector('.nav-indicator-glide') as HTMLElement
      if (indicator) {
        indicator.style.transform = `translate3d(${activeEl.offsetLeft}px, ${activeEl.offsetTop}px, 0) scale(1, 1) skewX(0deg)`
        indicator.style.width = `${activeEl.offsetWidth}px`
        indicator.style.height = `${activeEl.offsetHeight}px`
        indicator.style.opacity = '1'
      }
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }))
      const indicator = bottomNavRef.current.querySelector('.nav-indicator-glide') as HTMLElement
      if (indicator) {
        indicator.style.opacity = '0'
      }
    }
  }, [])

  const highlightNavButton = useCallback((btn: HTMLElement, targetLeft: number, stretch = 1, squish = 1, skew = 0) => {
    const cached = cachedButtonsRef.current.find((i) => i.el === btn)
    const width = cached ? cached.offsetWidth : btn.offsetWidth
    const height = cached ? cached.offsetHeight : btn.offsetHeight
    const top = cached ? cached.offsetTop : btn.offsetTop

    if (bottomNavRef.current) {
      const indicator = bottomNavRef.current.querySelector('.nav-indicator-glide') as HTMLElement
      if (indicator) {
        indicator.style.transform = `translate3d(${targetLeft}px, ${top}px, 0) scale(${stretch}, ${squish}) skewX(${skew}deg)`
        indicator.style.width = `${width}px`
        indicator.style.height = `${height}px`
        indicator.style.opacity = '1'
      }
    }

    if (cachedButtonsRef.current.length > 0) {
      for (const item of cachedButtonsRef.current) {
        item.el.classList.remove('hovered', 'neighbor')
      }
    } else if (bottomNavRef.current) {
      const buttons = bottomNavRef.current.querySelectorAll('.bottom-nav-item')
      buttons.forEach((el) => {
        el.classList.remove('hovered', 'neighbor')
      })
    }
    btn.classList.add('hovered')

    const index = cachedButtonsRef.current.findIndex((i) => i.el === btn)
    if (index !== -1) {
      if (index > 0) {
        cachedButtonsRef.current[index - 1].el.classList.add('neighbor')
      }
      if (index < cachedButtonsRef.current.length - 1) {
        cachedButtonsRef.current[index + 1].el.classList.add('neighbor')
      }
    } else if (btn.parentElement) {
      const siblings = Array.from(btn.parentElement.children) as HTMLElement[]
      const idx = siblings.indexOf(btn)
      if (idx > 0) {
        siblings[idx - 1].classList.add('neighbor')
      }
      if (idx < siblings.length - 1) {
        siblings[idx + 1].classList.add('neighbor')
      }
    }
  }, [])

  const handleNavPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    setIsDraggingNav(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    bottomNavRef.current?.classList.add('dragging')

    lastTimeRef.current = performance.now()
    startClientXRef.current = e.clientX
    didDragRef.current = false

    if (bottomNavRef.current) {
      const rect = bottomNavRef.current.getBoundingClientRect()
      containerLeftRef.current = rect.left
      containerWidthRef.current = rect.width

      const activeEl = bottomNavRef.current.querySelector('.bottom-nav-item.active') as HTMLElement
      if (activeEl) {
        indicatorWidthRef.current = activeEl.offsetWidth
      }

      const buttons = (Array.from(bottomNavRef.current.querySelectorAll('.bottom-nav-item')) as HTMLElement[])
        .filter((btn) => btn.offsetWidth > 0)
      cachedButtonsRef.current = buttons.map((btn) => {
        const r = btn.getBoundingClientRect()
        return {
          el: btn,
          left: r.left,
          right: r.right,
          offsetLeft: btn.offsetLeft,
          offsetTop: btn.offsetTop,
          offsetWidth: btn.offsetWidth,
          offsetHeight: btn.offsetHeight,
        }
      })
    }

    const btn = getButtonFromX(e.clientX)
    if (btn) {
      const localX = e.clientX - containerLeftRef.current
      const halfW = indicatorWidthRef.current / 2
      
      const firstBtn = cachedButtonsRef.current[0]
      const lastBtn = cachedButtonsRef.current[cachedButtonsRef.current.length - 1]
      const minLeft = firstBtn ? firstBtn.offsetLeft : 8
      const maxLeft = lastBtn ? lastBtn.offsetLeft : containerWidthRef.current - indicatorWidthRef.current - 8
      
      const targetLeft = Math.max(minLeft, Math.min(localX - halfW, maxLeft))
      
      lastTargetLeftRef.current = targetLeft

      // Expand bubble by 1.12x when dragging starts
      highlightNavButton(btn, targetLeft, 1.12, 1.12, 0)
    }
  }, [getButtonFromX, highlightNavButton])

  const handleNavPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingNav) return

    if (!didDragRef.current && Math.abs(e.clientX - startClientXRef.current) > 8) {
      didDragRef.current = true
    }

    const btn = getButtonFromX(e.clientX)
    if (btn) {
      indicatorWidthRef.current = btn.offsetWidth
      const localX = e.clientX - containerLeftRef.current
      const halfW = indicatorWidthRef.current / 2
      
      const firstBtn = cachedButtonsRef.current[0]
      const lastBtn = cachedButtonsRef.current[cachedButtonsRef.current.length - 1]
      const minLeft = firstBtn ? firstBtn.offsetLeft : 8
      const maxLeft = lastBtn ? lastBtn.offsetLeft : containerWidthRef.current - indicatorWidthRef.current - 8
      
      const targetLeft = Math.max(minLeft, Math.min(localX - halfW, maxLeft))

      const now = performance.now()
      const dt = now - lastTimeRef.current
      const dx = targetLeft - lastTargetLeftRef.current
      lastTimeRef.current = now
      lastTargetLeftRef.current = targetLeft

      let stretch = 1
      let squish = 1
      let skew = 0
      if (dt > 0 && Math.abs(dx) > 0.1) {
        const speed = Math.abs(dx / dt) // px per ms
        stretch = Math.min(1 + speed * 0.22, 1.45)
        squish = Math.max(1 - speed * 0.1, 0.8)
        const direction = dx > 0 ? 1 : -1
        skew = Math.min(speed * 9, 14) * direction
      }

      // Expand bubble by 1.12x and apply physical velocity distortion
      highlightNavButton(btn, targetLeft, stretch * 1.12, squish * 1.12, skew)
    }
  }, [isDraggingNav, getButtonFromX, highlightNavButton])

  const handleNavPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingNav) return
    setIsDraggingNav(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (err) {}
    
    if (bottomNavRef.current) {
      bottomNavRef.current.classList.remove('dragging')
      bottomNavRef.current.querySelectorAll('.bottom-nav-item').forEach((el) => {
        el.classList.remove('hovered', 'neighbor')
      })
    }

    // Only click the target button programmatically if we actually dragged.
    // Tap gestures are handled natively by the browser to avoid double clicks.
    if (didDragRef.current) {
      const btn = getButtonFromX(e.clientX)
      if (btn) {
        const isUtility = btn.getAttribute('data-utility') === 'true'
        const btnView = btn.getAttribute('data-view')
        if (isUtility) {
          btn.click()
        } else if (btnView) {
          btn.click()
        }
      }
    }

    cachedButtonsRef.current = []
    
    // Always force an indicator snap reset with a short timeout to prevent bubble stopping halfway
    setTimeout(() => {
      snapIndicatorToActive()
    }, 50)
  }, [isDraggingNav, getButtonFromX, snapIndicatorToActive])

  const handleNavPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingNav(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (err) {}
    if (bottomNavRef.current) {
      bottomNavRef.current.classList.remove('dragging')
      bottomNavRef.current.querySelectorAll('.bottom-nav-item').forEach((el) => {
        el.classList.remove('hovered', 'neighbor')
      })
    }
    cachedButtonsRef.current = []
    setTimeout(() => {
      snapIndicatorToActive()
    }, 50)
  }, [snapIndicatorToActive])

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false)
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false)
  const [publishingConcert, setPublishingConcert] = useState<Concert | null>(null)
  const [mobileTab, setMobileTab] = useState<'map' | 'list' | 'search' | 'board'>('map')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'concert' | 'sport'>('all')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isEditingZoom, setIsEditingZoom] = useState(false)
  const [tempZoomInput, setTempZoomInput] = useState('')

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [sidebarTab, setSidebarTab] = useState<'venue' | 'tickets' | 'transit'>('tickets')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    handleResize() // 確保在組件掛載時立即取得正確的視窗寬度，避免 Mobile App 顯示成電腦版
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    // 只有在 Capacitor 原生 App (Android/iOS) 環境下才檢查並跳出 APK 下載更新彈窗
    const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()
    if (!isNative) return

    const checkVersion = async () => {
      try {
        let data: { version: string; url: string; notes: string } | null = null
        try {
          const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
          if (res.ok) data = await res.json()
        } catch { /* ignore */ }

        if (!data) {
          const res = await fetch('https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/version.json?t=' + Date.now(), { cache: 'no-store' })
          if (res.ok) data = await res.json()
        }

        if (data && data.version && data.version !== APP_VERSION) {
          const curParts = APP_VERSION.split('.').map(Number)
          const newParts = data.version.split('.').map(Number)
          let isNewer = false
          for (let i = 0; i < Math.max(curParts.length, newParts.length); i++) {
            const curPart = curParts[i] || 0
            const newPart = newParts[i] || 0
            if (newPart > curPart) {
              isNewer = true
              break
            } else if (newPart < curPart) {
              break
            }
          }
          if (isNewer) {
            setUpdateInfo(data)
          }
        }
      } catch (err) {
        console.log('Update check failed:', err)
      }
    }

    const timer = setTimeout(checkVersion, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (selectedVenueId) {
      setSidebarTab('venue')
    } else {
      setSidebarTab('tickets')
    }
  }, [selectedVenueId])

  const handleZoomInputSubmit = () => {
    setIsEditingZoom(false)
    const val = parseInt(tempZoomInput, 10)
    if (!isNaN(val)) {
      const clampedVal = Math.max(70, Math.min(999, val))
      setZoom(clampedVal / 100)
    }
  }

  const [isVenuePanelExpanded, setIsVenuePanelExpanded] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 768 : true
  })
  const [venueSearchQuery, setVenueSearchQuery] = useState('')
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({
    '北部地區': true,
    '中部地區': false,
    '南部地區': false,
    '東部地區': false,
  })

  const [mobileDrawerState, setMobileDrawerState] = useState<'collapsed' | 'half' | 'full'>('collapsed')
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const dragMoved = useRef(false)

  const dragHeightRef = useRef<number | null>(null)
  dragHeightRef.current = dragHeight

  const isDraggingRef = useRef(false)
  isDraggingRef.current = isDragging

  // Bind native touch event listeners to the bottom sheet drawer header to prevent browser pull-to-refresh
  useEffect(() => {
    const headerEl = drawerHeaderRef.current
    if (!headerEl) return

    const handleTouchStartNative = (e: TouchEvent) => {
      if (typeof window === 'undefined') return
      const touch = e.touches[0]
      dragStartY.current = touch.clientY
      dragMoved.current = false
      const drawerEl = document.querySelector('.mobile-bottom-drawer')
      if (drawerEl) {
        dragStartHeight.current = drawerEl.getBoundingClientRect().height
        setIsDragging(true)
      }
    }

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (!isDraggingRef.current || typeof window === 'undefined') return
      e.preventDefault() // Block browser viewport scroll/pull-to-refresh during drag
      const touch = e.touches[0]
      const deltaY = touch.clientY - dragStartY.current
      if (Math.abs(deltaY) > 5) {
        dragMoved.current = true
      }
      const newHeight = dragStartHeight.current - deltaY
      const minHeight = 90
      const maxHeight = window.innerHeight - 100
      setDragHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)))
    }

    const handleTouchEndNative = () => {
      if (!isDraggingRef.current || typeof window === 'undefined') return
      setIsDragging(false)
      if (!dragMoved.current) {
        setDragHeight(null)
        return
      }
      const height = dragHeightRef.current ?? dragStartHeight.current
      setDragHeight(null)
      
      const vh = window.innerHeight
      const collapsedVal = 90
      const halfVal = vh * 0.45
      const fullVal = vh - 100
      
      const diffCollapsed = Math.abs(height - collapsedVal)
      const diffHalf = Math.abs(height - halfVal)
      const diffFull = Math.abs(height - fullVal)
      
      const minDiff = Math.min(diffCollapsed, diffHalf, diffFull)
      if (minDiff === diffCollapsed) {
        setMobileDrawerState('collapsed')
      } else if (minDiff === diffHalf) {
        setMobileDrawerState('half')
      } else {
        setMobileDrawerState('full')
      }
    }

    headerEl.addEventListener('touchstart', handleTouchStartNative, { passive: true })
    headerEl.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
    headerEl.addEventListener('touchend', handleTouchEndNative, { passive: true })
    headerEl.addEventListener('touchcancel', handleTouchEndNative, { passive: true })

    return () => {
      headerEl.removeEventListener('touchstart', handleTouchStartNative)
      headerEl.removeEventListener('touchmove', handleTouchMoveNative)
      headerEl.removeEventListener('touchend', handleTouchEndNative)
      headerEl.removeEventListener('touchcancel', handleTouchEndNative)
    }
  }, [])

  // Toggle .modal-open class on body to freeze background page scroll on mobile
  const isAnyModalOpen = !!(
    isAddModalOpen ||
    detailConcertId ||
    selectedTicket ||
    isSuspensionModalOpen ||
    isAllModalOpen ||
    isPublishModalOpen ||
    isGuideModalOpen ||
    !!updateInfo
  )

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [isAnyModalOpen])

  const handleDrawerHeaderClick = () => {
    if (dragMoved.current) return
    setMobileDrawerState((current) => {
      if (current === 'collapsed') return 'half'
      if (current === 'half') return 'full'
      return 'collapsed'
    })
  }

  // Auto-expand drawer on mobile when venue is selected
  useEffect(() => {
    if (selectedVenueId && typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobileDrawerState('half')
    }
  }, [selectedVenueId])

  useEffect(() => {
    if (view === 'board') {
      setMobileTab('board')
    } else if (view === 'map') {
      setMobileTab((current) => (current === 'board' ? 'map' : current))
    }
    // Log view change
    logCustomEvent('view_page', { page: view })
  }, [view])

  // Log venue selection
  useEffect(() => {
    if (selectedVenueId) {
      const venue = VENUES.find(v => v.id === selectedVenueId)
      if (venue) {
        logCustomEvent('select_venue', {
          venue_id: selectedVenueId,
          venue_name: venue.name,
          venue_city: venue.city
        })
      }
    }
  }, [selectedVenueId])

  // Log search queries (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) return
    const timer = setTimeout(() => {
      logCustomEvent('search_concert', {
        search_term: searchQuery.trim()
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [searchQuery])
  const [nickname, setNickname] = useState(() => localStorage.getItem('tw-nickname') || '')
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('tw-logged-in') === 'true')
  const [currentUser, setCurrentUser] = useState<{ nickname: string; email?: string; avatarUrl?: string; spotifyUrl?: string } | null>(() => {
    const stored = localStorage.getItem('tw-user-info')
    return stored ? JSON.parse(stored) : null
  })
  const [hasCheckedMigration, setHasCheckedMigration] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const localAvatar = localStorage.getItem(`tw-avatar-${firebaseUser.email || firebaseUser.uid}`) || undefined
        const user = {
          nickname: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '樂迷',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || localAvatar
        }
        setIsLoggedIn(true)
        setCurrentUser(user)
        setNickname(user.nickname)
        localStorage.setItem('tw-logged-in', 'true')
        localStorage.setItem('tw-user-info', JSON.stringify(user))
        localStorage.setItem('tw-nickname', user.nickname)

        // Restore cloud-saved theme & palette preference
        getDoc(doc(db, 'users', firebaseUser.uid))
          .then((userSnap) => {
            if (userSnap.exists()) {
              const data = userSnap.data()
              if (data.preferredTheme === 'light' || data.preferredTheme === 'dark') {
                setTheme(data.preferredTheme)
              }
              if (data.preferredPalette === 'sage' || data.preferredPalette === 'volcano') {
                setColorPalette(data.preferredPalette)
              }
            }
          })
          .catch(() => {})
      } else {
        // Maintain guest@example.com session if active (mock guest login)
        const stored = localStorage.getItem('tw-user-info')
        const parsed = stored ? JSON.parse(stored) : null
        if (parsed && parsed.email === 'guest@example.com') {
          setIsLoggedIn(true)
          setCurrentUser(parsed)
          setNickname(parsed.nickname)
        } else {
          setIsLoggedIn(false)
          setCurrentUser(null)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  // 抓取停班停課資訊，並判斷是否彈窗
  useEffect(() => {
    const fetchSuspension = async () => {
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/suspension.json?t=${Date.now()}`,
          { cache: 'no-store' }
        )
        if (!response.ok) throw new Error('suspension.json not found')
        const data = (await response.json()) as SuspensionInfo
        setSuspensionData(data)

        // 檢查是否有實際停班停課資訊（包含「停止」或「停班」或「停課」，且排除單純的照常）
        const hasSuspension = data.items.some(
          (item) =>
            item.status.includes('停止') ||
            item.status.includes('停班') ||
            item.status.includes('停課') ||
            !item.status.includes('照常')
        )

        if (hasSuspension) {
          // 取得台北時間 YYYY-MM-DD
          const d = new Date()
          const utc = d.getTime() + d.getTimezoneOffset() * 60000
          const taipeiTime = new Date(utc + 3600000 * 8)
          const yyyy = taipeiTime.getFullYear()
          const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
          const dd = String(taipeiTime.getDate()).padStart(2, '0')
          const todayStr = `${yyyy}-${mm}-${dd}`

          const dismissedDate = localStorage.getItem('suspension-dismissed-date')
          if (dismissedDate !== todayStr) {
            setIsSuspensionModalOpen(true)
          }
        }
      } catch (e) {
        console.error('Failed to fetch suspension info:', e)
      }
    }

    fetchSuspension()
  }, [])

  const selectedVenue = useMemo(
    () => VENUES.find((venue) => venue.id === selectedVenueId) ?? null,
    [selectedVenueId],
  )
  const selectedVenueConcerts = useMemo(
    () =>
      concerts
        .filter((concert) => concert.venueId === selectedVenueId)
        .sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0')),
    [concerts, selectedVenueId],
  )
  // 取得台北時間 YYYY-MM-DD 作為「今日」的基準
  const selectedVenueTodayConcerts = useMemo(() => {
    if (!selectedVenueId || !selectedVenue) return []

    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const taipeiTime = new Date(utc + 3600000 * 8)
    const yyyy = taipeiTime.getFullYear()
    const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
    const dd = String(taipeiTime.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    const normalizeDate = (dStr: string | undefined): string => {
      if (!dStr) return ''
      const clean = dStr.trim().replace(/\//g, '-')
      const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (match) {
        const y = match[1]
        const m = match[2].padStart(2, '0')
        const d = match[3].padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      return clean.substring(0, 10)
    }

    return remoteConcerts.filter((c) => {
      let venueMatch = false
      if (c.venue_id === selectedVenueId) {
        venueMatch = true
      } else {
        const nameMatch = c.venue_name && c.venue_name.toLowerCase().includes(selectedVenue.name.toLowerCase())
        const rawMatch = c.venue_raw && c.venue_raw.toLowerCase().includes(selectedVenue.name.toLowerCase())
        venueMatch = !!(nameMatch || rawMatch)
      }
      if (!venueMatch) return false

      const dateKey = normalizeDate(c.date)
      return dateKey === todayStr
    })
  }, [remoteConcerts, selectedVenueId, selectedVenue])
  const resolvedRemoteConcerts = useMemo(() => {
    return resolveTixcraftUrls(remoteConcerts)
  }, [remoteConcerts])
  const sortedRemoteConcerts = useMemo(() => {
    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const taipeiTime = new Date(utc + 3600000 * 8)
    const yyyy = taipeiTime.getFullYear()
    const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
    const dd = String(taipeiTime.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`

    return [...resolvedRemoteConcerts]
      .filter((c) => !c.date || c.date.trim() >= todayStr)
      .sort((a, b) => Date.parse(a.date || '9999') - Date.parse(b.date || '9999'))
  }, [resolvedRemoteConcerts])
  const categoryCounts = useMemo(() => {
    const all = sortedRemoteConcerts.length
    const sport = sortedRemoteConcerts.filter((c) => c.source === '中華職棒').length
    const concert = all - sport
    return { all, sport, concert }
  }, [sortedRemoteConcerts])
  const filteredRemoteConcerts = useMemo(() => {
    let list = sortedRemoteConcerts

    if (categoryFilter !== 'all') {
      list = list.filter((c) => {
        const isSport = c.source === '中華職棒'
        return categoryFilter === 'sport' ? isSport : !isSport
      })
    }

    if (selectedVenueId) {
      list = list.filter((concert) => {
        if (concert.venue_id === selectedVenueId) return true
        if (selectedVenue) {
          const nameMatch = concert.venue_name && concert.venue_name.toLowerCase().includes(selectedVenue.name.toLowerCase())
          const rawMatch = concert.venue_raw && concert.venue_raw.toLowerCase().includes(selectedVenue.name.toLowerCase())
          return nameMatch || rawMatch
        }
        return false
      })
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((concert) => {
        const nameMatch = concert.name && concert.name.toLowerCase().includes(q)
        const venueMatch = (concert.venue_name && concert.venue_name.toLowerCase().includes(q)) ||
                           (concert.venue_raw && concert.venue_raw.toLowerCase().includes(q))
        const cityMatch = concert.city && concert.city.toLowerCase().includes(q)
        const platformMatch = concert.ticket_links && concert.ticket_links.some(
          (link) => link.name.toLowerCase().includes(q) || link.platform.toLowerCase().includes(q)
        )
        return nameMatch || venueMatch || cityMatch || platformMatch
      })
    }

    return list
  }, [sortedRemoteConcerts, selectedVenueId, selectedVenue, searchQuery, categoryFilter])
  const activeVenueIds = useMemo(() => {
    return new Set(filteredRemoteConcerts.map((rc) => rc.venue_id).filter(Boolean) as string[])
  }, [filteredRemoteConcerts])

  const groupedVenues = useMemo(() => {
    const grouped: Record<string, typeof VENUES> = {
      '北部地區': [],
      '中部地區': [],
      '南部地區': [],
      '東部地區': [],
    }

    const filtered = VENUES.filter((v) => {
      if (categoryFilter !== 'all' && activeVenueIds && !activeVenueIds.has(v.id)) {
        return false
      }
      if (venueSearchQuery) {
        const query = venueSearchQuery.toLowerCase()
        return (
          v.name.toLowerCase().includes(query) ||
          v.city.toLowerCase().includes(query) ||
          (v.address && v.address.toLowerCase().includes(query))
        )
      }
      return true
    })

    filtered.forEach((v) => {
      const region = getRegionForCity(v.city)
      if (grouped[region]) {
        grouped[region].push(v)
      }
    })

    return grouped
  }, [venueSearchQuery, categoryFilter, activeVenueIds])

  useEffect(() => {
    if (venueSearchQuery) {
      setExpandedRegions({
        '北部地區': true,
        '中部地區': true,
        '南部地區': true,
        '東部地區': true,
      })
    }
  }, [venueSearchQuery])
  const notesPreviewHtml = useMemo(() => {
    if (!form.notes) return '<p style="color: var(--muted); font-style: italic; font-size: 0.85rem; padding: 1rem 0;">（輸入心得後可在此預覽 Markdown 效果）</p>'
    try {
      return marked.parse(form.notes) as string
    } catch {
      return form.notes
    }
  }, [form.notes])
  const sortedConcerts = useMemo(
    () => [...concerts].sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0')),
    [concerts],
  )
  const detailConcert = concerts.find((concert) => concert.id === detailConcertId) ?? null
  const lightboxConcert = lightbox ? concerts.find((concert) => concert.id === lightbox.concertId) : null
  const lightboxMedia = lightbox && lightboxConcert ? lightboxConcert.media[lightbox.mediaIndex] : null
  const visitedVenueCount = new Set(concerts.map((concert) => concert.venueId)).size
  const totalMedia = concerts.reduce((sum, concert) => sum + concert.media.length, 0)
  const musicBarEmbedUrl = parseSpotifyEmbedUrl(musicBarUrl)
  const musicBarPlayerHeight = musicBarUrl
    ? (musicBarUrl.includes('/track/') || musicBarUrl.includes('/episode/') ? 80 : 352)
    : 80

  const loadRemoteConcerts = useCallback(async () => {
    setIsRemoteRefreshing(true)

    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public/concerts.json?t=${Date.now()}`,
        { cache: 'no-store' }
      )
      if (!response.ok) throw new Error('concerts.json not found')

      const data = (await response.json()) as RemoteConcertPayload
      const rawEvents = Array.isArray(data.events) ? data.events : []
      const events = rawEvents.filter(isTargetEventCategory)
      setRemoteConcerts(events)
      setRemoteUpdatedAt(data.updated_at ?? null)
      setRemoteStatus(events.length ? '' : '目前沒有抓到近期售票活動')
    } catch {
      setRemoteConcerts([])
      setRemoteUpdatedAt(null)
      setRemoteStatus('近期售票活動暫時讀取失敗')
    } finally {
      setIsRemoteRefreshing(false)
    }
  }, [])

  const updateConcertsList = async (updatedList: Concert[]) => {
    // 1. Immediately update React state
    setConcerts(updatedList)

    // 2. Prepare clean list (sanitize fields to prevent undefined errors in Firestore)
    const cleanList: Concert[] = updatedList.map((c) => ({
      id: String(c.id || Date.now()),
      venueId: String(c.venueId || ''),
      venueName: String(c.venueName || ''),
      venueCity: String(c.venueCity || ''),
      artist: String(c.artist || ''),
      concertName: String(c.concertName || ''),
      date: String(c.date || ''),
      seat: String(c.seat || ''),
      notes: String(c.notes || ''),
      spotifyUrl: String(c.spotifyUrl || ''),
      media: (c.media || []).map((m) => ({
        id: String(m.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
        name: String(m.name || 'photo.jpg'),
        dataUrl: String(m.dataUrl || ''),
        type: String(m.type || 'image/jpeg')
      })),
      createdAt: String(c.createdAt || new Date().toISOString())
    }))

    if (isLoggedIn && currentUser?.email) {
      const email = currentUser.email
      // ALWAYS update local cache first
      try {
        localStorage.setItem(`tw-concerts-${email}`, JSON.stringify(cleanList))
      } catch (e) {
        console.error('Failed to save to local cache:', e)
      }

      try {
        const docRef = doc(db, 'users_concerts', email)
        await setDoc(docRef, {
          email,
          concerts: cleanList,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      } catch (error) {
        console.error('Failed to save to Firestore:', error)
        showToast(
          lang === 'zh-TW' 
            ? '已儲存至本機，但雲端同步失敗！可能因為照片過大，請減少照片數量後再試。' 
            : 'Saved locally, but cloud sync failed! Cumulative file size might be too large.', 
          'error'
        )
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList))
      } catch (error) {
        console.error('Failed to save guest concerts:', error)
        showToast(
          lang === 'zh-TW' 
            ? '儲存失敗！本機儲存空間已滿，請減少照片數量後再試。' 
            : 'Save failed! Local storage is full. Please reduce photos and try again.', 
          'error'
        )
      }
    }
  }

  // Sync and load user-specific concerts from Firestore when login state changes
  useEffect(() => {
    let unsubscribe = () => {}

    if (isLoggedIn && currentUser?.email) {
      const email = currentUser.email
      const docRef = doc(db, 'users_concerts', email)

      unsubscribe = onSnapshot(docRef, (docSnap) => {
        // Load current local cached concerts and guest concerts
        const localCached = localStorage.getItem(`tw-concerts-${email}`)
        const localConcerts = localCached ? (JSON.parse(localCached) as Concert[]) : []
        const guestCached = localStorage.getItem(STORAGE_KEY)
        const guestConcerts = guestCached ? (JSON.parse(guestCached) as Concert[]) : []

        if (docSnap.exists()) {
          const docData = docSnap.data()
          const remoteConcerts = (docData.concerts as Concert[]) || []

          const cloudNickname = docData.nickname as string | undefined
          const cloudAvatar = docData.avatarUrl as string | undefined
          const cloudSpotifyUrl = docData.spotifyUrl as string | undefined

          if (cloudNickname || cloudAvatar || cloudSpotifyUrl !== undefined) {
            setCurrentUser((prev) => {
              if (!prev) return null
              const updated = {
                ...prev,
                nickname: cloudNickname || prev.nickname,
                avatarUrl: cloudAvatar || prev.avatarUrl,
                spotifyUrl: cloudSpotifyUrl !== undefined ? (cloudSpotifyUrl || undefined) : prev.spotifyUrl
              }
              localStorage.setItem('tw-user-info', JSON.stringify(updated))
              if (cloudNickname) {
                localStorage.setItem('tw-nickname', cloudNickname)
                setNickname(cloudNickname)
              }
              return updated
            })
          }

          // Safely merge: start with remoteConcerts, then add localConcerts and guestConcerts not present in remote
          const concertMap = new Map<string, Concert>()
          remoteConcerts.forEach((c) => {
            if (c.id) concertMap.set(c.id, c)
          })
          
          let hasNewLocalAdditions = false
          localConcerts.forEach((lc) => {
            if (lc.id && !concertMap.has(lc.id)) {
              concertMap.set(lc.id, lc)
              hasNewLocalAdditions = true
            }
          })

          guestConcerts.forEach((gc) => {
            if (gc.id && !concertMap.has(gc.id)) {
              concertMap.set(gc.id, gc)
              hasNewLocalAdditions = true
            }
          })

          const mergedConcerts = Array.from(concertMap.values())
          setConcerts(mergedConcerts)
          localStorage.setItem(`tw-concerts-${email}`, JSON.stringify(mergedConcerts))

          if (hasNewLocalAdditions) {
            setDoc(docRef, {
              email,
              concerts: mergedConcerts,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch((err) => console.error('Failed to sync merged concerts to Firestore:', err))
            localStorage.setItem(STORAGE_KEY, '[]')
          }
        } else {
          // Document doesn't exist, initialize with local/guest concerts
          const concertMap = new Map<string, Concert>()
          localConcerts.forEach((c) => { if (c.id) concertMap.set(c.id, c) })
          guestConcerts.forEach((c) => { if (c.id) concertMap.set(c.id, c) })
          const merged = Array.from(concertMap.values())

          setConcerts(merged)
          localStorage.setItem(`tw-concerts-${email}`, JSON.stringify(merged))
          setDoc(docRef, {
            email,
            concerts: merged,
            updatedAt: new Date().toISOString()
          }).catch((err) => console.error('Failed to initialize user concerts in Firestore:', err))
          localStorage.setItem(STORAGE_KEY, '[]')
        }
      }, (error) => {
        console.error('Firestore real-time sync failed:', error)
        const cached = localStorage.getItem(`tw-concerts-${email}`)
        if (cached) {
          setConcerts(JSON.parse(cached) as Concert[])
        }
      })
    } else {
      const cached = localStorage.getItem(STORAGE_KEY)
      setConcerts(cached ? (JSON.parse(cached) as Concert[]) : [])
    }

    return () => unsubscribe()
  }, [isLoggedIn, currentUser?.email])

  // Background migration of old Base64 images to ImgBB
  useEffect(() => {
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY
    if (!apiKey || concerts.length === 0 || hasCheckedMigration) return

    const migrateOldPhotos = async () => {
      // Find all concerts that have old base64 images
      const concertsToMigrate = concerts.filter(c =>
        c.media && c.media.some(m => m.type.startsWith('image/') && m.dataUrl.startsWith('data:image/'))
      )

      if (concertsToMigrate.length === 0) {
        setHasCheckedMigration(true)
        return
      }

      setHasCheckedMigration(true)
      showToast(
        lang === 'zh-TW' 
          ? '偵測到舊照片，正在背景備份至雲端空間...' 
          : 'Old photos detected, backing up to cloud in background...', 
        'info'
      )

      let updatedList = [...concerts]
      let hasChanges = false

      for (let i = 0; i < updatedList.length; i++) {
        const concert = updatedList[i]
        if (!concert.media || concert.media.length === 0) continue

        let concertMediaChanged = false
        const newMedia = await Promise.all(
          concert.media.map(async (m) => {
            if (m.type.startsWith('image/') && m.dataUrl.startsWith('data:image/')) {
              try {
                const blob = dataURLtoBlob(m.dataUrl)
                const imgbbUrl = await uploadImageToImgBB(blob, m.name || 'migrated_photo.jpg')
                concertMediaChanged = true
                hasChanges = true
                return { ...m, dataUrl: imgbbUrl }
              } catch (err) {
                console.error(`Failed to migrate image ${m.name} in concert ${concert.id}:`, err)
                return m
              }
            }
            return m
          })
        )

        if (concertMediaChanged) {
          updatedList[i] = { ...concert, media: newMedia }
        }
      }

      if (hasChanges) {
        try {
          await updateConcertsList(updatedList)
          showToast(
            lang === 'zh-TW' 
              ? '舊照片備份至雲端完成！' 
              : 'Old photos backup completed!', 
            'success'
          )
        } catch (err) {
          console.error('Failed to save migrated concerts list:', err)
        }
      }
    }

    migrateOldPhotos()
  }, [concerts, hasCheckedMigration, lang])

  useEffect(() => {
    loadRemoteConcerts()
    const timer = window.setInterval(loadRemoteConcerts, REMOTE_CONCERT_REFRESH_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [loadRemoteConcerts])

  useEffect(() => {
    document.body.classList.toggle('player-open', isMusicBarVisible)
    const totalHeight = isMusicBarVisible ? (musicBarPlayerHeight + 34) : 0
    document.documentElement.style.setProperty('--player-height', `${totalHeight}px`)

    return () => {
      document.body.classList.remove('player-open')
    }
  }, [isMusicBarVisible, musicBarPlayerHeight])



  const openAddModal = (date?: string, venue?: typeof VENUES[0] | null) => {
    const activeVenue = venue !== undefined ? venue : selectedVenue
    setForm({
      ...EMPTY_FORM,
      date: date || ''
    })
    if (activeVenue) {
      setFormVenueId(activeVenue.id)
      setFormVenueName(activeVenue.name)
      setFormVenueCity(activeVenue.city)
    } else {
      setFormVenueId('')
      setFormVenueName('')
      setFormVenueCity('台北')
    }
    setPendingMedia([])
    setEditingConcertId(null)
    setSpotifyQuery('')
    setSpotifyResults([])
    setSpotifyStatus('')
    setSelectedSpotify(null)
    setSpotifyTab('artist')
    setNotesActiveTab('edit')
    setIsAddModalOpen(true)
  }

  const openEditModal = (concert: Concert) => {
    setForm({
      artist: concert.artist,
      concertName: concert.concertName || '',
      date: concert.date || '',
      seat: concert.seat || '',
      notes: concert.notes || '',
      spotifyUrl: concert.spotifyUrl || ''
    })
    setFormVenueId(concert.venueId)
    setFormVenueName(concert.venueName)
    setFormVenueCity(concert.venueCity)
    setPendingMedia(concert.media)
    setEditingConcertId(concert.id)

    setSpotifyQuery('')
    setSpotifyResults([])
    setSpotifyStatus('')
    setSelectedSpotify(null)
    setSpotifyTab('artist')
    setNotesActiveTab('edit')
    setIsAddModalOpen(true)
    setDetailConcertId(null) // Close the detail modal when editing
  }

  const closeAddModal = () => {
    setNotesActiveTab('edit')
    setEditingConcertId(null)
    setIsAddModalOpen(false)
  }
  const closeDetailModal = () => setDetailConcertId(null)
  const closeAllModal = () => setIsAllModalOpen(false)

  const handleDismissSuspensionToday = () => {
    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const taipeiTime = new Date(utc + 3600000 * 8)
    const yyyy = taipeiTime.getFullYear()
    const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
    const dd = String(taipeiTime.getDate()).padStart(2, '0')
    const todayStr = `${yyyy}-${mm}-${dd}`
    localStorage.setItem('suspension-dismissed-date', todayStr)
    setIsSuspensionModalOpen(false)
  }

  const updateForm = (field: keyof ConcertForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const compressConcertImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = base64Str
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        const MAX_HEIGHT = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        } else {
          resolve(base64Str)
        }
      }
      img.onerror = () => {
        resolve(base64Str)
      }
    })
  }

  const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  const uploadImageToImgBB = async (fileBlob: Blob, fileName: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY
    if (!apiKey) {
      throw new Error('ImgBB API key is missing')
    }

    const formData = new FormData()
    formData.append('image', fileBlob, fileName)

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result?.success && result?.data?.url) {
      return result.data.url
    } else {
      throw new Error('Invalid response from ImgBB')
    }
  }

  const handleMediaUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    files.forEach((file) => {
      const isImage = file.type.startsWith('image/')

      if (!isImage) {
        showToast(lang === 'zh-TW' ? '僅支援上傳照片檔案！' : 'Only photo files are supported!', 'error')
        return
      }

      if (file.size > 32 * 1024 * 1024) {
        showToast(lang === 'zh-TW' ? '單張照片容量不能超過 32MB！' : 'Single photo size cannot exceed 32MB!', 'error')
        return
      }
      
      const mediaId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.name}`
      const reader = new FileReader()
      reader.onload = async () => {
        if (typeof reader.result !== 'string') return
        
        let finalDataUrl = reader.result
        let imageBlob: Blob | null = null

        if (isImage) {
          try {
            finalDataUrl = await compressConcertImage(reader.result)
            imageBlob = dataURLtoBlob(finalDataUrl)
          } catch (err) {
            console.warn('Failed to compress image:', err)
          }
        }

        const apiKey = import.meta.env.VITE_IMGBB_API_KEY

        // Add to pending list immediately with preview data URL and uploading flag
        setPendingMedia((current) => [
          ...current,
          { 
            id: mediaId, 
            name: file.name, 
            dataUrl: finalDataUrl, 
            type: file.type, 
            isUploading: isImage && !!apiKey 
          },
        ])

        if (isImage && apiKey) {
          try {
            const blobToUpload = imageBlob || file
            const imgbbUrl = await uploadImageToImgBB(blobToUpload, file.name)
            
            // Swap preview with ImgBB URL and clear loading state
            setPendingMedia((current) =>
              current.map((item) =>
                item.id === mediaId ? { ...item, dataUrl: imgbbUrl, isUploading: false } : item
              )
            )
          } catch (err) {
            console.error('Failed to upload image to ImgBB:', err)
            showToast(
              lang === 'zh-TW' 
                ? `照片上傳失敗，將降級為本地儲存：${err instanceof Error ? err.message : ''}` 
                : `Photo upload failed, falling back to local: ${err instanceof Error ? err.message : ''}`,
              'error'
            )
            // Fallback: keep local compressed dataUrl, set isUploading: false
            setPendingMedia((current) =>
              current.map((item) =>
                item.id === mediaId ? { ...item, isUploading: false } : item
              )
            )
          }
        }
      }
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  const saveConcert = async () => {
    if (pendingMedia.some((m) => m.isUploading)) {
      showToast(lang === 'zh-TW' ? '照片仍在儲存/上傳中，請稍候。' : 'Photos are still uploading, please wait.', 'info')
      return
    }

    const artist = (form.artist || '').trim()

    if (!artist) {
      showToast(lang === 'zh-TW' ? '請輸入演出者名稱' : 'Please enter artist name', 'error')
      return
    }
    if (!formVenueId) {
      showToast(lang === 'zh-TW' ? '請選擇或輸入活動場館' : 'Please select or enter venue', 'error')
      return
    }
    if (formVenueId === 'custom' && !(formVenueName || '').trim()) {
      showToast(lang === 'zh-TW' ? '請輸入自訂場館名稱' : 'Please enter custom venue name', 'error')
      return
    }

    try {
      setIsSaving(true)
      const finalVenueId = formVenueId
      const finalVenueName = formVenueId === 'custom' ? (formVenueName || '').trim() : VENUES.find(v => v.id === formVenueId)?.name || (formVenueName || '').trim() || ''
      const finalVenueCity = formVenueId === 'custom' ? formVenueCity : VENUES.find(v => v.id === formVenueId)?.city || formVenueCity || '台北'

      const concertId = editingConcertId || Date.now().toString()

      showToast(lang === 'zh-TW' ? '正在儲存紀錄...' : 'Saving record...', 'info')

      // Save photos to IndexedDB for local persistence backup
      if (pendingMedia && pendingMedia.length > 0) {
        pendingMedia.forEach((m) => {
          if (m.id && m.dataUrl) {
            saveLocalMedia(m.id, m.dataUrl).catch((err) => console.error('Failed to cache media to IndexedDB:', err))
          }
        })
      }

      const concert: Concert = {
        id: concertId,
        venueId: finalVenueId,
        venueName: finalVenueName,
        venueCity: finalVenueCity,
        artist,
        concertName: (form.concertName || '').trim(),
        date: form.date || '',
        seat: (form.seat || '').trim(),
        notes: (form.notes || '').trim(),
        spotifyUrl: (form.spotifyUrl || '').trim(),
        media: (pendingMedia || []).map((m) => ({
          id: m.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: m.name || 'photo.jpg',
          dataUrl: m.dataUrl || '',
          type: m.type || 'image/jpeg'
        })),
        createdAt: editingConcertId ? (concerts.find(c => c.id === editingConcertId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      }

      let updatedList: Concert[]
      if (editingConcertId) {
        updatedList = concerts.map((c) => c.id === editingConcertId ? concert : c)
      } else {
        updatedList = [...concerts, concert]
      }

      await updateConcertsList(updatedList)
      
      setIsAddModalOpen(false)
      setEditingConcertId(null)
      setIsSaving(false)
      showToast(lang === 'zh-TW' ? '紀錄已成功儲存並同步！' : 'Record saved and synced successfully!', 'success')

      logCustomEvent('add_concert_record', {
        venue_id: concert.venueId,
        venue_name: concert.venueName,
        artist: concert.artist,
        concert_name: concert.concertName
      })
    } catch (err) {
      console.error('Error in saveConcert:', err)
      setIsSaving(false)
      showToast(lang === 'zh-TW' ? '儲存失敗！發生未知錯誤。' : 'Save failed! An unknown error occurred.', 'error')
    }
  }

  const deleteConcert = (id: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!confirm(t('confirmDelete'))) return
    
    // Clean up IndexedDB media
    const targetConcert = concerts.find((c) => c.id === id)
    if (targetConcert) {
      targetConcert.media.forEach((m) => {
        if (m.id) {
          deleteLocalMedia(m.id).catch((err) => console.error('Failed to delete media from IndexedDB:', err))
        }
      })
    }

    const updatedList = concerts.filter((c) => c.id !== id)
    updateConcertsList(updatedList)
  }

  const handlePublishToBoard = async (authorName: string) => {
    if (!publishingConcert) return
    const author = authorName.trim() || t('anonymousAuthor')
    localStorage.setItem('tw-nickname', author)
    setNickname(author)

    try {
      const docRef = await addDoc(collection(db, 'reviews'), {
        artist: publishingConcert.artist,
        concertName: publishingConcert.concertName || (lang === 'zh-TW' ? '未命名演唱會' : 'Unnamed Concert'),
        venueName: publishingConcert.venueName || (lang === 'zh-TW' ? '未指定場館' : 'Unspecified Venue'),
        venueCity: publishingConcert.venueCity || '其他',
        date: publishingConcert.date || '',
        author: author,
        notes: publishingConcert.notes,
        likes: 0,
        createdAt: new Date().toISOString(),
      })

      // Save created note ID to local storage
      const myCreatedNotes = JSON.parse(localStorage.getItem('tw-my-created-notes') || '[]')
      myCreatedNotes.push(docRef.id)
      localStorage.setItem('tw-my-created-notes', JSON.stringify(myCreatedNotes))

      logCustomEvent('publish_community_note', {
        artist: publishingConcert.artist,
        venue_name: publishingConcert.venueName,
        concert_name: publishingConcert.concertName,
        source: 'my_record'
      })

      setIsPublishModalOpen(false)
      setPublishingConcert(null)
      setTimeout(() => {
        showToast(lang === 'zh-TW' ? '發佈成功！已將您的觀後感分享至社牆。' : 'Successfully published! Your review has been shared to the community board.', 'success')
        setView('board')
        setDetailConcertId(null)
      }, 100)
    } catch (error) {
      console.error('Firebase write error:', error)
      showToast(lang === 'zh-TW' ? '發佈失敗，請檢查網路連線或 Firebase 設定！' : 'Failed to publish. Please check your connection or Firebase settings.', 'error')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Firebase Auth sign out error:', err)
    }
    localStorage.removeItem('tw-logged-in')
    localStorage.removeItem('tw-user-info')
    setIsLoggedIn(false)
    setCurrentUser(null)
    setView('map')
    showToast(lang === 'zh-TW' ? '您已成功登出！' : 'You have successfully logged out.', 'success')
  }

  const removePendingMedia = (index: number) => {
    setPendingMedia((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const searchSpotify = async (queryOverride?: string) => {
    const query = (queryOverride ?? spotifyQuery).trim()
    if (!query) return

    setIsSpotifySearching(true)
    setSpotifyStatus(`搜尋中 ${query}...`)

    try {
      let token = await getSpotifyToken()
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query,
      )}&type=artist,album,track&limit=5&market=TW`
      
      let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

      if (response.status === 401) {
        token = await getSpotifyToken(true)
        response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const results = normalizeSpotifyResults(data)

      setSpotifyResults(results)
      setSpotifyStatus(results.length === 0 ? `找不到「${query}」的結果` : '')
    } catch (err: any) {
      console.error('Spotify search error:', err)
      setSpotifyResults([])
      setSpotifyStatus(err?.message ? `搜尋失敗 (${err.message})，請檢查 API 金鑰或網路` : '搜尋失敗，請稍後再試')
    } finally {
      setIsSpotifySearching(false)
    }
  }

  const selectSpotifyItem = (item: SpotifyItem) => {
    setSelectedSpotify(item)
    setForm((current) => ({ ...current, spotifyUrl: item.url }))
    setSpotifyResults([])
  }

  const clearSpotifySelection = () => {
    setSelectedSpotify(null)
    setForm((current) => ({ ...current, spotifyUrl: '' }))
    setSpotifyQuery('')
    setSpotifyResults([])
    setSpotifyStatus('')
  }

  const openConcertDetail = (concertId: string) => {
    const concert = concerts.find((item) => item.id === concertId)
    setDetailConcertId(concertId)

    if (concert?.spotifyUrl && parseSpotifyEmbedUrl(concert.spotifyUrl)) {
      setMusicBarUrl(concert.spotifyUrl)
      setIsMusicBarVisible(true)
    }
  }

  const handleHeaderClick = () => {
    setView('map')
    setSelectedVenueId(null) // Return to home (deselect venue)

    // Scroll window/document
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
    try {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      document.documentElement.scrollTop = 0
    }
    try {
      document.body.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      document.body.scrollTop = 0
    }

    // Scroll sidebar
    const sidebarScroll = document.querySelector('.concert-list-area')
    if (sidebarScroll) {
      try {
        sidebarScroll.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        sidebarScroll.scrollTop = 0
      }
    }
  }

  return (
    <>
      <header className={view !== 'map' || isSidebarCollapsed ? 'full-width-header' : ''}>
        {view !== 'login' && (
          <button
            className="mobile-menu-toggle-btn"
            type="button"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            aria-label="選單"
          >
            <MenuIcon />
          </button>
        )}
        <div className="logo" onClick={handleHeaderClick}>
          <div className="logo-icon"><TaiwanIcon /></div>
          <div className="logo-text">
            <h1>{t('title')}</h1>
            <span>{t('subtitle')}</span>
          </div>
        </div>

        <div className="header-search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (window.innerWidth <= 768 && e.target.value) {
                setMobileTab('list')
              }
            }}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              type="button"
              onClick={() => setSearchQuery('')}
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="header-right">
          <div className="stats-bar">
            <Stat number={concerts.length} label={t('statConcerts')} />
            <Stat number={visitedVenueCount} label={t('statVenues')} />
            <Stat number={remoteConcerts.length} label={t('statTickets')} />
            <Stat number={totalMedia} label={t('statMedia')} />
          </div>
          <button
            className={`nav-toggle-btn${view === 'map' ? ' active' : ''}`}
            type="button"
            onClick={() => setView('map')}
          >
            <MapIcon style={{ marginRight: '6px' }} /> <span className="btn-label">{t('tabMap')}</span>
          </button>
          <button
            className={`nav-toggle-btn${view === 'calendar' ? ' active' : ''}`}
            type="button"
            onClick={() => setView('calendar')}
          >
            <CalendarIcon style={{ marginRight: '6px' }} /> <span className="btn-label">{t('tabCalendar')}</span>
          </button>
          <button
            className={`nav-toggle-btn${view === 'board' ? ' active' : ''}`}
            type="button"
            onClick={() => setView('board')}
          >
            <MessageIcon style={{ marginRight: '6px' }} /> <span className="btn-label">{t('tabCommunity')}</span>
          </button>
          <button
            className="theme-toggle-btn lang-toggle-btn"
            type="button"
            onClick={() => setIsLanguageModalOpen(true)}
            title={t('langTitle')}
            aria-label="Language Selector"
          >
            <GlobeIcon size="1.2em" />
          </button>
          <button
            className="theme-toggle-btn guide-trigger-icon-btn"
            type="button"
            onClick={() => setIsGuideModalOpen(true)}
            title={t('siteTour')}
            aria-label="網站導覽"
          >
            <SparklesIcon />
          </button>
          <button
            className="theme-toggle-btn palette-toggle-btn"
            type="button"
            onClick={toggleColorPalette}
            title={colorPalette === 'sage' ? (lang === 'zh-TW' ? '切換為黑橘配色' : 'Switch to Orange Theme') : (lang === 'zh-TW' ? '切換為綠色配色' : 'Switch to Green Theme')}
            aria-label="切換調色盤"
          >
            <PaletteIcon style={{ color: colorPalette === 'sage' ? 'var(--accent)' : '#ff9100' }} />
          </button>
          <button
            className="theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? (lang === 'zh-TW' ? '切換為淺色模式' : 'Switch to Light Mode') : (lang === 'zh-TW' ? '切換為深色模式' : 'Switch to Dark Mode')}
            aria-label="切換主題"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {isLoggedIn && currentUser ? (
            <div className="user-profile-menu">
              <button
                className={`nav-toggle-btn profile-trigger-btn${view === 'profile' ? ' active' : ''}`}
                type="button"
                onClick={() => setView('profile')}
              >
                <UserIcon style={{ marginRight: '6px' }} /> <span className="btn-label">{t('profile')}</span>
              </button>
              <button className="nav-toggle-btn logout-btn" type="button" onClick={handleLogout}>
                <LogoutIcon style={{ marginRight: '6px' }} /> <span className="btn-label">{t('logout')}</span>
              </button>
            </div>
          ) : (
            <button
              className="nav-toggle-btn login-trigger-btn"
              type="button"
              onClick={() => setView('login')}
            >
              <KeyIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> <span className="btn-label">{t('login')}</span>
            </button>
          )}
        </div>
      </header>

      {view === 'map' ? (
        <main className={`main-layout mobile-tab-${mobileTab}${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
          {isMobile && (
            <div className="mobile-view-selector-tabs">
              <button
                className={`mobile-view-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
                type="button"
                onClick={() => setMobileTab('map')}
              >
                <MapIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {t('tabMap')}
              </button>
              <button
                className={`mobile-view-tab-btn ${mobileTab === 'list' ? 'active' : ''}`}
                type="button"
                onClick={() => setMobileTab('list')}
              >
                <CalendarIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {t('tabList')}
              </button>
              <button
                className={`mobile-view-tab-btn ${mobileTab === 'search' ? 'active' : ''}`}
                type="button"
                onClick={() => setMobileTab('search')}
              >
                <SearchIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {t('tabSearch')}
              </button>
            </div>
          )}
          <section className="map-container" aria-label="台灣場館地圖">
            <div className="map-bg" onClick={() => setSelectedVenueId(null)} />

            <div className={`venue-panel-container ${isVenuePanelExpanded ? 'expanded' : 'collapsed'}`}>
              <div className="venue-panel-header">
                <div className="search-input-wrapper">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    type="text"
                    placeholder={t('searchVenue')}
                    value={venueSearchQuery}
                    onChange={(e) => setVenueSearchQuery(e.target.value)}
                    onClick={() => {
                      if (!isVenuePanelExpanded) setIsVenuePanelExpanded(true)
                    }}
                  />
                  {venueSearchQuery && (
                    <button
                      className="search-clear-btn"
                      type="button"
                      onClick={() => setVenueSearchQuery('')}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>
                <button
                  className="panel-toggle-btn"
                  type="button"
                  onClick={() => setIsVenuePanelExpanded(!isVenuePanelExpanded)}
                  title={isVenuePanelExpanded ? (lang === 'zh-TW' ? '收合面板' : lang === 'ja' ? 'パネルを閉じる' : lang === 'ko' ? '패널 접기' : 'Collapse Panel') : (lang === 'zh-TW' ? '展開面板' : lang === 'ja' ? 'パネルを開く' : lang === 'ko' ? '패널 열기' : 'Expand Panel')}
                >
                  {isVenuePanelExpanded ? <CloseIcon /> : <MapIcon />}
                </button>
              </div>

              {isVenuePanelExpanded && (
                <div className="venue-panel-content">
                  {Object.entries(groupedVenues).every(([_, list]) => list.length === 0) ? (
                    <div className="no-venues-found">
                      {lang === 'zh-TW' ? '找不到符合的場館' : lang === 'en' ? 'No venues found' : lang === 'ja' ? '該当する会場が見つかりません' : '일치하는 공연장이 없습니다'}
                    </div>
                  ) : (
                    Object.entries(groupedVenues).map(([region, list]) => {
                      if (list.length === 0) return null
                      const isExpanded = expandedRegions[region]
                      return (
                        <div key={region} className="region-group">
                          <button
                            className="region-group-header"
                            type="button"
                            onClick={() =>
                              setExpandedRegions((prev) => ({
                                ...prev,
                                [region]: !prev[region],
                              }))
                            }
                          >
                            <span className="region-title">{t(region as any)}</span>
                            <span className="region-count">{list.length}</span>
                            <span className="region-arrow">
                              {isExpanded ? <ChevronDownIcon size="1.2em" /> : <ChevronRightIcon size="1.2em" />}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="region-group-list">
                              {list.map((v) => {
                                const isActive = selectedVenueId === v.id
                                const hasVisits = concerts.some((c) => c.venueId === v.id)
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    className={`venue-list-item${isActive ? ' active' : ''}${hasVisits ? ' visited' : ''}`}
                                    onClick={() => {
                                      setSelectedVenueId(v.id)
                                      if (window.innerWidth <= 768) {
                                        setIsVenuePanelExpanded(false)
                                      }
                                    }}
                                  >
                                    <span className="dot" />
                                    <span className="name">{translateVenueName(v.name, lang)}</span>
                                    {hasVisits && <span className="visited-badge">✓</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <TaiwanMap
              concerts={concerts}
              selectedVenueId={selectedVenueId}
              onSelectVenue={setSelectedVenueId}
              onClearVenue={() => setSelectedVenueId(null)}
              zoom={zoom}
              onZoomChange={setZoom}
              activeVenueIds={activeVenueIds}
              categoryFilter={categoryFilter}
            />

            {selectedVenue && (
              <div className="map-weather-overlay">
                <VenueWeather
                  latitude={selectedVenue.latitude}
                  longitude={selectedVenue.longitude}
                  cityName={selectedVenue.city}
                  onClose={() => setSelectedVenueId(null)}
                  onViewDetails={() => setMobileTab('list')}
                />
              </div>
            )}

            <div className="map-zoom-control vertical">
              <button
                className="zoom-btn"
                type="button"
                onClick={() => setZoom((z) => Math.min(9.99, z + 0.1))}
                title="放大地圖"
              >
                +
              </button>
              <button
                className="zoom-btn"
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                title="縮小地圖"
              >
                -
              </button>
              <button
                className="zoom-btn reset"
                type="button"
                onClick={() => setZoom(getDefaultZoom())}
                title="重設縮放"
              >
                ⟲
              </button>
              {isEditingZoom ? (
                <input
                  type="text"
                  className="zoom-input"
                  value={tempZoomInput}
                  onChange={(e) => setTempZoomInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={handleZoomInputSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleZoomInputSubmit()
                    } else if (e.key === 'Escape') {
                      setIsEditingZoom(false)
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="zoom-value"
                  onClick={() => {
                    setTempZoomInput(String(Math.round(zoom * 100)))
                    setIsEditingZoom(true)
                  }}
                  title={lang === 'zh-TW' ? '點擊輸入自訂比例' : 'Click to enter custom zoom'}
                  style={{ cursor: 'pointer' }}
                >
                  {Math.round(zoom * 100)}%
                </span>
              )}
            </div>

            <div className="map-legend">
              <LegendItem color="var(--accent)" label={t('unvisited')} />
              <LegendItem color="var(--teal)" label={t('visited')} />
              <LegendItem color="var(--gold)" label={t('selected')} />
            </div>

            <button className="all-concerts-btn" type="button" onClick={() => setIsAllModalOpen(true)}>
              <ClipboardIcon style={{ marginRight: '6px', verticalAlign: 'middle', marginTop: '-2px' }} /> {t('allLogs')}
            </button>
            <button className="add-concert-desktop-btn" type="button" onClick={() => openAddModal()}>
              <PlusIcon style={{ marginRight: '6px', verticalAlign: 'middle', marginTop: '-2px' }} /> {t('addRecord')}
            </button>

            {/* Mobile Bottom Sheet (Sliding Drawer) */}
            <div 
              className={`mobile-bottom-drawer ${mobileDrawerState}${isDragging ? ' dragging' : ''}`}
              style={{
                height: dragHeight !== null ? `${dragHeight}px` : undefined
              }}
            >
              {/* Drawer Drag Handle / Header */}
              <div
                className="drawer-header"
                ref={drawerHeaderRef}
                onClick={handleDrawerHeaderClick}
              >
                <div className="drawer-handle" />
                <div className="drawer-title-row" onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.drawer-search-bar-inline')) {
                    e.stopPropagation();
                  }
                }}>
                  {selectedVenue ? (
                    <div className="drawer-header-left">
                      <span className="drawer-venue-title">
                        <PinIcon style={{ marginRight: '6px', verticalAlign: 'middle', marginTop: '-2px' }} />
                        {translateVenueName(selectedVenue.name, lang)}
                      </span>
                      <button 
                        className="clear-selected-venue-btn" 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVenueId(null);
                          setMobileDrawerState('collapsed');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="drawer-search-bar-inline">
                      <span className="search-icon"><SearchIcon /></span>
                      <input
                        type="text"
                        placeholder={t('searchVenue')}
                        value={venueSearchQuery}
                        onChange={(e) => setVenueSearchQuery(e.target.value)}
                        onFocus={(e) => {
                          e.stopPropagation();
                          if (mobileDrawerState === 'collapsed') {
                            setMobileDrawerState('half');
                          }
                        }}
                      />
                      {venueSearchQuery && (
                        <button
                          className="search-clear-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVenueSearchQuery('');
                          }}
                        >
                          <CloseIcon />
                        </button>
                      )}
                    </div>
                  )}
                  <span className="drawer-state-indicator">
                    {mobileDrawerState === 'collapsed' ? '▲' : mobileDrawerState === 'half' 
                      ? (lang === 'zh-TW' ? '展開 ▴' : lang === 'ja' ? '展開 ▴' : lang === 'ko' ? '펼치기 ▴' : 'Expand ▴') 
                      : (lang === 'zh-TW' ? '收起 ▾' : lang === 'ja' ? '折りたたむ ▾' : lang === 'ko' ? '접기 ▾' : 'Collapse ▾')}
                  </span>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="drawer-body">
                {/* 1. Collapsed Preview */}
                {mobileDrawerState === 'collapsed' && selectedVenue && (
                  <div className="drawer-collapsed-preview" onClick={() => setMobileDrawerState('half')}>
                    <div className="venue-preview-info">
                      <span className="city-tag">{selectedVenue.city}</span>
                      <span className="preview-capacity">
                        <UserIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />{selectedVenue.capacity} {lang === 'zh-TW' ? '人' : lang === 'ja' ? '人' : lang === 'ko' ? '명' : 'ppl'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Expanded Content */}
                {mobileDrawerState !== 'collapsed' && (
                  <div className="drawer-scroll-content">
                    {selectedVenue ? (
                      <div className="drawer-venue-detail">
                        <div className="drawer-section">
                          <VenueWeather
                            latitude={selectedVenue.latitude}
                            longitude={selectedVenue.longitude}
                            cityName={selectedVenue.city}
                            onClose={() => {
                              setSelectedVenueId(null)
                              setMobileDrawerState('collapsed')
                            }}
                            onViewDetails={() => setMobileDrawerState('full')}
                          />
                        </div>

                        <div className="drawer-section transit-section">
                          <TransitInfoBoard />
                        </div>

                        {mobileDrawerState === 'half' ? (
                          <div className="drawer-view-list-action">
                            <button 
                              className="view-concerts-btn" 
                              type="button"
                              onClick={() => setMobileDrawerState('full')}
                            >
                              <MusicIcon style={{ marginRight: '6px', verticalAlign: 'middle', marginTop: '-2px' }} />
                              {lang === 'zh-TW' ? `查看此場館的演唱會記錄 (${selectedVenueConcerts.length} 次)` :
                               lang === 'ja' ? `この会場のコンサート履歴を表示 (${selectedVenueConcerts.length} 回)` :
                               lang === 'ko' ? `이 공연장의 콘서트 기록 보기 (${selectedVenueConcerts.length}회)` :
                               `View Concert History for this Venue (${selectedVenueConcerts.length} times)`}
                            </button>
                          </div>
                        ) : (
                          <div className="drawer-concert-list-wrapper">
                            <UpcomingConcerts
                              key={selectedVenueId || 'all'}
                              concerts={filteredRemoteConcerts}
                              status={remoteStatus}
                              updatedAt={remoteUpdatedAt}
                              isRefreshing={isRemoteRefreshing}
                              onRefresh={loadRemoteConcerts}
                              searchQuery={searchQuery}
                              hasSelectedVenue={!!selectedVenueId}
                              onClearVenue={() => {
                                setSelectedVenueId(null)
                                setMobileDrawerState('collapsed')
                              }}
                              onSelectTicket={setSelectedTicket}
                              categoryFilter={categoryFilter}
                              onCategoryChange={setCategoryFilter}
                              categoryCounts={categoryCounts}
                              suspensionItems={suspensionData?.items}
                            />
                            <ConcertList
                              concerts={selectedVenueConcerts}
                              hasSelectedVenue={Boolean(selectedVenue)}
                              onOpenDetail={openConcertDetail}
                              onDelete={deleteConcert}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="drawer-explore-mode">
                        <div className="drawer-region-accordion">
                          {Object.entries(groupedVenues).every(([_, list]) => list.length === 0) ? (
                            <div className="no-venues-found">
                              {lang === 'zh-TW' ? '找不到符合的場館' : lang === 'en' ? 'No venues found' : lang === 'ja' ? '該当する会場が見つかりません' : '일치하는 공연장이 없습니다'}
                            </div>
                          ) : (
                            Object.entries(groupedVenues).map(([region, list]) => {
                              if (list.length === 0) return null
                              const isExpanded = expandedRegions[region]
                              return (
                                <div key={region} className="region-group">
                                  <button
                                    className="region-group-header"
                                    type="button"
                                    onClick={() =>
                                      setExpandedRegions((prev) => ({
                                        ...prev,
                                        [region]: !prev[region],
                                      }))
                                    }
                                  >
                                    <span className="region-title">{t(region as any)}</span>
                                    <span className="region-count">{list.length}</span>
                                    <span className="region-arrow">
                                      {isExpanded ? <ChevronDownIcon size="1.2em" /> : <ChevronRightIcon size="1.2em" />}
                                    </span>
                                  </button>
                                  {isExpanded && (
                                    <div className="region-group-list">
                                      {list.map((v) => {
                                        const isActive = selectedVenueId === v.id
                                        const hasVisits = concerts.some((c) => c.venueId === v.id)
                                        return (
                                          <button
                                            key={v.id}
                                            type="button"
                                            className={`venue-list-item${isActive ? ' active' : ''}${hasVisits ? ' visited' : ''}`}
                                            onClick={() => {
                                              setSelectedVenueId(v.id)
                                              setMobileDrawerState('half')
                                            }}
                                          >
                                            <span className="dot" />
                                            <span className="name">{translateVenueName(v.name, lang)}</span>
                                            {hasVisits && <span className="visited-badge">✓</span>}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>

                        {mobileDrawerState === 'full' && (
                          <div className="drawer-general-concerts">
                            <UpcomingConcerts
                              key={selectedVenueId || 'all'}
                              concerts={filteredRemoteConcerts}
                              status={remoteStatus}
                              updatedAt={remoteUpdatedAt}
                              isRefreshing={isRemoteRefreshing}
                              onRefresh={loadRemoteConcerts}
                              searchQuery={searchQuery}
                              hasSelectedVenue={false}
                              onClearVenue={() => setSelectedVenueId(null)}
                              onSelectTicket={setSelectedTicket}
                              categoryFilter={categoryFilter}
                              onCategoryChange={setCategoryFilter}
                              categoryCounts={categoryCounts}
                              suspensionItems={suspensionData?.items}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              className={`sidebar-collapse-toggle-btn${isSidebarCollapsed ? ' collapsed' : ''}`}
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
            >
              {isSidebarCollapsed ? <ChevronRightIcon size="1.2em" /> : <ChevronLeftIcon size="1.2em" />}
            </button>
          </section>
          <aside className="sidebar">
            {isMobile ? (
              <>
                {mobileTab !== 'search' && (
                  <VenueInfo
                    key={selectedVenue?.id ?? 'empty'}
                    venue={selectedVenue}
                    concertCount={selectedVenueConcerts.length}
                    onAddConcert={openAddModal}
                    onClearVenue={() => setSelectedVenueId(null)}
                    todayConcerts={selectedVenueTodayConcerts}
                    onSelectTicket={setSelectedTicket}
                    suspensionItems={suspensionData?.items}
                  />
                )}
                <div className="concert-list-area">
                  {mobileTab === 'search' && (
                    <div className="mobile-search-bar">
                      <span className="search-icon"><SearchIcon /></span>
                      <input
                        type="text"
                        placeholder="搜尋歌手、售票或場館..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button
                          className="search-clear-btn"
                          type="button"
                          onClick={() => setSearchQuery('')}
                        >
                          <CloseIcon />
                        </button>
                      )}
                    </div>
                  )}
                  {mobileTab !== 'search' && <TransitInfoBoard />}
                  <UpcomingConcerts
                    key={selectedVenueId || 'all'}
                    concerts={filteredRemoteConcerts}
                    status={remoteStatus}
                    updatedAt={remoteUpdatedAt}
                    isRefreshing={isRemoteRefreshing}
                    onRefresh={loadRemoteConcerts}
                    searchQuery={searchQuery}
                    hasSelectedVenue={!!selectedVenueId}
                    onClearVenue={() => setSelectedVenueId(null)}
                    onSelectTicket={setSelectedTicket}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    categoryCounts={categoryCounts}
                    suspensionItems={suspensionData?.items}
                  />
                  <ConcertList
                    concerts={selectedVenueConcerts}
                    hasSelectedVenue={Boolean(selectedVenue)}
                    onOpenDetail={openConcertDetail}
                    onDelete={deleteConcert}
                  />
                </div>
              </>
            ) : (
              <div className="desktop-sidebar-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div className="sidebar-tabs">
                  {selectedVenue && (
                    <button
                      className={`sidebar-tab-btn${sidebarTab === 'venue' ? ' active' : ''}`}
                      type="button"
                      onClick={() => setSidebarTab('venue')}
                    >
                      <MapIcon size="1.1em" />
                      {lang === 'zh-TW' ? '場館資訊' : lang === 'en' ? 'Venue Info' : lang === 'ja' ? '会場情報' : '공연장 정보'}
                    </button>
                  )}
                  <button
                    className={`sidebar-tab-btn${sidebarTab === 'tickets' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setSidebarTab('tickets')}
                  >
                    <TicketIcon size="1.1em" />
                    {lang === 'zh-TW' ? '近期售票' : lang === 'en' ? 'Upcoming Tickets' : lang === 'ja' ? '近日発売チケット' : '최근 티켓 예매'}
                  </button>
                  <button
                    className={`sidebar-tab-btn${sidebarTab === 'transit' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setSidebarTab('transit')}
                  >
                    <TrainIcon size="1.1em" />
                    {lang === 'zh-TW' ? '交通動態' : lang === 'en' ? 'Transit Info' : lang === 'ja' ? '交通情報' : '교통 상황'}
                  </button>
                </div>

                <div className="concert-list-area" style={{ flex: 1, overflowY: 'auto' }}>
                  {sidebarTab === 'venue' && selectedVenue && (
                    <VenueInfo
                      key={selectedVenue.id}
                      venue={selectedVenue}
                      concertCount={selectedVenueConcerts.length}
                      onAddConcert={openAddModal}
                      onClearVenue={() => setSelectedVenueId(null)}
                      todayConcerts={selectedVenueTodayConcerts}
                      onSelectTicket={setSelectedTicket}
                      suspensionItems={suspensionData?.items}
                    />
                  )}

                  {sidebarTab === 'transit' && <TransitInfoBoard />}

                  {sidebarTab === 'tickets' && (
                    <div className="tickets-tab-scroll-wrapper">
                      <UpcomingConcerts
                        key={selectedVenueId || 'all'}
                        concerts={filteredRemoteConcerts}
                        status={remoteStatus}
                        updatedAt={remoteUpdatedAt}
                        isRefreshing={isRemoteRefreshing}
                        onRefresh={loadRemoteConcerts}
                        searchQuery={searchQuery}
                        hasSelectedVenue={!!selectedVenueId}
                        onClearVenue={() => setSelectedVenueId(null)}
                        onSelectTicket={setSelectedTicket}
                        categoryFilter={categoryFilter}
                        onCategoryChange={setCategoryFilter}
                        categoryCounts={categoryCounts}
                        suspensionItems={suspensionData?.items}
                      />
                      <ConcertList
                        concerts={selectedVenueConcerts}
                        hasSelectedVenue={Boolean(selectedVenue)}
                        onOpenDetail={openConcertDetail}
                        onDelete={deleteConcert}
                      />
                    </div>
                  )}
                </div>

                {/* Spotify Player nested at the bottom of the right panel */}
                {isMusicBarVisible && (
                  <div className="right-panel-spotify-player">
                    <div className="spotify-player-header">
                      <span className="sp-title"><MusicIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />{t('spotifyPlayerTitle')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {musicBarUrl && (
                          <a
                            href={musicBarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.72rem', color: 'var(--teal)', textDecoration: 'none' }}
                            title="在 Spotify 開啟"
                          >
                            ↗ Spotify
                          </a>
                        )}
                        {musicBarEmbedUrl && (
                          <button
                            type="button"
                            onClick={handleReloadPlayer}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', display: 'inline-flex', alignItems: 'center' }}
                            title="重新載入播放器"
                          >
                            <RefreshIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                          </button>
                        )}
                        <button className="sp-close-btn" type="button" onClick={() => setIsMusicBarVisible(false)}>✕</button>
                      </div>
                    </div>
                    <div className="spotify-player-body">
                      {musicBarEmbedUrl ? (
                        <SafeIframe
                          key={`${musicBarEmbedUrl}-${playerReloadKey}`}
                          src={musicBarEmbedUrl}
                          height={musicBarPlayerHeight}
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          title="Spotify player"
                        />
                      ) : (
                        <div className="music-bar-placeholder">
                          <span>{t('spotifyPlayerPlaceholder')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </main>
      ) : view === 'calendar' ? (
        <main className="calendar-main-layout">
          <CalendarView
            concerts={concerts}
            remoteConcerts={remoteConcerts}
            onAddEventClick={(date) => openAddModal(date, null)}
            onOpenConcertDetail={openConcertDetail}
            onOpenTicketDetail={(ticket) => setSelectedTicket(ticket)}
            onDeleteConcert={(id, event) => deleteConcert(id, event as any)}
          />
        </main>
      ) : view === 'board' ? (
        <ShareBoard />
      ) : view === 'profile' && isLoggedIn && currentUser ? (
        <ProfilePage
          user={currentUser}
          concerts={concerts}
          onUpdateNickname={async (newName) => {
            const updated = { ...currentUser, nickname: newName }
            setCurrentUser(updated)
            localStorage.setItem('tw-user-info', JSON.stringify(updated))
            localStorage.setItem('tw-nickname', newName)
            setNickname(newName)

            if (auth.currentUser) {
              try {
                await updateProfile(auth.currentUser, { displayName: newName })
              } catch (err) {
                console.error('Failed to update Firebase display name:', err)
              }
            }

            if (currentUser?.email) {
              try {
                const docRef = doc(db, 'users_concerts', currentUser.email)
                await setDoc(docRef, { nickname: newName }, { merge: true })
              } catch (err) {
                console.error('Failed to sync nickname to Firestore:', err)
              }
            }
          }}
          onUpdateAvatar={async (newAvatar) => {
            let finalAvatar = newAvatar
            if (newAvatar && newAvatar.startsWith('data:image/')) {
              try {
                showToast(lang === 'zh-TW' ? '正在上傳大頭貼至 imgbb...' : 'Uploading avatar to imgbb...', 'info')
                const blob = dataURLtoBlob(newAvatar)
                const imgbbUrl = await uploadImageToImgBB(blob, 'avatar.jpg')
                finalAvatar = imgbbUrl
                showToast(lang === 'zh-TW' ? '大頭貼更新成功！' : 'Avatar updated successfully!', 'success')
              } catch (err) {
                console.error('Failed to upload avatar to ImgBB:', err)
                showToast(lang === 'zh-TW' ? '大頭貼上傳失敗，請稍後再試！' : 'Avatar upload failed, please try again later!', 'error')
                return
              }
            }

            const emailKey = currentUser?.email || 'guest'
            if (finalAvatar) {
              localStorage.setItem(`tw-avatar-${emailKey}`, finalAvatar)
            } else {
              localStorage.removeItem(`tw-avatar-${emailKey}`)
            }
            const updated = { ...currentUser, avatarUrl: finalAvatar || undefined }
            setCurrentUser(updated)
            localStorage.setItem('tw-user-info', JSON.stringify(updated))

            if (auth.currentUser) {
              try {
                await updateProfile(auth.currentUser, { photoURL: finalAvatar || null })
              } catch (err) {
                console.error('Failed to update Firebase photoURL:', err)
              }
            }

            if (currentUser?.email) {
              try {
                const docRef = doc(db, 'users_concerts', currentUser.email)
                await setDoc(docRef, { avatarUrl: finalAvatar || null }, { merge: true })
              } catch (err) {
                console.error('Failed to sync avatar to Firestore:', err)
              }
            }
          }}
          onUpdateSpotifyUrl={async (newSpotifyUrl) => {
            const updated = { ...currentUser, spotifyUrl: newSpotifyUrl || undefined }
            setCurrentUser(updated)
            localStorage.setItem('tw-user-info', JSON.stringify(updated))

            if (currentUser?.email) {
              try {
                const docRef = doc(db, 'users_concerts', currentUser.email)
                await setDoc(docRef, { spotifyUrl: newSpotifyUrl || null }, { merge: true })
              } catch (err) {
                console.error('Failed to sync spotifyUrl to Firestore:', err)
              }
            }
            showToast(lang === 'zh-TW' ? '已更新個人主題曲！' : 'Theme song updated!', 'success')
          }}
          onPlaySpotifyTrack={(url) => {
            setMusicBarUrl(url)
            setIsMusicBarVisible(true)
            showToast(lang === 'zh-TW' ? '已開啟全站播放器！' : 'Player opened!', 'success')
          }}
          onLogout={handleLogout}
          onBack={() => setView('map')}
          onOpenConcertDetail={openConcertDetail}
        />
      ) : (
        <LoginPage
          onLoginSuccess={(user) => {
            const localAvatar = localStorage.getItem(`tw-avatar-${user.email || 'guest'}`) || undefined
            const userWithAvatar = { ...user, avatarUrl: user.avatarUrl || localAvatar }
            setIsLoggedIn(true)
            setCurrentUser(userWithAvatar)
            localStorage.setItem('tw-logged-in', 'true')
            localStorage.setItem('tw-user-info', JSON.stringify(userWithAvatar))
            localStorage.setItem('tw-nickname', user.nickname)
            setNickname(user.nickname)
            setView('map')
            showToast(lang === 'zh-TW' ? `歡迎回來，${user.nickname}！` : `Welcome back, ${user.nickname}!`, 'success')
          }}
          onCancel={() => setView('map')}
        />
      )}

      {isAddModalOpen && (
        <Modal onClose={closeAddModal}>
          <h2>{t('addConcertTitle')}</h2>

          <div className="form-group">
            <label htmlFor="input-venue-select">{t('formVenue')}</label>
            <select
              id="input-venue-select"
              value={formVenueId}
              className="venue-select-input"
              onChange={(event) => {
                const val = event.target.value
                setFormVenueId(val)
                if (val !== 'custom') {
                  const matched = VENUES.find((v) => v.id === val)
                  if (matched) {
                    setFormVenueName(matched.name)
                    setFormVenueCity(matched.city)
                  }
                } else {
                  setFormVenueName('')
                  setFormVenueCity('台北')
                }
              }}
            >
              <option value="" disabled>{t('selectVenuePlaceholder')}</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.city})
                </option>
              ))}
              <option value="custom">{t('customVenueOpt')}</option>
            </select>
          </div>

          {formVenueId === 'custom' && (
            <div className="form-row custom-venue-row" style={{ display: 'flex', gap: '0.8rem', marginTop: '0.4rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label htmlFor="input-custom-venue">{t('customVenueLabel')}</label>
                <input
                  id="input-custom-venue"
                  type="text"
                  value={formVenueName}
                  placeholder={t('customVenuePlaceholder')}
                  onChange={(event) => setFormVenueName(event.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="input-custom-city">{t('customCityLabel')}</label>
                <select
                  id="input-custom-city"
                  value={formVenueCity}
                  onChange={(event) => setFormVenueCity(event.target.value)}
                >
                  {['台北', '新北', '桃園', '台中', '台南', '高雄', '宜蘭', '花蓮', '台東', '新竹', '苗栗', '彰化', '南投', '雲林', '嘉義', '屏東', '港澳', '國外'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="input-artist">{t('artistLabel')}</label>
            <input
              id="input-artist"
              type="text"
              value={form.artist}
              placeholder={t('artistPlaceholder')}
              onChange={(event) => updateForm('artist', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-concert-name">{t('concertNameLabel')}</label>
            <input
              id="input-concert-name"
              type="text"
              value={form.concertName}
              placeholder={t('concertNamePlaceholder')}
              onChange={(event) => updateForm('concertName', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-date">{t('dateLabel')}</label>
            <input
              id="input-date"
              type="date"
              value={form.date}
              onChange={(event) => updateForm('date', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="input-seat">{t('seatLabel')}</label>
            <input
              id="input-seat"
              type="text"
              value={form.seat}
              placeholder={t('seatPlaceholder')}
              onChange={(event) => updateForm('seat', event.target.value)}
            />
          </div>
          <div className="form-group">
            <div className="notes-label-row">
              <label htmlFor="input-notes">{t('notesLabel')}</label>
              <div className="notes-tabs">
                <button
                  type="button"
                  className={`notes-tab-btn${notesActiveTab === 'edit' ? ' active' : ''}`}
                  onClick={() => setNotesActiveTab('edit')}
                >
                  {lang === 'zh-TW' ? '編輯' : 'Edit'}
                </button>
                <button
                  type="button"
                  className={`notes-tab-btn${notesActiveTab === 'preview' ? ' active' : ''}`}
                  onClick={() => setNotesActiveTab('preview')}
                >
                  {lang === 'zh-TW' ? '預覽' : 'Preview'}
                </button>
              </div>
            </div>
            {notesActiveTab === 'edit' ? (
              <textarea
                id="input-notes"
                value={form.notes}
                placeholder={t('notesPlaceholder')}
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            ) : (
              <div
                className="notes-preview-box markdown-body"
                dangerouslySetInnerHTML={{ __html: notesPreviewHtml }}
              />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="input-spotify-query">{t('spotifySearchLabel')}</label>
            <div className="spotify-search-box">
              <div className="spotify-search-row">
                <input
                  id="input-spotify-query"
                  type="text"
                  value={spotifyQuery}
                  placeholder={t('spotifySearchPlaceholder')}
                  onChange={(event) => setSpotifyQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      searchSpotify()
                    }
                  }}
                />
                <button
                  className="sp-search-btn"
                  type="button"
                  disabled={isSpotifySearching}
                  onClick={() => searchSpotify()}
                >
                  {t('spotifySearchBtn')}
                </button>
              </div>
              <input
                id="input-spotify"
                type="hidden"
                value={form.spotifyUrl}
                onChange={(event) => updateForm('spotifyUrl', event.target.value)}
              />
              <div className="spotify-hint">
                {lang === 'zh-TW' ? '搜尋後選擇一個 Spotify 項目，之後點擊演唱會卡片即可載入播放器。' : 'Select a Spotify item to load into the player upon clicking a card.'}
              </div>
              {selectedSpotify && (
                <div className="spotify-selected-preview">
                  {selectedSpotify.img && (
                    <LazyImage
                      className={`sp-selected-img${selectedSpotify.type === 'artist' ? ' round' : ''}`}
                      src={selectedSpotify.img}
                      alt=""
                    />
                  )}
                  <div className="sp-selected-info">
                    <div className="sp-selected-name">{selectedSpotify.name}</div>
                    <div className="sp-selected-sub">
                      {lang === 'zh-TW' ? '已選擇' : 'Selected'} · {selectedSpotify.type === 'artist' ? t('spotifyTypeArtist') : selectedSpotify.type === 'album' ? t('spotifyTypeAlbum') : t('spotifyTypeTrack')}
                    </div>
                  </div>
                  <button className="sp-selected-clear" type="button" onClick={clearSpotifySelection}>
                    <CloseIcon />
                  </button>
                </div>
              )}
              {(spotifyStatus || spotifyResults.length > 0) && (
                <SpotifyResults
                  results={spotifyResults}
                  status={spotifyStatus}
                  activeTab={spotifyTab}
                  onChangeTab={setSpotifyTab}
                  onSelect={selectSpotifyItem}
                />
              )}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="input-media">{lang === 'zh-TW' ? '照片' : 'Photos'}</label>
            <div className="media-upload-area">
              <div className="upload-icon"><CameraIcon /></div>
              <div className="upload-text">{lang === 'zh-TW' ? '點擊或拖曳上傳' : 'Click or drag files to upload'}</div>
              <div className="upload-sub">
                {lang === 'zh-TW' 
                  ? '支援 jpg, png, gif，最多上傳 3 張' 
                  : 'Supports jpg, png, gif, up to 3 photos'}
              </div>
              <input
                id="input-media"
                type="file"
                multiple
                accept="image/*"
                onChange={handleMediaUpload}
              />
            </div>
            <MediaPreviewGrid media={pendingMedia} onRemove={removePendingMedia} />
          </div>

          <button
            className="modal-submit"
            type="button"
            onClick={saveConcert}
            disabled={isSaving || pendingMedia.some((m) => m.isUploading)}
            style={isSaving || pendingMedia.some((m) => m.isUploading) ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
          >
            {pendingMedia.some((m) => m.isUploading)
              ? (lang === 'zh-TW' ? '正在上傳照片...' : 'Uploading photos...')
              : isSaving
                ? (lang === 'zh-TW' ? '正在儲存...' : 'Saving...')
                : (lang === 'zh-TW' ? '儲存記錄' : 'Save Log')}
            {!isSaving && !pendingMedia.some((m) => m.isUploading) && <CheckIcon style={{ marginLeft: '4px', verticalAlign: 'middle' }} />}
          </button>
        </Modal>
      )}

      {detailConcert && (
        <Modal className="detail-modal" onClose={closeDetailModal}>
          <ConcertDetail
            concert={detailConcert}
            onOpenLightbox={(mediaIndex) => setLightbox({ concertId: detailConcert.id, mediaIndex })}
            onPublishToBoard={() => {
              setPublishingConcert(detailConcert)
              setIsPublishModalOpen(true)
              setDetailConcertId(null) // Close detail modal immediately
            }}
            onEditConcert={openEditModal}
            onDeleteConcert={(id) => {
              deleteConcert(id, { stopPropagation: () => {} } as any)
              setDetailConcertId(null) // Close detail modal after delete
            }}
            lang={lang}
          />
        </Modal>
      )}

      {selectedTicket && (
        <Modal className="ticket-detail-modal" onClose={() => setSelectedTicket(null)}>
          <TicketDetailModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            spotifyTokenFetcher={getSpotifyToken}
            onPlayMusicBar={(url) => {
              setMusicBarUrl(url)
              setIsMusicBarVisible(true)
            }}
            onLogAsPersonal={(ticket) => {
              setSelectedTicket(null)
              const extractedArtist = extractArtistFromTitle(ticket.name)
              const matchedVenue = VENUES.find(v => v.id === ticket.venue_id || (ticket.venue_name && v.name.includes(ticket.venue_name))) || null
              
              setForm({
                artist: extractedArtist,
                concertName: ticket.name,
                date: ticket.date || '',
                seat: '',
                notes: '',
                spotifyUrl: ''
              })
              
              if (matchedVenue) {
                setFormVenueId(matchedVenue.id)
                setFormVenueName(matchedVenue.name)
                setFormVenueCity(matchedVenue.city)
              } else {
                setFormVenueId('custom')
                setFormVenueName(ticket.venue_name || ticket.venue_raw || '')
                setFormVenueCity(ticket.city || '台北')
              }
              
              setPendingMedia([])
              setSpotifyQuery('')
              setSpotifyResults([])
              setSpotifyStatus('')
              setSelectedSpotify(null)
              setSpotifyTab('artist')
              setNotesActiveTab('edit')
              setIsAddModalOpen(true)
            }}
          />
        </Modal>
      )}

      {isSuspensionModalOpen && suspensionData && (
        <Modal className="suspension-modal" onClose={() => setIsSuspensionModalOpen(false)}>
          <div className="suspension-header">
            <WarningIcon className="suspension-icon" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="suspension-title">{t('suspensionTitle')}</h2>
              <div className="suspension-subtitle">
                {t('suspensionSource', { time: suspensionData.updateTime })}
              </div>
            </div>
          </div>

          <div className="suspension-body">
            {(() => {
              const warningItems = suspensionData.items.filter(
                (item) =>
                  item.status.includes('停止') ||
                  item.status.includes('停班') ||
                  item.status.includes('停課') ||
                  !item.status.includes('照常')
              )
              const normalItems = suspensionData.items.filter(
                (item) =>
                  !warningItems.includes(item)
              )

              return (
                <>
                  {warningItems.length > 0 && (
                    <div className="suspension-section warning-section">
                      <div className="section-title">
                        <WarningIcon size="1.2em" style={{ color: '#ff4d4f', marginRight: '6px', verticalAlign: 'middle' }} />
                        {t('suspensionStop')}
                      </div>
                      <div className="warning-list">
                        {warningItems.map((item, idx) => (
                          <div key={idx} className="suspension-card warning-card">
                            <div className="county-name">{lang === 'zh-TW' ? item.city : translateCityName(item.city.replace(/[市縣]/g, ''), lang)}</div>
                            <div className="county-status">{translateSuspensionStatus(item.status, lang)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {normalItems.length > 0 && (
                    <details className="suspension-section normal-section" open>
                      <summary className="section-title collapsible-title">
                        <CheckIcon size="1.2em" style={{ color: '#52c41a', marginRight: '6px', verticalAlign: 'middle' }} />
                        {t('suspensionNormal', { count: normalItems.length })}
                      </summary>
                      <div className="normal-list">
                        {normalItems.map((item, idx) => (
                          <div key={idx} className="suspension-card normal-card">
                            <span className="normal-county">{lang === 'zh-TW' ? item.city : translateCityName(item.city.replace(/[市縣]/g, ''), lang)}</span>
                            <span className="normal-status">{translateSuspensionStatus(item.status, lang)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )
            })()}
          </div>

          <div className="suspension-actions">
            <button
              className="suspension-btn dismiss-btn"
              type="button"
              onClick={handleDismissSuspensionToday}
            >
              {t('suspensionDismiss')}
              <VolumeXIcon size="1.1em" style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
            </button>
            <button
              className="suspension-btn close-btn"
              type="button"
              onClick={() => setIsSuspensionModalOpen(false)}
            >
              {t('suspensionClose')}
            </button>
          </div>
        </Modal>
      )}

      {isAllModalOpen && (
        <Modal className="all-modal" onClose={closeAllModal}>
          <h2 className="all-modal-title">所有演唱會記錄</h2>
          <div className="all-modal-kicker">ALL CONCERT LOGS</div>
          {sortedConcerts.length === 0 ? (
            <div className="empty-state">還沒有任何記錄，點擊地圖上的場館開始新增！</div>
          ) : (
            sortedConcerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={concert}
                showVenue
                onOpenDetail={openConcertDetail}
              />
            ))
          )}
        </Modal>
      )}

      {lightboxMedia && (
        <div className="lightbox active" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" type="button" onClick={() => setLightbox(null)}>
            ×
          </button>
          {lightboxMedia.type.startsWith('image') ? (
            <img src={lightboxMedia.dataUrl} alt={lightboxMedia.name} />
          ) : (
            <video src={lightboxMedia.dataUrl} controls autoPlay />
          )}
        </div>
      )}

      {isPublishModalOpen && publishingConcert && (
        <Modal className="publish-modal" onClose={() => {
          setIsPublishModalOpen(false)
          setDetailConcertId(publishingConcert.id) // Restore detail modal
          setPublishingConcert(null)
        }}>
          <h2><MegaphoneIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />分享觀後感至社群牆</h2>
          <p className="publish-prompt">
            您即將把關於 <strong>{publishingConcert.artist} - {publishingConcert.concertName || '未命名演唱會'}</strong> 的觀後心得發佈至公開分享牆！
          </p>
          <div className="form-group">
            <label htmlFor="input-nickname">請輸入您的暱稱 (將公開顯示)</label>
            <input
              id="input-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. 搖滾區小精靈 (留空則以「匿名樂迷」發佈)"
              maxLength={20}
              autoFocus
            />
          </div>
          <div className="publish-actions">
            <button
              className="publish-submit-btn"
              type="button"
              onClick={() => handlePublishToBoard(nickname)}
            >
              確認發佈 <RocketIcon style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
            </button>
            <button
              className="publish-cancel-btn"
              type="button"
              onClick={() => {
                setIsPublishModalOpen(false)
                setDetailConcertId(publishingConcert.id) // Restore detail modal
                setPublishingConcert(null)
              }}
            >
              取消
            </button>
          </div>
        </Modal>
      )}

      {isGuideModalOpen && (
        <GuideModal onClose={() => setIsGuideModalOpen(false)} />
      )}

      {isLanguageModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsLanguageModalOpen(false)}>
          <div className="modal publish-modal" style={{ maxWidth: '360px', padding: '1.8rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setIsLanguageModalOpen(false)}>
              <CloseIcon />
            </button>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--gold)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <GlobeIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
              {lang === 'zh-TW' ? '選擇顯示語言' : lang === 'en' ? 'Select Language' : lang === 'ja' ? '言語を選択' : '언어 선택'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {[
                { code: 'zh-TW', native: '繁體中文' },
                { code: 'en', native: 'English' },
                { code: 'ja', native: '日本語' },
                { code: 'ko', native: '한국어' }
              ].map((langItem) => {
                const isActive = lang === langItem.code
                return (
                  <button
                    key={langItem.code}
                    type="button"
                    onClick={() => {
                      setLang(langItem.code as any)
                      setIsLanguageModalOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1.2rem',
                      borderRadius: '12px',
                      background: isActive 
                        ? 'rgba(var(--accent-rgb), 0.15)' 
                        : 'var(--surface-hover)',
                      border: isActive 
                        ? '1px solid var(--accent)' 
                        : '1px solid var(--border)',
                      color: isActive ? 'var(--accent)' : 'var(--text)',
                      fontSize: '0.92rem',
                      fontWeight: isActive ? '700' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                    className={isActive ? 'lang-option active' : 'lang-option'}
                  >
                    <span>{langItem.native}</span>
                    {isActive && <CheckIcon size="1.1em" style={{ color: 'var(--gold)' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {updateInfo && (
        <div className="modal-overlay active" onClick={() => setUpdateInfo(null)}>
          <div className="modal publish-modal" style={{ maxWidth: '400px', padding: '2rem', borderRadius: '20px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setUpdateInfo(null)}>
              <CloseIcon />
            </button>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--gold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
              <RocketIcon style={{ verticalAlign: 'middle' }} /> {lang === 'zh-TW' ? '發現新版本！' : 'New Version Available!'}
            </h2>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
              {lang === 'zh-TW' ? `從 v${APP_VERSION} 升級至 v${updateInfo.version}` : `Upgrade from v${APP_VERSION} to v${updateInfo.version}`}
            </div>
            {updateInfo.notes && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                  {lang === 'zh-TW' ? '更新內容：' : 'Changelog:'}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {updateInfo.notes}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                className="login-submit-btn"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '24px', background: 'var(--gold)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  window.open(updateInfo.url, '_system');
                  setUpdateInfo(null);
                }}
              >
                {lang === 'zh-TW' ? '立即下載更新' : 'Download Now'}
              </button>
              <button
                type="button"
                className="cancel-publish-btn"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '24px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setUpdateInfo(null)}
              >
                {lang === 'zh-TW' ? '稍後再說' : 'Later'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Keep-Alive Spotify Player for both desktop and mobile */}
      {isMusicBarVisible && musicBarEmbedUrl && (
        <div className={`global-spotify-player ${view} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="spotify-player-header">
            <span className="sp-title">
              <MusicIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {t('spotifyPlayerTitle')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {musicBarUrl && (
                <a
                  href={musicBarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sp-open-link"
                  title="在 Spotify 開啟"
                >
                  ↗ Spotify
                </a>
              )}
              <button
                type="button"
                className="sp-reload-btn"
                onClick={handleReloadPlayer}
                title="重新載入播放器"
              >
                <RefreshIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
              </button>
              <button 
                className="sp-close-btn desktop-close-btn" 
                type="button" 
                onClick={() => setIsMusicBarVisible(false)}
                title="關閉播放器"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="spotify-player-body">
            <SafeIframe
              key={`${musicBarEmbedUrl}-${playerReloadKey}`}
              src={musicBarEmbedUrl}
              height={musicBarPlayerHeight}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Spotify player"
              scrolling="no"
            />
          </div>
          <button 
            className="sp-close-btn mobile-side-close-btn" 
            type="button" 
            onClick={() => setIsMusicBarVisible(false)}
            title="關閉播放器"
          >
            ✕
          </button>
        </div>
      )}

      {isMobile && (
        <button
          className="music-bar-toggle"
          type="button"
          onClick={() => setIsMusicBarVisible((visible) => !visible)}
        >
          <div className="spotify-icon" />
          <span>{isMusicBarVisible ? t('spotifyPlayerCollapse') : t('spotifyPlayerTitle')}</span>
        </button>
      )}

        <>
          <div
            className={`mobile-sidebar-overlay${isMobileSidebarOpen ? ' active' : ''}`}
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className={`mobile-sidebar-nav${isMobileSidebarOpen ? ' open' : ''}`}>
            <div className="sidebar-nav-header">
              <span className="sidebar-nav-title">{lang === 'zh-TW' ? '選單 MENU' : lang === 'ja' ? 'メニュー MENU' : lang === 'ko' ? '메뉴 MENU' : 'MENU'}</span>
              <button
                className="sidebar-nav-close"
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="關閉選單"
              >
                ✕
              </button>
            </div>
            <div className="sidebar-nav-items">
              <button
                className={`sidebar-nav-item${view === 'map' ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  setView('map')
                  setMobileTab('map')
                  setMobileDrawerState('collapsed')
                  setSelectedVenueId(null)
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><MapIcon /></span>
                <span className="label">{t('tabMap')}</span>
              </button>
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false)
                  openAddModal()
                }}
              >
                <span className="icon"><PlusIcon /></span>
                <span className="label">{lang === 'zh-TW' ? '新增活動紀錄' : lang === 'ja' ? '活動記録を追加' : lang === 'ko' ? '이벤트 기록 추가' : 'Add Event Log'}</span>
              </button>
              <button
                className={`sidebar-nav-item${view === 'calendar' ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  setView('calendar')
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><CalendarIcon /></span>
                <span className="label">{t('tabCalendar')}</span>
              </button>
              <button
                className={`sidebar-nav-item${view === 'board' ? ' active' : ''}`}
                type="button"
                onClick={() => {
                  setView('board')
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><MessageIcon /></span>
                <span className="label">{t('tabCommunity')}</span>
              </button>
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false)
                  setIsGuideModalOpen(true)
                }}
              >
                <span className="icon"><SparklesIcon /></span>
                <span className="label">{t('siteTour')}</span>
              </button>
              {isLoggedIn && currentUser ? (
                <button
                  className={`sidebar-nav-item${view === 'profile' ? ' active' : ''}`}
                  type="button"
                  onClick={() => {
                    setView('profile')
                    setIsMobileSidebarOpen(false)
                  }}
                >
                  <span className="icon"><UserIcon /></span>
                  <span className="label">{t('profile')} ({currentUser.nickname})</span>
                </button>
              ) : (
                <button
                  className={`sidebar-nav-item${view === 'login' ? ' active' : ''}`}
                  type="button"
                  onClick={() => {
                    setView('login')
                    setIsMobileSidebarOpen(false)
                  }}
                >
                  <span className="icon"><KeyIcon /></span>
                  <span className="label">{t('login')}</span>
                </button>
              )}
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  setIsLanguageModalOpen(true)
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><GlobeIcon size="1.1em" /></span>
                <span className="label">
                  {lang === 'zh-TW' ? '語言設定' : lang === 'en' ? 'Language Settings' : lang === 'ja' ? '言語設定' : '언어 설정'}
                </span>
              </button>
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  toggleTheme()
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
                <span className="label">{theme === 'dark' ? (lang === 'zh-TW' ? '切換為淺色模式' : lang === 'ja' ? 'ライトモードに切替' : lang === 'ko' ? '라이트 모드로 전환' : 'Switch to Light Mode') : (lang === 'zh-TW' ? '切換為深色模式' : lang === 'ja' ? 'ダークモードに切替' : lang === 'ko' ? '다크 모드로 전환' : 'Switch to Dark Mode')}</span>
              </button>
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  toggleColorPalette()
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><PaletteIcon style={{ color: colorPalette === 'sage' ? 'var(--accent)' : '#ff9100' }} /></span>
                <span className="label">{colorPalette === 'sage' ? (lang === 'zh-TW' ? '切換為黑橘配色' : 'Orange Theme') : (lang === 'zh-TW' ? '切換為綠色配色' : 'Green Theme')}</span>
              </button>
              <button
                className="sidebar-nav-item"
                type="button"
                onClick={() => {
                  setIsMusicBarVisible((visible) => !visible)
                  setIsMobileSidebarOpen(false)
                }}
              >
                <span className="icon"><MusicIcon /></span>
                <span className="label">{isMusicBarVisible ? (lang === 'zh-TW' ? '隱藏音樂播放器' : lang === 'ja' ? 'プレイヤーを非表示' : lang === 'ko' ? '플레이어 숨기기' : 'Hide Player') : (lang === 'zh-TW' ? '顯示音樂播放器' : lang === 'ja' ? 'プレイヤーを表示' : lang === 'ko' ? '플레이어 표시' : 'Show Player')}</span>
              </button>
              {isLoggedIn && currentUser && (
                <button
                  className="sidebar-nav-item"
                  type="button"
                  style={{ color: '#ff4d4d' }}
                  onClick={() => {
                    handleLogout()
                    setIsMobileSidebarOpen(false)
                  }}
                >
                  <span className="icon"><LogoutIcon /></span>
                  <span className="label">{t('logout')}</span>
                </button>
              )}
            </div>
          </div>
          
          <div
            className={`mobile-bottom-nav${isAnyModalOpen ? ' modal-open-hidden' : ''}`}
            ref={bottomNavRef}
            onPointerDown={handleNavPointerDown}
            onPointerMove={handleNavPointerMove}
            onPointerUp={handleNavPointerUp}
            onPointerCancel={handleNavPointerCancel}
            style={{ touchAction: 'none' }}
          >
            <button
              className={`bottom-nav-item${view === 'map' ? ' active' : ''}`}
              type="button"
              data-view="map"
              onClick={() => {
                if (view !== 'map') {
                  setView('map')
                  setMobileTab('map')
                  setMobileDrawerState('collapsed')
                } else {
                  if (mobileTab !== 'map') {
                    setMobileTab('map')
                    setSelectedVenueId(null)
                    setMobileDrawerState('collapsed')
                  } else if (selectedVenueId) {
                    setSelectedVenueId(null)
                    setMobileDrawerState('collapsed')
                  } else {
                    setMobileDrawerState((current) => (current === 'collapsed' ? 'half' : 'collapsed'))
                  }
                }
              }}
            >
              <span className="icon"><MapIcon /></span>
              <span className="label">{lang === 'zh-TW' ? '地圖' : lang === 'en' ? 'Map' : lang === 'ja' ? 'マップ' : '지도'}</span>
            </button>
            <button
              className={`bottom-nav-item${view === 'calendar' ? ' active' : ''}`}
              type="button"
              data-view="calendar"
              onClick={() => {
                setView('calendar')
              }}
            >
              <span className="icon"><CalendarIcon /></span>
              <span className="label">{t('tabCalendar')}</span>
            </button>
            <button
              className="bottom-nav-item bottom-nav-item-record"
              type="button"
              data-utility="true"
              onClick={() => openAddModal()}
              title={lang === 'zh-TW' ? '新增演唱會紀錄' : lang === 'ja' ? '活動記録を追加' : lang === 'ko' ? '이벤트記錄追加' : 'Add Event Log'}
            >
              <span className="icon"><PlusIcon /></span>
              <span className="label">{lang === 'zh-TW' ? '紀錄' : lang === 'ja' ? '記録' : lang === 'ko' ? '기록' : 'Log'}</span>
            </button>
            <button
              className={`bottom-nav-item${view === 'board' ? ' active' : ''}`}
              type="button"
              data-view="board"
              onClick={() => {
                setView('board')
              }}
            >
              <span className="icon"><MessageIcon /></span>
              <span className="label">{t('tabCommunity')}</span>
            </button>
            <button
              className={`bottom-nav-item${(view === 'profile' || view === 'login') ? ' active' : ''}`}
              type="button"
              data-view="profile"
              onClick={() => {
                if (isLoggedIn) {
                  setView('profile')
                } else {
                  setView('login')
                }
              }}
            >
              <span className="icon"><UserIcon /></span>
              <span className="label">{isLoggedIn ? (lang === 'zh-TW' ? '我的' : lang === 'ja' ? 'マイページ' : lang === 'ko' ? '마이페이지' : 'Profile') : t('login')}</span>
            </button>
            <button
              className="bottom-nav-item bottom-nav-item-record"
              type="button"
              data-utility="true"
              onClick={() => openAddModal()}
              title={lang === 'zh-TW' ? '新增演唱會紀錄' : lang === 'ja' ? '活動記録を追加' : lang === 'ko' ? '이벤트 기록 추가' : 'Add Event Log'}
            >
              <span className="icon"><PlusIcon /></span>
              <span className="label">{lang === 'zh-TW' ? '紀錄' : lang === 'ja' ? '記録' : lang === 'ko' ? '기록' : 'Log'}</span>
            </button>
            <button
              className="bottom-nav-item tablet-only-nav-item"
              type="button"
              data-utility="true"
              onClick={() => setIsLanguageModalOpen(true)}
            >
              <span className="icon"><GlobeIcon size="1.1em" /></span>
              <span className="label">{lang === 'zh-TW' ? '語言' : lang === 'ja' ? '言語' : lang === 'ko' ? '언어' : 'Lang'}</span>
            </button>
            <button
              className="bottom-nav-item tablet-only-nav-item"
              type="button"
              data-utility="true"
              onClick={toggleTheme}
            >
              <span className="icon">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
              <span className="label">{theme === 'dark' ? (lang === 'zh-TW' ? '淺色' : lang === 'ja' ? 'ライト' : lang === 'ko' ? '라이트' : 'Light') : (lang === 'zh-TW' ? '深色' : lang === 'ja' ? 'ダーク' : lang === 'ko' ? '다크' : 'Dark')}</span>
            </button>
            <button
              className="bottom-nav-item tablet-only-nav-item"
              type="button"
              data-utility="true"
              onClick={toggleColorPalette}
              title={colorPalette === 'sage' ? (lang === 'zh-TW' ? '切換為黑橘配色' : 'Switch to Orange Theme') : (lang === 'zh-TW' ? '切換為綠色配色' : 'Switch to Green Theme')}
            >
              <span className="icon"><PaletteIcon style={{ color: colorPalette === 'sage' ? 'var(--accent)' : '#ff9100' }} /></span>
              <span className="label">{colorPalette === 'sage' ? (lang === 'zh-TW' ? '黑橘' : 'Orange') : (lang === 'zh-TW' ? '綠色' : 'Green')}</span>
            </button>
            <button
              className="bottom-nav-item tablet-only-nav-item"
              type="button"
              data-utility="true"
              onClick={() => setIsGuideModalOpen(true)}
            >
              <span className="icon"><SparklesIcon /></span>
              <span className="label">{t('siteTour')}</span>
            </button>
            <div className="nav-indicator-glide" style={indicatorStyle} />
          </div>
        </>
      {toast && (
        <div className={`app-toast ${toast.type || 'info'}`}>
          {toast.type === 'success' && <CheckIcon size="1.15em" style={{ color: '#81c784', verticalAlign: 'middle', marginRight: '6px' }} />}
          {toast.type === 'error' && <WarningIcon size="1.15em" style={{ color: '#e57373', verticalAlign: 'middle', marginRight: '6px' }} />}
          {toast.type === 'info' && <SparklesIcon size="1.15em" style={{ color: 'var(--gold)', verticalAlign: 'middle', marginRight: '6px' }} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  )
}

const UpcomingConcerts = memo(function UpcomingConcerts({
  concerts,
  status,
  updatedAt,
  isRefreshing,
  onRefresh,
  searchQuery,
  hasSelectedVenue,
  onClearVenue,
  onSelectTicket,
  categoryFilter,
  onCategoryChange,
  categoryCounts,
  suspensionItems = [],
}: {
  concerts: RemoteConcert[]
  status: string
  updatedAt: string | null
  isRefreshing: boolean
  onRefresh: () => void
  searchQuery?: string
  hasSelectedVenue?: boolean
  onClearVenue?: () => void
  onSelectTicket: (ticket: RemoteConcert) => void
  categoryFilter: 'all' | 'concert' | 'sport'
  onCategoryChange: (category: 'all' | 'concert' | 'sport') => void
  categoryCounts: { all: number; sport: number; concert: number }
  suspensionItems?: SuspensionItem[]
}) {
  const { t, lang } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const displayedConcerts = useMemo(() => isExpanded ? concerts : concerts.slice(0, 8), [isExpanded, concerts])

  const todayStr = useMemo(() => {
    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const taipeiTime = new Date(utc + 3600000 * 8)
    const yyyy = taipeiTime.getFullYear()
    const mm = String(taipeiTime.getMonth() + 1).padStart(2, '0')
    const dd = String(taipeiTime.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const translateSource = (src: string): string => {
    if (lang === 'zh-TW') return src
    const srcMap: Record<string, Record<string, string>> = {
      '中華職棒': { en: 'CPBL', ja: '中華職棒 (台湾プロ野球)', ko: '대만 프로야구 (CPBL)' },
      '拓元售票': { en: 'tixCraft', ja: 'tixCraft', ko: '티스 크래프트 (tixCraft)' },
      '寬宏售票': { en: 'Kham Ticketing', ja: 'Kham售票', ko: '캄 티케팅 (Kham)' },
      '年代售票': { en: 'Era Ticket', ja: 'Era售票', ko: '에라 티켓 (Era)' },
      'ibon售票': { en: 'ibon Ticketing', ja: 'ibon售票', ko: '이본 티케팅 (ibon)' },
      'FamiTicket': { en: 'FamiTicket', ja: 'FamiTicket', ko: '패미티켓 (FamiTicket)' },
      'KKTIX': { en: 'KKTIX', ja: 'KKTIX', ko: 'KKTIX' },
      '遠大售票': { en: 'Ticket Plus', ja: 'Ticket Plus', ko: '티켓 플러스 (Ticket Plus)' },
      '主辦官網': { en: 'Official Site', ja: '主催者公式サイト', ko: '공식 웹사이트' },
    }
    return srcMap[src]?.[lang === 'ja' ? 'ja' : lang === 'ko' ? 'ko' : 'en'] || src
  }

  const translatePrice = (price: string): string => {
    if (!price) return ''
    if (price === '依官網/主辦公告為準') {
      return lang === 'zh-TW' 
        ? '依官網/主辦公告為準' 
        : lang === 'ja' 
          ? '公式サイトまたは主催者の発表に準ずる' 
          : lang === 'ko' 
            ? '공식 홈페이지/주최측 공지 기준' 
            : 'Subject to official website/organizer announcement'
    }
    return price
  }

  const getVenueMetaText = (c: RemoteConcert): string => {
    const rawVal = c.venue_raw || c.venue_name || c.city
    if (!rawVal) return lang === 'zh-TW' ? '地點待確認' : lang === 'en' ? 'Location TBA' : lang === 'ja' ? '開催地未定' : '장소 미정'
    return translateVenueName(rawVal, lang)
  }

  return (
    <section className="upcoming-section" aria-label="售票資訊">
      <div className="section-row">
        <div>
          <div className="section-title">— {t('upcomingTickets')} —</div>
          {updatedAt && <div className="remote-updated">{t('ticketUpdate', { time: formatRemoteDate(updatedAt) })}</div>}
        </div>
        <button className="refresh-events-btn" type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? (lang === 'zh-TW' ? '更新中' : 'Updating...') : (lang === 'zh-TW' ? '更新' : 'Refresh')}
        </button>
      </div>

      <div className="category-filter-bar">
        <button
          type="button"
          className={`filter-tab-btn${categoryFilter === 'all' ? ' active' : ''}`}
          onClick={() => onCategoryChange('all')}
        >
          <SparklesIcon style={{ marginRight: '4px' }} /> {t('all')} ({categoryCounts.all})
        </button>
        <button
          type="button"
          className={`filter-tab-btn${categoryFilter === 'concert' ? ' active' : ''}`}
          onClick={() => onCategoryChange('concert')}
        >
          <MusicIcon style={{ marginRight: '4px' }} /> {t('statConcerts')} ({categoryCounts.concert})
        </button>
        <button
          type="button"
          className={`filter-tab-btn${categoryFilter === 'sport' ? ' active' : ''}`}
          onClick={() => onCategoryChange('sport')}
        >
          <BaseballIcon style={{ marginRight: '4px' }} /> {lang === 'zh-TW' ? '中華職棒' : 'CPBL'} ({categoryCounts.sport})
        </button>
      </div>

      {searchQuery && searchQuery.trim() && (
        <div className="search-info-tip">
          <SearchIcon style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {lang === 'zh-TW' ? `搜尋「${searchQuery}」：共 ${concerts.length} 筆` : `Search "${searchQuery}": ${concerts.length} found`}
          {hasSelectedVenue && onClearVenue && (
            <button
              type="button"
              className="clear-filter-inline-btn"
              onClick={onClearVenue}
              style={{
                marginLeft: '0.4rem',
                border: 'none',
                background: 'transparent',
                color: 'var(--teal)',
                textDecoration: 'underline',
                fontSize: '0.72rem',
                cursor: 'pointer',
                padding: 0
              }}
            >
              {t('clearVenueFilter')}
            </button>
          )}
        </div>
      )}

      {status && <div className="empty-state compact">{status}</div>}
      {!status && concerts.length === 0 && (
        <div className="empty-state compact">
          {searchQuery ? (lang === 'zh-TW' ? `找不到符合「${searchQuery}」的售票資料` : `No tickets found matching "${searchQuery}"`) : t('noTicketsFound')}
        </div>
      )}
      {displayedConcerts.map((concert) => {
        const isToday = concert.date && concert.date.trim() === todayStr
        return (
        <div
          className="remote-card"
          style={{ cursor: 'pointer' }}
          key={concert.id}
          onClick={() => {
            logCustomEvent('click_ticket_card', {
              concert_id: concert.id,
              concert_name: concert.name,
              venue_name: concert.venue_name || concert.venue_raw,
              source: concert.source
            })
            onSelectTicket(concert)
          }}
        >
          <LazyImage
            src={concert.image}
            alt=""
            fallback={<div className="remote-card-fallback">LIVE</div>}
          />
          <div className="remote-card-body">
            <div className="remote-card-top">
              <span>{concert.source ? translateSource(concert.source) : t('statTickets')}</span>
              <span>{concert.date || (lang === 'zh-TW' ? '日期未定' : lang === 'en' ? 'TBA' : lang === 'ja' ? '日程未定' : '날짜 미정')}</span>
            </div>
            <div className="remote-card-name">{concert.name}</div>
            {isToday && getCitySuspensionStatus(concert.city, suspensionItems) ? (
              <div className="typhoon-warning-badge">
                <WarningIcon size="0.95em" style={{ marginRight: '3px', flexShrink: 0 }} />
                {lang === 'zh-TW' ? '因颱風停班停課，演出可能延期/取消' : 'Show may be postponed/cancelled due to typhoon.'}
              </div>
            ) : null}
            <div className="remote-card-meta">
              {getVenueMetaText(concert)}
              {concert.price ? ` · ${translatePrice(concert.price)}` : ''}
            </div>
            {concert.ticket_links?.length > 0 && (
              <div className="ticket-links">
                {concert.ticket_links.slice(0, 3).map((link) => (
                  <a
                    key={`${concert.id}-${link.platform}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ticket-link-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    {translateSource(link.name)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        )
      })}
      {concerts.length > 8 && (
        <button
          className="show-more-btn"
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t('hideAllTickets') : t('showAllTickets', { count: concerts.length - 8 })}
        </button>
      )}
    </section>
  )
})



function ConcertList({
  concerts,
  hasSelectedVenue,
  onOpenDetail,
  onDelete,
}: {
  concerts: Concert[]
  hasSelectedVenue: boolean
  onOpenDetail: (concertId: string) => void
  onDelete: (concertId: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const { t, lang } = useTranslation()
  if (!hasSelectedVenue) {
    return <div className="empty-state">{lang === 'zh-TW' ? '選擇場館後顯示演唱會記錄' : 'Select a venue to display concert records'}</div>
  }

  if (concerts.length === 0) {
    return <div className="empty-state">{lang === 'zh-TW' ? '這個場館還沒有記錄，快去新增吧！' : 'No records at this venue yet. Go ahead and add one!'}</div>
  }

  return (
    <>
      <div className="section-title">— {t('myRecords')} —</div>
      {concerts.map((concert) => (
        <ConcertCard
          key={concert.id}
          concert={concert}
          onOpenDetail={onOpenDetail}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

const ConcertCard = memo(function ConcertCard({
  concert,
  showVenue = false,
  onOpenDetail,
  onDelete,
}: {
  concert: Concert
  showVenue?: boolean
  onOpenDetail: (concertId: string) => void
  onDelete?: (concertId: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const { t, lang } = useTranslation()
  return (
    <div className="concert-card" onClick={() => onOpenDetail(concert.id)}>
      <div className="concert-card-header">
        <div className="concert-artist">{concert.artist}</div>
        <div className="concert-card-header-right">
          <div className="concert-date">{concert.date || (lang === 'zh-TW' ? '日期未知' : 'Date TBD')}</div>
          {onDelete && (
            <button
              className="concert-card-delete-btn"
              type="button"
              title={t('deleteBtn')}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(concert.id, event)
              }}
            >
              <TrashIcon size="0.95em" style={{ verticalAlign: 'middle' }} />
            </button>
          )}
        </div>
      </div>
      {showVenue && (
        <div className="concert-venue-tag">
          <PinIcon style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {concert.venueName} · {concert.venueCity}
        </div>
      )}
      {concert.concertName && <div className="concert-venue-tag">{concert.concertName}</div>}
      {concert.seat && <div className="concert-venue-tag seat-tag">{lang === 'zh-TW' ? `座位：${concert.seat}` : `Seat: ${concert.seat}`}</div>}
      <MediaStrip media={concert.media} />
    </div>
  )
})

function MediaStrip({ media }: { media: ConcertMedia[] }) {
  if (!media.length) return null

  const visibleMedia = media.slice(0, 3)
  const extra = media.length - visibleMedia.length

  return (
    <div className="concert-media-preview">
      {visibleMedia.map((item, index) =>
        item.type.startsWith('image') ? (
          <img className="media-thumb" key={`${item.name}-${index}`} src={item.dataUrl} alt="" loading="lazy" />
        ) : (
          <div className="media-thumb-video" key={`${item.name}-${index}`}>
            <PlayIcon />
          </div>
        ),
      )}
      {extra > 0 && <div className="more-media">+{extra}</div>}
    </div>
  )
}

function MediaPreviewGrid({
  media,
  onRemove,
}: {
  media: ConcertMedia[]
  onRemove: (index: number) => void
}) {
  if (!media.length) return null

  return (
    <div className="preview-grid">
      {media.map((item, index) => (
        <div className="preview-item" key={`${item.name}-${index}`}>
          {item.type.startsWith('image') ? (
            <img src={item.dataUrl} alt={item.name} style={item.isUploading ? { opacity: 0.5 } : undefined} />
          ) : (
            <>
              <video src={item.dataUrl} />
              <div className="video-preview-overlay"><PlayIcon /></div>
            </>
          )}
          {item.isUploading && (
            <div className="media-uploading-overlay">
              <div className="spinner"></div>
            </div>
          )}
          <button className="remove-media" type="button" onClick={() => onRemove(index)}>
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}



function SpotifyResults({
  results,
  status,
  activeTab,
  onChangeTab,
  onSelect,
}: {
  results: SpotifyItem[]
  status: string
  activeTab: SpotifyItem['type']
  onChangeTab: (tab: SpotifyItem['type']) => void
  onSelect: (item: SpotifyItem) => void
}) {
  const counts = {
    artist: results.filter((item) => item.type === 'artist').length,
    album: results.filter((item) => item.type === 'album').length,
    track: results.filter((item) => item.type === 'track').length,
  }
  const visibleResults = results.filter((item) => item.type === activeTab)

  return (
    <div className="spotify-results">
      {results.length > 0 && (
        <div className="sp-tabs">
          {(['artist', 'album', 'track'] as const).map((type) => (
            <button
              key={type}
              className={`sp-tab${activeTab === type ? ' active' : ''}`}
              type="button"
              onClick={() => onChangeTab(type)}
            >
              {SPOTIFY_TYPE_LABELS[type]} ({counts[type]})
            </button>
          ))}
        </div>
      )}

      {status && <div className="sp-search-status">{status}</div>}

      {results.length > 0 &&
        (visibleResults.length > 0 ? (
          visibleResults.map((item) => (
            <button
              className="sp-result-item"
              type="button"
              key={`${item.type}-${item.id}`}
              onClick={() => onSelect(item)}
            >
              <LazyImage
                className={`sp-result-img${item.type === 'artist' ? ' round' : ''}`}
                src={item.img}
                alt=""
                fallback={<div className={`sp-result-img${item.type === 'artist' ? ' round' : ''}`} />}
              />
              <div className="sp-result-info">
                <div className="sp-result-name">{item.name}</div>
                <div className="sp-result-sub">{item.sub}</div>
              </div>
              <span className={`sp-result-type sp-type-${item.type}`}>
                {SPOTIFY_TYPE_LABELS[item.type]}
              </span>
            </button>
          ))
        ) : (
          <div className="sp-search-status">此分類無結果</div>
        ))}
    </div>
  )
}



function Modal({
  children,
  className = '',
  onClose,
}: {
  children: ReactNode
  className?: string
  onClose: () => void
}) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragMoved = useRef(false)

  const handleTouchStart = (e: ReactTouchEvent) => {
    if (typeof window === 'undefined' || window.innerWidth > 768) return
    const touch = e.touches[0]
    dragStartY.current = touch.clientY
    setIsDragging(true)
    dragMoved.current = false
  }

  const handleTouchMove = (e: ReactTouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    const deltaY = touch.clientY - dragStartY.current

    if (deltaY > 0) {
      setDragOffset(deltaY)
      if (deltaY > 5) {
        dragMoved.current = true
      }
    } else {
      setDragOffset(0)
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    if (!dragMoved.current) {
      setDragOffset(0)
      return
    }

    if (dragOffset > 100) {
      onClose()
    } else {
      setDragOffset(0)
    }
  }

  const handleHandleClick = () => {
    if (dragMoved.current) return
    onClose()
  }

  const style = (dragOffset > 0 || isDragging) ? {
    transform: `translateY(${dragOffset}px)`,
    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
  } : {}

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div 
        className={`modal ${className}`} 
        onClick={(event) => event.stopPropagation()}
        style={style}
      >
        <div 
          className="modal-drag-handle-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClick={handleHandleClick}
        >
          <div className="modal-drag-handle" />
        </div>
        <button className="modal-close" type="button" onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

export async function getSpotifyToken(forceRefresh = false) {
  if (!forceRefresh && spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: 'grant_type=client_credentials',
    })
    if (!response.ok) {
      spotifyToken = null
      spotifyTokenExpiry = 0
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData?.error_description || errData?.error || `HTTP ${response.status}: Unable to get Spotify token`)
    }

    const data = await response.json()
    spotifyToken = data.access_token
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return spotifyToken
  } catch (err) {
    spotifyToken = null
    spotifyTokenExpiry = 0
    throw err
  }
}

export function normalizeSpotifyResults(data: any): SpotifyItem[] {
  const artists = data.artists?.items ?? []
  const albums = data.albums?.items ?? []
  const tracks = data.tracks?.items ?? []

  return [
    ...artists.map((artist: any) => ({
      type: 'artist' as const,
      id: artist.id,
      name: artist.name,
      sub: artist.genres?.slice(0, 2).join('、') || '音樂人',
      img: artist.images?.[1]?.url || artist.images?.[0]?.url,
      url: artist.external_urls?.spotify,
    })),
    ...albums.map((album: any) => ({
      type: 'album' as const,
      id: album.id,
      name: album.name,
      sub: `${album.artists?.map((artist: any) => artist.name).join('、') || '未知藝人'} · ${(
        album.release_date || ''
      ).slice(0, 4)}`,
      img: album.images?.[1]?.url || album.images?.[0]?.url,
      url: album.external_urls?.spotify,
    })),
    ...tracks.map((track: any) => ({
      type: 'track' as const,
      id: track.id,
      name: track.name,
      sub: `${track.artists?.map((artist: any) => artist.name).join('、') || '未知藝人'} · ${
        track.album?.name || ''
      }`,
      img: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url,
      url: track.external_urls?.spotify,
    })),
  ].filter((item) => item.url)
}

export function parseSpotifyEmbedUrl(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsedUrl = new URL(url)
    if (!parsedUrl.hostname.includes('spotify.com')) return null
    let cleanPath = parsedUrl.pathname.replace(/^\/intl-[a-zA-Z]{2}(-[a-zA-Z]{2})?/, '')
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath
    }
    return `https://open.spotify.com/embed${cleanPath}?utm_source=generator&theme=0&autoplay=1`
  } catch {
    return null
  }
}

function formatRemoteDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default App
