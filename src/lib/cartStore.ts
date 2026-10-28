import { useSyncExternalStore } from 'react'
import { applyCartAction, setNote, type CartLine } from './cart.ts'

const KEY = 'chezpapa-cart'

let lines = readCart()
const listeners = new Set<() => void>()

function readCart(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const dishId = 'dishId' in entry ? entry.dishId : ''
      const qty = 'qty' in entry ? entry.qty : 0
      const supplementQty = 'supplementQty' in entry ? entry.supplementQty : 0
      const note = 'note' in entry && typeof entry.note === 'string' ? entry.note.trim().slice(0, 140) : ''
      if (typeof dishId !== 'string' || !Number.isInteger(qty) || qty <= 0) return []
      const line: CartLine = { dishId, qty, supplementQty: Number.isInteger(supplementQty) ? supplementQty : 0 }
      if (note) line.note = note
      return [line]
    })
  } catch {
    return []
  }
}

function emit(next: CartLine[]) {
  lines = next
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    /* navigation privée */
  }
  listeners.forEach((listener) => listener())
}

export function getCartLines(): CartLine[] {
  return lines
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCartLines(): CartLine[] {
  return useSyncExternalStore(subscribeCart, getCartLines, getCartLines)
}

export function dispatchCart(action: string, dishId: string) {
  emit(applyCartAction(lines, action, dishId))
}

export function setCartNote(dishId: string, note: string) {
  emit(setNote(lines, dishId, note))
}

export function clearCart() {
  emit([])
}

export function installCartClicks(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button[data-cart]')
    if (!(button instanceof HTMLButtonElement) || button.disabled) return
    const dishId = button.dataset.dish
    const action = button.dataset.cart
    if (!dishId || !action) return
    event.preventDefault()
    event.stopPropagation()
    dispatchCart(action, dishId)
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
