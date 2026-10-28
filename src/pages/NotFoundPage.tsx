import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Emblem } from '../components/brand/Ornaments.tsx'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page introuvable — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  return (
    <main className="not-found">
      <Emblem />
      <p className="kicker light">Chez Papa</p>
      <h1>Cette page n’existe pas</h1>
      <p>La carte du restaurant reste ouverte.</p>
      <Link to="/menu">Voir la carte</Link>
    </main>
  )
}
