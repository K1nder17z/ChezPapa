import type { CartLine } from './cart.ts'

export type OrderStatus = 'attente' | 'en_cours' | 'pause' | 'annulee' | 'terminee'

export type SalleOrder = {
  code: string
  lines: CartLine[]
  tableLabel: string | null
  status: OrderStatus
  paid: boolean
  createdAt: string
  updatedAt: string
}

export type SalleAction = 'start' | 'pause' | 'cancel' | 'finish' | 'pay'

export const statusLabel: Record<OrderStatus, string> = {
  attente: 'En attente',
  en_cours: 'En cours',
  pause: 'En pause',
  annulee: 'Annulée',
  terminee: 'Terminée',
}

export function rememberOrder(
  orders: SalleOrder[],
  code: string,
  lines: CartLine[],
  now: string,
): SalleOrder[] {
  if (orders.some((order) => order.code === code)) return orders
  return [
    {
      code,
      lines,
      tableLabel: null,
      status: 'attente',
      paid: false,
      createdAt: now,
      updatedAt: now,
    },
    ...orders,
  ]
}

export function assignTable(order: SalleOrder, tableLabel: string, now: string): SalleOrder {
  const label = tableLabel.trim().slice(0, 40)
  if (!label) return order
  return { ...order, tableLabel: label, updatedAt: now }
}

export function applySalleAction(order: SalleOrder, action: SalleAction, now: string): SalleOrder {
  if (action === 'pay') {
    if (order.paid || order.status === 'annulee') return order
    return { ...order, paid: true, updatedAt: now }
  }
  if (order.status === 'annulee' || order.status === 'terminee') return order
  if (action === 'start' && (order.status === 'attente' || order.status === 'pause')) {
    return { ...order, status: 'en_cours', updatedAt: now }
  }
  if (action === 'pause' && order.status === 'en_cours') {
    return { ...order, status: 'pause', updatedAt: now }
  }
  if (action === 'cancel') return { ...order, status: 'annulee', updatedAt: now }
  if (action === 'finish' && (order.status === 'en_cours' || order.status === 'pause')) {
    return { ...order, status: 'terminee', updatedAt: now }
  }
  return order
}
