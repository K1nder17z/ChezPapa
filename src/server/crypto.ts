const text = new TextEncoder()

export function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `${prefix}_${base64Url(bytes)}`
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', text.encode(value))
  return hex(new Uint8Array(digest))
}

export function safeEqual(left: string, right: string): boolean {
  const a = text.encode(left)
  const b = text.encode(right)
  const length = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const bits = await derive(password, salt)
  return `pbkdf2$120000$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, rounds, salt, expected] = stored.split('$')
  if (kind !== 'pbkdf2' || !rounds || !salt || !expected) return false
  const iterations = Number(rounds)
  if (!Number.isInteger(iterations) || iterations < 10000) return false
  const saltBytes = fromBase64Url(salt)
  const bits = await derive(password, saltBytes, iterations)
  return safeEqual(base64Url(new Uint8Array(bits)), expected)
}

export async function encryptSecret(secret: string, keyMaterial: string): Promise<string> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const key = await aesKey(keyMaterial)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text.encode(secret)))
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(iv, 0)
  packed.set(cipher, iv.length)
  return base64Url(packed)
}

export async function decryptSecret(payload: string, keyMaterial: string): Promise<string | null> {
  try {
    const packed = fromBase64Url(payload)
    if (packed.length < 13) return null
    const iv = packed.slice(0, 12)
    const cipher = packed.slice(12)
    const key = await aesKey(keyMaterial)
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return new TextDecoder().decode(clear)
  } catch {
    return null
  }
}

async function derive(password: string, salt: Uint8Array, iterations = 120000): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer(salt), iterations, hash: 'SHA-256' }, key, 256)
}

function saltBuffer(salt: Uint8Array): BufferSource {
  return salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
}

async function aesKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', text.encode(material))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

const STAFF_TTL_MS = 180 * 24 * 60 * 60 * 1000

export function staffSessionSeconds(): number {
  return Math.floor(STAFF_TTL_MS / 1000)
}

export async function issueStaffToken(password: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + staffSessionSeconds()
  const signature = await sha256Hex(`staff|${exp}|${password}`)
  return `stf_${exp}.${signature}`
}

export async function verifyStaffToken(token: string, password: string, nowMs = Date.now()): Promise<boolean> {
  const match = /^stf_(\d+)\.([0-9a-f]+)$/.exec(token)
  if (!match || !password) return false
  const exp = Number(match[1])
  if (!Number.isInteger(exp) || exp * 1000 < nowMs) return false
  const expected = await sha256Hex(`staff|${exp}|${password}`)
  return safeEqual(expected, match[2] ?? '')
}

function fromBase64Url(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + pad)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
