import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { statusLabel } from '../../lib/ordering/domain.ts'
import type { HistoryRow } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'

export function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.title = 'Historique — Chez Papa'
    void (async () => {
      const result = await apiSend<HistoryRow[]>('/api/staff/history', { token: staffToken() })
      if (!result.ok) setMessage(result.message)
      else setRows(result.data)
    })()
  }, [])

  return (
    <main className="desk">
      <StaffGate>
        <p className="kicker light">Restaurant</p>
        <h1>Historique</h1>
        {message ? <p className="salle-error">{message}</p> : null}
        <ul className="desk-orders">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/salle/commande/${row.id}`}>
                <strong>
                  Table {row.tableNumber} · {row.publicNumber}
                </strong>
                <span>
                  {statusLabel[row.status]} · {formatEuro(row.totalCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {rows.length === 0 && !message ? <p>Aucune commande dans l’historique.</p> : null}
      </StaffGate>
    </main>
  )
}
