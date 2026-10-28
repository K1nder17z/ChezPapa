import { priceLines } from '../ticket.ts'
import type { CartLine } from '../cart.ts'

export const ORDER_STATUSES = [
  'draft',
  'submitted',
  'ready_for_pickup',
  'claimed',
  'completed',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const statusLabel: Record<OrderStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  ready_for_pickup: 'À récupérer',
  claimed: 'Récupérée',
  completed: 'Clôturée',
  cancelled: 'Annulée',
}

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['claimed', 'cancelled'],
  claimed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to)
}

export type Tone = 'grey' | 'blue' | 'red' | 'orange' | 'green'

export const legend: Array<{ tone: Tone; label: string; text: string }> = [
  { tone: 'grey', label: 'Disponible', text: 'Aucune commande en attente' },
  { tone: 'blue', label: 'En cours', text: 'Le client est en train de commander' },
  { tone: 'red', label: 'À récupérer', text: 'Le client a terminé et attend le restaurant' },
  { tone: 'orange', label: 'Récupérée', text: 'Commande récupérée, encore à traiter' },
  { tone: 'green', label: 'Clôturée', text: 'Commande clôturée par le restaurant' },
]

export function tablePresentation(statuses: OrderStatus[]): { tone: Tone; label: string } {
  const active = statuses.filter((status) => status !== 'cancelled')
  if (active.includes('ready_for_pickup')) return { tone: 'red', label: 'À récupérer' }
  if (active.includes('claimed')) return { tone: 'orange', label: 'Récupérée' }
  if (active.includes('draft') || active.includes('submitted')) return { tone: 'blue', label: 'En cours' }
  if (active.includes('completed')) return { tone: 'green', label: 'Clôturée' }
  return { tone: 'grey', label: 'Disponible' }
}

export function waitingLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  if (safe < 45) return "à l'instant"
  const minutes = Math.floor(safe / 60)
  if (minutes < 60) return `depuis ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `depuis ${hours} h ${minutes % 60} min`
}

export function connectionState(input: { navigatorOnline: boolean; lastError: boolean }): {
  online: boolean
  message: string | null
} {
  if (!input.navigatorOnline || input.lastError) {
    return {
      online: false,
      message: 'Connexion interrompue. Les informations peuvent ne pas être à jour.',
    }
  }
  return { online: true, message: null }
}

export type OrderItem = {
  dishId: string
  name: string
  qty: number
  unitCents: number
  supplementQty: number
  supplementLabel: string | null
  supplementCents: number
  lineCents: number
  note: string
}

const NOTE_MAX = 140
const ORDER_NOTE_MAX = 240

export function cleanNote(value: unknown, max = NOTE_MAX): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function parseCartPayload(
  raw: unknown,
): { lines: CartLine[]; note: string; clientRequestId: string } | { error: 'empty' | 'invalid' } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid' }
  const body = raw as Record<string, unknown>
  const note = cleanNote(body.note, ORDER_NOTE_MAX)
  const clientRequestId = body.clientRequestId
  if (typeof clientRequestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(clientRequestId)) {
    return { error: 'invalid' }
  }
  if (!Array.isArray(body.lines)) return { error: 'invalid' }
  if (body.lines.length === 0) return { error: 'empty' }
  if (body.lines.length > 40) return { error: 'invalid' }
  const lines: CartLine[] = []
  for (const entry of body.lines) {
    if (!entry || typeof entry !== 'object') return { error: 'invalid' }
    const row = entry as Record<string, unknown>
    if (typeof row.dishId !== 'string' || !/^[a-z0-9-]{2,48}$/.test(row.dishId)) return { error: 'invalid' }
    if (!Number.isInteger(row.qty)) return { error: 'invalid' }
    const supplementQty = Number.isInteger(row.supplementQty) ? (row.supplementQty as number) : 0
    const line: CartLine = { dishId: row.dishId, qty: row.qty as number, supplementQty }
    const itemNote = cleanNote(row.note)
    if (itemNote) line.note = itemNote
    lines.push(line)
  }
  return { lines, note, clientRequestId }
}

export function snapshotCart(lines: CartLine[], note: string): { items: OrderItem[]; totalCents: number; note: string } | { error: 'empty' } {
  const priced = priceLines(lines)
  if (priced.lines.length === 0) return { error: 'empty' }
  const notes = new Map(lines.map((line) => [line.dishId, cleanNote(line.note)]))
  return {
    note: cleanNote(note, ORDER_NOTE_MAX),
    totalCents: priced.totalCents,
    items: priced.lines.map((line) => ({
      dishId: line.dishId,
      name: line.name,
      qty: line.qty,
      unitCents: line.unitCents,
      supplementQty: line.supplementQty,
      supplementLabel: line.supplementLabel,
      supplementCents: line.supplementCents,
      lineCents: line.lineCents,
      note: notes.get(line.dishId) ?? '',
    })),
  }
}

export const PICKUP_PREFIX = 'chezpapa-pickup:v1:'
export const PICKUP_TTL_MS = 36 * 60 * 60 * 1000

export function pickupPayload(token: string): string {
  return `${PICKUP_PREFIX}${token}`
}

export function readPickupToken(value: string): string | null {
  const trimmed = value.trim()
  const raw = trimmed.startsWith(PICKUP_PREFIX) ? trimmed.slice(PICKUP_PREFIX.length) : trimmed
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(raw)) return null
  return raw
}

export function failureMessage(code: string): { status: number; message: string } {
  switch (code) {
    case 'empty':
      return { status: 400, message: 'Le panier est vide.' }
    case 'invalid':
      return { status: 400, message: 'Commande invalide.' }
    case 'invalid_table':
      return { status: 400, message: 'Cette table n’est pas ouverte.' }
    case 'unauthorized':
      return { status: 401, message: 'Accès non autorisé.' }
    case 'not_configured':
      return { status: 503, message: 'L’identifiant du restaurant n’est pas configuré.' }
    case 'bad_password':
      return { status: 401, message: 'Identifiant incorrect.' }
    case 'rate_limited':
      return { status: 429, message: 'Trop de tentatives. Réessayez dans quelques minutes.' }
    case 'not_found':
      return { status: 404, message: 'Commande introuvable.' }
    case 'invalid_qr':
      return { status: 404, message: 'QR code invalide.' }
    case 'expired_qr':
      return { status: 410, message: 'QR code expiré.' }
    case 'already_claimed':
      return { status: 409, message: 'Commande déjà récupérée.' }
    case 'cancelled':
      return { status: 409, message: 'Commande annulée.' }
    case 'session_closed':
      return { status: 409, message: 'Session de table clôturée.' }
    case 'session_busy':
      return { status: 409, message: 'Il reste une commande en cours sur cette table.' }
    case 'forbidden_transition':
      return { status: 409, message: 'Cette action n’est plus possible sur la commande.' }
    case 'unavailable':
      return { status: 503, message: 'Serveur temporairement indisponible.' }
    case 'not_saved':
      return { status: 500, message: 'La commande n’a pas été enregistrée.' }
    default:
      return { status: 400, message: 'Commande invalide.' }
  }
}
