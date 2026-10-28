import type { OrderItem, OrderStatus, Tone } from '../lib/ordering/domain.ts'

export type ClientOrder = {
  id: string
  publicNumber: string
  tableNumber: number
  sessionId: string
  status: OrderStatus
  items: OrderItem[]
  note: string
  totalCents: number
  createdAt: string
  readyAt: string | null
  claimedAt: string | null
  pickupToken: string | null
  qrPayload: string | null
}

export type StaffOrder = {
  id: string
  publicNumber: string
  tableNumber: number
  sessionId: string
  status: OrderStatus
  items: OrderItem[]
  note: string
  totalCents: number
  paid: boolean
  createdAt: string
  submittedAt: string | null
  readyAt: string | null
  claimedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  waitingSeconds: number | null
  history: Array<{ fromStatus: OrderStatus | null; toStatus: OrderStatus; at: string; actor: string }>
  recoverable: boolean
}

export type BoardOrder = {
  id: string
  publicNumber: string
  status: OrderStatus
  totalCents: number
  itemCount: number
  paid: boolean
  readyAt: string | null
  waitingSeconds: number | null
  createdAt: string
}

export type BoardTable = {
  number: number
  tone: Tone
  label: string
  sessionId: string | null
  sessionOpenedAt: string | null
  orders: BoardOrder[]
  action: 'Voir' | 'Scanner'
}

export type BoardAlert = {
  orderId: string
  tableNumber: number
  publicNumber: string
  waitingSeconds: number
}

export type Board = {
  serverTime: string
  tableCount: number
  tables: BoardTable[]
  alerts: BoardAlert[]
}

export type HistoryRow = {
  id: string
  publicNumber: string
  tableNumber: number
  status: OrderStatus
  totalCents: number
  createdAt: string
  claimedAt: string | null
  completedAt: string | null
}

export type StoreFailure = { ok: false; code: string }

export type StoreSuccess<T> = { ok: true; value: T }

export type StoreResult<T> = StoreSuccess<T> | StoreFailure

export interface OrderStore {
  kind: 'memory' | 'supabase'
  openDevice(tableNumber: number, deviceToken: string | null): Promise<StoreResult<{ deviceToken: string; tableNumber: number; sessionId: string }>>
  clientOrders(deviceToken: string): Promise<StoreResult<{ tableNumber: number; sessionStatus: 'open' | 'closed'; orders: ClientOrder[] }>>
  submit(deviceToken: string, body: unknown): Promise<StoreResult<ClientOrder>>
  ready(deviceToken: string, orderId: string): Promise<StoreResult<ClientOrder>>
  confirm(staffToken: string, orderId: string): Promise<StoreResult<StaffOrder>>
  amend(staffToken: string, orderId: string, body: unknown): Promise<StoreResult<StaffOrder>>
  login(password: string, ip: string): Promise<StoreResult<{ token: string }>>
  logout(staffToken: string): Promise<StoreResult<{ done: true }>>
  board(staffToken: string, nowMs: number): Promise<StoreResult<Board>>
  order(staffToken: string, orderId: string, nowMs: number): Promise<StoreResult<StaffOrder>>
  verify(staffToken: string, pickup: string, nowMs: number): Promise<StoreResult<StaffOrder>>
  claim(staffToken: string, pickup: string, nowMs: number): Promise<StoreResult<StaffOrder>>
  complete(staffToken: string, orderId: string): Promise<StoreResult<StaffOrder>>
  cancel(staffToken: string, orderId: string): Promise<StoreResult<StaffOrder>>
  pay(staffToken: string, orderId: string): Promise<StoreResult<StaffOrder>>
  closeSession(staffToken: string, sessionId: string): Promise<StoreResult<{ sessionId: string }>>
  reopenTable(staffToken: string, tableNumber: number): Promise<StoreResult<{ sessionId: string }>>
  setTableCount(staffToken: string, count: number): Promise<StoreResult<{ tableCount: number }>>
  history(staffToken: string): Promise<StoreResult<HistoryRow[]>>
  tableCount(): Promise<number>
}
