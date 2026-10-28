const tagline = 'La tradition marocaine, généreusement servie.'

function text(value: string | undefined): string {
  return (value ?? '').trim()
}

export function isPublishableMenuUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const host = url.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.includes('votre-domaine')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function publishable(value: string | undefined): string | null {
  const raw = text(value)
  if (!raw || !isPublishableMenuUrl(raw)) return null
  return new URL(raw).toString()
}

function optionalUrl(value: string | undefined): string | null {
  return publishable(value)
}

function optionalPhone(value: string | undefined): string | null {
  const raw = text(value)
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  return raw
}

function optionalText(value: string | undefined): string | null {
  const raw = text(value)
  return raw.length > 0 ? raw : null
}

export const restaurant = {
  name: 'Chez Papa',
  tagline,
  publicMenuUrl: publishable(import.meta.env.VITE_PUBLIC_MENU_URL),
  address: optionalText(import.meta.env.VITE_RESTAURANT_ADDRESS),
  phone: optionalPhone(import.meta.env.VITE_RESTAURANT_PHONE),
  hours: optionalText(import.meta.env.VITE_RESTAURANT_HOURS),
  mapsUrl: optionalUrl(import.meta.env.VITE_RESTAURANT_MAPS_URL),
  reviewsUrl: optionalUrl(import.meta.env.VITE_RESTAURANT_REVIEWS_URL),
  instagram: optionalUrl(import.meta.env.VITE_RESTAURANT_INSTAGRAM),
  facebook: optionalUrl(import.meta.env.VITE_RESTAURANT_FACEBOOK),
}

