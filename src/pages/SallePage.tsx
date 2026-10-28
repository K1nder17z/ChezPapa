import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SalleGate } from '../components/salle/SalleGate.tsx'
import { formatEuro } from '../lib/format.ts'
import { statusLabel } from '../lib/salle.ts'
import { useSalleOrders } from '../lib/salleStore.ts'
import { priceLines } from '../lib/ticket.ts'

export function SallePage() {
  const orders = useSalleOrders()

  useEffect(() => {
    document.title = 'Salle — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  const visible = [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <main className="salle-page">
      <article className="salle-card">
        <SalleGate>
          <p className="kicker">Salle</p>
          <h1>Commandes</h1>
          {visible.length === 0 ? (
            <p>Aucune commande pour le moment. Scannez le code affiché dans le livre du client.</p>
          ) : (
            <ul className="salle-list">
              {visible.map((order) => {
                const total = priceLines(order.lines).totalCents
                return (
                  <li key={order.code}>
                    <Link to={`/service/${order.code}`}>
                      <strong>{order.tableLabel ? `Table ${order.tableLabel}` : 'Table non indiquée'}</strong>
                      <span>
                        {statusLabel[order.status]}
                        {order.paid ? ' · Payée' : ''} · {formatEuro(total)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/menu">Retour à la carte</Link>
        </SalleGate>
      </article>
    </main>
  )
}
