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
import type {
  Board,
  ClientOrder,
  HistoryRow,
  OrderStore,
  StaffOrder,
  StoreResult,
} from './contracts.ts'
import { decryptSecret, encryptSecret, hashPassword, issueStaffToken, randomToken, sha256Hex, verifyPassword, verifyStaffToken } from './crypto.ts'

type Config = { url: string; serviceKey: string; tokenKey: string; staffPassword: string }

type ItemRow = {
  position: number
  dish_id: string
  name: string
  qty: number
  unit_cents: number
  supplement_qty: number
  supplement_label: string | null
  supplement_cents: number
  line_cents: number
  note: string
}

type OrderRow = {
  id: string
  public_number: string
  table_number: number
  session_id: string
  device_id: string
  status: OrderStatus
  note: string
  total_cents: number
  client_request_id: string
  pickup_token_hash: string | null
  pickup_token_enc: string | null
  pickup_status: 'active' | 'consumed' | 'revoked' | null
  pickup_expires_at: string | null
  paid_at: string | null
  created_at: string
  submitted_at: string | null
  ready_at: string | null
  claimed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  order_items?: ItemRow[]
}

type DeviceRow = { id: string; session_id: string; table_number: number; token_hash: string }
type SessionRow = { id: string; table_number: number; status: 'open' | 'closed'; opened_at: string; closed_at: string | null }
type HistoryDb = { from_status: OrderStatus | null; to_status: OrderStatus; actor: string | null; created_at: string }

const STAFF_TTL_MS = 180 * 24 * 60 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

export function createSupabaseStore(config: Config): OrderStore {
  const base = `${config.url.replace(/\/$/, '')}/rest/v1`

  async function call<T>(path: string, init: RequestInit = {}, prefer?: string): Promise<{ status: number; data: T }> {
    const headers = new Headers(init.headers)
    headers.set('apikey', config.serviceKey)
    headers.set('authorization', `Bearer ${config.serviceKey}`)
    headers.set('user-agent', 'chezpapa-server')
    if (init.body) headers.set('content-type', 'application/json')
    if (prefer) headers.set('prefer', prefer)
    const response = await fetch(`${base}/${path}`, { ...init, headers })
    const text = await response.text()
    const data = text ? (JSON.parse(text) as T) : (null as T)
    if (!response.ok) {
      const code = data && typeof data === 'object' && 'code' in data ? String((data as { code: string }).code) : ''
      const error = new Error(code || `http_${response.status}`) as Error & { status: number; pg: string }
      error.status = response.status
      error.pg = code
      throw error
    }
    return { status: response.status, data }
  }

  function fail(code: string): StoreResult<never> {
    return { ok: false, code }
  }

  function itemsOf(row: OrderRow): OrderItem[] {
    return [...(row.order_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        dishId: item.dish_id,
        name: item.name,
        qty: item.qty,
        unitCents: item.unit_cents,
        supplementQty: item.supplement_qty,
        supplementLabel: item.supplement_label,
        supplementCents: item.supplement_cents,
        lineCents: item.line_cents,
        note: item.note,
      }))
  }

  async function clientView(row: OrderRow): Promise<ClientOrder> {
    let pickupToken: string | null = null
    if (row.status === 'ready_for_pickup' && row.pickup_status === 'active' && row.pickup_token_enc) {
      if (!row.pickup_expires_at || Date.parse(row.pickup_expires_at) >= Date.now()) {
        pickupToken = await decryptSecret(row.pickup_token_enc, config.tokenKey)
      }
    }
    return {
      id: row.id,
      publicNumber: row.public_number,
      tableNumber: row.table_number,
      sessionId: row.session_id,
      status: row.status,
      items: itemsOf(row),
      note: row.note,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      readyAt: row.ready_at,
      claimedAt: row.claimed_at,
      pickupToken,
      qrPayload: pickupToken ? pickupPayload(pickupToken) : null,
    }
  }

  async function staffView(row: OrderRow, nowMs: number): Promise<StaffOrder> {
    const { data } = await call<HistoryDb[]>(
      `order_status_history?order_id=eq.${row.id}&select=from_status,to_status,actor,created_at&order=created_at.asc`,
    )
    const waiting = orderWaitSeconds(row.status, row.submitted_at, row.ready_at, nowMs)
    return {
      id: row.id,
      publicNumber: row.public_number,
      tableNumber: row.table_number,
      sessionId: row.session_id,
      status: row.status,
      items: itemsOf(row),
      note: row.note,
      totalCents: row.total_cents,
      paid: Boolean(row.paid_at),
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      readyAt: row.ready_at,
      claimedAt: row.claimed_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      waitingSeconds: waiting,
      recoverable:
        row.status === 'ready_for_pickup' &&
        row.pickup_status === 'active' &&
        (!row.pickup_expires_at || Date.parse(row.pickup_expires_at) >= nowMs),
      history: (data ?? []).map((entry) => ({
        fromStatus: entry.from_status,
        toStatus: entry.to_status,
        at: entry.created_at,
        actor: entry.actor ?? '',
      })),
    }
  }

  async function deviceByToken(token: string | null): Promise<DeviceRow | null> {
    if (!token?.startsWith('dev_')) return null
    const hash = await sha256Hex(token)
    const { data } = await call<DeviceRow[]>(`table_devices?token_hash=eq.${hash}&select=id,session_id,table_number,token_hash&limit=1`)
    return data[0] ?? null
  }

  async function sessionById(id: string): Promise<SessionRow | null> {
    const { data } = await call<SessionRow[]>(`table_sessions?id=eq.${id}&select=id,table_number,status,opened_at,closed_at&limit=1`)
    return data[0] ?? null
  }

  async function requireStaff(token: string): Promise<boolean> {
    if (!token.startsWith('stf_')) return false
    if (config.staffPassword && (await verifyStaffToken(token, config.staffPassword))) return true
    const hash = await sha256Hex(token)
    const { data } = await call<Array<{ expires_at: string }>>(
      `staff_sessions?token_hash=eq.${hash}&select=expires_at&limit=1`,
    )
    const session = data[0]
    return Boolean(session && Date.parse(session.expires_at) >= Date.now())
  }

  async function countTables(): Promise<number> {
    const { data } = await call<Array<{ table_count: number }>>('restaurant_settings?id=eq.1&select=table_count&limit=1')
    return data[0]?.table_count ?? 10
  }

  async function ensureTable(number: number) {
    const { data } = await call<Array<{ number: number }>>(`restaurant_tables?number=eq.${number}&select=number&limit=1`)
    if (data[0]) return
    await call('restaurant_tables', { method: 'POST', body: JSON.stringify({ number, label: `Table ${number}` }) }, 'return=minimal')
  }

  async function ensureOpen(tableNumber: number): Promise<SessionRow> {
    const { data } = await call<SessionRow[]>(
      `table_sessions?table_number=eq.${tableNumber}&status=eq.open&select=id,table_number,status,opened_at,closed_at&limit=1`,
    )
    if (data[0]) return data[0]
    await ensureTable(tableNumber)
    try {
      const created = await call<SessionRow[]>(
        'table_sessions',
        { method: 'POST', body: JSON.stringify({ table_number: tableNumber, status: 'open' }) },
        'return=representation',
      )
      const row = created.data[0]
      if (!row) throw new Error('session')
      return row
    } catch (error) {
      const pg = error instanceof Error && 'pg' in error ? String((error as { pg: string }).pg) : ''
      if (pg !== '23505') throw error
      const again = await call<SessionRow[]>(
        `table_sessions?table_number=eq.${tableNumber}&status=eq.open&select=id,table_number,status,opened_at,closed_at&limit=1`,
      )
      const row = again.data[0]
      if (!row) throw error
      return row
    }
  }

  async function loadOrder(id: string): Promise<OrderRow | null> {
    const { data } = await call<OrderRow[]>(`orders?id=eq.${id}&select=*,order_items(*)&limit=1`)
    return data[0] ?? null
  }

  async function pending(sessionId: string): Promise<boolean> {
    const { data } = await call<Array<{ id: string }>>(
      `orders?session_id=eq.${sessionId}&status=in.(submitted,ready_for_pickup)&select=id&limit=1`,
    )
    return Boolean(data[0])
  }

  function pickupBlock(row: OrderRow, nowMs: number): string | null {
    if (row.status === 'cancelled' || row.pickup_status === 'revoked') return 'cancelled'
    if (row.pickup_expires_at && Date.parse(row.pickup_expires_at) < nowMs) return 'expired_qr'
    if (row.status !== 'ready_for_pickup' || row.pickup_status !== 'active') return 'already_claimed'
    return null
  }

  async function findByPickup(pickup: string): Promise<OrderRow | { error: string }> {
    const token = readPickupToken(pickup)
    if (!token) return { error: 'invalid_qr' }
    const hash = await sha256Hex(token)
    const { data } = await call<OrderRow[]>(`orders?pickup_token_hash=eq.${hash}&select=*,order_items(*)&limit=1`)
    return data[0] ?? { error: 'invalid_qr' }
  }

  return {
    kind: 'supabase',
    tableCount: countTables,
    async openDevice(tableNumber, deviceToken) {
      const max = await countTables()
      if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > max) return fail('invalid_table')
      const known = await deviceByToken(deviceToken)
      if (known && known.table_number === tableNumber && deviceToken) {
        const session = await sessionById(known.session_id)
        if (session?.status === 'open') {
          return { ok: true, value: { deviceToken, tableNumber, sessionId: session.id } }
        }
      }
      const session = await ensureOpen(tableNumber)
      const token = randomToken('dev')
      await call(
        'table_devices',
        {
          method: 'POST',
          body: JSON.stringify({ session_id: session.id, table_number: tableNumber, token_hash: await sha256Hex(token) }),
        },
        'return=minimal',
      )
      return { ok: true, value: { deviceToken: token, tableNumber, sessionId: session.id } }
    },
    async clientOrders(deviceToken) {
      const device = await deviceByToken(deviceToken)
      if (!device) return fail('unauthorized')
      const session = await sessionById(device.session_id)
      if (!session) return fail('unauthorized')
      const { data } = await call<OrderRow[]>(
        `orders?session_id=eq.${session.id}&select=*,order_items(*)&order=created_at.asc`,
      )
      const orders: ClientOrder[] = []
      for (const row of data) orders.push(await clientView(row))
      return { ok: true, value: { tableNumber: device.table_number, sessionStatus: session.status, orders } }
    },
    async submit(deviceToken, body) {
      const device = await deviceByToken(deviceToken)
      if (!device) return fail('unauthorized')
      const session = await sessionById(device.session_id)
      if (!session || session.status !== 'open') return fail('session_closed')
      const parsed = parseCartPayload(body)
      if ('error' in parsed) return fail(parsed.error)
      const existing = await call<OrderRow[]>(
        `orders?device_id=eq.${device.id}&client_request_id=eq.${encodeURIComponent(parsed.clientRequestId)}&select=*,order_items(*)&limit=1`,
      )
      if (existing.data[0]) return { ok: true, value: await clientView(existing.data[0]) }
      const snapshot = snapshotCart(parsed.lines, parsed.note)
      if ('error' in snapshot) return fail('empty')
      const number = await call<string>('rpc/next_order_number', { method: 'POST', body: '{}' })
      const createdAt = new Date().toISOString()
      let inserted: OrderRow
      try {
        const result = await call<OrderRow[]>(
          'orders',
          {
            method: 'POST',
            body: JSON.stringify({
              public_number: number.data,
              table_number: device.table_number,
              session_id: session.id,
              device_id: device.id,
              status: 'submitted',
              note: snapshot.note,
              total_cents: snapshot.totalCents,
              client_request_id: parsed.clientRequestId,
              submitted_at: createdAt,
              last_actor: 'client',
            }),
          },
          'return=representation',
        )
        const row = result.data[0]
        if (!row) return fail('not_saved')
        inserted = row
      } catch (error) {
        const pg = error instanceof Error && 'pg' in error ? String((error as { pg: string }).pg) : ''
        if (pg !== '23505') return fail('not_saved')
        const again = await call<OrderRow[]>(
          `orders?device_id=eq.${device.id}&client_request_id=eq.${encodeURIComponent(parsed.clientRequestId)}&select=*,order_items(*)&limit=1`,
        )
        if (!again.data[0]) return fail('not_saved')
        return { ok: true, value: await clientView(again.data[0]) }
      }
      await call(
        'order_items',
        {
          method: 'POST',
          body: JSON.stringify(
            snapshot.items.map((item, position) => ({
              order_id: inserted.id,
              position,
              dish_id: item.dishId,
              name: item.name,
              qty: item.qty,
              unit_cents: item.unitCents,
              supplement_qty: item.supplementQty,
              supplement_label: item.supplementLabel,
              supplement_cents: item.supplementCents,
              line_cents: item.lineCents,
              note: item.note,
            })),
          ),
        },
        'return=minimal',
      )
      const full = await loadOrder(inserted.id)
      if (!full) return fail('not_saved')
      return { ok: true, value: await clientView(full) }
    },
    async ready(deviceToken, orderId) {
      const device = await deviceByToken(deviceToken)
      if (!device) return fail('unauthorized')
      const row = await loadOrder(orderId)
      if (!row || row.device_id !== device.id) return fail('not_found')
      if (row.status === 'cancelled') return fail('cancelled')
      if (row.status === 'claimed' || row.status === 'completed') return fail('already_claimed')
      const expired = row.pickup_expires_at ? Date.parse(row.pickup_expires_at) < Date.now() : true
      if (row.status === 'ready_for_pickup' && row.pickup_status === 'active' && !expired) {
        return { ok: true, value: await clientView(row) }
      }
      if (row.status !== 'ready_for_pickup' && !canTransition(row.status, 'ready_for_pickup')) return fail('forbidden_transition')
      const token = randomToken('pk')
      const patch = {
        status: 'ready_for_pickup',
        pickup_status: 'active',
        pickup_token_hash: await sha256Hex(token),
        pickup_token_enc: await encryptSecret(token, config.tokenKey),
        pickup_expires_at: new Date(Date.now() + PICKUP_TTL_MS).toISOString(),
        ready_at: row.ready_at ?? new Date().toISOString(),
        last_actor: 'client',
      }
      const filter =
        row.status === 'ready_for_pickup'
          ? `id=eq.${row.id}&device_id=eq.${device.id}&status=eq.ready_for_pickup`
          : `id=eq.${row.id}&device_id=eq.${device.id}&status=eq.${row.status}`
      const updated = await call<OrderRow[]>(`orders?${filter}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'return=representation')
      const next = updated.data[0] ?? (await loadOrder(orderId))
      if (!next) return fail('not_saved')
      return { ok: true, value: await clientView(next) }
    },
    async login(password, ip) {
      const key = ip || 'local'
      const current = attempts.get(key)
      if (current && current.resetAt > Date.now() && current.count >= 8) return fail('rate_limited')
      const { data } = await call<Array<{ id: string; password_hash: string; disabled: boolean }>>(
        'restaurant_users?select=id,password_hash,disabled&limit=1',
      )
      let user = data.find((item) => !item.disabled)
      if (!user) {
        if (!config.staffPassword) return fail('not_configured')
        if (password !== config.staffPassword) {
          noteFailure(key)
          return fail('bad_password')
        }
        const created = await call<Array<{ id: string }>>(
          'restaurant_users',
          {
            method: 'POST',
            body: JSON.stringify({ display_name: 'Restaurant', password_hash: await hashPassword(password) }),
          },
          'return=representation',
        )
        const id = created.data[0]?.id
        if (!id) return fail('unavailable')
        user = { id, password_hash: '', disabled: false }
      } else if (!(await verifyPassword(password, user.password_hash))) {
        noteFailure(key)
        return fail('bad_password')
      }
      attempts.delete(key)
      const token = config.staffPassword ? await issueStaffToken(config.staffPassword) : randomToken('stf')
      await call(
        'staff_sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: user.id,
            token_hash: await sha256Hex(token),
            expires_at: new Date(Date.now() + STAFF_TTL_MS).toISOString(),
          }),
        },
        'return=minimal',
      )
      return { ok: true, value: { token } }
    },
    async logout(staffToken) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const hash = await sha256Hex(staffToken)
      await call(`staff_sessions?token_hash=eq.${hash}`, { method: 'DELETE' }, 'return=minimal')
      return { ok: true, value: { done: true } }
    },
    async board(staffToken, nowMs) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const tableCount = await countTables()
      const sessions = await call<SessionRow[]>('table_sessions?status=eq.open&select=id,table_number,status,opened_at,closed_at')
      const ids = sessions.data.map((session) => session.id)
      const orderRows = ids.length
        ? (
            await call<OrderRow[]>(
              `orders?session_id=in.(${ids.join(',')})&select=id,public_number,table_number,session_id,status,total_cents,paid_at,submitted_at,ready_at,created_at,order_items(qty)`,
            )
          ).data
        : []
      const tables = []
      const alerts = []
      for (let number = 1; number <= tableCount; number += 1) {
        const session = sessions.data.find((item) => item.table_number === number)
        const sessionOrders = session ? orderRows.filter((order) => order.session_id === session.id) : []
        const visible = sessionOrders.filter((order) => order.status !== 'draft' && order.status !== 'cancelled')
        const presentation = serviceTone(
          visible.map((order) => ({ status: order.status, paid: Boolean(order.paid_at) })),
          Boolean(session),
        )
        tables.push({
          number,
          tone: presentation.tone,
          label: presentation.label,
          sessionId: session?.id ?? null,
          sessionOpenedAt: session?.opened_at ?? null,
          action: 'Voir' as const,
          orders: visible.map((order) => ({
            id: order.id,
            publicNumber: order.public_number,
            status: order.status,
            totalCents: order.total_cents,
            itemCount: (order.order_items ?? []).reduce((sum, item) => sum + item.qty, 0),
            paid: Boolean(order.paid_at),
            readyAt: order.ready_at,
            createdAt: order.created_at,
            waitingSeconds: orderWaitSeconds(order.status, order.submitted_at, order.ready_at, nowMs),
          })),
        })
        for (const order of visible) {
          const waiting = orderWaitSeconds(order.status, order.submitted_at, order.ready_at, nowMs)
          if (waiting == null) continue
          alerts.push({
            orderId: order.id,
            tableNumber: number,
            publicNumber: order.public_number,
            waitingSeconds: waiting,
          })
        }
      }
      return { ok: true, value: { serverTime: new Date(nowMs).toISOString(), tableCount, tables, alerts } satisfies Board }
    },
    async order(staffToken, orderId, nowMs) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const row = await loadOrder(orderId)
      if (!row) return fail('not_found')
      return { ok: true, value: await staffView(row, nowMs) }
    },
    async verify(staffToken, pickup, nowMs) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const found = await findByPickup(pickup)
      if ('error' in found) return fail(found.error)
      const blocked = pickupBlock(found, nowMs)
      if (blocked) return fail(blocked)
      return { ok: true, value: await staffView(found, nowMs) }
    },
    async claim(staffToken, pickup, nowMs) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const found = await findByPickup(pickup)
      if ('error' in found) return fail(found.error)
      const blocked = pickupBlock(found, nowMs)
      if (blocked) return fail(blocked)
      const hash = found.pickup_token_hash
      const updated = await call<OrderRow[]>(
        `orders?id=eq.${found.id}&status=eq.ready_for_pickup&pickup_status=eq.active&pickup_token_hash=eq.${hash}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'claimed',
            pickup_status: 'consumed',
            claimed_at: new Date().toISOString(),
            last_actor: 'staff',
          }),
        },
        'return=representation',
      )
      const row = updated.data[0] ? await loadOrder(updated.data[0].id) : null
      if (!row) {
        const again = await loadOrder(found.id)
        if (!again) return fail('not_saved')
        return fail(pickupBlock(again, nowMs) ?? 'already_claimed')
      }
      return { ok: true, value: await staffView(row, nowMs) }
    },
    async confirm(staffToken, orderId) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const row = await loadOrder(orderId)
      if (!row) return fail('not_found')
      if (row.status === 'claimed') return { ok: true, value: await staffView(row, Date.now()) }
      if (!canTransition(row.status, 'claimed')) return fail('forbidden_transition')
      const patch: Record<string, string> = {
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        last_actor: 'staff',
      }
      if (row.pickup_status === 'active') patch.pickup_status = 'consumed'
      try {
        await call(`orders?id=eq.${orderId}&status=eq.${row.status}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'return=minimal')
      } catch {
        if (row.status !== 'submitted') return fail('forbidden_transition')
        const readyAt = new Date().toISOString()
        try {
          await call(
            `orders?id=eq.${orderId}&status=eq.submitted`,
            { method: 'PATCH', body: JSON.stringify({ status: 'ready_for_pickup', ready_at: readyAt, last_actor: 'staff' }) },
            'return=minimal',
          )
          await call(
            `orders?id=eq.${orderId}&status=eq.ready_for_pickup`,
            { method: 'PATCH', body: JSON.stringify(patch) },
            'return=minimal',
          )
        } catch {
          return fail('forbidden_transition')
        }
      }
      const next = await loadOrder(orderId)
      if (!next) return fail('not_saved')
      return { ok: true, value: await staffView(next, Date.now()) }
    },
    async amend(staffToken, orderId, body) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const row = await loadOrder(orderId)
      if (!row) return fail('not_found')
      if (row.status !== 'submitted' && row.status !== 'ready_for_pickup' && row.status !== 'claimed') {
        return fail('forbidden_transition')
      }
      const parsed = parseStaffCart(body)
      if ('error' in parsed) return fail(parsed.error)
      const snapshot = snapshotCart(parsed.lines, parsed.note)
      if ('error' in snapshot) return fail(snapshot.error)
      await call(`order_items?order_id=eq.${orderId}`, { method: 'DELETE' }, 'return=minimal')
      await call(
        'order_items',
        {
          method: 'POST',
          body: JSON.stringify(
            snapshot.items.map((item, position) => ({
              order_id: orderId,
              position,
              dish_id: item.dishId,
              name: item.name,
              qty: item.qty,
              unit_cents: item.unitCents,
              supplement_qty: item.supplementQty,
              supplement_label: item.supplementLabel,
              supplement_cents: item.supplementCents,
              line_cents: item.lineCents,
              note: item.note,
            })),
          ),
        },
        'return=minimal',
      )
      await call(
        `orders?id=eq.${orderId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ note: snapshot.note, total_cents: snapshot.totalCents, last_actor: 'staff' }),
        },
        'return=minimal',
      )
      const next = await loadOrder(orderId)
      if (!next) return fail('not_saved')
      return { ok: true, value: await staffView(next, Date.now()) }
    },
    async complete(staffToken, orderId) {
      return transition(staffToken, orderId, 'completed')
    },
    async cancel(staffToken, orderId) {
      return transition(staffToken, orderId, 'cancelled')
    },
    async pay(staffToken, orderId) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const row = await loadOrder(orderId)
      if (!row) return fail('not_found')
      if (row.status === 'cancelled') return fail('cancelled')
      if (!row.paid_at) {
        await call(`orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ paid_at: new Date().toISOString() }) }, 'return=minimal')
      }
      const next = await loadOrder(orderId)
      if (!next) return fail('not_saved')
      return { ok: true, value: await staffView(next, Date.now()) }
    },
    async closeSession(staffToken, sessionId) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const session = await sessionById(sessionId)
      if (!session || session.status !== 'open') return fail('not_found')
      if (await pending(session.id)) return fail('session_busy')
      try {
        await call(
          `orders?session_id=eq.${sessionId}&status=eq.claimed`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), last_actor: 'staff' }),
          },
          'return=minimal',
        )
      } catch (error) {
        const status = error instanceof Error && 'status' in error ? Number((error as { status: number }).status) : 0
        if (status !== 404) return fail('not_saved')
      }
      await call(
        `table_sessions?id=eq.${sessionId}&status=eq.open`,
        { method: 'PATCH', body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() }) },
        'return=minimal',
      )
      return { ok: true, value: { sessionId } }
    },
    async reopenTable(staffToken, tableNumber) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const max = await countTables()
      if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > max) return fail('invalid_table')
      const { data } = await call<SessionRow[]>(
        `table_sessions?table_number=eq.${tableNumber}&status=eq.open&select=id,table_number,status,opened_at,closed_at&limit=1`,
      )
      const current = data[0]
      if (current) {
        if (await pending(current.id)) return fail('session_busy')
        await call(
          `table_sessions?id=eq.${current.id}&status=eq.open`,
          { method: 'PATCH', body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() }) },
          'return=minimal',
        )
      }
      const session = await ensureOpen(tableNumber)
      return { ok: true, value: { sessionId: session.id } }
    },
    async setTableCount(staffToken, count) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      if (!Number.isInteger(count) || count < 1 || count > 200) return fail('invalid')
      await call('restaurant_settings?id=eq.1', { method: 'PATCH', body: JSON.stringify({ table_count: count }) }, 'return=minimal')
      if (count > 0) {
        const rows = Array.from({ length: count }, (_, index) => ({ number: index + 1, label: `Table ${index + 1}` }))
        await call('restaurant_tables?on_conflict=number', { method: 'POST', body: JSON.stringify(rows) }, 'resolution=merge-duplicates,return=minimal')
      }
      return { ok: true, value: { tableCount: count } }
    },
    async history(staffToken) {
      if (!(await requireStaff(staffToken))) return fail('unauthorized')
      const { data } = await call<OrderRow[]>(
        'orders?status=in.(claimed,completed,cancelled)&select=id,public_number,table_number,status,total_cents,created_at,claimed_at,completed_at&order=created_at.desc&limit=200',
      )
      const rows: HistoryRow[] = data.map((order) => ({
        id: order.id,
        publicNumber: order.public_number,
        tableNumber: order.table_number,
        status: order.status,
        totalCents: order.total_cents,
        createdAt: order.created_at,
        claimedAt: order.claimed_at,
        completedAt: order.completed_at,
      }))
      return { ok: true, value: rows }
    },
  }

  async function transition(staffToken: string, orderId: string, status: 'completed' | 'cancelled'): Promise<StoreResult<StaffOrder>> {
    if (!(await requireStaff(staffToken))) return fail('unauthorized')
    const row = await loadOrder(orderId)
    if (!row) return fail('not_found')
    if (!canTransition(row.status, status)) return fail('forbidden_transition')
    const patch: Record<string, string> = { status, last_actor: 'staff' }
    if (status === 'completed') patch.completed_at = new Date().toISOString()
    if (status === 'cancelled') {
      patch.cancelled_at = new Date().toISOString()
      if (row.pickup_token_hash) patch.pickup_status = 'revoked'
    }
    try {
      await call(`orders?id=eq.${orderId}&status=eq.${row.status}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'return=minimal')
    } catch {
      return fail('forbidden_transition')
    }
    const next = await loadOrder(orderId)
    if (!next) return fail('not_saved')
    return { ok: true, value: await staffView(next, Date.now()) }
  }
}

function noteFailure(key: string) {
  const current = attempts.get(key)
  const resetAt = Date.now() + 10 * 60 * 1000
  if (!current || current.resetAt < Date.now()) attempts.set(key, { count: 1, resetAt })
  else current.count += 1
}
