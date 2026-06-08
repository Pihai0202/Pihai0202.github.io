import { useState, useEffect, useRef } from 'react'
import type { Concert } from '../types'
import { getConcertShareText, exportToMarkdownFile } from '../utils/shareUtils'

interface ShareMenuProps {
  concert: Concert
  onPublishToBoard: () => void
}

export function ShareMenu({ concert, onPublishToBoard }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleCopyShareText = async () => {
    try {
      const shareText = getConcertShareText(concert)
      await navigator.clipboard.writeText(shareText)
      showStatus('複製成功！')
    } catch {
      showStatus('複製失敗')
    }
  }

  const handleCopyRawMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(concert.notes || '')
      showStatus('複製成功！')
    } catch {
      showStatus('複製失敗')
    }
  }

  const handleExportMarkdown = () => {
    exportToMarkdownFile(concert)
    showStatus('開始下載...')
  }

  const handlePublishClick = () => {
    setIsOpen(false)
    onPublishToBoard()
  }

  const showStatus = (msg: string) => {
    setStatus(msg)
    setIsOpen(false)
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="share-menu-container" ref={menuRef}>
      <button
        className="share-trigger-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="分享觀後心得"
      >
        🔗 分享 / 匯出心得
      </button>

      {isOpen && (
        <div className="share-dropdown">
          <button type="button" onClick={handleCopyShareText}>
            📋 複製分享文字 (含格式)
          </button>
          <button type="button" onClick={handleExportMarkdown}>
            💾 匯出為 Markdown 檔案 (.md)
          </button>
          <button type="button" onClick={handleCopyRawMarkdown}>
            ✍️ 複製 Markdown 原始碼
          </button>
          <button type="button" onClick={handlePublishClick}>
            📢 發佈至分享牆
          </button>
        </div>
      )}

      {status && <span className="share-status-toast">{status}</span>}
    </div>
  )
}
