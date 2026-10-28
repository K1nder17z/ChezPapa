export const MAX_QTY = 12

export type CartLine = {
  dishId: string
  qty: number
  supplementQty: number
  note?: string
}

export function changeQty(lines: CartLine[], dishId: string, delta: number): CartLine[] {
  const current = lines.find((line) => line.dishId === dishId)
  const qty = clamp((current?.qty ?? 0) + delta, 0, MAX_QTY)
  const supplementQty = Math.min(current?.supplementQty ?? 0, qty)
  const rest = lines.filter((line) => line.dishId !== dishId)
  if (qty === 0) return rest
  const next: CartLine = { dishId, qty, supplementQty }
  if (current?.note) next.note = current.note
  return sortLines([...rest, next])
}

export function setNote(lines: CartLine[], dishId: string, note: string): CartLine[] {
  const clean = note.replace(/\s+/g, ' ').trim().slice(0, 140)
  return lines.map((line) => {
    if (line.dishId !== dishId) return line
    if (!clean) return { dishId: line.dishId, qty: line.qty, supplementQty: line.supplementQty }
    return { ...line, note: clean }
  })
}

export function changeSupplement(lines: CartLine[], dishId: string, delta: number): CartLine[] {
  return lines.map((line) => {
    if (line.dishId !== dishId || line.qty === 0) return line
    return { ...line, supplementQty: clamp(line.supplementQty + delta, 0, line.qty) }
  })
}

export function applyCartAction(lines: CartLine[], action: string, dishId: string): CartLine[] {
  if (action === 'inc') return changeQty(lines, dishId, 1)
  if (action === 'dec') return changeQty(lines, dishId, -1)
  if (action === 'sup-inc') return changeSupplement(lines, dishId, 1)
  if (action === 'sup-dec') return changeSupplement(lines, dishId, -1)
  return lines
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function sortLines(lines: CartLine[]): CartLine[] {
  return [...lines].sort((a, b) => a.dishId.localeCompare(b.dishId))
}
