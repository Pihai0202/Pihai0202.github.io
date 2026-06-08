import type { Concert } from '../types'

export function getConcertShareText(concert: Concert): string {
  const meta = `【台灣演唱會記錄分享】\n` +
    `🎵 藝人/團體：${concert.artist}\n` +
    `🏟️ 演出場館：${concert.venueCity} · ${concert.venueName}\n` +
    `📅 演出日期：${concert.date || '未定'}\n` +
    (concert.concertName ? `🎫 演出名稱：${concert.concertName}\n` : '') +
    (concert.seat ? `💺 座位區域：${concert.seat}\n` : '') +
    `----------------------------------------\n`;
  
  return meta + (concert.notes ? `📝 觀後感心得：\n${concert.notes}` : '（無撰寫心得）');
}

export function exportToMarkdownFile(concert: Concert) {
  const frontMatter = `---
artist: "${concert.artist.replace(/"/g, '\\"')}"
concertName: "${(concert.concertName || '').replace(/"/g, '\\"')}"
date: "${concert.date || ''}"
venue: "${concert.venueCity} · ${concert.venueName}"
seat: "${(concert.seat || '').replace(/"/g, '\\"')}"
created_at: "${concert.createdAt || ''}"
---

# ${concert.artist}${concert.concertName ? ` - ${concert.concertName}` : ''}

**日期:** ${concert.date || '未定'}
**場館:** ${concert.venueCity} · ${concert.venueName}
${concert.seat ? `**座位/區域:** ${concert.seat}\n` : ''}
---

## 觀後心得

${concert.notes || '（尚未寫下心得）'}
`;

  const blob = new Blob([frontMatter], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  
  const safeArtist = concert.artist.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  const safeDate = concert.date ? concert.date : 'date'
  link.setAttribute('download', `${safeDate}_${safeArtist}_concert_log.md`)
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
