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
import type { Venue, SharedNote, RemoteConcert } from '../types'
import { TAIWAN_PATHS } from '../constants/taiwanPaths'
import { VENUES as STATIC_VENUES } from '../constants/venues'
import { ADMIN_EMAILS } from '../constants/adminConfig'
import {
  saveVenuesToLocalCache,
  seedDefaultVenuesToFirestore,
  fetchVenuesFromFirestore
} from '../utils/venueService'
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
  TargetIcon
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

export function AdminDashboard({
  currentUser,
  venues,
  onVenuesChange,
  remoteConcerts,
  remoteUpdatedAt,
  onBack,
  onShowToast
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'venues'>('overview')

  // ---------------- 1. Firestore Real-time Data ----------------
  const [allReviews, setAllReviews] = useState<SharedNote[]>([])
  const [ticketComments, setTicketComments] = useState<TicketCommentDoc[]>([])
  const [userStats, setUserStats] = useState<{
    totalUsers: number
    totalLoggedConcerts: number
    topArtists: { name: string; count: number }[]
    topVenues: { name: string; count: number }[]
  }>({
    totalUsers: 0,
    totalLoggedConcerts: 0,
    topArtists: [],
    topVenues: []
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

  // Load users_concerts summary statistics
  useEffect(() => {
    let cancelled = false
    async function loadUserStats() {
      try {
        const snap = await getDocs(collection(db, 'users_concerts'))
        if (cancelled) return
        let totalUsers = 0
        let totalLoggedConcerts = 0
        const artistCounts: Record<string, number> = {}
        const venueCounts: Record<string, number> = {}

        snap.forEach((docSnap) => {
          totalUsers++
          const data = docSnap.data()
          const concerts = Array.isArray(data.concerts) ? data.concerts : []
          totalLoggedConcerts += concerts.length
          concerts.forEach((c: any) => {
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

        setUserStats({ totalUsers, totalLoggedConcerts, topArtists, topVenues })
      } catch (err) {
        console.warn('[Admin] Failed to fetch users_concerts stats:', err)
      }
    }
    loadUserStats()
    return () => {
      cancelled = true
    }
  }, [])

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

  // Click on the Taiwan SVG map to pick coordinates
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

  // Computed summary metrics
  const visibleReviewCount = allReviews.filter((r) => !r.hidden).length
  const hiddenReviewCount = allReviews.filter((r) => r.hidden).length
  const pinnedReviewCount = allReviews.filter((r) => r.pinned).length
  const totalReviewLikes = allReviews.reduce((sum, r) => sum + (r.likes || 0), 0)
  const customVenueCount = venues.filter((v) => !staticVenueIds.has(v.id)).length

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
            <p>管理全台場館座標、審核社群心得與售票討論留言、檢視全站營運數據</p>
          </div>
        </div>
        <div className="admin-identity-badge">
          <UserIcon size="0.95em" />
          <span>管理員：{currentUser?.email || currentUser?.nickname}</span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
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
          <span>場館與地圖座標管理</span>
          <span className="admin-tab-count">{venues.length}</span>
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
              <div className="admin-stat-value">{remoteConcerts.length}</div>
              <div className="admin-stat-sub">
                最後爬蟲更新：{remoteUpdatedAt || '讀取中'}
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
                  <span>授權管理員白名單 (RBAC)</span>
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
                  前往審核社群貼文與留言 →
                </button>
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setActiveTab('venues')}
                >
                  前往管理場館與地圖座標 →
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
                            · 作者：<strong>{review.author}</strong> · <HeartFilledIcon size="0.88em" style={{ color: '#ef4444', verticalAlign: '-1px' }} /> {review.likes}
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
                  <RefreshIcon size="0.95em" /> 同步預設場館
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

                {/* All other venues as reference dots */}
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

                {/* Active Editing Venue Target Pin */}
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
                  <RefreshIcon size="0.95em" />
                </button>
              </div>

              <div className="admin-map-coord-readout">
                <span>
                  <TargetIcon size="1em" style={{ color: 'var(--gold)', verticalAlign: '-2px', marginRight: '5px' }} />
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
    </div>
  )
}
export default AdminDashboard
