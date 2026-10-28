import {
  PICKUP_TTL_MS,
  canTransition,
  orderWaitSeconds,
  parseCartPayload,
  parseStaffCart,
  pickupPayload,
  readPickupToken,
  serviceTone,
  snapshotCart,
  type OrderItem,
  type OrderStatus,
} from '../lib/ordering/domain.ts'
import { decryptSecret, encryptSecret, hashPassword, issueStaffToken, randomToken, sha256Hex, verifyPassword, verifyStaffToken } from './crypto.ts'
import type {
  Board,
  BoardOrder,
  ClientOrder,
  HistoryRow,
  OrderStore,
  StaffOrder,
  StoreResult,
} from './contracts.ts'

type Session = {
  id: string
  tableNumber: number
  status: 'open' | 'closed'
  openedAt: string
  closedAt: string | null
}

type Device = {
  id: string
  sessionId: string
  tableNumber: number
  tokenHash: string
}

type History = {
  orderId: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  at: string
  actor: string
}

type Order = {
  id: string
  publicNumber: string
  tableNumber: number
  sessionId: string
  deviceId: string
  status: OrderStatus
  items: OrderItem[]
  note: string
  totalCents: number
  clientRequestId: string
  pickupTokenHash: string | null
  pickupTokenEnc: string | null
  pickupStatus: 'active' | 'consumed' | 'revoked' | null
  pickupExpiresAt: string | null
  paidAt: string | null
  createdAt: string
  submittedAt: string | null
  readyAt: string | null
  claimedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

type User = { id: string; passwordHash: string }

type StaffSession = { tokenHash: string; userId: string; expiresAt: string }

const STAFF_TTL_MS = 180 * 24 * 60 * 60 * 1000

export function createMemoryStore(options: { staffPassword: string; tokenKey: string; tableCount?: number }): OrderStore {
  let tableCount = options.tableCount ?? 10
  const sessions: Session[] = []
  const devices: Device[] = []
  const orders: Order[] = []
  const history: History[] = []
  const users: User[] = []
  const staffSessions: StaffSession[] = []
  let seq = 1000
  const attempts = new Map<string, { count: number; resetAt: number }>()

  function nowIso(): string {
    return new Date().toISOString()
  }

  function fail(code: string): StoreResult<never> {
    return { ok: false, code }
  }

  function openSession(tableNumber: number): Session | undefined {
    return sessions.find((session) => session.tableNumber === tableNumber && session.status === 'open')
  }

  async function deviceFromToken(token: string | null): Promise<Device | null> {
    if (!token?.startsWith('dev_')) return null
    const hash = await sha256Hex(token)
    return devices.find((device) => device.tokenHash === hash) ?? null
  }

  async function staffFromToken(token: string): Promise<StaffSession | null> {
    if (!token.startsWith('stf_')) return null
    if (options.staffPassword && (await verifyStaffToken(token, options.staffPassword))) {
      return { tokenHash: 'signed', userId: 'restaurant', expiresAt: new Date(Date.now() + STAFF_TTL_MS).toISOString() }
    }
    const hash = await sha256Hex(token)
    const session = staffSessions.find((item) => item.tokenHash === hash)
    if (!session) return null
    if (Date.parse(session.expiresAt) < Date.now()) return null
    return session
  }

  function sessionOf(device: Device): Session | undefined {
    return sessions.find((session) => session.id === device.sessionId)
  }

  function pushHistory(order: Order, from: OrderStatus | null, actor: string) {
    history.push({ orderId: order.id, fromStatus: from, toStatus: order.status, at: nowIso(), actor })
  }

  async function clientView(order: Order): Promise<ClientOrder> {
    let pickupToken: string | null = null
    if (order.status === 'ready_for_pickup' && order.pickupStatus === 'active' && order.pickupTokenEnc) {
      if (!order.pickupExpiresAt || Date.parse(order.pickupExpiresAt) >= Date.now()) {
        pickupToken = await decryptSecret(order.pickupTokenEnc, options.tokenKey)
      }
    }
    return {
      id: order.id,
      publicNumber: order.publicNumber,
      tableNumber: order.tableNumber,
      sessionId: order.sessionId,
      status: order.status,
      items: order.items,
      note: order.note,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      readyAt: order.readyAt,
      claimedAt: order.claimedAt,
      pickupToken,
      qrPayload: pickupToken ? pickupPayload(pickupToken) : null,
    }
  }

  function staffView(order: Order, nowMs: number): StaffOrder {
    const waiting = orderWaitSeconds(order.status, order.submittedAt, order.readyAt, nowMs)
    const recoverable =
      order.status === 'ready_for_pickup' &&
      order.pickupStatus === 'active' &&
      (!order.pickupExpiresAt || Date.parse(order.pickupExpiresAt) >= nowMs)
    return {
      id: order.id,
      publicNumber: order.publicNumber,
      tableNumber: order.tableNumber,
      sessionId: order.sessionId,
      status: order.status,
      items: order.items,
      note: order.note,
      totalCents: order.totalCents,
      paid: Boolean(order.paidAt),
      createdAt: order.createdAt,
      submittedAt: order.submittedAt,
      readyAt: order.readyAt,
      claimedAt: order.claimedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      waitingSeconds: waiting,
      recoverable,
      history: history
        .filter((entry) => entry.orderId === order.id)
        .map((entry) => ({
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          at: entry.at,
          actor: entry.actor,
        })),
    }
  }

  async function findByPickup(pickup: string): Promise<{ order: Order; token: string } | { error: string }> {
    const token = readPickupToken(pickup)
    if (!token) return { error: 'invalid_qr' }
    const hash = await sha256Hex(token)
    const order = orders.find((item) => item.pickupTokenHash === hash)
    if (!order) return { error: 'invalid_qr' }
    return { order, token }
  }

  function pickupBlock(order: Order, nowMs: number): string | null {
    if (order.status === 'cancelled' || order.pickupStatus === 'revoked') return 'cancelled'
    if (order.pickupExpiresAt && Date.parse(order.pickupExpiresAt) < nowMs) return 'expired_qr'
    if (order.status !== 'ready_for_pickup' || order.pickupStatus !== 'active') return 'already_claimed'
    return null
  }

  function pending(sessionId: string): boolean {
    return orders.some(
      (order) =>
        order.sessionId === sessionId && (order.status === 'submitted' || order.status === 'ready_for_pickup'),
    )
  }

  function ensureOpen(tableNumber: number): Session {
    const existing = openSession(tableNumber)
    if (existing) return existing
    const session: Session = {
      id: crypto.randomUUID(),
      tableNumber,
      status: 'open',
      openedAt: nowIso(),
      closedAt: null,
    }
    sessions.push(session)
    return session
  }

  const store: OrderStore = {
    kind: 'memory',
    async tableCount() {
      return tableCount
    },
    async openDevice(tableNumber, deviceToken, renew = false) {
      if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > tableCount) return fail('invalid_table')
      const known = await deviceFromToken(deviceToken)
      if (known && known.tableNumber === tableNumber && deviceToken) {
        const session = sessionOf(known)
        if (session?.status === 'open') {
          return { ok: true, value: { deviceToken, tableNumber, sessionId: session.id } }
        }
        if (!renew) return fail('session_closed')
      }
      const session = ensureOpen(tableNumber)
      const token = randomToken('dev')
      devices.push({
        id: crypto.randomUUID(),
        sessionId: session.id,
        tableNumber,
        tokenHash: await sha256Hex(token),
      })
      return { ok: true, value: { deviceToken: token, tableNumber, sessionId: session.id } }
    },
    async clientOrders(deviceToken) {
      const device = await deviceFromToken(deviceToken)
      if (!device) return fail('unauthorized')
      const session = sessionOf(device)
      if (!session) return fail('unauthorized')
      const shared = orders.filter((order) => order.sessionId === device.sessionId)
      const views: ClientOrder[] = []
      for (const order of shared) views.push(await clientView(order))
      return {
        ok: true,
        value: { tableNumber: device.tableNumber, sessionStatus: session.status, orders: views },
      }
    },
    async submit(deviceToken, body) {
      const device = await deviceFromToken(deviceToken)
      if (!device) return fail('unauthorized')
      const session = sessionOf(device)
      if (!session || session.status !== 'open') return fail('session_closed')
      const parsed = parseCartPayload(body)
      if ('error' in parsed) return fail(parsed.error)
      const existing = orders.find(
        (order) => order.deviceId === device.id && order.clientRequestId === parsed.clientRequestId,
      )
      if (existing) return { ok: true, value: await clientView(existing) }
      const snapshot = snapshotCart(parsed.lines, parsed.note)
      if ('error' in snapshot) return fail('empty')
      seq += 1
      const created = nowIso()
      const order: Order = {
        id: crypto.randomUUID(),
        publicNumber: `CP-${String(seq).padStart(4, '0')}`,
        tableNumber: device.tableNumber,
        sessionId: session.id,
        deviceId: device.id,
        status: 'submitted',
        items: snapshot.items,
        note: snapshot.note,
        totalCents: snapshot.totalCents,
        clientRequestId: parsed.clientRequestId,
        pickupTokenHash: null,
        pickupTokenEnc: null,
        pickupStatus: null,
        pickupExpiresAt: null,
        paidAt: null,
        createdAt: created,
        submittedAt: created,
        readyAt: null,
        claimedAt: null,
        completedAt: null,
        cancelledAt: null,
      }
      orders.push(order)
      pushHistory(order, null, 'client')
      return { ok: true, value: await clientView(order) }
    },
    async ready(deviceToken, orderId) {
      const device = await deviceFromToken(deviceToken)
      if (!device) return fail('unauthorized')
      const order = orders.find((item) => item.id === orderId && item.deviceId === device.id)
      if (!order) return fail('not_found')
      if (order.status === 'cancelled') return fail('cancelled')
      if (order.status === 'claimed' || order.status === 'completed') return fail('already_claimed')
      if (order.status === 'ready_for_pickup') {
        const expired = order.pickupExpiresAt ? Date.parse(order.pickupExpiresAt) < Date.now() : false
        if (!expired && order.pickupStatus === 'active') return { ok: true, value: await clientView(order) }
      } else if (!canTransition(order.status, 'ready_for_pickup')) {
        return fail('forbidden_transition')
      }
      const previous = order.status
      const token = randomToken('pk')
      order.status = 'ready_for_pickup'
      order.pickupStatus = 'active'
      order.pickupTokenHash = await sha256Hex(token)
      order.pickupTokenEnc = await encryptSecret(token, options.tokenKey)
      order.pickupExpiresAt = new Date(Date.now() + PICKUP_TTL_MS).toISOString()
      order.readyAt = order.readyAt ?? nowIso()
      if (previous !== 'ready_for_pickup') pushHistory(order, previous, 'client')
      return { ok: true, value: await clientView(order) }
    },
    async login(password, ip) {
      const key = ip || 'local'
      const current = attempts.get(key)
      if (current && current.resetAt > Date.now() && current.count >= 8) return fail('rate_limited')
      if (!options.staffPassword && users.length === 0) return fail('not_configured')
      let user = users[0]
      if (!user) {
        if (!options.staffPassword || password !== options.staffPassword) {
          noteFailure(key)
          return fail(options.staffPassword ? 'bad_password' : 'not_configured')
        }
        user = { id: crypto.randomUUID(), passwordHash: await hashPassword(password) }
        users.push(user)
      } else if (!(await verifyPassword(password, user.passwordHash))) {
        noteFailure(key)
        return fail('bad_password')
      }
      attempts.delete(key)
      const token = options.staffPassword ? await issueStaffToken(options.staffPassword) : randomToken('stf')
      staffSessions.push({
        tokenHash: await sha256Hex(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + STAFF_TTL_MS).toISOString(),
      })
      return { ok: true, value: { token } }
    },
    async logout(staffToken) {
      const session = await staffFromToken(staffToken)
      if (!session) return fail('unauthorized')
      const index = staffSessions.indexOf(session)
      if (index >= 0) staffSessions.splice(index, 1)
      return { ok: true, value: { done: true } }
    },
    async board(staffToken, nowMs) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const tables = []
      const alerts = []
      for (let number = 1; number <= tableCount; number += 1) {
        const session = openSession(number)
        const sessionOrders = session ? orders.filter((order) => order.sessionId === session.id) : []
        const visible = sessionOrders.filter((order) => order.status !== 'draft' && order.status !== 'cancelled')
        const presentation = serviceTone(
          visible.map((order) => ({ status: order.status, paid: Boolean(order.paidAt) })),
          Boolean(session),
        )
        const cards: BoardOrder[] = visible.map((order) => ({
          id: order.id,
          publicNumber: order.publicNumber,
          status: order.status,
          totalCents: order.totalCents,
          itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
          paid: Boolean(order.paidAt),
          readyAt: order.readyAt,
          waitingSeconds: orderWaitSeconds(order.status, order.submittedAt, order.readyAt, nowMs),
          createdAt: order.createdAt,
        }))
        tables.push({
          number,
          tone: presentation.tone,
          label: presentation.label,
          sessionId: session?.id ?? null,
          sessionOpenedAt: session?.openedAt ?? null,
          orders: cards,
          action: 'Voir' as const,
        })
        for (const order of visible) {
          const waiting = orderWaitSeconds(order.status, order.submittedAt, order.readyAt, nowMs)
          if (waiting == null) continue
          alerts.push({
            orderId: order.id,
            tableNumber: number,
            publicNumber: order.publicNumber,
            waitingSeconds: waiting,
          })
        }
      }
      return {
        ok: true,
        value: { serverTime: new Date(nowMs).toISOString(), tableCount, tables, alerts } satisfies Board,
      }
    },
    async order(staffToken, orderId, nowMs) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const order = orders.find((item) => item.id === orderId)
      if (!order) return fail('not_found')
      return { ok: true, value: staffView(order, nowMs) }
    },
    async verify(staffToken, pickup, nowMs) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const found = await findByPickup(pickup)
      if ('error' in found) return fail(found.error)
      const blocked = pickupBlock(found.order, nowMs)
      if (blocked) return fail(blocked)
      return { ok: true, value: staffView(found.order, nowMs) }
    },
    async claim(staffToken, pickup, nowMs) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const found = await findByPickup(pickup)
      if ('error' in found) return fail(found.error)
      const blocked = pickupBlock(found.order, nowMs)
      if (blocked) return fail(blocked)
      const order = found.order
      if (!canTransition(order.status, 'claimed')) return fail('forbidden_transition')
      const previous = order.status
      order.status = 'claimed'
      order.pickupStatus = 'consumed'
      order.claimedAt = nowIso()
      pushHistory(order, previous, 'staff')
      return { ok: true, value: staffView(order, nowMs) }
    },
    async confirm(staffToken, orderId) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const order = orders.find((item) => item.id === orderId)
      if (!order) return fail('not_found')
      if (order.status === 'claimed') return { ok: true, value: staffView(order, Date.now()) }
      if (!canTransition(order.status, 'claimed')) return fail('forbidden_transition')
      const previous = order.status
      order.status = 'claimed'
      order.claimedAt = nowIso()
      if (order.pickupStatus === 'active') order.pickupStatus = 'consumed'
      pushHistory(order, previous, 'staff')
      return { ok: true, value: staffView(order, Date.now()) }
    },
    async amend(staffToken, orderId, body) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const order = orders.find((item) => item.id === orderId)
      if (!order) return fail('not_found')
      if (order.status !== 'submitted' && order.status !== 'ready_for_pickup' && order.status !== 'claimed') {
        return fail('forbidden_transition')
      }
      const parsed = parseStaffCart(body)
      if ('error' in parsed) return fail(parsed.error)
      const snapshot = snapshotCart(parsed.lines, parsed.note)
      if ('error' in snapshot) return fail(snapshot.error)
      order.items = snapshot.items
      order.note = snapshot.note
      order.totalCents = snapshot.totalCents
      return { ok: true, value: staffView(order, Date.now()) }
    },
    async complete(staffToken, orderId) {
      return changeStatus(staffToken, orderId, 'completed')
    },
    async cancel(staffToken, orderId) {
      return changeStatus(staffToken, orderId, 'cancelled')
    },
    async pay(staffToken, orderId) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const order = orders.find((item) => item.id === orderId)
      if (!order) return fail('not_found')
      if (order.status === 'cancelled') return fail('cancelled')
      order.paidAt = order.paidAt ?? nowIso()
      return { ok: true, value: staffView(order, Date.now()) }
    },
    async closeSession(staffToken, sessionId) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const session = sessions.find((item) => item.id === sessionId)
      if (!session || session.status !== 'open') return fail('not_found')
      if (pending(session.id)) return fail('session_busy')
      for (const order of orders) {
        if (order.sessionId !== session.id || order.status !== 'claimed') continue
        const previous = order.status
        order.status = 'completed'
        order.completedAt = nowIso()
        pushHistory(order, previous, 'staff')
      }
      session.status = 'closed'
      session.closedAt = nowIso()
      return { ok: true, value: { sessionId: session.id } }
    },
    async reopenTable(staffToken, tableNumber) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > tableCount) return fail('invalid_table')
      const current = openSession(tableNumber)
      if (current) {
        if (pending(current.id)) return fail('session_busy')
        current.status = 'closed'
        current.closedAt = nowIso()
      }
      const session = ensureOpen(tableNumber)
      return { ok: true, value: { sessionId: session.id } }
    },
    async setTableCount(staffToken, count) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      if (!Number.isInteger(count) || count < 1 || count > 200) return fail('invalid')
      tableCount = count
      return { ok: true, value: { tableCount } }
    },
    async history(staffToken) {
      if (!(await staffFromToken(staffToken))) return fail('unauthorized')
      const rows: HistoryRow[] = orders
        .filter((order) => order.status === 'claimed' || order.status === 'completed' || order.status === 'cancelled')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200)
        .map((order) => ({
          id: order.id,
          publicNumber: order.publicNumber,
          tableNumber: order.tableNumber,
          status: order.status,
          totalCents: order.totalCents,
          createdAt: order.createdAt,
          claimedAt: order.claimedAt,
          completedAt: order.completedAt,
        }))
      return { ok: true, value: rows }
    },
  }

  async function changeStatus(staffToken: string, orderId: string, status: 'completed' | 'cancelled'): Promise<StoreResult<StaffOrder>> {
    if (!(await staffFromToken(staffToken))) return fail('unauthorized')
    const order = orders.find((item) => item.id === orderId)
    if (!order) return fail('not_found')
    if (!canTransition(order.status, status)) return fail('forbidden_transition')
    const previous = order.status
    order.status = status
    if (status === 'completed') order.completedAt = nowIso()
    if (status === 'cancelled') {
      order.cancelledAt = nowIso()
      order.pickupStatus = order.pickupTokenHash ? 'revoked' : order.pickupStatus
    }
    pushHistory(order, previous, 'staff')
    return { ok: true, value: staffView(order, Date.now()) }
  }

  function noteFailure(key: string) {
    const current = attempts.get(key)
    const resetAt = Date.now() + 10 * 60 * 1000
    if (!current || current.resetAt < Date.now()) attempts.set(key, { count: 1, resetAt })
    else current.count += 1
  }

  return store
}
