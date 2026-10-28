import { useSyncExternalStore } from 'react'

const TABLE_KEY = 'chezpapa-table'
const DEVICE_KEY = 'chezpapa-device'
const NOTE_KEY = 'chezpapa-order-note'
const REQUEST_KEY = 'chezpapa-request'
const STAFF_KEY = 'chezpapa-staff-token'
const SOUND_KEY = 'chezpapa-staff-sound'
const ALERT_KEY = 'chezpapa-alerted'

const listeners = new Set<() => void>()

export function apiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
  if (configured) return configured
  const native = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (native?.isNativePlatform?.()) return 'https://chezpapa-beta.vercel.app'
  return ''
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; offline: boolean; status: number; code: string; message: string }

export async function apiSend<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown; keepCart?: boolean } = {},
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers()
    if (options.body !== undefined) headers.set('content-type', 'application/json')
    if (options.token) headers.set('authorization', `Bearer ${options.token}`)
    const response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const data = (await response.json().catch(() => ({}))) as T & { code?: string; message?: string }
    if (!response.ok) {
      return {
        ok: false,
        offline: false,
        status: response.status,
        code: data.code ?? 'unavailable',
        message: data.message ?? 'Serveur temporairement indisponible.',
      }
    }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      offline: true,
      status: 0,
      code: 'offline',
      message: options.keepCart
        ? 'La commande n’a pas été enregistrée. Vérifiez la connexion. Votre panier est conservé.'
        : 'Connexion interrompue. Les informations peuvent ne pas être à jour.',
    }
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export function rememberTable(tableNumber: number) {
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 200) return
  const previous = currentTable()
  localStorage.setItem(TABLE_KEY, String(tableNumber))
  if (previous && previous !== tableNumber) localStorage.removeItem(DEVICE_KEY)
  emit()
}

export function currentTable(): number | null {
  try {
    const value = Number(localStorage.getItem(TABLE_KEY))
    return Number.isInteger(value) && value >= 1 && value <= 200 ? value : null
  } catch {
    return null
  }
}

export function useTableNumber(): number | null {
  return useSyncExternalStore(subscribeTable, currentTable, () => null)
}

function subscribeTable(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function deviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}

export function saveDeviceToken(token: string) {
  localStorage.setItem(DEVICE_KEY, token)
}

export async function ensureDevice(tableNumber: number, renew = false) {
  rememberTable(tableNumber)
  const result = await apiSend<{ deviceToken: string }>('/api/client/session', {
    method: 'POST',
    token: deviceToken(),
    body: { tableNumber, renew },
  })
  if (result.ok) saveDeviceToken(result.data.deviceToken)
  return result
}

export function orderNote(): string {
  try {
    return localStorage.getItem(NOTE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveOrderNote(note: string) {
  localStorage.setItem(NOTE_KEY, note.slice(0, 240))
}

export function clientRequestId(): string {
  try {
    const existing = sessionStorage.getItem(REQUEST_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(REQUEST_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function clearClientRequest() {
  try {
    sessionStorage.removeItem(REQUEST_KEY)
  } catch {
    /* navigation privée */
  }
}

const STAFF_COOKIE = 'cp_staff'
const STAFF_MAX_AGE = 180 * 24 * 60 * 60

export function staffToken(): string | null {
  try {
    return localStorage.getItem(STAFF_KEY) || readStaffCookie()
  } catch {
    return readStaffCookie()
  }
}

export function saveStaffToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STAFF_KEY, token)
    else localStorage.removeItem(STAFF_KEY)
  } catch {
    /* navigation privée */
  }
  document.cookie = token
    ? `${STAFF_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${STAFF_MAX_AGE}; SameSite=Lax`
    : `${STAFF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  emit()
}

function readStaffCookie(): string | null {
  const stored = document.cookie.split('; ').find((row) => row.startsWith(`${STAFF_COOKIE}=`))
  if (!stored) return null
  try {
    return decodeURIComponent(stored.slice(STAFF_COOKIE.length + 1))
  } catch {
    return null
  }
}

export function useStaffToken(): string | null {
  return useSyncExternalStore(subscribeTable, staffToken, () => null)
}

export function soundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) === '1'
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
}

export function beep() {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 880
  gain.gain.value = 0.04
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.16)
  oscillator.onended = () => void context.close()
}

export function freshAlerts(ids: string[]): string[] {
  try {
    const seen = new Set(JSON.parse(sessionStorage.getItem(ALERT_KEY) ?? '[]') as string[])
    const fresh = ids.filter((id) => !seen.has(id))
    if (fresh.length === 0) return []
    sessionStorage.setItem(ALERT_KEY, JSON.stringify([...seen, ...fresh].slice(-80)))
    return fresh
  } catch {
    return ids
  }
}
