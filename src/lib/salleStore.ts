import { useSyncExternalStore } from 'react'
import type { CartLine } from './cart.ts'
import {
  applySalleAction,
  assignTable,
  rememberOrder,
  type SalleAction,
  type SalleOrder,
} from './salle.ts'

const ORDERS_KEY = 'chezpapa-salle-orders'
const SESSION_KEY = 'chezpapa-salle-session'

let orders = readOrders()
const listeners = new Set<() => void>()

function readOrders(): SalleOrder[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOrder)
  } catch {
    return []
  }
}

function isOrder(value: unknown): value is SalleOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as SalleOrder
  return typeof order.code === 'string' && Array.isArray(order.lines) && typeof order.status === 'string'
}

function emit(next: SalleOrder[]) {
  orders = next
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  } catch {
    /* navigation privée */
  }
  listeners.forEach((listener) => listener())
}

export function getSalleOrders(): SalleOrder[] {
  return orders
}

export function subscribeSalle(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSalleOrders(): SalleOrder[] {
  return useSyncExternalStore(subscribeSalle, getSalleOrders, getSalleOrders)
}

export function ensureSalleOrder(code: string, lines: CartLine[]): SalleOrder | null {
  const next = rememberOrder(orders, code, lines, new Date().toISOString())
  if (next !== orders) emit(next)
  return next.find((order) => order.code === code) ?? null
}

export function saveSalleTable(code: string, tableLabel: string) {
  const now = new Date().toISOString()
  emit(orders.map((order) => (order.code === code ? assignTable(order, tableLabel, now) : order)))
}

export function runSalleAction(code: string, action: SalleAction) {
  const now = new Date().toISOString()
  emit(orders.map((order) => (order.code === code ? applySalleAction(order, action, now) : order)))
}

export function salleCode(): string {
  return (import.meta.env.VITE_SALLE_CODE ?? '').trim()
}

export function isSalleUnlocked(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === '1' && salleCode().length > 0
  } catch {
    return false
  }
}

export function unlockSalle(input: string): boolean {
  const expected = salleCode()
  if (!expected || input.trim() !== expected) return false
  try {
    localStorage.setItem(SESSION_KEY, '1')
  } catch {
    return false
  }
  return true
}

export function lockSalle() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
