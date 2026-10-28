import { handleNode } from '../src/server/nodeAdapter.ts'

type NodeReq = Parameters<typeof handleNode>[0]
type NodeRes = Parameters<typeof handleNode>[1]

const KEYS = ['a', 'b', 'c', 'd', 'e']

export default function handler(request: NodeReq, response: NodeRes) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const parts = KEYS.map((key) => url.searchParams.get(key)).filter((part): part is string => Boolean(part))
  if (parts.length > 0) request.url = `/api/${parts.map(encodeURIComponent).join('/')}`
  return handleNode(request, response)
}
