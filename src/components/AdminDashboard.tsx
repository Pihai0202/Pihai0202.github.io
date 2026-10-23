import { useState, useEffect, useMemo, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs
} from 'firebase/firestore'
import { db } from '../firebase'
import type {
  Venue,
  SharedNote,
  RemoteConcert,
  HistoricalEvent,
  EventOverride,
  SystemConfig,
  Concert,
  SuspensionItem
} from '../types'
import { TAIWAN_PATHS } from '../constants/taiwanPaths'
import { VENUES as STATIC_VENUES } from '../constants/venues'
import { ADMIN_EMAILS } from '../constants/adminConfig'
import {
  saveVenuesToLocalCache,
  seedDefaultVenuesToFirestore,
  fetchVenuesFromFirestore
} from '../utils/venueService'
import {
  getHistoricalEvents,
  invalidateHistoricalEventsCache
} from '../utils/historicalEventsService'
import {
  ArrowLeftIcon,
  ShieldIcon,
  SearchIcon,
  CloseIcon,
  TrashIcon,
  PinIcon,
  EditIcon,
  CheckIcon,
  PlusIcon,
  RefreshIcon,
  MessageIcon,
  MapIcon,
  ActivityIcon,
  UserIcon,
  MegaphoneIcon,
  BuildingIcon,
  TicketIcon,
  FlameIcon,
  HeartFilledIcon,
  EyeIcon,
  EyeOffIcon,
  TargetIcon,
  CalendarIcon,
  ArchiveIcon,
  SettingsIcon,
  WarningIcon,
  RocketIcon,
  SparklesIcon,
  LinkIcon,
  ClipboardIcon
} from './SvgIcon'
import './AdminDashboard.css'

interface AdminDashboardProps {
  currentUser: { nickname: string; email?: string; avatarUrl?: string } | null
  venues: Venue[]
  onVenuesChange: (newVenues: Venue[]) => void
  remoteConcerts: RemoteConcert[]
  remoteUpdatedAt: string | null
  onBack: () => void
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface TicketCommentDoc {
  id: string
  ticketId: string
  author: string
  content: string
  createdAt: string
  avatarColor?: string
}

interface ReplyDoc {
  id: string
  author: string
  content: string
  createdAt: string
  likes?: number
}

interface UserConcertLogDoc {
  email: string
  nickname?: string
  avatarUrl?: string
  updatedAt?: string
  concerts: Concert[]
}

// Coordinate projection helpers (synchronized with TaiwanMap.tsx)
const projectLonLatToSvg = (lon: number, lat: number) => {
  const x = Math.round(159.787256 * lon - 18882.141068)
  const y = Math.round(-172.627301 * lat + 4572.883143)
  return { x, y }
}

const unprojectSvgToLonLat = (x: number, y: number) => {
  const longitude = Number(((x + 18882.141068) / 159.787256).toFixed(6))
  const latitude = Number(((4572.883143 - y) / 172.627301).toFixed(6))
  return { longitude, latitude }
}

const SORTED_TAIWAN_PATHS = Object.entries(TAIWAN_PATHS).sort(([a], [b]) =>
  a === 'Taipei' ? 1 : b === 'Taipei' ? -1 : 0
)

const TAIWAN_CITY_OPTIONS = [
  '基隆', '台北', '新北', '桃園', '新竹', '苗栗',
  '台中', '彰化', '南投', '雲林', '嘉義', '台南',
  '高雄', '屏東', '宜蘭', '花蓮', '台東', '澎湖', '金門', '連江'
]

const EMPTY_VENUE_FORM: Venue = {
  id: '',
  name: '',
  city: '台北',
  capacity: '2,000',
  x: 540,
  y: 250,
  address: '',
  transit: '',
  latitude: 25.044,
  longitude: 121.5606
}

const EMPTY_HISTORICAL_FORM: HistoricalEvent = {
  id: '',
  name: '',
  artist: '',
  venue_id: 'taipei-arena',
  venue_name: '臺北小巨蛋',
  city: '台北',
  date: new Date().toISOString().slice(0, 10),
  category: 'music',
  source: '管理員補登',
  price: '',
  url: '',
  image: ''
}

export function AdminDashboard({
  currentUser,
  venues,
  onVenuesChange,
  remoteConcerts,
  remoteUpdatedAt,
  onBack,
  onShowToast
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'moderation' | 'venues' | 'events' | 'system'
  >('overview')

  // ---------------- 1. Firestore Real-time Data ----------------
  const [allReviews, setAllReviews] = useState<SharedNote[]>([])
  const [ticketComments, setTicketComments] = useState<TicketCommentDoc[]>([])
  const [userDocs, setUserDocs] = useState<UserConcertLogDoc[]>([])
  const [eventOverrides, setEventOverrides] = useState<Record<string, EventOverride>>({})
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    announcementEnabled: false,
    announcementText: '',
    announcementType: 'info',
    announcementLink: '',
    announcementLinkText: '',
    customSuspensions: []
  })

  // Listen to ALL reviews (including hidden ones for admin moderation)
  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SharedNote[] = []
        snap.forEach((docSnap) => {
          const d = docSnap.data()
          list.push({
            id: docSnap.id,
            artist: d.artist || '',
            concertName: d.concertName || '',
            venueName: d.venueName || '',
            venueCity: d.venueCity || '',
            date: d.date || '',
            author: d.author || '匿名樂迷',
            notes: d.notes || '',
            likes: d.likes || 0,
            createdAt: d.createdAt || '',
            hidden: d.hidden === true || d.status === 'hidden' || d.isHided === true || d.isHide === true,
            status: d.status || 'active',
            pinned: d.pinned === true
          })
        })
        setAllReviews(list)
      },
      (err) => console.error('[Admin] Failed to load reviews:', err)
    )
    return () => unsub()
  }, [])

  // Listen to ALL ticket_comments
  useEffect(() => {
    const q = query(collection(db, 'ticket_comments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TicketCommentDoc[] = []
        snap.forEach((docSnap) => {
          const d = docSnap.data()
          list.push({
            id: docSnap.id,
            ticketId: d.ticketId || '',
            author: d.author || '匿名',
            content: d.content || '',
            createdAt: d.createdAt || '',
            avatarColor: d.avatarColor
          })
        })
        setTicketComments(list)
      },
      (err) => console.error('[Admin] Failed to load ticket_comments:', err)
    )
    return () => unsub()
  }, [])

  // Listen to event_overrides (Phase 3)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'event_overrides'),
      (snap) => {
        const map: Record<string, EventOverride> = {}
        snap.forEach((d) => {
          const data = d.data() as EventOverride
          map[d.id] = { ...data, id: d.id }
        })
        setEventOverrides(map)
      },
      (err) => console.warn('[Admin] Failed to load event_overrides:', err)
    )
    return () => unsub()
  }, [])

  // Listen to system_config/global (Phase 4)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system_config', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data() as SystemConfig
          setSystemConfig({
            announcementEnabled: d.announcementEnabled === true,
            announcementTitle: d.announcementTitle || '全站重要公告',
            announcementText: d.announcementText || '',
            announcementType: d.announcementType || 'info',
            announcementSpeed: d.announcementSpeed || 'normal',
            announcementLink: d.announcementLink || '',
            announcementLinkText: d.announcementLinkText || '',
            customSuspensions: Array.isArray(d.customSuspensions) ? d.customSuspensions : [],
            updatedAt: d.updatedAt,
            updatedBy: d.updatedBy
          })
        }
      },
      (err) => console.warn('[Admin] Failed to load system_config:', err)
    )
    return () => unsub()
  }, [])

  // Listen to users_concerts (for Overview + Phase 4 User Inspector)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users_concerts'),
      (snap) => {
        const list: UserConcertLogDoc[] = []
        snap.forEach((docSnap) => {
          const d = docSnap.data()
          list.push({
            email: docSnap.id,
            nickname: d.nickname || docSnap.id.split('@')[0],
            avatarUrl: d.avatarUrl,
            updatedAt: d.updatedAt || '',
            concerts: Array.isArray(d.concerts) ? d.concerts : []
          })
        })
        list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        setUserDocs(list)
      },
      (err) => console.warn('[Admin] Failed to load users_concerts:', err)
    )
    return () => unsub()
  }, [])

  const userStats = useMemo(() => {
    let totalLoggedConcerts = 0
    const artistCounts: Record<string, number> = {}
    const venueCounts: Record<string, number> = {}

    userDocs.forEach((u) => {
      totalLoggedConcerts += u.concerts.length
      u.concerts.forEach((c) => {
        if (c?.artist) {
          const a = String(c.artist).trim()
          if (a) artistCounts[a] = (artistCounts[a] || 0) + 1
        }
        if (c?.venueName) {
          const v = String(c.venueName).trim()
          if (v) venueCounts[v] = (venueCounts[v] || 0) + 1
        }
      })
    })

    const topArtists = Object.entries(artistCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const topVenues = Object.entries(venueCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    return {
      totalUsers: userDocs.length,
      totalLoggedConcerts,
      topArtists,
      topVenues
    }
  }, [userDocs])

  // ---------------- 2. Community Moderation State & Actions ----------------
  const [modSubTab, setModSubTab] = useState<'reviews' | 'comments'>('reviews')
  const [modSearch, setModSearch] = useState('')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'visible' | 'hidden' | 'pinned'>('all')
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null)
  const [reviewReplies, setReviewReplies] = useState<Record<string, ReplyDoc[]>>({})
  const [editingReview, setEditingReview] = useState<SharedNote | null>(null)
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set())

  const ticketTitleMap = useMemo(() => {
    const map = new Map<string, string>()
    remoteConcerts.forEach((rc) => {
      map.set(rc.id, `${rc.name} (${rc.date})`)
    })
    return map
  }, [remoteConcerts])

  const filteredReviews = useMemo(() => {
    const q = modSearch.trim().toLowerCase()
    return allReviews.filter((r) => {
      if (reviewFilter === 'visible' && r.hidden) return false
      if (reviewFilter === 'hidden' && !r.hidden) return false
      if (reviewFilter === 'pinned' && !r.pinned) return false
      if (!q) return true
      return (
        r.artist.toLowerCase().includes(q) ||
        r.concertName.toLowerCase().includes(q) ||
        r.venueName.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      )
    })
  }, [allReviews, modSearch, reviewFilter])

  const filteredComments = useMemo(() => {
    const q = modSearch.trim().toLowerCase()
    if (!q) return ticketComments
    return ticketComments.filter((c) => {
      const eventTitle = (ticketTitleMap.get(c.ticketId) || '').toLowerCase()
      return (
        c.content.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.ticketId.toLowerCase().includes(q) ||
        eventTitle.includes(q)
      )
    })
  }, [ticketComments, modSearch, ticketTitleMap])

  const handleToggleHideReview = async (review: SharedNote) => {
    const nextHidden = !review.hidden
    try {
      await updateDoc(doc(db, 'reviews', review.id), {
        hidden: nextHidden,
        status: nextHidden ? 'hidden' : 'active'
      })
      onShowToast?.(
        nextHidden ? `已隱藏「${review.artist}」的心得貼文` : `已恢復公開「${review.artist}」的心得貼文`,
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle review visibility:', err)
      onShowToast?.('更新貼文狀態失敗，請確認管理員權限', 'error')
    }
  }

  const handleTogglePinReview = async (review: SharedNote) => {
    const nextPinned = !review.pinned
    try {
      await updateDoc(doc(db, 'reviews', review.id), {
        pinned: nextPinned
      })
      onShowToast?.(
        nextPinned ? `已將「${review.artist}」心得設為精選置頂！` : `已取消置頂「${review.artist}」心得`,
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle review pin:', err)
      onShowToast?.('置頂設定失敗', 'error')
    }
  }

  const handleDeleteReview = async (review: SharedNote) => {
    if (!window.confirm(`確定要永久刪除「${review.author}」分享的「${review.artist} - ${review.concertName}」心得嗎？此操作無法復原。`)) {
      return
    }
    try {
      await deleteDoc(doc(db, 'reviews', review.id))
      onShowToast?.('已永久刪除該篇心得貼文', 'success')
    } catch (err) {
      console.error('Failed to delete review:', err)
      onShowToast?.('刪除貼文失敗', 'error')
    }
  }

  const handleSaveEditedReview = async () => {
    if (!editingReview) return
    try {
      await updateDoc(doc(db, 'reviews', editingReview.id), {
        artist: editingReview.artist.trim(),
        concertName: editingReview.concertName.trim(),
        venueName: editingReview.venueName.trim(),
        venueCity: editingReview.venueCity.trim(),
        date: editingReview.date.trim(),
        author: editingReview.author.trim(),
        notes: editingReview.notes
      })
      setEditingReview(null)
      onShowToast?.('已儲存貼文修改！', 'success')
    } catch (err) {
      console.error('Failed to update review:', err)
      onShowToast?.('儲存貼文修改失敗', 'error')
    }
  }

  const handleToggleExpandReplies = async (reviewId: string) => {
    if (expandedReviewId === reviewId) {
      setExpandedReviewId(null)
      return
    }
    setExpandedReviewId(reviewId)
    try {
      const q = query(collection(db, 'reviews', reviewId, 'replies'), orderBy('createdAt', 'asc'))
      const snap = await getDocs(q)
      const list: ReplyDoc[] = []
      snap.forEach((d) => {
        const data = d.data()
        list.push({
          id: d.id,
          author: data.author || '匿名',
          content: data.content || '',
          createdAt: data.createdAt || '',
          likes: data.likes || 0
        })
      })
      setReviewReplies((prev) => ({ ...prev, [reviewId]: list }))
    } catch (err) {
      console.error('Failed to load replies:', err)
    }
  }

  const handleDeleteReply = async (reviewId: string, replyId: string) => {
    if (!window.confirm('確定要刪除這則子回覆嗎？')) return
    try {
      await deleteDoc(doc(db, 'reviews', reviewId, 'replies', replyId))
      setReviewReplies((prev) => ({
        ...prev,
        [reviewId]: (prev[reviewId] || []).filter((r) => r.id !== replyId)
      }))
      onShowToast?.('已刪除子回覆', 'success')
    } catch (err) {
      console.error('Failed to delete reply:', err)
      onShowToast?.('刪除子回覆失敗', 'error')
    }
  }

  const handleDeleteTicketComment = async (commentId: string) => {
    if (!window.confirm('確定要刪除這則售票討論留言嗎？')) return
    try {
      await deleteDoc(doc(db, 'ticket_comments', commentId))
      setSelectedCommentIds((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
      onShowToast?.('已刪除留言', 'success')
    } catch (err) {
      console.error('Failed to delete ticket comment:', err)
      onShowToast?.('刪除留言失敗', 'error')
    }
  }

  const handleBatchDeleteComments = async () => {
    if (selectedCommentIds.size === 0) return
    if (!window.confirm(`確定要批次刪除勾選的 ${selectedCommentIds.size} 則留言嗎？`)) return
    try {
      const ids = Array.from(selectedCommentIds)
      await Promise.all(ids.map((id) => deleteDoc(doc(db, 'ticket_comments', id))))
      setSelectedCommentIds(new Set())
      onShowToast?.(`已批次刪除 ${ids.length} 則留言`, 'success')
    } catch (err) {
      console.error('Batch delete failed:', err)
      onShowToast?.('批次刪除留言失敗', 'error')
    }
  }

  // ---------------- 3. Venue & Map Pin Manager State & Actions ----------------
  const [venueSearch, setVenueSearch] = useState('')
  const [venueCityFilter, setVenueCityFilter] = useState('all')
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(venues[0]?.id || null)
  const [isCreatingVenue, setIsCreatingVenue] = useState(false)
  const [venueForm, setVenueForm] = useState<Venue>(() => venues[0] || EMPTY_VENUE_FORM)
  const [isSavingVenue, setIsSavingVenue] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  // Map Picker Zoom & Pan State
  const [mapZoom, setMapZoom] = useState(1.25)
  const [mapCenter, setMapCenter] = useState({ x: 455, y: 480 })
  const [isMapDragging, setIsMapDragging] = useState(false)
  const mapDragStartRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null)
  const didMapDragRef = useRef(false)
  const mapSvgRef = useRef<SVGSVGElement | null>(null)

  const staticVenueIds = useMemo(() => new Set(STATIC_VENUES.map((v) => v.id)), [])

  const filteredVenues = useMemo(() => {
    const q = venueSearch.trim().toLowerCase()
    return venues.filter((v) => {
      if (venueCityFilter === 'custom' && staticVenueIds.has(v.id)) return false
      if (venueCityFilter !== 'all' && venueCityFilter !== 'custom' && v.city !== venueCityFilter) return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        (v.address || '').toLowerCase().includes(q)
      )
    })
  }, [venues, venueSearch, venueCityFilter, staticVenueIds])

  const handleSelectVenueRow = (v: Venue) => {
    setIsCreatingVenue(false)
    setSelectedVenueId(v.id)
    const proj =
      v.longitude && v.latitude ? projectLonLatToSvg(v.longitude, v.latitude) : { x: v.x || 455, y: v.y || 500 }
    setVenueForm({
      ...v,
      x: v.x || proj.x,
      y: v.y || proj.y
    })
    setMapCenter({ x: proj.x, y: proj.y })
    setMapZoom((z) => Math.max(z, 2.6))
  }

  const handleStartNewVenue = () => {
    setIsCreatingVenue(true)
    setSelectedVenueId(null)
    setVenueForm({
      ...EMPTY_VENUE_FORM,
      id: `venue-${Date.now().toString(36)}`
    })
  }

  const handleMapSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (didMapDragRef.current || !mapSvgRef.current) return
    const rect = mapSvgRef.current.getBoundingClientRect()
    const pctX = (e.clientX - rect.left) / rect.width
    const pctY = (e.clientY - rect.top) / rect.height
    const viewW = 800 / mapZoom
    const viewH = 800 / mapZoom
    const minX = mapCenter.x - viewW / 2
    const minY = mapCenter.y - viewH / 2
    const svgX = Math.round(minX + pctX * viewW)
    const svgY = Math.round(minY + pctY * viewH)
    const { longitude, latitude } = unprojectSvgToLonLat(svgX, svgY)

    setVenueForm((prev) => ({
      ...prev,
      x: svgX,
      y: svgY,
      longitude,
      latitude
    }))
  }

  const handleMapMouseDown = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    didMapDragRef.current = false
    mapDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      centerX: mapCenter.x,
      centerY: mapCenter.y
    }
    setIsMapDragging(true)
  }

  const handleMapMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!isMapDragging || !mapDragStartRef.current || !mapSvgRef.current) return
    const dx = e.clientX - mapDragStartRef.current.clientX
    const dy = e.clientY - mapDragStartRef.current.clientY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didMapDragRef.current = true
    }
    const rect = mapSvgRef.current.getBoundingClientRect()
    const viewW = 800 / mapZoom
    const viewH = 800 / mapZoom
    setMapCenter({
      x: mapDragStartRef.current.centerX - dx * (viewW / rect.width),
      y: mapDragStartRef.current.centerY - dy * (viewH / rect.height)
    })
  }

  const handleMapMouseUp = () => {
    setIsMapDragging(false)
    mapDragStartRef.current = null
  }

  const handleAutoGeocodeAddress = async () => {
    const queryStr = (venueForm.address || venueForm.name).trim()
    if (!queryStr) {
      onShowToast?.('請先輸入場館地址或場館名稱以查詢座標', 'info')
      return
    }
    setIsGeocoding(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tw&q=${encodeURIComponent(queryStr)}`
      const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW' } })
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const lat = Number(parseFloat(data[0].lat).toFixed(6))
        const lon = Number(parseFloat(data[0].lon).toFixed(6))
        const { x, y } = projectLonLatToSvg(lon, lat)
        setVenueForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          x,
          y
        }))
        setMapCenter({ x, y })
        setMapZoom(3.2)
        onShowToast?.(`已成功定位座標：(${lat}, ${lon})`, 'success')
      } else {
        onShowToast?.('找不到該地址的精確經緯度，建議直接點擊右側台灣地圖校準！', 'info')
      }
    } catch (err) {
      console.error('Geocode error:', err)
      onShowToast?.('地理編碼查詢失敗，請直接點擊地圖或手動輸入', 'error')
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSaveVenue = async () => {
    const cleanId = venueForm.id.trim().replace(/\s+/g, '-').toLowerCase()
    const cleanName = venueForm.name.trim()
    if (!cleanId || !cleanName) {
      onShowToast?.('請填寫場館 ID 與場館名稱！', 'error')
      return
    }

    setIsSavingVenue(true)
    try {
      const lon = typeof venueForm.longitude === 'number' && !isNaN(venueForm.longitude) ? venueForm.longitude : 121.5606
      const lat = typeof venueForm.latitude === 'number' && !isNaN(venueForm.latitude) ? venueForm.latitude : 25.044
      const proj = projectLonLatToSvg(lon, lat)

      const savedVenue: Venue = {
        id: cleanId,
        name: cleanName,
        city: venueForm.city.trim() || '台北',
        capacity: String(venueForm.capacity || '').trim() || '—',
        x: typeof venueForm.x === 'number' ? venueForm.x : proj.x,
        y: typeof venueForm.y === 'number' ? venueForm.y : proj.y,
        address: (venueForm.address || '').trim(),
        transit: (venueForm.transit || '').trim(),
        latitude: lat,
        longitude: lon
      }

      await setDoc(doc(db, 'venues', cleanId), savedVenue, { merge: true })

      const exists = venues.some((v) => v.id === cleanId)
      const updatedList = exists
        ? venues.map((v) => (v.id === cleanId ? savedVenue : v))
        : [...venues, savedVenue]

      onVenuesChange(updatedList)
      saveVenuesToLocalCache(updatedList)
      setIsCreatingVenue(false)
      setSelectedVenueId(cleanId)
      onShowToast?.(`已儲存場館「${cleanName}」並同步至雲端與地圖！`, 'success')
    } catch (err) {
      console.error('Failed to save venue:', err)
      onShowToast?.('儲存場館失敗，請檢查網路或權限', 'error')
    } finally {
      setIsSavingVenue(false)
    }
  }

  const handleDeleteVenue = async (venue: Venue) => {
    if (!window.confirm(`確定要從 Firestore 刪除場館「${venue.name} (${venue.id})」嗎？`)) return
    try {
      await deleteDoc(doc(db, 'venues', venue.id))
      const updatedList = venues.filter((v) => v.id !== venue.id)
      onVenuesChange(updatedList)
      saveVenuesToLocalCache(updatedList)
      if (updatedList.length > 0) {
        handleSelectVenueRow(updatedList[0])
      }
      onShowToast?.(`已刪除場館「${venue.name}」`, 'success')
    } catch (err) {
      console.error('Failed to delete venue:', err)
      onShowToast?.('刪除場館失敗', 'error')
    }
  }

  const handleReseedVenues = async () => {
    if (!window.confirm('確定要將系統預設的 38 座場館重新同步補齊至 Firestore 嗎？（現有自訂場館不會被刪除）')) return
    setIsSavingVenue(true)
    try {
      await seedDefaultVenuesToFirestore()
      const latest = await fetchVenuesFromFirestore()
      onVenuesChange(latest)
      onShowToast?.(`已成功同步 ${latest.length} 座場館！`, 'success')
    } catch (err) {
      console.error('Failed to re-seed venues:', err)
      onShowToast?.('同步預設場館失敗', 'error')
    } finally {
      setIsSavingVenue(false)
    }
  }

  // ---------------- 4. Phase 3: Events & Historical Manager ----------------
  const [eventsSubTab, setEventsSubTab] = useState<'upcoming' | 'historical'>('upcoming')
  const [eventSearch, setEventSearch] = useState('')
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'unmapped' | 'overridden' | 'hidden'>('all')
  const [editingOverride, setEditingOverride] = useState<EventOverride | null>(null)
  const [isSavingOverride, setIsSavingOverride] = useState(false)

  // Historical events state
  const [historicalList, setHistoricalList] = useState<HistoricalEvent[]>([])
  const [historicalSearch, setHistoricalSearch] = useState('')
  const [historicalForm, setHistoricalForm] = useState<HistoricalEvent>(EMPTY_HISTORICAL_FORM)
  const [isCreatingHistorical, setIsCreatingHistorical] = useState(true)
  const [isSavingHistorical, setIsSavingHistorical] = useState(false)

  useEffect(() => {
    if (activeTab === 'events' && eventsSubTab === 'historical' && historicalList.length === 0) {
      getHistoricalEvents().then((list) => setHistoricalList(list))
    }
  }, [activeTab, eventsSubTab, historicalList.length])

  // Merge remoteConcerts with any custom-created upcoming events in eventOverrides
  const mergedAdminUpcomingEvents = useMemo(() => {
    const baseIds = new Set(remoteConcerts.map((c) => c.id))
    const customEvents: RemoteConcert[] = Object.values(eventOverrides)
      .filter((ov) => ov.isCustomNew && !baseIds.has(ov.id))
      .map((ov) => ({
        id: ov.id,
        source: ov.source || '管理員補登',
        name: ov.name || '未命名活動',
        venue_raw: ov.venue_name || '',
        venue_id: ov.venue_id || null,
        venue_name: ov.venue_name || null,
        city: ov.city || '台北',
        date: ov.date || '',
        image: ov.image || '',
        url: ov.url || '',
        price: ov.price || '',
        artist: ov.artist || '',
        category: ov.category || 'music',
        ticket_links: ov.url ? [{ platform: 'official', name: ov.source || '官方連結', url: ov.url }] : []
      }))

    return [...customEvents, ...remoteConcerts].map((ev) => {
      const ov = eventOverrides[ev.id]
      if (!ov) return { ...ev, isOverridden: false, isHidden: false }
      return {
        ...ev,
        name: ov.name ?? ev.name,
        artist: ov.artist ?? ev.artist,
        venue_id: ov.venue_id !== undefined ? ov.venue_id : ev.venue_id,
        venue_name: ov.venue_name !== undefined ? ov.venue_name : ev.venue_name,
        city: ov.city ?? ev.city,
        date: ov.date ?? ev.date,
        image: ov.image ?? ev.image,
        url: ov.url ?? ev.url,
        price: ov.price ?? ev.price,
        isOverridden: true,
        isHidden: ov.hidden === true
      }
    })
  }, [remoteConcerts, eventOverrides])

  const unmappedEventCount = useMemo(
    () => mergedAdminUpcomingEvents.filter((e) => !e.venue_id && !e.isHidden).length,
    [mergedAdminUpcomingEvents]
  )

  const filteredAdminUpcoming = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    return mergedAdminUpcomingEvents.filter((ev) => {
      if (upcomingFilter === 'unmapped' && (ev.venue_id || ev.isHidden)) return false
      if (upcomingFilter === 'overridden' && !ev.isOverridden) return false
      if (upcomingFilter === 'hidden' && !ev.isHidden) return false
      if (!q) return true
      return (
        ev.name.toLowerCase().includes(q) ||
        (ev.artist || '').toLowerCase().includes(q) ||
        (ev.venue_name || '').toLowerCase().includes(q) ||
        (ev.venue_raw || '').toLowerCase().includes(q) ||
        (ev.city || '').toLowerCase().includes(q) ||
        ev.source.toLowerCase().includes(q)
      )
    })
  }, [mergedAdminUpcomingEvents, eventSearch, upcomingFilter])

  const filteredHistorical = useMemo(() => {
    const q = historicalSearch.trim().toLowerCase()
    const list = q
      ? historicalList.filter(
          (ev) =>
            ev.name.toLowerCase().includes(q) ||
            (ev.artist || '').toLowerCase().includes(q) ||
            (ev.venue_name || '').toLowerCase().includes(q) ||
            (ev.date || '').includes(q)
        )
      : historicalList
    return list.slice(0, 60)
  }, [historicalList, historicalSearch])

  const handleOpenOverrideModal = (ev: RemoteConcert & { isHidden?: boolean }) => {
    const existing = eventOverrides[ev.id]
    setEditingOverride({
      id: ev.id,
      name: existing?.name ?? ev.name,
      artist: existing?.artist ?? (ev.artist || ''),
      venue_id: existing?.venue_id !== undefined ? existing.venue_id : ev.venue_id,
      venue_name: existing?.venue_name !== undefined ? existing.venue_name : ev.venue_name,
      city: existing?.city ?? ev.city,
      date: existing?.date ?? ev.date,
      price: existing?.price ?? ev.price,
      url: existing?.url ?? ev.url,
      image: existing?.image ?? ev.image,
      source: existing?.source ?? ev.source,
      category: existing?.category ?? (ev.category || 'music'),
      hidden: existing?.hidden ?? false,
      isCustomNew: existing?.isCustomNew ?? false
    })
  }

  const handleStartNewUpcomingEvent = () => {
    const firstVenue = venues[0]
    setEditingOverride({
      id: `custom-ev-${Date.now().toString(36)}`,
      name: '',
      artist: '',
      venue_id: firstVenue?.id || 'taipei-dome',
      venue_name: firstVenue?.name || '臺北大巨蛋',
      city: firstVenue?.city || '台北',
      date: new Date().toISOString().slice(0, 10),
      price: '',
      url: '',
      image: '',
      source: '管理員補登',
      category: 'music',
      hidden: false,
      isCustomNew: true
    })
  }

  const handleSaveEventOverride = async () => {
    if (!editingOverride || !editingOverride.id || !editingOverride.name?.trim()) {
      onShowToast?.('請填寫活動名稱！', 'error')
      return
    }
    setIsSavingOverride(true)
    try {
      const matchedVenue = venues.find((v) => v.id === editingOverride.venue_id)
      const payload: EventOverride = {
        ...editingOverride,
        name: editingOverride.name.trim(),
        artist: (editingOverride.artist || '').trim(),
        venue_id: editingOverride.venue_id || null,
        venue_name: matchedVenue ? matchedVenue.name : editingOverride.venue_name || null,
        city: matchedVenue ? matchedVenue.city : editingOverride.city || '台北',
        updatedAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'event_overrides', payload.id), payload, { merge: true })
      setEditingOverride(null)
      onShowToast?.('已儲存活動覆寫設定，前台地圖與清單已即時更新！', 'success')
    } catch (err) {
      console.error('Failed to save event override:', err)
      onShowToast?.('儲存活動覆寫失敗', 'error')
    } finally {
      setIsSavingOverride(false)
    }
  }

  const handleQuickToggleHideEvent = async (ev: RemoteConcert & { isHidden?: boolean }) => {
    const nextHidden = !ev.isHidden
    try {
      await setDoc(
        doc(db, 'event_overrides', ev.id),
        {
          id: ev.id,
          name: ev.name,
          hidden: nextHidden,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      )
      onShowToast?.(
        nextHidden ? `已下架隱藏「${ev.name}」` : `已恢復顯示「${ev.name}」`,
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle event hide:', err)
      onShowToast?.('切換活動顯示狀態失敗', 'error')
    }
  }

  const handleResetEventOverride = async (eventId: string) => {
    if (!window.confirm('確定要清除此活動的手動覆寫設定並還原為爬蟲原始資料嗎？')) return
    try {
      await deleteDoc(doc(db, 'event_overrides', eventId))
      if (editingOverride?.id === eventId) setEditingOverride(null)
      onShowToast?.('已還原為爬蟲原始資料', 'success')
    } catch (err) {
      console.error('Failed to delete override:', err)
      onShowToast?.('還原失敗', 'error')
    }
  }

  const handleSaveHistoricalEvent = async () => {
    const cleanName = historicalForm.name.trim()
    if (!cleanName || !historicalForm.date.trim()) {
      onShowToast?.('請填寫歷史活動名稱與日期！', 'error')
      return
    }
    setIsSavingHistorical(true)
    try {
      const cleanId =
        historicalForm.id.trim() || `hist-${Date.now().toString(36)}`
      const matchedVenue = venues.find((v) => v.id === historicalForm.venue_id)
      const artistStr = (historicalForm.artist || '').trim()
      const keywords = Array.from(
        new Set(
          [
            artistStr.toLowerCase(),
            ...artistStr.toLowerCase().split(/[\s/&、,]+/)
          ].filter((k) => k.length >= 2)
        )
      )

      const docData = {
        id: cleanId,
        name: cleanName,
        artist: artistStr,
        artist_lower: artistStr.toLowerCase(),
        artist_keywords: keywords,
        venue_id: historicalForm.venue_id || null,
        venue_name: matchedVenue ? matchedVenue.name : historicalForm.venue_name || '',
        city: matchedVenue ? matchedVenue.city : historicalForm.city || '台北',
        date: historicalForm.date.trim(),
        category: historicalForm.category || 'music',
        source: historicalForm.source || '管理員補登',
        price: (historicalForm.price || '').trim(),
        url: (historicalForm.url || '').trim(),
        image: (historicalForm.image || '').trim(),
        isCustomAdmin: true,
        updatedAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'archived_events', cleanId), docData, { merge: true })
      invalidateHistoricalEventsCache()
      const latest = await getHistoricalEvents()
      setHistoricalList(latest)
      setIsCreatingHistorical(true)
      setHistoricalForm({
        ...EMPTY_HISTORICAL_FORM,
        id: `hist-${Date.now().toString(36)}`
      })
      onShowToast?.(`已儲存歷史活動「${cleanName}」並同步至歷史搜尋器！`, 'success')
    } catch (err) {
      console.error('Failed to save historical event:', err)
      onShowToast?.('儲存歷史活動失敗', 'error')
    } finally {
      setIsSavingHistorical(false)
    }
  }

  // ---------------- 5. Phase 4: System Config & User Inspector ----------------
  const [sysSubTab, setSysSubTab] = useState<'config' | 'users'>('config')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [newSuspensionCity, setNewSuspensionCity] = useState('台北')
  const [newSuspensionStatus, setNewSuspensionStatus] = useState('今日停止上班、停止上課（演出可能延期或取消）')
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('tw_admin_gh_token') || '')
  const [isTriggeringAction, setIsTriggeringAction] = useState(false)

  // User Inspector state
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return userDocs
    return userDocs.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.nickname || '').toLowerCase().includes(q) ||
        u.concerts.some(
          (c) =>
            (c.artist || '').toLowerCase().includes(q) ||
            (c.concertName || '').toLowerCase().includes(q) ||
            (c.venueName || '').toLowerCase().includes(q)
        )
    )
  }, [userDocs, userSearch])

  const selectedUserDoc = useMemo(
    () => userDocs.find((u) => u.email === selectedUserEmail) || userDocs[0] || null,
    [userDocs, selectedUserEmail]
  )

  const handleSaveSystemConfig = async () => {
    setIsSavingConfig(true)
    try {
      await setDoc(
        doc(db, 'system_config', 'global'),
        {
          ...systemConfig,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin'
        },
        { merge: true }
      )
      onShowToast?.('已儲存全站公告與系統設定，前台已即時生效！', 'success')
    } catch (err) {
      console.error('Failed to save system_config:', err)
      onShowToast?.('儲存系統設定失敗', 'error')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const handleAddCustomSuspension = () => {
    if (!newSuspensionStatus.trim()) return
    const existing = systemConfig.customSuspensions || []
    const filtered = existing.filter((item) => item.city !== newSuspensionCity)
    const updated: SuspensionItem[] = [
      ...filtered,
      { city: newSuspensionCity, status: newSuspensionStatus.trim() }
    ]
    setSystemConfig((prev) => ({ ...prev, customSuspensions: updated }))
  }

  const handleRemoveCustomSuspension = (city: string) => {
    setSystemConfig((prev) => ({
      ...prev,
      customSuspensions: (prev.customSuspensions || []).filter((item) => item.city !== city)
    }))
  }

  const handleTriggerGithubScraper = async () => {
    const token = ghToken.trim()
    if (!token) {
      window.open('https://github.com/Pihai0202/Pihai0202.github.io/actions/workflows/scrape.yml', '_blank')
      return
    }
    localStorage.setItem('tw_admin_gh_token', token)
    setIsTriggeringAction(true)
    try {
      const res = await fetch(
        'https://api.github.com/repos/Pihai0202/Pihai0202.github.io/actions/workflows/scrape.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({ ref: 'main' })
        }
      )
      if (res.status === 204 || res.ok) {
        onShowToast?.('已成功發送 GitHub Actions 爬蟲排程觸發指令！', 'success')
      } else {
        const errText = await res.text()
        onShowToast?.(`觸發失敗 (${res.status})：請確認 Token 具備 workflow 權限 (${errText.slice(0, 60)})`, 'error')
      }
    } catch (err) {
      console.error('GitHub dispatch error:', err)
      onShowToast?.('網路連線錯誤，無法呼叫 GitHub API', 'error')
    } finally {
      setIsTriggeringAction(false)
    }
  }

  const handleExportUserJson = (u: UserConcertLogDoc) => {
    const blob = new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `concert-backup-${u.email.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    onShowToast?.(`已匯出 ${u.email} 的備份 JSON 檔案`, 'success')
  }

  const handleDeleteUserSingleConcert = async (u: UserConcertLogDoc, concertId: string, title: string) => {
    if (!window.confirm(`確定要從會員「${u.email}」的雲端紀錄中移除「${title}」嗎？`)) return
    try {
      const nextConcerts = u.concerts.filter((c) => c.id !== concertId)
      await setDoc(
        doc(db, 'users_concerts', u.email),
        {
          email: u.email,
          concerts: nextConcerts,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      )
      onShowToast?.('已移除該筆打卡紀錄', 'success')
    } catch (err) {
      console.error('Failed to update user concerts:', err)
      onShowToast?.('移除紀錄失敗', 'error')
    }
  }

  // Computed summary metrics
  const visibleReviewCount = allReviews.filter((r) => !r.hidden).length
  const hiddenReviewCount = allReviews.filter((r) => r.hidden).length
  const pinnedReviewCount = allReviews.filter((r) => r.pinned).length
  const totalReviewLikes = allReviews.reduce((sum, r) => sum + (r.likes || 0), 0)
  const customVenueCount = venues.filter((v) => !staticVenueIds.has(v.id)).length
  const overrideCount = Object.keys(eventOverrides).length

  // Map viewBox calculation for Venue Picker
  const mapViewW = 800 / mapZoom
  const mapViewH = 800 / mapZoom
  const mapMinX = mapCenter.x - mapViewW / 2
  const mapMinY = mapCenter.y - mapViewH / 2
  const activePinPos =
    venueForm.longitude && venueForm.latitude
      ? projectLonLatToSvg(venueForm.longitude, venueForm.latitude)
      : { x: venueForm.x || 455, y: venueForm.y || 500 }

  return (
    <div className="admin-dashboard-container">
      {/* Top Bar */}
      <div className="admin-top-bar">
        <div className="admin-top-left">
          <button type="button" className="admin-back-btn" onClick={onBack}>
            <ArrowLeftIcon size="1em" />
            <span>返回前台地圖</span>
          </button>
          <div className="admin-title-block">
            <h2>
              <ShieldIcon size="1.15em" style={{ color: 'var(--gold)' }} />
              <span>後台管理控制中心 (Admin Dashboard)</span>
            </h2>
            <p>管理全台場館座標、審核社群內容、覆寫/補登活動檔期、會員足跡救援與全站公告設定</p>
          </div>
        </div>
        <div className="admin-identity-badge">
          <UserIcon size="0.95em" />
          <span>管理員：{currentUser?.email || currentUser?.nickname}</span>
        </div>
      </div>

      {/* Main Navigation Tabs (All 5 Modules) */}
      <div className="admin-main-tabs">
        <button
          type="button"
          className={`admin-tab-btn${activeTab === 'overview' ? ' active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <ActivityIcon size="1.05em" />
          <span>營運數據總覽</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn${activeTab === 'moderation' ? ' active' : ''}`}
          onClick={() => setActiveTab('moderation')}
        >
          <MegaphoneIcon size="1.05em" />
          <span>社群內容審核</span>
          <span className="admin-tab-count">{allReviews.length + ticketComments.length}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn${activeTab === 'venues' ? ' active' : ''}`}
          onClick={() => setActiveTab('venues')}
        >
          <MapIcon size="1.05em" />
          <span>場館與地圖座標</span>
          <span className="admin-tab-count">{venues.length}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn${activeTab === 'events' ? ' active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <CalendarIcon size="1.05em" />
          <span>活動覆寫與歷史檔期</span>
          {unmappedEventCount > 0 && (
            <span className="admin-tab-count" style={{ background: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' }}>
              待配對 {unmappedEventCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`admin-tab-btn${activeTab === 'system' ? ' active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <SettingsIcon size="1.05em" />
          <span>全站公告與會員查詢</span>
          <span className="admin-tab-count">{userDocs.length}</span>
        </button>
      </div>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <>
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <span>收錄展演場館總數</span>
                <BuildingIcon size="1.15em" />
              </div>
              <div className="admin-stat-value">{venues.length}</div>
              <div className="admin-stat-sub">
                預設 {STATIC_VENUES.length} 座 · 爬蟲/自訂新增 {customVenueCount} 座
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <span>社群心得貼文</span>
                <MegaphoneIcon size="1.15em" />
              </div>
              <div className="admin-stat-value">{allReviews.length}</div>
              <div className="admin-stat-sub">
                公開 {visibleReviewCount} · 已隱藏 {hiddenReviewCount} · 置頂 {pinnedReviewCount} · 共 {totalReviewLikes} 讚
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <span>售票活動討論留言</span>
                <MessageIcon size="1.15em" />
              </div>
              <div className="admin-stat-value">{ticketComments.length}</div>
              <div className="admin-stat-sub">即時同步自 Firestore ticket_comments</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <span>雲端樂迷與累計打卡</span>
                <UserIcon size="1.15em" />
              </div>
              <div className="admin-stat-value">{userStats.totalLoggedConcerts}</div>
              <div className="admin-stat-sub">
                來自 {userStats.totalUsers} 位雲端同步樂迷的現場足跡
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-header">
                <span>近期售票與職棒賽事</span>
                <TicketIcon size="1.15em" />
              </div>
              <div className="admin-stat-value">{mergedAdminUpcomingEvents.length}</div>
              <div className="admin-stat-sub">
                未配對場館 {unmappedEventCount} 筆 · 已手動覆寫 {overrideCount} 筆
              </div>
            </div>
          </div>

          <div className="admin-panel-grid">
            <div className="admin-panel">
              <div className="admin-panel-header">
                <h3>
                  <FlameIcon size="1.05em" style={{ color: 'var(--gold)' }} />
                  <span>樂迷最常打卡歌手 Top 6</span>
                </h3>
              </div>
              {userStats.topArtists.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>尚無統計資料</p>
              ) : (
                <div className="admin-rank-list">
                  {userStats.topArtists.map((item, idx) => (
                    <div key={item.name} className="admin-rank-row">
                      <div>
                        <span className="admin-rank-num">{idx + 1}</span>
                        <strong>{item.name}</strong>
                      </div>
                      <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{item.count} 場</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <h3>
                  <BuildingIcon size="1.05em" style={{ color: 'var(--gold)' }} />
                  <span>最熱門打卡場館 Top 6</span>
                </h3>
              </div>
              {userStats.topVenues.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>尚無統計資料</p>
              ) : (
                <div className="admin-rank-list">
                  {userStats.topVenues.map((item, idx) => (
                    <div key={item.name} className="admin-rank-row">
                      <div>
                        <span className="admin-rank-num">{idx + 1}</span>
                        <strong>{item.name}</strong>
                      </div>
                      <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{item.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <h3>
                  <ShieldIcon size="1em" style={{ color: 'var(--gold)' }} />
                  <span>授權管理員白名單與快捷操作</span>
                </h3>
              </div>
              <div className="admin-rank-list">
                {ADMIN_EMAILS.map((email, idx) => (
                  <div key={email} className="admin-rank-row">
                    <div>
                      <span className="admin-rank-num">{idx + 1}</span>
                      <span style={{ fontFamily: 'monospace' }}>{email}</span>
                    </div>
                    <span className="admin-badge visible">
                      <CheckIcon size="0.85em" /> 已啟用最高權限
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="admin-action-btn primary"
                  onClick={() => setActiveTab('moderation')}
                >
                  審核社群貼文與留言 →
                </button>
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setActiveTab('events')}
                >
                  配對活動場館與歷史檔期 →
                </button>
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setActiveTab('system')}
                >
                  發布全站公告與查詢會員 →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: COMMUNITY MODERATION ==================== */}
      {activeTab === 'moderation' && (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-filter-pills">
              <button
                type="button"
                className={`admin-pill-btn${modSubTab === 'reviews' ? ' active' : ''}`}
                onClick={() => setModSubTab('reviews')}
              >
                <MegaphoneIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                心得分享牆貼文 ({allReviews.length})
              </button>
              <button
                type="button"
                className={`admin-pill-btn${modSubTab === 'comments' ? ' active' : ''}`}
                onClick={() => setModSubTab('comments')}
              >
                <MessageIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                售票活動討論留言 ({ticketComments.length})
              </button>
            </div>

            {modSubTab === 'comments' && selectedCommentIds.size > 0 && (
              <button
                type="button"
                className="admin-action-btn danger"
                onClick={handleBatchDeleteComments}
              >
                <TrashIcon size="0.95em" />
                <span>批次刪除已勾選 ({selectedCommentIds.size})</span>
              </button>
            )}
          </div>

          <div className="admin-toolbar">
            <div className="admin-search-box">
              <SearchIcon size="1em" />
              <input
                type="text"
                placeholder={
                  modSubTab === 'reviews'
                    ? '搜尋歌手、演唱會、場館、作者或心得內容...'
                    : '搜尋留言內容、作者暱稱或活動名稱...'
                }
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
              />
              {modSearch && (
                <button
                  type="button"
                  onClick={() => setModSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  <CloseIcon size="0.9em" />
                </button>
              )}
            </div>

            {modSubTab === 'reviews' && (
              <div className="admin-filter-pills">
                <button
                  type="button"
                  className={`admin-pill-btn${reviewFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setReviewFilter('all')}
                >
                  全部 ({allReviews.length})
                </button>
                <button
                  type="button"
                  className={`admin-pill-btn${reviewFilter === 'visible' ? ' active' : ''}`}
                  onClick={() => setReviewFilter('visible')}
                >
                  公開中 ({visibleReviewCount})
                </button>
                <button
                  type="button"
                  className={`admin-pill-btn${reviewFilter === 'hidden' ? ' active' : ''}`}
                  onClick={() => setReviewFilter('hidden')}
                >
                  已隱藏 ({hiddenReviewCount})
                </button>
                <button
                  type="button"
                  className={`admin-pill-btn${reviewFilter === 'pinned' ? ' active' : ''}`}
                  onClick={() => setReviewFilter('pinned')}
                >
                  已置頂 ({pinnedReviewCount})
                </button>
              </div>
            )}
          </div>

          {modSubTab === 'reviews' ? (
            <div className="admin-mod-list">
              {filteredReviews.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem 0' }}>
                  找不到符合條件的心得貼文
                </p>
              ) : (
                filteredReviews.map((review) => {
                  const isExpanded = expandedReviewId === review.id
                  const replies = reviewReplies[review.id] || []
                  const isEditingThis = editingReview?.id === review.id

                  return (
                    <div
                      key={review.id}
                      className={`admin-mod-item${review.hidden ? ' is-hidden' : ''}${review.pinned ? ' is-pinned' : ''}`}
                    >
                      <div className="admin-mod-top">
                        <div className="admin-mod-meta">
                          {review.pinned && (
                            <span className="admin-badge pinned">
                              <PinIcon size="0.85em" /> 精選置頂
                            </span>
                          )}
                          <span className={`admin-badge ${review.hidden ? 'hidden' : 'visible'}`}>
                            {review.hidden ? '已隱藏' : '公開中'}
                          </span>
                          <span className="admin-badge artist">{review.artist}</span>
                          <strong>{review.concertName}</strong>
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                            · {review.venueName} ({review.venueCity}) · {review.date || '未填日期'}
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                            · 作者：<strong>{review.author}</strong> ·{' '}
                            <HeartFilledIcon size="0.88em" style={{ color: '#ef4444', verticalAlign: '-1px' }} />{' '}
                            {review.likes}
                          </span>
                        </div>

                        <div className="admin-mod-actions">
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => handleTogglePinReview(review)}
                          >
                            <PinIcon size="0.9em" />
                            <span>{review.pinned ? '取消置頂' : '設為置頂'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => handleToggleHideReview(review)}
                          >
                            {review.hidden ? <EyeIcon size="0.9em" /> : <EyeOffIcon size="0.9em" />}
                            <span>{review.hidden ? '恢復公開' : '隱藏貼文'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => setEditingReview(isEditingThis ? null : { ...review })}
                          >
                            <EditIcon size="0.9em" />
                            <span>{isEditingThis ? '取消編輯' : '編輯'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => handleToggleExpandReplies(review.id)}
                          >
                            <MessageIcon size="0.9em" />
                            <span>{isExpanded ? '收起回覆' : '管理子回覆'}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn danger"
                            onClick={() => handleDeleteReview(review)}
                          >
                            <TrashIcon size="0.9em" />
                            <span>刪除</span>
                          </button>
                        </div>
                      </div>

                      {isEditingThis && editingReview ? (
                        <div className="admin-venue-form-grid" style={{ marginTop: '0.75rem' }}>
                          <div className="admin-form-field">
                            <label>演出者 (Artist)</label>
                            <input
                              type="text"
                              value={editingReview.artist}
                              onChange={(e) => setEditingReview({ ...editingReview, artist: e.target.value })}
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>演唱會名稱</label>
                            <input
                              type="text"
                              value={editingReview.concertName}
                              onChange={(e) => setEditingReview({ ...editingReview, concertName: e.target.value })}
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>場館名稱</label>
                            <input
                              type="text"
                              value={editingReview.venueName}
                              onChange={(e) => setEditingReview({ ...editingReview, venueName: e.target.value })}
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>分享者暱稱</label>
                            <input
                              type="text"
                              value={editingReview.author}
                              onChange={(e) => setEditingReview({ ...editingReview, author: e.target.value })}
                            />
                          </div>
                          <div className="admin-form-field full">
                            <label>心得內容 (支援 Markdown)</label>
                            <textarea
                              rows={4}
                              value={editingReview.notes}
                              onChange={(e) => setEditingReview({ ...editingReview, notes: e.target.value })}
                            />
                          </div>
                          <div className="admin-form-field full" style={{ flexDirection: 'row', gap: '0.6rem' }}>
                            <button type="button" className="admin-action-btn primary" onClick={handleSaveEditedReview}>
                              <CheckIcon size="0.9em" /> 儲存修改
                            </button>
                            <button type="button" className="admin-action-btn" onClick={() => setEditingReview(null)}>
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-mod-content">{review.notes}</div>
                      )}

                      {isExpanded && (
                        <div className="admin-replies-drawer">
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                            子回覆列表 ({replies.length} 則)：
                          </div>
                          {replies.length === 0 ? (
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>此貼文目前沒有子回覆</div>
                          ) : (
                            replies.map((rep) => (
                              <div key={rep.id} className="admin-reply-row">
                                <div>
                                  <strong>{rep.author}</strong>：{rep.content}
                                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: '8px' }}>
                                    ({new Date(rep.createdAt).toLocaleString('zh-TW')})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="admin-action-btn danger"
                                  onClick={() => handleDeleteReply(review.id, rep.id)}
                                >
                                  <TrashIcon size="0.85em" /> 刪除回覆
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="admin-mod-list">
              {filteredComments.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem 0' }}>
                  目前沒有符合條件的售票活動留言
                </p>
              ) : (
                filteredComments.map((comment) => {
                  const eventTitle = ticketTitleMap.get(comment.ticketId) || `活動 ID: ${comment.ticketId}`
                  const isChecked = selectedCommentIds.has(comment.id)
                  return (
                    <div key={comment.id} className="admin-mod-item">
                      <div className="admin-mod-top">
                        <div className="admin-mod-meta">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedCommentIds)
                              if (e.target.checked) next.add(comment.id)
                              else next.delete(comment.id)
                              setSelectedCommentIds(next)
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <span className="admin-badge artist">{comment.author}</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 600 }}>
                            {eventTitle}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                            · {comment.createdAt ? new Date(comment.createdAt).toLocaleString('zh-TW') : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="admin-action-btn danger"
                          onClick={() => handleDeleteTicketComment(comment.id)}
                        >
                          <TrashIcon size="0.9em" /> 刪除留言
                        </button>
                      </div>
                      <div className="admin-mod-content">{comment.content}</div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: VENUE & MAP PIN MANAGER ==================== */}
      {activeTab === 'venues' && (
        <div className="admin-venue-workspace">
          {/* Left Column: Venue Table + Editor Form */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3>
                <BuildingIcon size="1.05em" />
                <span>全台場館資料庫 ({filteredVenues.length} / {venues.length})</span>
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="admin-action-btn primary" onClick={handleStartNewVenue}>
                  <PlusIcon size="0.95em" /> 新增場館
                </button>
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={handleReseedVenues}
                  disabled={isSavingVenue}
                  title="將預設 38 座場館補齊至 Firestore"
                >
                  <RefreshIcon size={15} style={{ width: '15px', height: '15px', flexShrink: 0 }} /> 同步預設場館
                </button>
              </div>
            </div>

            <div className="admin-toolbar">
              <div className="admin-search-box">
                <SearchIcon size="1em" />
                <input
                  type="text"
                  placeholder="搜尋場館名稱、ID、城市或地址..."
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                />
                {venueSearch && (
                  <button
                    type="button"
                    onClick={() => setVenueSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    <CloseIcon size="0.9em" />
                  </button>
                )}
              </div>

              <select
                value={venueCityFilter}
                onChange={(e) => setVenueCityFilter(e.target.value)}
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem'
                }}
              >
                <option value="all">所有城市 ({venues.length})</option>
                <option value="custom">爬蟲/自訂新增場館 ({customVenueCount})</option>
                {TAIWAN_CITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-venue-table-wrap">
              <table className="admin-venue-table">
                <thead>
                  <tr>
                    <th>城市</th>
                    <th>場館名稱</th>
                    <th>容納人數</th>
                    <th>SVG (x, y)</th>
                    <th>經緯度</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVenues.map((v) => {
                    const isSelected = !isCreatingVenue && selectedVenueId === v.id
                    const isCustom = !staticVenueIds.has(v.id)
                    return (
                      <tr
                        key={v.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => handleSelectVenueRow(v)}
                      >
                        <td>
                          <span className="admin-badge artist">{v.city}</span>
                        </td>
                        <td>
                          <strong>{v.name}</strong>
                          {isCustom && (
                            <span
                              className="admin-badge pinned"
                              style={{ marginLeft: '6px', fontSize: '0.68rem' }}
                            >
                              新場館
                            </span>
                          )}
                          <div style={{ fontSize: '0.73rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                            {v.id}
                          </div>
                        </td>
                        <td>{v.capacity || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          ({v.x}, {v.y})
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {v.latitude && v.longitude ? `${v.latitude.toFixed(3)}, ${v.longitude.toFixed(3)}` : '未設定'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Venue Editor Form */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold)' }}>
                  {isCreatingVenue ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <PlusIcon size="1em" /> 新增場館資料
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <EditIcon size="1em" /> 編輯場館：{venueForm.name}
                    </span>
                  )}
                </h4>
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={handleAutoGeocodeAddress}
                  disabled={isGeocoding}
                >
                  <PinIcon size="0.9em" />
                  <span>{isGeocoding ? '定位查詢中...' : '依地址自動查詢經緯度'}</span>
                </button>
              </div>

              <div className="admin-venue-form-grid">
                <div className="admin-form-field">
                  <label>場館代碼 ID (英文數字與連字號)</label>
                  <input
                    type="text"
                    value={venueForm.id}
                    disabled={!isCreatingVenue}
                    onChange={(e) => setVenueForm({ ...venueForm, id: e.target.value })}
                    placeholder="例如：kaohsiung-arena"
                  />
                </div>

                <div className="admin-form-field">
                  <label>場館名稱</label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                    placeholder="例如：臺北大巨蛋"
                  />
                </div>

                <div className="admin-form-field">
                  <label>所在城市</label>
                  <select
                    value={venueForm.city}
                    onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                  >
                    {TAIWAN_CITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-field">
                  <label>容納人數 (Capacity)</label>
                  <input
                    type="text"
                    value={venueForm.capacity}
                    onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })}
                    placeholder="例如：15,000"
                  />
                </div>

                <div className="admin-form-field">
                  <label>緯度 (Latitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={venueForm.latitude ?? ''}
                    onChange={(e) => {
                      const lat = parseFloat(e.target.value)
                      const lon = venueForm.longitude || 121.5606
                      const proj = !isNaN(lat) ? projectLonLatToSvg(lon, lat) : { x: venueForm.x, y: venueForm.y }
                      setVenueForm({
                        ...venueForm,
                        latitude: isNaN(lat) ? undefined : lat,
                        x: proj.x,
                        y: proj.y
                      })
                    }}
                  />
                </div>

                <div className="admin-form-field">
                  <label>經度 (Longitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={venueForm.longitude ?? ''}
                    onChange={(e) => {
                      const lon = parseFloat(e.target.value)
                      const lat = venueForm.latitude || 25.044
                      const proj = !isNaN(lon) ? projectLonLatToSvg(lon, lat) : { x: venueForm.x, y: venueForm.y }
                      setVenueForm({
                        ...venueForm,
                        longitude: isNaN(lon) ? undefined : lon,
                        x: proj.x,
                        y: proj.y
                      })
                    }}
                  />
                </div>

                <div className="admin-form-field">
                  <label>地圖 SVG X 座標 (點擊右側地圖自動帶入)</label>
                  <input
                    type="number"
                    value={venueForm.x}
                    onChange={(e) => {
                      const x = parseInt(e.target.value, 10) || 0
                      const { longitude, latitude } = unprojectSvgToLonLat(x, venueForm.y)
                      setVenueForm({ ...venueForm, x, longitude, latitude })
                    }}
                  />
                </div>

                <div className="admin-form-field">
                  <label>地圖 SVG Y 座標 (點擊右側地圖自動帶入)</label>
                  <input
                    type="number"
                    value={venueForm.y}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10) || 0
                      const { longitude, latitude } = unprojectSvgToLonLat(venueForm.x, y)
                      setVenueForm({ ...venueForm, y, longitude, latitude })
                    }}
                  />
                </div>

                <div className="admin-form-field full">
                  <label>詳細地址</label>
                  <input
                    type="text"
                    value={venueForm.address || ''}
                    onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                    placeholder="例如：台北市信義區忠孝東路四段515號"
                  />
                </div>

                <div className="admin-form-field full">
                  <label>大眾運輸建議指南</label>
                  <textarea
                    rows={2}
                    value={venueForm.transit || ''}
                    onChange={(e) => setVenueForm({ ...venueForm, transit: e.target.value })}
                    placeholder="例如：捷運板南線「國父紀念館站」5 號出口直達"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="admin-action-btn primary"
                  onClick={handleSaveVenue}
                  disabled={isSavingVenue}
                >
                  <CheckIcon size="0.95em" />
                  <span>{isSavingVenue ? '儲存中...' : '儲存場館至雲端 (Firestore)'}</span>
                </button>

                {!isCreatingVenue && selectedVenueId && (
                  <button
                    type="button"
                    className="admin-action-btn danger"
                    onClick={() => handleDeleteVenue(venueForm)}
                  >
                    <TrashIcon size="0.95em" />
                    <span>刪除此場館</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Taiwan SVG Map Coordinate Picker */}
          <div className="admin-map-picker-card">
            <div className="admin-panel-header" style={{ marginBottom: '0.75rem' }}>
              <h3>
                <PinIcon size="1em" style={{ color: 'var(--gold)' }} />
                <span>視覺化台灣地圖座標校準器</span>
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                點擊地圖任意位置即可設定圖釘座標
              </span>
            </div>

            <div className="admin-map-svg-box">
              <svg
                ref={mapSvgRef}
                viewBox={`${mapMinX} ${mapMinY} ${mapViewW} ${mapViewH}`}
                xmlns="http://www.w3.org/2000/svg"
                onClick={handleMapSvgClick}
                onMouseDown={handleMapMouseDown}
                onMouseMove={handleMapMouseMove}
                onMouseUp={handleMapMouseUp}
                onMouseLeave={handleMapMouseUp}
              >
                {SORTED_TAIWAN_PATHS.map(([countyName, pathD]) => (
                  <path
                    key={countyName}
                    d={pathD}
                    fill="var(--map-land, #3C3D37)"
                    stroke="var(--map-land-stroke, #51544a)"
                    strokeWidth={1.2 / Math.sqrt(mapZoom)}
                  />
                ))}

                {venues.map((v) => {
                  const pos =
                    v.longitude && v.latitude
                      ? projectLonLatToSvg(v.longitude, v.latitude)
                      : { x: v.x || 455, y: v.y || 500 }
                  const isCurrent = v.id === venueForm.id
                  if (isCurrent) return null
                  return (
                    <circle
                      key={v.id}
                      cx={pos.x}
                      cy={pos.y}
                      r={Math.max(2.2, 4.5 / mapZoom)}
                      fill="var(--muted)"
                      opacity={0.55}
                    >
                      <title>{v.name}</title>
                    </circle>
                  )
                })}

                <g transform={`translate(${activePinPos.x}, ${activePinPos.y})`}>
                  <circle
                    r={Math.max(7, 16 / mapZoom)}
                    fill="rgba(245, 158, 11, 0.25)"
                    stroke="#f59e0b"
                    strokeWidth={Math.max(1.2, 2.2 / mapZoom)}
                  />
                  <circle
                    r={Math.max(3, 6 / mapZoom)}
                    fill="#f59e0b"
                    stroke="#fff"
                    strokeWidth={Math.max(0.8, 1.5 / mapZoom)}
                  />
                  <text
                    y={-Math.max(10, 20 / mapZoom)}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize={Math.max(8, 13 / mapZoom)}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {venueForm.name || '新場館定位點'}
                  </text>
                </g>
              </svg>

              <div className="admin-map-controls">
                <button
                  type="button"
                  className="admin-map-ctrl-btn"
                  onClick={() => setMapZoom((z) => Math.min(8, z * 1.35))}
                  title="放大地圖"
                >
                  +
                </button>
                <button
                  type="button"
                  className="admin-map-ctrl-btn"
                  onClick={() => setMapZoom((z) => Math.max(0.8, z / 1.35))}
                  title="縮小地圖"
                >
                  -
                </button>
                <button
                  type="button"
                  className="admin-map-ctrl-btn"
                  onClick={() => {
                    setMapZoom(1.25)
                    setMapCenter({ x: 455, y: 480 })
                  }}
                  title="重設全島視角"
                >
                  <RefreshIcon size={15} style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                </button>
              </div>

              <div className="admin-map-coord-readout">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <TargetIcon
                    size={15}
                    style={{
                      width: '15px',
                      height: '15px',
                      color: 'var(--gold)',
                      verticalAlign: '-2px',
                      marginRight: '5px',
                      flexShrink: 0
                    }}
                  />
                  <strong>{venueForm.name || '未命名場館'}</strong>
                </span>
                <span style={{ fontFamily: 'monospace' }}>
                  SVG: ({activePinPos.x}, {activePinPos.y}) · GPS: ({venueForm.latitude?.toFixed(4) ?? '—'},{' '}
                  {venueForm.longitude?.toFixed(4) ?? '—'})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: EVENTS & OVERRIDE MANAGER (PHASE 3) ==================== */}
      {activeTab === 'events' && (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-filter-pills">
              <button
                type="button"
                className={`admin-pill-btn${eventsSubTab === 'upcoming' ? ' active' : ''}`}
                onClick={() => setEventsSubTab('upcoming')}
              >
                <TicketIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                近期售票與賽事覆寫 ({mergedAdminUpcomingEvents.length})
              </button>
              <button
                type="button"
                className={`admin-pill-btn${eventsSubTab === 'historical' ? ' active' : ''}`}
                onClick={() => setEventsSubTab('historical')}
              >
                <ArchiveIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                歷史活動資料庫補登 ({historicalList.length})
              </button>
            </div>

            {eventsSubTab === 'upcoming' && (
              <button type="button" className="admin-action-btn primary" onClick={handleStartNewUpcomingEvent}>
                <PlusIcon size="0.95em" /> 手動補登近期活動
              </button>
            )}
          </div>

          {eventsSubTab === 'upcoming' ? (
            <>
              <div className="admin-toolbar">
                <div className="admin-search-box">
                  <SearchIcon size="1em" />
                  <input
                    type="text"
                    placeholder="搜尋活動名稱、歌手、原始場館字串或售票平台..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                  />
                  {eventSearch && (
                    <button
                      type="button"
                      onClick={() => setEventSearch('')}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      <CloseIcon size="0.9em" />
                    </button>
                  )}
                </div>

                <div className="admin-filter-pills">
                  <button
                    type="button"
                    className={`admin-pill-btn${upcomingFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setUpcomingFilter('all')}
                  >
                    全部 ({mergedAdminUpcomingEvents.length})
                  </button>
                  <button
                    type="button"
                    className={`admin-pill-btn${upcomingFilter === 'unmapped' ? ' active' : ''}`}
                    onClick={() => setUpcomingFilter('unmapped')}
                  >
                    未配對場館 ({unmappedEventCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-pill-btn${upcomingFilter === 'overridden' ? ' active' : ''}`}
                    onClick={() => setUpcomingFilter('overridden')}
                  >
                    已手動覆寫 ({overrideCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-pill-btn${upcomingFilter === 'hidden' ? ' active' : ''}`}
                    onClick={() => setUpcomingFilter('hidden')}
                  >
                    已下架隱藏 ({mergedAdminUpcomingEvents.filter((e) => e.isHidden).length})
                  </button>
                </div>
              </div>

              {editingOverride && (
                <div
                  className="admin-mod-item is-pinned"
                  style={{ marginBottom: '1.25rem', background: 'rgba(var(--surface-rgb), 0.95)' }}
                >
                  <div className="admin-panel-header" style={{ marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <EditIcon size="1em" />
                      <span>
                        {editingOverride.isCustomNew ? '手動補登近期售票活動' : `覆寫活動設定：${editingOverride.name}`}
                      </span>
                    </h4>
                    <button type="button" className="admin-action-btn" onClick={() => setEditingOverride(null)}>
                      <CloseIcon size="0.9em" /> 關閉編輯器
                    </button>
                  </div>

                  <div className="admin-venue-form-grid">
                    <div className="admin-form-field full">
                      <label>活動名稱 (Name)</label>
                      <input
                        type="text"
                        value={editingOverride.name || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, name: e.target.value })}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>演出者 / 歌手 (Artist)</label>
                      <input
                        type="text"
                        value={editingOverride.artist || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, artist: e.target.value })}
                        placeholder="例如：五月天 Mayday"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>指定對應地圖場館 (解決未配對場館問題)</label>
                      <select
                        value={editingOverride.venue_id || ''}
                        onChange={(e) => {
                          const vid = e.target.value || null
                          const matched = venues.find((v) => v.id === vid)
                          setEditingOverride({
                            ...editingOverride,
                            venue_id: vid,
                            venue_name: matched ? matched.name : editingOverride.venue_name,
                            city: matched ? matched.city : editingOverride.city
                          })
                        }}
                      >
                        <option value="">-- 未配對場館 --</option>
                        {venues.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.city} · {v.name} ({v.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>演出日期 (YYYY-MM-DD)</label>
                      <input
                        type="text"
                        value={editingOverride.date || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, date: e.target.value })}
                        placeholder="2026-11-15"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>票價資訊 (Price)</label>
                      <input
                        type="text"
                        value={editingOverride.price || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, price: e.target.value })}
                        placeholder="例如：NT$ 4,880 / 3,880 / 2,880"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>售票連結 (URL)</label>
                      <input
                        type="text"
                        value={editingOverride.url || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, url: e.target.value })}
                        placeholder="https://tixcraft.com/activity/detail/..."
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>海報圖片網址 (Image URL)</label>
                      <input
                        type="text"
                        value={editingOverride.image || ''}
                        onChange={(e) => setEditingOverride({ ...editingOverride, image: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="admin-action-btn primary"
                      onClick={handleSaveEventOverride}
                      disabled={isSavingOverride}
                    >
                      <CheckIcon size="0.95em" />
                      <span>{isSavingOverride ? '儲存中...' : '儲存活動覆寫設定'}</span>
                    </button>
                    {eventOverrides[editingOverride.id] && (
                      <button
                        type="button"
                        className="admin-action-btn danger"
                        onClick={() => handleResetEventOverride(editingOverride.id)}
                      >
                        <TrashIcon size="0.9em" /> 清除覆寫並還原
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="admin-mod-list">
                {filteredAdminUpcoming.slice(0, 80).map((ev) => (
                  <div
                    key={ev.id}
                    className={`admin-mod-item${ev.isHidden ? ' is-hidden' : ''}${ev.isOverridden ? ' is-pinned' : ''}`}
                  >
                    <div className="admin-mod-top">
                      <div className="admin-mod-meta">
                        <span className="admin-badge artist">{ev.source}</span>
                        {ev.isOverridden && <span className="admin-badge pinned">已覆寫</span>}
                        {ev.isHidden && <span className="admin-badge hidden">已隱藏</span>}
                        {!ev.venue_id ? (
                          <span className="admin-badge hidden">
                            <WarningIcon size="0.85em" /> 未配對場館 ({ev.venue_raw || '無地點'})
                          </span>
                        ) : (
                          <span className="admin-badge visible">
                            <PinIcon size="0.85em" /> {ev.city} · {ev.venue_name}
                          </span>
                        )}
                        <strong>{ev.name}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {ev.date}
                        </span>
                      </div>

                      <div className="admin-mod-actions">
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => handleOpenOverrideModal(ev)}
                        >
                          <EditIcon size="0.9em" />
                          <span>配對場館 / 編輯</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => handleQuickToggleHideEvent(ev)}
                        >
                          {ev.isHidden ? <EyeIcon size="0.9em" /> : <EyeOffIcon size="0.9em" />}
                          <span>{ev.isHidden ? '恢復顯示' : '下架隱藏'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="admin-venue-workspace">
              {/* Historical Events List */}
              <div>
                <div className="admin-toolbar">
                  <div className="admin-search-box">
                    <SearchIcon size="1em" />
                    <input
                      type="text"
                      placeholder="搜尋歷史活動名稱、歌手、場館或年份 (例如 2024)..."
                      value={historicalSearch}
                      onChange={(e) => setHistoricalSearch(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-action-btn primary"
                    onClick={() => {
                      setIsCreatingHistorical(true)
                      setHistoricalForm({
                        ...EMPTY_HISTORICAL_FORM,
                        id: `hist-${Date.now().toString(36)}`
                      })
                    }}
                  >
                    <PlusIcon size="0.95em" /> 新增歷史檔期
                  </button>
                </div>

                <div className="admin-venue-table-wrap" style={{ maxHeight: '520px' }}>
                  <table className="admin-venue-table">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>演出者</th>
                        <th>活動名稱</th>
                        <th>場館</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistorical.map((ev) => (
                        <tr
                          key={ev.id}
                          className={!isCreatingHistorical && historicalForm.id === ev.id ? 'selected' : ''}
                          onClick={() => {
                            setIsCreatingHistorical(false)
                            setHistoricalForm({ ...ev })
                          }}
                        >
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ev.date}</td>
                          <td>
                            <span className="admin-badge artist">{ev.artist || '—'}</span>
                          </td>
                          <td>
                            <strong>{ev.name}</strong>
                          </td>
                          <td>{ev.venue_name || ev.city || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historical Event Form */}
              <div className="admin-map-picker-card">
                <div className="admin-panel-header">
                  <h3>
                    {isCreatingHistorical ? <PlusIcon size="1em" /> : <EditIcon size="1em" />}
                    <span>{isCreatingHistorical ? '新增歷史經典活動' : '編輯歷史活動'}</span>
                  </h3>
                </div>

                <div className="admin-venue-form-grid">
                  <div className="admin-form-field full">
                    <label>活動完整名稱</label>
                    <input
                      type="text"
                      value={historicalForm.name}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, name: e.target.value })}
                      placeholder="例如：周杰倫 嘉年華世界巡迴演唱會 台北站"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>演出者 / 歌手 (Artist)</label>
                    <input
                      type="text"
                      value={historicalForm.artist || ''}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, artist: e.target.value })}
                      placeholder="例如：周杰倫"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>演出日期 (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={historicalForm.date}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, date: e.target.value })}
                      placeholder="2024-12-05"
                    />
                  </div>
                  <div className="admin-form-field full">
                    <label>舉辦場館</label>
                    <select
                      value={historicalForm.venue_id || ''}
                      onChange={(e) => {
                        const vid = e.target.value
                        const matched = venues.find((v) => v.id === vid)
                        setHistoricalForm({
                          ...historicalForm,
                          venue_id: vid,
                          venue_name: matched ? matched.name : historicalForm.venue_name,
                          city: matched ? matched.city : historicalForm.city
                        })
                      }}
                    >
                      <option value="">-- 自訂場館 --</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.city} · {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>場館顯示名稱</label>
                    <input
                      type="text"
                      value={historicalForm.venue_name || ''}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, venue_name: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>城市</label>
                    <input
                      type="text"
                      value={historicalForm.city || ''}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, city: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-field full">
                    <label>活動海報圖片網址 (選填)</label>
                    <input
                      type="text"
                      value={historicalForm.image || ''}
                      onChange={(e) => setHistoricalForm({ ...historicalForm, image: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="admin-action-btn primary"
                    onClick={handleSaveHistoricalEvent}
                    disabled={isSavingHistorical}
                  >
                    <CheckIcon size="0.95em" />
                    <span>{isSavingHistorical ? '儲存中...' : '儲存至歷史資料庫 (Firestore)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: SYSTEM CONFIG & USER INSPECTOR (PHASE 4) ==================== */}
      {activeTab === 'system' && (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-filter-pills">
              <button
                type="button"
                className={`admin-pill-btn${sysSubTab === 'config' ? ' active' : ''}`}
                onClick={() => setSysSubTab('config')}
              >
                <MegaphoneIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                全站置頂公告與系統控制
              </button>
              <button
                type="button"
                className={`admin-pill-btn${sysSubTab === 'users' ? ' active' : ''}`}
                onClick={() => setSysSubTab('users')}
              >
                <UserIcon size="0.95em" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                雲端會員足跡查詢與備份 ({userDocs.length})
              </button>
            </div>
          </div>

          {sysSubTab === 'config' ? (
            <div className="admin-panel-grid">
              {/* Global Announcement Banner Config */}
              <div className="admin-mod-item">
                <div className="admin-panel-header">
                  <h3>
                    <SparklesIcon size="1em" style={{ color: 'var(--gold)' }} />
                    <span>全站彈出式公告視窗設定 (Popup Modal)</span>
                  </h3>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={systemConfig.announcementEnabled === true}
                      onChange={(e) =>
                        setSystemConfig({ ...systemConfig, announcementEnabled: e.target.checked })
                      }
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>{systemConfig.announcementEnabled ? '已啟用彈窗公告' : '目前關閉'}</span>
                  </label>
                </div>

                <div className="admin-venue-form-grid">
                  <div className="admin-form-field">
                    <label>彈窗公告標題</label>
                    <input
                      type="text"
                      value={systemConfig.announcementTitle || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, announcementTitle: e.target.value })}
                      placeholder="例如：全站重要公告"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>公告主題樣式</label>
                    <select
                      value={systemConfig.announcementType || 'info'}
                      onChange={(e) =>
                        setSystemConfig({
                          ...systemConfig,
                          announcementType: e.target.value as 'info' | 'warning' | 'celebration'
                        })
                      }
                    >
                      <option value="info">系統公告 (預設主題色)</option>
                      <option value="warning">重要提醒 (琥珀橘黃)</option>
                      <option value="celebration">最新活動公告 (亮橘強調色)</option>
                    </select>
                  </div>
                  <div className="admin-form-field full">
                    <label>公告內文 (支援多行文字)</label>
                    <textarea
                      rows={3}
                      value={systemConfig.announcementText || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, announcementText: e.target.value })}
                      placeholder="輸入要向全站訪客彈出顯示的公告內容..."
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>行動按鈕文字 (選填)</label>
                    <input
                      type="text"
                      value={systemConfig.announcementLinkText || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, announcementLinkText: e.target.value })}
                      placeholder="例如：前往查看詳情"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>點擊導向連結 URL (選填)</label>
                    <input
                      type="text"
                      value={systemConfig.announcementLink || ''}
                      onChange={(e) => setSystemConfig({ ...systemConfig, announcementLink: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Live Popup Modal Preview */}
                <div style={{ marginTop: '1.1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    彈出式公告視窗即時預覽：
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border:
                        systemConfig.announcementType === 'warning'
                          ? '1px solid rgba(245, 158, 11, 0.55)'
                          : '1px solid var(--border)',
                      borderRadius: '18px',
                      padding: '1.25rem 1.4rem',
                      boxShadow: '0 10px 28px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.2rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        marginBottom: '0.55rem',
                        background:
                          systemConfig.announcementType === 'warning'
                            ? 'rgba(245, 158, 11, 0.18)'
                            : systemConfig.announcementType === 'celebration'
                              ? 'rgba(234, 88, 12, 0.18)'
                              : 'rgba(var(--accent-rgb), 0.18)',
                        color:
                          systemConfig.announcementType === 'warning'
                            ? '#f59e0b'
                            : systemConfig.announcementType === 'celebration'
                              ? '#fb923c'
                              : 'var(--gold)'
                      }}
                    >
                      {systemConfig.announcementType === 'warning' ? (
                        <WarningIcon size="0.9em" />
                      ) : systemConfig.announcementType === 'celebration' ? (
                        <SparklesIcon size="0.9em" />
                      ) : (
                        <MegaphoneIcon size="0.9em" />
                      )}
                      <span>
                        {systemConfig.announcementType === 'warning'
                          ? '重要提醒'
                          : systemConfig.announcementType === 'celebration'
                            ? '最新活動公告'
                            : '系統公告'}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.6rem' }}>
                      {systemConfig.announcementTitle || '全站重要公告'}
                    </div>

                    <div
                      style={{
                        background: 'rgba(var(--bg-rgb), 0.45)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '0.8rem 0.95rem',
                        fontSize: '0.86rem',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text)'
                      }}
                    >
                      {systemConfig.announcementText || '（請在上方輸入公告內文以預覽彈窗效果）'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="admin-action-btn primary"
                    onClick={handleSaveSystemConfig}
                    disabled={isSavingConfig}
                  >
                    <CheckIcon size="0.95em" />
                    <span>{isSavingConfig ? '儲存中...' : '儲存並立即發布全站設定'}</span>
                  </button>
                </div>
              </div>

              {/* Manual Suspension Overrides & Scraper Trigger */}
              <div className="admin-mod-item">
                <div className="admin-panel-header">
                  <h3>
                    <WarningIcon size="1em" style={{ color: '#f59e0b' }} />
                    <span>颱風停班停課 / 演出異動手動警示覆寫</span>
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  <select
                    value={newSuspensionCity}
                    onChange={(e) => setNewSuspensionCity(e.target.value)}
                    style={{
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.45rem 0.7rem'
                    }}
                  >
                    {TAIWAN_CITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newSuspensionStatus}
                    onChange={(e) => setNewSuspensionStatus(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.45rem 0.7rem'
                    }}
                  />
                  <button type="button" className="admin-action-btn" onClick={handleAddCustomSuspension}>
                    <PlusIcon size="0.9em" /> 加入警示
                  </button>
                </div>

                {(systemConfig.customSuspensions || []).length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    目前無手動覆寫的縣市停班停課警示（將完全依人事行政總處自動爬蟲為準）。
                  </p>
                ) : (
                  <div className="admin-rank-list" style={{ marginBottom: '0.85rem' }}>
                    {(systemConfig.customSuspensions || []).map((item) => (
                      <div key={item.city} className="admin-rank-row">
                        <div>
                          <span className="admin-badge hidden" style={{ marginRight: '8px' }}>
                            {item.city}
                          </span>
                          <span>{item.status}</span>
                        </div>
                        <button
                          type="button"
                          className="admin-action-btn danger"
                          onClick={() => handleRemoveCustomSuspension(item.city)}
                        >
                          <TrashIcon size="0.85em" /> 移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="admin-action-btn primary"
                  onClick={handleSaveSystemConfig}
                  disabled={isSavingConfig}
                >
                  <CheckIcon size="0.95em" /> 儲存停班停課覆寫
                </button>

                {/* GitHub Actions Crawler Trigger */}
                <div style={{ marginTop: '1.3rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RocketIcon size="1em" style={{ color: 'var(--gold)' }} />
                    <span>GitHub Actions 自動爬蟲排程控制</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
                    最後更新時間：{remoteUpdatedAt || '讀取中'}（預設每 20 分鐘自動執行一次）
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      placeholder="選填 GitHub PAT Token (留空則開啟 GitHub 網頁)"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '210px',
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.82rem'
                      }}
                    />
                    <button
                      type="button"
                      className="admin-action-btn"
                      onClick={handleTriggerGithubScraper}
                      disabled={isTriggeringAction}
                    >
                      <LinkIcon size="0.9em" />
                      <span>{isTriggeringAction ? '觸發中...' : ghToken.trim() ? 'API 立即觸發爬蟲' : '前往 GitHub Actions'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-venue-workspace">
              {/* Left: Users Table */}
              <div>
                <div className="admin-toolbar">
                  <div className="admin-search-box">
                    <SearchIcon size="1em" />
                    <input
                      type="text"
                      placeholder="搜尋樂迷 Email、暱稱或曾打卡的歌手/場館..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-venue-table-wrap">
                  <table className="admin-venue-table">
                    <thead>
                      <tr>
                        <th>樂迷帳號 (Email)</th>
                        <th>暱稱</th>
                        <th>打卡場數</th>
                        <th>最後同步時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.email}
                          className={selectedUserDoc?.email === u.email ? 'selected' : ''}
                          onClick={() => setSelectedUserEmail(u.email)}
                        >
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.email}</td>
                          <td>
                            <strong>{u.nickname || '—'}</strong>
                          </td>
                          <td>
                            <span className="admin-badge artist">{u.concerts.length} 場</span>
                          </td>
                          <td style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                            {u.updatedAt ? new Date(u.updatedAt).toLocaleString('zh-TW') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Selected User Concert Footprint Inspector */}
              <div className="admin-map-picker-card">
                {selectedUserDoc ? (
                  <>
                    <div className="admin-panel-header">
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedUserDoc.nickname} 的現場足跡明細</h3>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '3px' }}>
                          {selectedUserDoc.email} · 共 {selectedUserDoc.concerts.length} 筆紀錄
                        </div>
                      </div>
                      <button
                        type="button"
                        className="admin-action-btn primary"
                        onClick={() => handleExportUserJson(selectedUserDoc)}
                      >
                        <ClipboardIcon size="0.9em" /> 匯出 JSON 備份
                      </button>
                    </div>

                    <div className="admin-mod-list" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                      {selectedUserDoc.concerts.length === 0 ? (
                        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>此會員尚無打卡紀錄</p>
                      ) : (
                        selectedUserDoc.concerts.map((c) => (
                          <div key={c.id} className="admin-reply-row">
                            <div>
                              <span className="admin-badge artist" style={{ marginRight: '6px' }}>
                                {c.artist}
                              </span>
                              <strong>{c.concertName || '未命名演出'}</strong>
                              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '2px' }}>
                                {c.date || '無日期'} · {c.venueName} ({c.venueCity}) · 座位：{c.seat || '未填'}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="admin-action-btn danger"
                              onClick={() =>
                                handleDeleteUserSingleConcert(
                                  selectedUserDoc,
                                  c.id,
                                  `${c.artist} - ${c.concertName}`
                                )
                              }
                            >
                              <TrashIcon size="0.85em" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--muted)' }}>請從左側選擇一位樂迷檢視明細</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default AdminDashboard
