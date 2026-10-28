import { handleApi } from './handleApi.ts'
import { resolveStore } from './resolveStore.ts'

type NodeReq = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  on(event: 'data' | 'end' | 'error', listener: (chunk?: Uint8Array) => void): void
}

type NodeRes = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: Uint8Array): void
}

export async function handleNode(req: NodeReq, res: NodeRes): Promise<void> {
  const host = header(req, 'host') || 'localhost'
  const proto = header(req, 'x-forwarded-proto') || 'http'
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const body = await rawBody(req)
  const request = new Request(`${proto}://${host}${req.url ?? '/'}`, {
    method: req.method ?? 'GET',
    headers,
    body: body ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer : undefined,
  })
  const response = await handleApi(request, resolveStore())
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(new Uint8Array(await response.arrayBuffer()))
}

async function rawBody(req: NodeReq): Promise<Uint8Array | undefined> {
  if (!req.method || req.method === 'GET' || req.method === 'HEAD') return undefined
  if (typeof req.body === 'string') return new TextEncoder().encode(req.body)
  if (req.body && typeof req.body === 'object') return new TextEncoder().encode(JSON.stringify(req.body))
  const chunks: Uint8Array[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      if (chunk) chunks.push(chunk)
    })
    req.on('end', () => resolve())
    req.on('error', () => reject(new Error('body')))
  })
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function header(req: NodeReq, name: string): string {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()]
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? ''
  return ''
}
