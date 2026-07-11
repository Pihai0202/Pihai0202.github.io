import type { SuspensionItem } from '../types'

/**
 * 檢查特定城市是否處於颱風停班停課狀態，若有則回傳停班停課公告文字，否則回傳 null。
 */
export function getCitySuspensionStatus(
  city: string | undefined,
  suspensionItems: SuspensionItem[] | undefined
): string | null {
  if (!city || !suspensionItems) return null
  const target = city.replace(/台/g, '臺').replace(/(市|縣)$/, '').trim()
  
  const matched = suspensionItems.find((item) => {
    const itemCity = item.city.replace(/台/g, '臺').replace(/(市|縣)$/, '').trim()
    return itemCity === target
  })
  if (!matched) return null

  const isSuspended =
    matched.status.includes('停止') ||
    matched.status.includes('停班') ||
    matched.status.includes('停課') ||
    !matched.status.includes('照常')

  return isSuspended ? matched.status : null
}
