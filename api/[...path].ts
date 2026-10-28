import { handleNode } from '../src/server/nodeAdapter.ts'

type NodeReq = Parameters<typeof handleNode>[0]
type NodeRes = Parameters<typeof handleNode>[1]

export default function handler(request: NodeReq, response: NodeRes) {
  return handleNode(request, response)
}
