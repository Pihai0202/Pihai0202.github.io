export const ADMIN_EMAILS: string[] = [
  '5b2g0010@stust.edu.tw',
  '5b2g0018@stust.edu.tw',
]

const DYNAMIC_ADMIN_STORAGE_KEY = 'tw-dynamic-admin-emails'

let dynamicAdminEmails: string[] = (() => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DYNAMIC_ADMIN_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
      : []
  } catch {
    return []
  }
})()

export function setDynamicAdminEmails(emails?: string[] | null): void {
  const clean = Array.isArray(emails)
    ? Array.from(
        new Set(
          emails
            .map((e) => String(e).trim().toLowerCase())
            .filter((e) => e.includes('@'))
        )
      )
    : []
  dynamicAdminEmails = clean
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DYNAMIC_ADMIN_STORAGE_KEY, JSON.stringify(clean))
    } catch {
      // ignore storage quota errors
    }
  }
}

export function getDynamicAdminEmails(): string[] {
  return dynamicAdminEmails
}

export function isSuperAdminUser(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized)
}

export function isAdminUser(email?: string | null, extraAdminEmails?: string[]): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (isSuperAdminUser(normalized)) return true
  if (dynamicAdminEmails.includes(normalized)) return true
  if (
    Array.isArray(extraAdminEmails) &&
    extraAdminEmails.some((e) => String(e).trim().toLowerCase() === normalized)
  ) {
    return true
  }
  return false
}
