export const ADMIN_EMAILS: string[] = [
  '5b2g0010@stust.edu.tw',
  '5b2g0018@stust.edu.tw',
]

export function isAdminUser(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized)
}
