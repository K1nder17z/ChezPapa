import { failureMessage, legend } from '../lib/ordering/domain.ts'
import { staffSessionSeconds } from './crypto.ts'
import type { OrderStore } from './contracts.ts'

const BODY_LIMIT = 20_000

export async function handleApi(request: Request, store: OrderStore | 'unconfigured'): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return cors(request, new Response(null, { status: 204 }))
  if (store === 'unconfigured') {
    return cors(request, json(503, { code: 'unavailable', message: failureMessage('unavailable').message }))
  }
  try {
    const response = await route(request, url, store)
    return cors(request, response)
  } catch (error) {
    const code = error instanceof SyntaxError ? 'invalid' : 'unavailable'
    const mapped = failureMessage(code)
    return cors(request, json(mapped.status, { code, message: mapped.message }))
  }
}

async function route(request: Request, url: URL, store: OrderStore): Promise<Response> {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'api') return json(404, { code: 'not_found', message: 'Commande introuvable.' })
  const method = request.method
  const bearer = tokenFrom(request)

  if (method === 'GET' && parts[1] === 'health') {
    return json(200, { ok: true, store: store.kind })
  }
  if (method === 'GET' && parts[1] === 'tables' && parts.length === 2) {
    const tableCount = await store.tableCount()
    return json(200, {
      tableCount,
      tables: Array.from({ length: tableCount }, (_, index) => ({ number: index + 1, path: `/t/${index + 1}` })),
    })
  }
  if (method === 'POST' && parts[1] === 'client' && parts[2] === 'session' && parts.length === 3) {
    const body = await readBody(request)
    const tableNumber = body && typeof body === 'object' ? (body as { tableNumber?: unknown }).tableNumber : null
    const renew = Boolean(body && typeof body === 'object' && (body as { renew?: unknown }).renew === true)
    if (typeof tableNumber !== 'number') return fail('invalid_table')
    return send(await store.openDevice(tableNumber, bearer, renew))
  }
  if (method === 'GET' && parts[1] === 'client' && parts[2] === 'orders' && parts.length === 3) {
    if (!bearer) return fail('unauthorized')
    return send(await store.clientOrders(bearer))
  }
  if (method === 'POST' && parts[1] === 'client' && parts[2] === 'orders' && parts.length === 3) {
    if (!bearer) return fail('unauthorized')
    return send(await store.submit(bearer, await readBody(request)))
  }
  if (method === 'POST' && parts[1] === 'client' && parts[2] === 'orders' && parts[4] === 'ready' && parts.length === 5) {
    if (!bearer) return fail('unauthorized')
    return send(await store.ready(bearer, parts[3] ?? ''))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'login' && parts.length === 3) {
    const body = await readBody(request)
    const password = body && typeof body === 'object' ? (body as { password?: unknown }).password : ''
    if (typeof password !== 'string' || password.length < 4 || password.length > 80) return fail('bad_password')
    const result = await store.login(password, clientIp(request))
    if (!result.ok) return fail(result.code)
    return json(200, result.value, { 'set-cookie': staffCookie(result.value.token, request) })
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'logout' && parts.length === 3) {
    if (!bearer) return fail('unauthorized')
    const result = await store.logout(bearer)
    if (!result.ok) return fail(result.code)
    return json(200, result.value, { 'set-cookie': staffCookie('', request, true) })
  }
  if (!bearer || !bearer.startsWith('stf_')) {
    if (parts[1] === 'staff') return fail('unauthorized')
  }
  if (method === 'GET' && parts[1] === 'staff' && parts[2] === 'board' && parts.length === 3) {
    const board = await store.board(bearer ?? '', Date.now())
    if (!board.ok) return fail(board.code)
    return json(200, { ...board.value, legend })
  }
  if (method === 'GET' && parts[1] === 'staff' && parts[2] === 'orders' && parts.length === 4) {
    return send(await store.order(bearer ?? '', parts[3] ?? '', Date.now()))
  }
  if (method === 'GET' && parts[1] === 'staff' && parts[2] === 'history' && parts.length === 3) {
    return send(await store.history(bearer ?? ''))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'verify' && parts.length === 3) {
    const pickup = stringField(await readBody(request), 'pickupToken')
    if (!pickup) return fail('invalid_qr')
    return send(await store.verify(bearer ?? '', pickup, Date.now()))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'claim' && parts.length === 3) {
    const pickup = stringField(await readBody(request), 'pickupToken')
    if (!pickup) return fail('invalid_qr')
    return send(await store.claim(bearer ?? '', pickup, Date.now()))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'orders' && parts.length === 5) {
    const id = parts[3] ?? ''
    const action = parts[4]
    if (action === 'confirm') return send(await store.confirm(bearer ?? '', id))
    if (action === 'items') return send(await store.amend(bearer ?? '', id, await readBody(request)))
    if (action === 'complete') return send(await store.complete(bearer ?? '', id))
    if (action === 'cancel') return send(await store.cancel(bearer ?? '', id))
    if (action === 'pay') return send(await store.pay(bearer ?? '', id))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'sessions' && parts[4] === 'close' && parts.length === 5) {
    return send(await store.closeSession(bearer ?? '', parts[3] ?? ''))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'tables' && parts[4] === 'session' && parts.length === 5) {
    const tableNumber = Number(parts[3])
    return send(await store.reopenTable(bearer ?? '', tableNumber))
  }
  if (method === 'POST' && parts[1] === 'staff' && parts[2] === 'settings' && parts.length === 3) {
    const count = (await readBody(request) as { tableCount?: unknown } | null)?.tableCount
    if (typeof count !== 'number') return fail('invalid')
    return send(await store.setTableCount(bearer ?? '', count))
  }
  return json(404, { code: 'not_found', message: 'Commande introuvable.' })
}

function send<T>(result: { ok: true; value: T } | { ok: false; code: string }): Response {
  if (!result.ok) return fail(result.code)
  return json(200, result.value)
}

function fail(code: string): Response {
  const mapped = failureMessage(code)
  return json(mapped.status, { code, message: mapped.message })
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > BODY_LIMIT) throw new Error('too_large')
  if (!text) return {}
  return JSON.parse(text) as unknown
}

function stringField(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') return null
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function tokenFrom(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (match?.[1]) return match[1]
  const cookie = request.headers.get('cookie') ?? ''
  const stored = /(?:^|;\s*)cp_staff=([^;]*)/.exec(cookie)?.[1]
  if (!stored) return null
  try {
    return decodeURIComponent(stored)
  } catch {
    return stored
  }
}

function staffCookie(token: string, request: Request, clear = false): string {
  const secure = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https'
  const maxAge = clear ? 0 : staffSessionSeconds()
  const sameSite = secure ? 'None' : 'Lax'
  const secureFlag = secure ? '; Secure' : ''
  return `cp_staff=${clear ? '' : encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=${sameSite}${secureFlag}`
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  return forwarded.split(',')[0]?.trim() || 'local'
}

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  const headers = new Headers(extra)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

function cors(request: Request, response: Response): Response {
  const origin = request.headers.get('origin')
  if (!origin || !allowedOrigin(origin, request)) return response
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', origin)
  headers.set('access-control-allow-credentials', 'true')
  headers.set('access-control-allow-headers', 'authorization, content-type')
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  headers.set('vary', 'Origin')
  return new Response(response.body, { status: response.status, headers })
}

function allowedOrigin(origin: string, request: Request): boolean {
  if (origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'https://chezpapa-beta.vercel.app') {
    return true
  }
  try {
    const url = new URL(origin)
    const host = request.headers.get('host') ?? ''
    if (url.host === host) return true
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}
