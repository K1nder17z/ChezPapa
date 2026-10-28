import { createMemoryStore } from './memoryStore.ts'
import { createSupabaseStore } from './supabaseStore.ts'
import type { OrderStore } from './contracts.ts'

const globalStore = globalThis as { __chezpapaStore?: OrderStore }

export function resolveStore(): OrderStore | 'unconfigured' {
  const url = readEnv('SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  const tokenKey = readEnv('ORDER_TOKEN_KEY')
  const staffPassword = readEnv('STAFF_PASSWORD')
  if (url && key && tokenKey) return createSupabaseStore({ url, serviceKey: key, tokenKey, staffPassword })
  if (readEnv('VERCEL')) return 'unconfigured'
  if (!globalStore.__chezpapaStore) {
    globalStore.__chezpapaStore = createMemoryStore({
      staffPassword,
      tokenKey: tokenKey || 'chezpapa-dev-token-key',
    })
  }
  return globalStore.__chezpapaStore
}

function readEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return (env?.[name] ?? '').trim()
}
