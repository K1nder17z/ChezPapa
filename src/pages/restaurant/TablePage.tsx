import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { statusLabel, waitingLabel } from '../../lib/ordering/domain.ts'
import type { Board } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'

export function TablePage() {
  const { table = '' } = useParams()
  const number = Number(table)
  const [board, setBoard] = useState<Board | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.title = `Table ${table} — Chez Papa`
    let stop = false
    const pull = async () => {
      const result = await apiSend<Board>('/api/staff/board', { token: staffToken() })
      if (stop) return
      if (!result.ok) setMessage(result.message)
      else {
        setBoard(result.data)
        setMessage('')
      }
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 2000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [table])

  const current = board?.tables.find((item) => item.number === number)

  async function closeSession() {
    if (!current?.sessionId) return
    const result = await apiSend('/api/staff/sessions/' + current.sessionId + '/close', {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    setMessage(result.ok ? 'Session clôturée.' : result.message)
  }

  async function reopen() {
    const result = await apiSend('/api/staff/tables/' + number + '/session', {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    setMessage(result.ok ? 'Nouvelle session ouverte.' : result.message)
  }

  return (
    <main className="desk">
      <StaffGate>
        <p className="kicker light">Table {table}</p>
        <h1>{current?.label ?? 'Table'}</h1>
        {message ? <p role="status">{message}</p> : null}
        <ul className="desk-orders">
          {(current?.orders ?? []).map((order) => (
            <li key={order.id}>
              <Link to={`/salle/commande/${order.id}`}>
                <strong>{order.publicNumber}</strong>
                <span>
                  {statusLabel[order.status]} · {formatEuro(order.totalCents)}
                  {order.waitingSeconds != null ? ` · ${waitingLabel(order.waitingSeconds)}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {current?.orders.length === 0 ? <p>Aucune commande pour cette session.</p> : null}
        <div className="desk-tools">
          <Link to="/salle/scanner">Scanner</Link>
          <button type="button" onClick={() => void closeSession()} disabled={!current?.sessionId}>
            Clôturer la session
          </button>
          <button type="button" onClick={() => void reopen()}>
            Nouvelle session
          </button>
          <Link to="/salle">Tableau</Link>
        </div>
      </StaffGate>
    </main>
  )
}
