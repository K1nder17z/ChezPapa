import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MenuExperience } from './MenuExperience.tsx'
import { ensureDevice } from '../lib/ordering/client.ts'

export function TableEntry() {
  const { table = '' } = useParams()
  const number = Number(table)
  const valid = Number.isInteger(number) && number >= 1 && number <= 200

  useEffect(() => {
    if (!valid) return
    void ensureDevice(number, true)
  }, [number, valid])

  if (!valid) {
    return (
      <main className="salle-page">
        <article className="salle-card">
          <p className="kicker">Table</p>
          <h1>Table introuvable</h1>
          <p>Ce QR code ne correspond pas à une table du restaurant.</p>
        </article>
      </main>
    )
  }

  return <MenuExperience />
}
