export const shortenCpblTeamName = (name?: string): string => {
  if (!name) return ''
  const clean = name.trim()
  if (clean.includes('富邦')) return '富邦'
  if (clean.includes('統一')) return '統一'
  if (clean.includes('中信') || clean.includes('兄弟')) return '中信'
  if (clean.includes('味全')) return '味全'
  if (clean.includes('樂天') || clean.includes('桃猿')) return '樂天'
  if (clean.includes('台鋼') || clean.includes('雄鷹')) return '台鋼'
  return clean
}
