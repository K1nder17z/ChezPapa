import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { connectionState, snapshotCart, tablePresentation, waitingLabel } from '../lib/ordering/domain.ts'
import { handleApi } from './handleApi.ts'
import { createMemoryStore } from './memoryStore.ts'
import type { ClientOrder } from './contracts.ts'
import type { OrderStore } from './contracts.ts'

const secret = 'test-secret-salle'
const lines = [
  { dishId: 'shawarma', qty: 2, supplementQty: 0 },
  { dishId: 'coca-cola', qty: 2, supplementQty: 0 },
]

function store(): OrderStore {
  return createMemoryStore({ staffPassword: secret, tokenKey: 'test-token-key' })
}

async function api(
  current: OrderStore | 'unconfigured',
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await handleApi(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    current,
  )
  const data = (await response.json()) as Record<string, unknown>
  return { status: response.status, data }
}

async function device(current: OrderStore, table = 4) {
  const opened = await api(current, 'POST', '/api/client/session', { tableNumber: table })
  expect(opened.status).toBe(200)
  return opened.data.deviceToken as string
}

async function submit(current: OrderStore, token: string, requestId: string, cart = lines) {
  return api(current, 'POST', '/api/client/orders', { lines: cart, clientRequestId: requestId, totalCents: 1 }, token)
}

describe('parcours commande', () => {
  it('calcule le total côté serveur et ignore le prix du navigateur', async () => {
    const current = store()
    const token = await device(current)
    const created = await submit(current, token, 'request-01')
    expect(created.status).toBe(200)
    const order = created.data as unknown as ClientOrder
    expect(order.totalCents).toBe(800 * 2 + 150 * 2)
    expect(order.totalCents).not.toBe(1)
    expect(order.publicNumber).toMatch(/^CP-\d{4}$/)
    expect(order.status).toBe('submitted')
    expect(order.qrPayload).toBeNull()
  })

  it('refuse un panier vide et conserve le refus explicite', async () => {
    const current = store()
    const token = await device(current)
    const created = await submit(current, token, 'request-vide', [])
    expect(created.status).toBe(400)
    expect(created.data.code).toBe('empty')
  })

  it('affiche le récapitulatif puis un seul QR après « terminé »', async () => {
    const current = store()
    const token = await device(current)
    const created = await submit(current, token, 'request-02')
    const order = created.data as unknown as ClientOrder
    const ready = await api(current, 'POST', `/api/client/orders/${order.id}/ready`, {}, token)
    const again = await api(current, 'POST', `/api/client/orders/${order.id}/ready`, {}, token)
    expect(ready.status).toBe(200)
    expect(again.status).toBe(200)
    const first = ready.data as unknown as ClientOrder
    const second = again.data as unknown as ClientOrder
    expect(first.status).toBe('ready_for_pickup')
    expect(first.qrPayload).toMatch(/^chezpapa-pickup:v1:/)
    expect(second.qrPayload).toBe(first.qrPayload)
    expect(first.qrPayload).not.toContain('shawarma')
    expect(first.qrPayload).not.toContain(String(first.totalCents))
    const listed = await api(current, 'GET', '/api/client/orders', undefined, token)
    const orders = listed.data.orders as ClientOrder[]
    expect(orders).toHaveLength(1)
    expect(orders[0]?.qrPayload).toBe(first.qrPayload)
  })

  it('ne crée pas une seconde commande si la même demande est répétée', async () => {
    const current = store()
    const token = await device(current)
    const first = await submit(current, token, 'same-request')
    const second = await submit(current, token, 'same-request')
    expect(first.data.id).toBe(second.data.id)
    const listed = await api(current, 'GET', '/api/client/orders', undefined, token)
    expect(listed.data.orders).toHaveLength(1)
  })

  it('passe la table au rouge tant qu’une commande attend, puis garde l’autre', async () => {
    const current = store()
    const tokenA = await device(current, 4)
    const tokenB = await device(current, 4)
    const staff = await api(current, 'POST', '/api/staff/login', { password: secret })
    const staffToken = staff.data.token as string
    const orderA = (await submit(current, tokenA, 'table-aaaa')).data as unknown as ClientOrder
    const orderB = (await submit(current, tokenB, 'table-bbbb')).data as unknown as ClientOrder
    await api(current, 'POST', `/api/client/orders/${orderA.id}/ready`, {}, tokenA)
    await api(current, 'POST', `/api/client/orders/${orderB.id}/ready`, {}, tokenB)
    expect(orderA).toMatchObject({ status: 'submitted', qrPayload: null })
    const readyA = (await api(current, 'GET', '/api/client/orders', undefined, tokenA)).data.orders as ClientOrder[]
    const readyB = (await api(current, 'GET', '/api/client/orders', undefined, tokenB)).data.orders as ClientOrder[]
    const qrA = readyA.find((order) => order.id === orderA.id)?.qrPayload
    const qrB = readyB.find((order) => order.id === orderB.id)?.qrPayload
    expect(readyA.map((order) => order.id).sort()).toEqual(readyB.map((order) => order.id).sort())
    expect(qrA).toMatch(/^chezpapa-pickup:v1:/)
    expect(qrB).toMatch(/^chezpapa-pickup:v1:/)
    expect(qrA).not.toBe(qrB)
    const board = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const table = (board.data.tables as Array<{ number: number; tone: string; orders: unknown[] }>).find((item) => item.number === 4)
    expect(table?.tone).toBe('red')
    expect(table?.orders).toHaveLength(2)
    const claimed = await api(current, 'POST', '/api/staff/claim', { pickupToken: qrA }, staffToken)
    expect(claimed.status).toBe(200)
    expect(claimed.data.status).toBe('claimed')
    const after = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const still = (after.data.tables as Array<{ number: number; tone: string }>).find((item) => item.number === 4)
    expect(still?.tone).toBe('red')
    const reused = await api(current, 'POST', '/api/staff/claim', { pickupToken: qrA }, staffToken)
    expect(reused.status).toBe(409)
    expect(reused.data.code).toBe('already_claimed')
    const second = await api(current, 'POST', '/api/staff/verify', { pickupToken: qrB }, staffToken)
    expect(second.status).toBe(200)
    expect(second.data.publicNumber).toBe(orderB.publicNumber)
    expect(second.data.recoverable).toBe(true)
  })

  it('bloque le dashboard, un jeton invalide, un total client et la session clôturée', async () => {
    const current = store()
    const hidden = await api(current, 'GET', '/api/staff/board')
    expect(hidden.status).toBe(401)
    const token = await device(current, 4)
    const other = await device(current, 5)
    const order = (await submit(current, token, 'secure-1')).data as unknown as ClientOrder
    const foreign = await api(current, 'POST', `/api/client/orders/${order.id}/ready`, {}, other)
    expect(foreign.status).toBe(404)
    const staff = await api(current, 'POST', '/api/staff/login', { password: secret })
    const staffToken = staff.data.token as string
    const missing = await api(current, 'POST', '/api/staff/verify', { pickupToken: 'chezpapa-pickup:v1:pas-un-jeton-valide-du-tout' }, staffToken)
    expect(missing.status).toBe(404)
    expect(missing.data.code).toBe('invalid_qr')
    const priced = snapshotCart([{ dishId: 'tiramisu', qty: 2, supplementQty: 9, note: 'sans café' }], '  table calme  ')
    expect('error' in priced).toBe(false)
    if (!('error' in priced)) {
      expect(priced.totalCents).toBe(250 * 2)
      expect(priced.items[0]?.supplementQty).toBe(0)
      expect(priced.items[0]?.note).toBe('sans café')
    }
    const closed = await api(current, 'POST', '/api/staff/sessions/inconnu/close', {}, staffToken)
    expect(closed.status).toBe(404)
    const listed = await api(current, 'GET', '/api/client/orders', undefined, token)
    const sessionId = (listed.data.orders as ClientOrder[])[0]?.sessionId
    const blocked = await api(current, 'POST', `/api/staff/sessions/${sessionId}/close`, {}, staffToken)
    expect(blocked.data.code).toBe('session_busy')
    await api(current, 'POST', `/api/staff/orders/${order.id}/cancel`, {}, staffToken)
    const afterClose = await api(current, 'POST', `/api/staff/sessions/${sessionId}/close`, {}, staffToken)
    expect(afterClose.status).toBe(200)
    const late = await submit(current, token, 'after-close')
    expect(late.status).toBe(409)
    expect(late.data.code).toBe('session_closed')
    const down = await api('unconfigured', 'POST', '/api/client/orders', { lines, clientRequestId: 'x' }, token)
    expect(down.status).toBe(503)
    expect(down.data.code).toBe('unavailable')
  })

  it('relie les téléphones d’une table et n’alerte la salle qu’après confirmation', async () => {
    const current = store()
    const phoneA = await device(current, 3)
    const phoneB = await device(current, 3)
    const other = await device(current, 8)
    const staff = await api(current, 'POST', '/api/staff/login', { password: secret })
    const staffToken = staff.data.token as string
    const before = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const quiet = (before.data.tables as Array<{ number: number; tone: string; orders: unknown[] }>).find((item) => item.number === 3)
    expect(quiet?.tone).toBe('blue')
    expect(quiet?.orders).toHaveLength(0)
    const created = (await submit(current, phoneA, 'lien-table')).data as unknown as ClientOrder
    const seen = (await api(current, 'GET', '/api/client/orders', undefined, phoneB)).data.orders as ClientOrder[]
    expect(seen.map((order) => order.id)).toContain(created.id)
    const hidden = (await api(current, 'GET', '/api/client/orders', undefined, other)).data.orders as ClientOrder[]
    expect(hidden).toHaveLength(0)
    const board = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const table = (board.data.tables as Array<{ number: number; tone: string; label: string }>).find((item) => item.number === 3)
    expect(table).toMatchObject({ tone: 'red', label: 'À confirmer' })
    expect(board.data.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ orderId: created.id, tableNumber: 3 })]))
    const confirmed = await api(current, 'POST', `/api/staff/orders/${created.id}/confirm`, {}, staffToken)
    expect(confirmed.status).toBe(200)
    expect(confirmed.data.status).toBe('claimed')
    const amended = await api(
      current,
      'POST',
      `/api/staff/orders/${created.id}/items`,
      { lines: [{ dishId: 'tiramisu', qty: 2, supplementQty: 0 }], note: 'sans café' },
      staffToken,
    )
    expect(amended.status).toBe(200)
    expect(amended.data.totalCents).toBe(500)
    expect(amended.data.status).toBe('claimed')
    const paid = await api(current, 'POST', `/api/staff/orders/${created.id}/pay`, {}, staffToken)
    expect(paid.data.paid).toBe(true)
    const after = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const served = (after.data.tables as Array<{ number: number; label: string }>).find((item) => item.number === 3)
    expect(served?.label).toBe('Payée')
    const closed = await api(current, 'POST', `/api/staff/sessions/${created.sessionId}/close`, {}, staffToken)
    expect(closed.status).toBe(200)
    const refreshed = await api(current, 'POST', '/api/client/session', { tableNumber: 3 }, phoneA)
    expect(refreshed.status).toBe(409)
    expect(refreshed.data.code).toBe('session_closed')
    const still = await api(current, 'GET', '/api/staff/board', undefined, staffToken)
    const freed = (still.data.tables as Array<{ number: number; sessionId: string | null; label: string }>).find((item) => item.number === 3)
    expect(freed).toMatchObject({ sessionId: null, label: 'Libre' })
    const scanned = await api(current, 'POST', '/api/client/session', { tableNumber: 3, renew: true }, phoneA)
    expect(scanned.status).toBe(200)
    expect(scanned.data.sessionId).not.toBe(created.sessionId)
  })
})

describe('présentation', () => {
  it('colore la table et décrit l’attente et la coupure réseau', () => {
    expect(tablePresentation(['submitted', 'ready_for_pickup']).tone).toBe('red')
    expect(tablePresentation(['claimed', 'completed']).tone).toBe('orange')
    expect(tablePresentation(['submitted']).label).toBe('À confirmer')
    expect(tablePresentation([]).tone).toBe('grey')
    expect(waitingLabel(10)).toBe("à l'instant")
    expect(waitingLabel(125)).toBe('depuis 2 min')
    expect(connectionState({ navigatorOnline: false, lastError: false }).online).toBe(false)
    expect(connectionState({ navigatorOnline: true, lastError: true }).message).toMatch(/à jour/)
    expect(connectionState({ navigatorOnline: true, lastError: false }).online).toBe(true)
  })

  it('verrouille la base et n’ouvre pas les tables aux clients', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261028120000_commandes_salle.sql', import.meta.url), 'utf8')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('force row level security')
    expect(sql).toContain('revoke all on table public.orders from anon, authenticated')
    expect(sql).not.toContain('supabase_realtime')
    expect(sql).toContain('table_sessions_one_open')
    expect(sql).toContain('transition interdite')
  })
})
