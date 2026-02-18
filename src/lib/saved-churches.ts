import type { Church } from '@/types/church'

const STORAGE_KEY = 'gathered_saved_churches'

export const getSavedChurches = (): Church[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    if (parsed.length === 0) return []
    if (typeof parsed[0] === 'string') return []
    return parsed as Church[]
  } catch {
    return []
  }
}

export const setSavedChurches = (churches: Church[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(churches))
}

export const isChurchSaved = (churches: Church[], id: string) => {
  return churches.some((church) => church.id === id)
}




