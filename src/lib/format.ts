export function formatEuro(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const euros = Math.floor(absolute / 100)
  const remainder = absolute % 100
  return `${sign}${euros},${String(remainder).padStart(2, '0')} €`
}
