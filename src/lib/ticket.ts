import { allDishes } from '../data/menu.ts'
import { MAX_QTY, type CartLine } from './cart.ts'

export type PricedLine = {
  dishId: string
  name: string
  qty: number
  unitCents: number
  supplementQty: number
  supplementLabel: string | null
  supplementCents: number
  lineCents: number
}

const MAX_CODE_LENGTH = 1800

export function priceLines(lines: CartLine[]): { lines: PricedLine[]; totalCents: number } {
  const catalog = new Map(allDishes().map((dish) => [dish.id, dish]))
  const priced: PricedLine[] = []
  for (const line of lines) {
    const dish = catalog.get(line.dishId)
    if (!dish?.available) continue
    const qty = clampInt(line.qty, 0, MAX_QTY)
    if (qty === 0) continue
    const supplement = dish.supplement
    const supplementQty = supplement ? clampInt(line.supplementQty, 0, qty) : 0
    const supplementCents = supplement?.priceCents ?? 0
    priced.push({
      dishId: dish.id,
      name: dish.name,
      qty,
      unitCents: dish.priceCents,
      supplementQty,
      supplementLabel: supplementQty > 0 ? (supplement?.label ?? null) : null,
      supplementCents,
      lineCents: qty * dish.priceCents + supplementQty * supplementCents,
    })
  }
  return {
    lines: priced,
    totalCents: priced.reduce((sum, line) => sum + line.lineCents, 0),
  }
}

export function encodeTicket(lines: CartLine[]): string {
  const priced = priceLines(lines).lines
  if (priced.length === 0) return ''
  const compact = priced.map((line) =>
    line.supplementQty > 0 ? [line.dishId, line.qty, line.supplementQty] : [line.dishId, line.qty],
  )
  return toBase64Url(JSON.stringify(compact))
}

export function decodeTicket(code: string): CartLine[] | null {
  if (!code || code.length > MAX_CODE_LENGTH) return null
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(code))
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 40) return null
    const lines: CartLine[] = []
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) return null
      const [dishId, qty, supplement] = entry
      if (typeof dishId !== 'string' || !/^[a-z0-9-]{2,48}$/.test(dishId)) return null
      if (!Number.isInteger(qty) || !Number.isInteger(supplement ?? 0)) return null
      lines.push({
        dishId,
        qty: clampInt(qty, 0, MAX_QTY),
        supplementQty: clampInt(supplement ?? 0, 0, MAX_QTY),
      })
    }
    const priced = priceLines(lines)
    if (priced.lines.length === 0) return null
    return priced.lines.map((line) => ({
      dishId: line.dishId,
      qty: line.qty,
      supplementQty: line.supplementQty,
    }))
  } catch {
    return null
  }
}

export function ticketUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/service/${code}`
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): string {
  const pad = (4 - (value.length % 4)) % 4
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
