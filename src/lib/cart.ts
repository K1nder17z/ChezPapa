export const MAX_QTY = 12

export type CartLine = {
  dishId: string
  qty: number
  supplementQty: number
}

export function changeQty(lines: CartLine[], dishId: string, delta: number): CartLine[] {
  const current = lines.find((line) => line.dishId === dishId)
  const qty = clamp((current?.qty ?? 0) + delta, 0, MAX_QTY)
  const supplementQty = Math.min(current?.supplementQty ?? 0, qty)
  const rest = lines.filter((line) => line.dishId !== dishId)
  if (qty === 0) return rest
  return sortLines([...rest, { dishId, qty, supplementQty }])
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
