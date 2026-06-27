import { useState, useMemo, useEffect } from 'react'
import { marked } from 'marked'
import type { SharedNote } from '../types'
import {
  MicIcon,
  EditIcon,
  SearchIcon,
  CloseIcon,
  TrashIcon,
  HeartFilledIcon,
  HeartOutlineIcon,
  PinIcon,
  CalendarIcon,
  UserIcon,
  CheckIcon
} from './SvgIcon'
import { COMMUNITY_MOCK_NOTES } from '../constants/communityMock'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, increment, addDoc } from 'firebase/firestore'
import { db, logCustomEvent } from '../firebase'

const LIKED_STORAGE_KEY = 'tw-liked-notes'

export function ShareBoard() {
  const [notes, setNotes] = useState<SharedNote[]>([])
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [myCreatedIds, setMyCreatedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notesActiveTab, setNotesActiveTab] = useState<'edit' | 'preview'>('edit')
  const [form, setForm] = useState({
    artist: '',
    concertName: '',
    venueName: '',
    venueCity: '台北',
    date: '',
    author: localStorage.getItem('tw-nickname') || '',
    notes: '',
  })

  // Selected note for detail and replies
  const [selectedNote, setSelectedNote] = useState<SharedNote | null>(null)
  const [replies, setReplies] = useState<any[]>([])
  const [replyForm, setReplyForm] = useState({
    author: localStorage.getItem('tw-nickname') || '',
    content: ''
  })
  const [replyActiveTab, setReplyActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isPublishingReply, setIsPublishingReply] = useState(false)

  const notesPreviewHtml = useMemo(() => {
    if (!form.notes) return '<p style="color: var(--muted); font-style: italic; font-size: 0.85rem; padding: 1rem 0;">（輸入心得後可在此預覽 Markdown 效果）</p>'
    try {
      return marked.parse(form.notes) as string
    } catch {
      return form.notes
    }
  }, [form.notes])

  // Load notes and liked status
  useEffect(() => {
    // Query Firestore sorted by createdAt descending
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reviewsList: SharedNote[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        reviewsList.push({
          id: doc.id,
          artist: data.artist,
          concertName: data.concertName,
          venueName: data.venueName,
          venueCity: data.venueCity,
          date: data.date,
          author: data.author,
          notes: data.notes,
          likes: data.likes || 0,
          createdAt: data.createdAt
        })
      })

      // If Firestore is empty, initialize it with mock reviews so it doesn't look empty!
      if (reviewsList.length === 0) {
        COMMUNITY_MOCK_NOTES.forEach(async (mock) => {
          await addDoc(collection(db, 'reviews'), {
            artist: mock.artist,
            concertName: mock.concertName,
            venueName: mock.venueName,
            venueCity: mock.venueCity,
            date: mock.date,
            author: mock.author,
            notes: mock.notes,
            likes: mock.likes,
            createdAt: mock.createdAt
          })
        })
      } else {
        setNotes(reviewsList)
      }
    }, (error) => {
      console.error("Firestore read error:", error)
    })

    // Load liked note IDs
    const storedLikes = localStorage.getItem(LIKED_STORAGE_KEY)
    if (storedLikes) {
      try {
        setLikedIds(JSON.parse(storedLikes))
      } catch {
        setLikedIds({})
      }
    }

    // Load created note IDs
    const storedMyNotes = localStorage.getItem('tw-my-created-notes')
    if (storedMyNotes) {
      try {
        setMyCreatedIds(JSON.parse(storedMyNotes))
      } catch {
        setMyCreatedIds([])
      }
    }

    return () => unsubscribe()
  }, [])

  // Listen to replies collection when a note is selected
  useEffect(() => {
    if (!selectedNote) {
      setReplies([])
      return
    }

    const repliesRef = collection(db, 'reviews', selectedNote.id, 'replies')
    const q = query(repliesRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        list.push({
          id: doc.id,
          author: data.author,
          content: data.content,
          createdAt: data.createdAt
        })
      })
      setReplies(list)
    }, (err) => {
      console.error("Failed to fetch replies:", err)
    })

    return () => unsubscribe()
  }, [selectedNote])

  // Select active note with latest real-time likes
  const activeNote = useMemo(() => {
    if (!selectedNote) return null
    return notes.find(n => n.id === selectedNote.id) || selectedNote
  }, [notes, selectedNote])

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNote) return
    const author = replyForm.author.trim() || '匿名樂迷'
    const content = replyForm.content.trim()

    if (!content) {
      alert('請輸入回覆內容')
      return
    }

    setIsPublishingReply(true)
    try {
      await addDoc(collection(db, 'reviews', selectedNote.id, 'replies'), {
        author,
        content,
        createdAt: new Date().toISOString()
      })
      // Save author nickname
      localStorage.setItem('tw-nickname', author)
      // Reset form
      setReplyForm((prev) => ({ ...prev, content: '' }))
      setReplyActiveTab('edit')
      logCustomEvent('reply_community_note', {
        note_id: selectedNote.id
      })
    } catch (err) {
      console.error('Failed to add reply:', err)
      alert('發表回覆失敗，請檢查連線並重試！')
    } finally {
      setIsPublishingReply(false)
    }
  }

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    }
    return notes
      .filter((note) => {
        return (
          note.artist.toLowerCase().includes(query) ||
          note.concertName.toLowerCase().includes(query) ||
          note.venueName.toLowerCase().includes(query) ||
          note.venueCity.toLowerCase().includes(query) ||
          note.author.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [notes, searchQuery])

  // Handle Like/Unlike toggle
  const handleLikeToggle = async (noteId: string) => {
    const isAlreadyLiked = likedIds[noteId]
    const updatedLikedIds = { ...likedIds, [noteId]: !isAlreadyLiked }

    setLikedIds(updatedLikedIds)
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(updatedLikedIds))

    try {
      const noteRef = doc(db, 'reviews', noteId)
      await updateDoc(noteRef, {
        likes: isAlreadyLiked ? increment(-1) : increment(1)
      })
      logCustomEvent(isAlreadyLiked ? 'unlike_community_note' : 'like_community_note', {
        note_id: noteId
      })
    } catch (err) {
      console.error("Firestore likes update error:", err)
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    const artist = form.artist.trim()
    const concertName = form.concertName.trim()
    const venueName = form.venueName.trim()
    const venueCity = form.venueCity.trim()
    const author = form.author.trim() || '匿名樂迷'
    const notesContent = form.notes.trim()

    if (!artist) {
      alert('請輸入演出者名稱')
      return
    }
    if (!notesContent) {
      alert('請輸入心得內容')
      return
    }

    localStorage.setItem('tw-nickname', author)

    try {
      const docRef = await addDoc(collection(db, 'reviews'), {
        artist,
        concertName: concertName || '未命名演唱會',
        venueName: venueName || '未指定場館',
        venueCity: venueCity || '其他',
        date: form.date,
        author,
        notes: notesContent,
        likes: 0,
        createdAt: new Date().toISOString(),
      })

      // Save created note ID to local storage and state
      const myCreatedNotes = JSON.parse(localStorage.getItem('tw-my-created-notes') || '[]')
      myCreatedNotes.push(docRef.id)
      localStorage.setItem('tw-my-created-notes', JSON.stringify(myCreatedNotes))
      setMyCreatedIds(myCreatedNotes)

      logCustomEvent('publish_community_note', {
        artist,
        venue_name: venueName,
        concert_name: concertName,
        source: 'share_board'
      })

      // Reset form
      setForm({
        artist: '',
        concertName: '',
        venueName: '',
        venueCity: '台北',
        date: '',
        author: author,
        notes: '',
      })
      setIsModalOpen(false)
      setTimeout(() => {
        alert('發佈成功！您的心得已更新至分享牆。')
      }, 100)
    } catch (err) {
      console.error('Firebase write error:', err)
      alert('發佈失敗，請檢查網路連線或 Firebase 設定！')
    }
  }

  const handleNoteDelete = async (noteId: string) => {
    if (!confirm('確定要刪除這筆分享記錄嗎？')) return
    try {
      await deleteDoc(doc(db, 'reviews', noteId))
      logCustomEvent('delete_community_note', {
        note_id: noteId
      })
    } catch (err) {
      console.error("Firestore delete error:", err)
      alert('刪除失敗，請檢查網路連線！')
    }
  }

  const toggleExpand = (noteId: string) => {
    setExpandedIds((prev) => ({ ...prev, [noteId]: !prev[noteId] }))
  }

  // Get raw notes text snippet or full compile
  const renderNoteContent = (note: SharedNote) => {
    const isExpanded = expandedIds[note.id]
    let content = note.notes

    // If not expanded and notes are long, truncate and add a indicator
    const shouldTruncate = content.length > 220 && !isExpanded
    if (shouldTruncate) {
      content = content.slice(0, 200) + '...'
    }

    let html = ''
    try {
      html = marked.parse(content) as string
    } catch {
      html = content
    }

    return (
      <div className="shared-card-body">
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        {note.notes.length > 220 && (
          <button
            className="expand-card-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(note.id)
            }}
          >
            {isExpanded ? '收起全文 ▴' : '展開全文 ▾'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="share-board-container">
      <div className="share-board-header">
        <h2 className="share-board-title">
          <MicIcon size="1.2em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          演唱會觀後感分享牆
        </h2>
        <div className="share-board-subtitle">COMMUNITY CONCERT REVIEWS</div>
        <p className="share-board-description">
          在這裡閱讀全台熱血歌迷分享的現場真實感受，感受音樂的感動與現場震撼！
        </p>
        <button
          className="board-publish-trigger"
          type="button"
          onClick={() => {
            setForm((prev) => ({ ...prev, author: localStorage.getItem('tw-nickname') || '' }))
            setIsModalOpen(true)
          }}
        >
          <EditIcon size="1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          撰寫並分享我的心得
        </button>
      </div>

      <div className="board-search-bar">
        <span className="search-icon"><SearchIcon /></span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋歌手、演唱會名稱、場館或分享者..."
        />
        {searchQuery && (
          <button className="clear-search" type="button" onClick={() => setSearchQuery('')}>
            <CloseIcon />
          </button>
        )}
      </div>

      {filteredNotes.length === 0 ? (
        <div className="board-empty-state">
          沒有符合的分享記錄，試試搜尋其他歌手或場館！
        </div>
      ) : (
        <div className="board-grid">
          {filteredNotes.map((note) => {
            const isLiked = likedIds[note.id]
            const formattedDate = new Date(note.createdAt).toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })

            return (
              <div key={note.id} className="shared-note-card" onClick={() => setSelectedNote(note)}>
                <div className="shared-card-header">
                  <div className="card-artist-tag">{note.artist}</div>
                  <div className="card-header-actions" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {myCreatedIds.includes(note.id) && (
                      <button
                        className="card-delete-btn"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNoteDelete(note.id)
                        }}
                        title="刪除此分享"
                      >
                        <TrashIcon size="1em" style={{ verticalAlign: 'middle' }} />
                      </button>
                    )}
                    <button
                      className={`card-like-btn${isLiked ? ' liked' : ''}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLikeToggle(note.id)
                      }}
                      title={isLiked ? '取消按讚' : '點擊按讚'}
                    >
                      <span className="heart-icon">
                        {isLiked ? (
                          <HeartFilledIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                        ) : (
                          <HeartOutlineIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                        )}
                      </span>
                      <span className="like-count">{note.likes}</span>
                    </button>
                  </div>
                </div>

                <div className="shared-card-title">{note.concertName}</div>

                <div className="shared-card-meta">
                  <span>
                    <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {note.venueCity} · {note.venueName}
                  </span>
                  <span>
                    <CalendarIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {note.date || '日期未定'}
                  </span>
                </div>

                {renderNoteContent(note)}

                <div className="shared-card-footer">
                  <span className="author">
                    <UserIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {note.author}
                  </span>
                  <span className="post-date">發佈於 {formattedDate}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsModalOpen(false)}>
          <div className="modal publish-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setIsModalOpen(false)}>
              <CloseIcon />
            </button>
            <h2>
              <EditIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              撰寫觀後心得分享
            </h2>
            <form onSubmit={handlePublish}>
              <div className="form-group">
                <label htmlFor="input-board-author">您的暱稱</label>
                <input
                  id="input-board-author"
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="e.g. 搖滾區小精靈 (留空則以「匿名樂迷」發佈)"
                  maxLength={20}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="input-board-artist">演出者 / 團體 *</label>
                  <input
                    id="input-board-artist"
                    type="text"
                    required
                    value={form.artist}
                    onChange={(e) => setForm({ ...form, artist: e.target.value })}
                    placeholder="e.g. YOASOBI"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="input-board-concert">演唱會名稱</label>
                  <input
                    id="input-board-concert"
                    type="text"
                    value={form.concertName}
                    onChange={(e) => setForm({ ...form, concertName: e.target.value })}
                    placeholder="e.g. 亞洲巡迴演唱會"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1.2fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="input-board-city">縣市 *</label>
                  <select
                    id="input-board-city"
                    value={form.venueCity}
                    onChange={(e) => setForm({ ...form, venueCity: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.5rem',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  >
                    {['台北', '新北', '桃園', '台中', '台南', '高雄', '宜蘭', '花蓮', '台東', '屏東', '其他'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="input-board-venue">場館名稱</label>
                  <input
                    id="input-board-venue"
                    type="text"
                    value={form.venueName}
                    onChange={(e) => setForm({ ...form, venueName: e.target.value })}
                    placeholder="e.g. 台北流行音樂中心"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="input-board-date">演出日期</label>
                  <input
                    id="input-board-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={{ padding: '0.55rem 0.8rem' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <div className="notes-label-row">
                  <label htmlFor="input-board-notes">心得內容 * (支援 Markdown)</label>
                  <div className="notes-tabs">
                    <button
                      type="button"
                      className={`notes-tab-btn${notesActiveTab === 'edit' ? ' active' : ''}`}
                      onClick={() => setNotesActiveTab('edit')}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      className={`notes-tab-btn${notesActiveTab === 'preview' ? ' active' : ''}`}
                      onClick={() => setNotesActiveTab('preview')}
                    >
                      預覽
                    </button>
                  </div>
                </div>
                {notesActiveTab === 'edit' ? (
                  <textarea
                    id="input-board-notes"
                    value={form.notes}
                    required
                    placeholder="在此寫下您的心得... (支援 Markdown 語法)"
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    style={{
                      width: '100%',
                      height: '140px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                ) : (
                  <div
                    className="notes-preview-box markdown-body"
                    style={{ height: '140px' }}
                    dangerouslySetInnerHTML={{ __html: notesPreviewHtml }}
                  />
                )}
              </div>
              <div className="publish-actions">
                <button className="publish-submit-btn" type="submit">
                  發佈心得 <CheckIcon size="1.1em" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                </button>
                <button
                  className="publish-cancel-btn"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedNote && activeNote && (
        <div className="modal-overlay active" onClick={() => setSelectedNote(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelectedNote(null)}>
              <CloseIcon />
            </button>
            
            <div className="detail-modal-header">
              <div className="card-artist-tag">{activeNote.artist}</div>
              <h2 className="detail-modal-title">{activeNote.concertName}</h2>
              <div className="shared-card-meta">
                <span>
                  <PinIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {activeNote.venueCity} · {activeNote.venueName}
                </span>
                <span>
                  <CalendarIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {activeNote.date || '日期未定'}
                </span>
              </div>
            </div>

            <div className="detail-modal-body" style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', paddingRight: '0.4rem' }}>
              {/* Original Post Content */}
              <div className="detail-post-content">
                <div className="detail-post-author-row">
                  <span className="author">
                    <UserIcon size="0.9em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    {activeNote.author}
                  </span>
                  <span className="post-date">
                    發佈於 {new Date(activeNote.createdAt).toLocaleDateString('zh-TW', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                
                <div 
                  className="markdown-body detail-notes-content" 
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      try {
                        return marked.parse(activeNote.notes) as string
                      } catch {
                        return activeNote.notes
                      }
                    })() 
                  }} 
                />

                <div className="detail-post-actions">
                  <button
                    className={`card-like-btn${likedIds[activeNote.id] ? ' liked' : ''}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLikeToggle(activeNote.id)
                    }}
                    title={likedIds[activeNote.id] ? '取消按讚' : '點擊按讚'}
                  >
                    <span className="heart-icon">
                      {likedIds[activeNote.id] ? (
                        <HeartFilledIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                      ) : (
                        <HeartOutlineIcon size="1.1em" style={{ verticalAlign: 'middle' }} />
                      )}
                    </span>
                    <span className="like-count">{activeNote.likes} 人按讚</span>
                  </button>
                </div>
              </div>

              {/* Replies Section */}
              <div className="replies-section">
                <h3>💬 樂迷回覆 ({replies.length})</h3>
                
                <div className="replies-list">
                  {replies.length === 0 ? (
                    <div className="replies-empty">
                      目前尚無回覆，快來跟大家交流吧！
                    </div>
                  ) : (
                    replies.map((reply) => {
                      const replyDate = new Date(reply.createdAt).toLocaleString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      return (
                        <div key={reply.id} className="reply-card">
                          <div className="reply-header">
                            <span className="reply-author">
                              <UserIcon size="0.8em" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {reply.author}
                            </span>
                            <span className="reply-date">{replyDate}</span>
                          </div>
                          <div 
                            className="markdown-body reply-content" 
                            dangerouslySetInnerHTML={{ 
                              __html: (() => {
                                try {
                                  return marked.parse(reply.content) as string
                                } catch {
                                  return reply.content
                                }
                              })() 
                            }} 
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Reply Form */}
              <div className="reply-form-container">
                <h4>✍️ 發表回覆</h4>
                <form onSubmit={handleAddReply}>
                  <div className="form-group">
                    <label htmlFor="reply-author">您的暱稱</label>
                    <input
                      id="reply-author"
                      type="text"
                      value={replyForm.author}
                      onChange={(e) => setReplyForm({ ...replyForm, author: e.target.value })}
                      placeholder="e.g. 搖滾區小精靈 (留空則以「匿名樂迷」發佈)"
                      maxLength={20}
                    />
                  </div>
                  <div className="form-group">
                    <div className="notes-label-row">
                      <label htmlFor="reply-content">回覆內容 * (支援 Markdown)</label>
                      <div className="notes-tabs">
                        <button
                          type="button"
                          className={`notes-tab-btn${replyActiveTab === 'edit' ? ' active' : ''}`}
                          onClick={() => setReplyActiveTab('edit')}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className={`notes-tab-btn${replyActiveTab === 'preview' ? ' active' : ''}`}
                          onClick={() => setReplyActiveTab('preview')}
                        >
                          預覽
                        </button>
                      </div>
                    </div>
                    {replyActiveTab === 'edit' ? (
                      <textarea
                        id="reply-content"
                        value={replyForm.content}
                        required
                        placeholder="寫下您的回覆... (支援 Markdown 語法)"
                        onChange={(e) => setReplyForm({ ...replyForm, content: e.target.value })}
                        style={{
                          width: '100%',
                          height: '90px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.8rem',
                          color: 'var(--text)',
                          fontSize: '0.85rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          resize: 'vertical'
                        }}
                      />
                    ) : (
                      <div
                        className="notes-preview-box markdown-body"
                        style={{ height: '90px', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                        dangerouslySetInnerHTML={{ 
                          __html: replyForm.content.trim() 
                            ? (marked.parse(replyForm.content) as string) 
                            : '<p style="color: var(--muted); font-style: italic; font-size: 0.8rem;">（輸入內容後可在此預覽 Markdown 效果）</p>' 
                        }}
                      />
                    )}
                  </div>
                  <button className="reply-submit-btn" type="submit" disabled={isPublishingReply}>
                    {isPublishingReply ? '發表中...' : '發表回覆'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
