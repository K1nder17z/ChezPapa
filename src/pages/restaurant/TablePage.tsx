import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { statusLabel, waitingLabel } from '../../lib/ordering/domain.ts'
import type { Board, StaffOrder } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'

export function TablePage() {
  const { table = '' } = useParams()
  const number = Number(table)
  const [board, setBoard] = useState<Board | null>(null)
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [message, setMessage] = useState('')
  const [askClose, setAskClose] = useState(false)
  const [askPay, setAskPay] = useState(false)

  useEffect(() => {
    document.title = `Table ${table} — Chez Papa`
    let stop = false
    const pull = async () => {
      const result = await apiSend<Board>('/api/staff/board', { token: staffToken() })
      if (stop) return
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setBoard(result.data)
      const current = result.data.tables.find((item) => item.number === number)
      const details = await Promise.all(
        (current?.orders ?? []).map((order) => apiSend<StaffOrder>(`/api/staff/orders/${order.id}`, { token: staffToken() })),
      )
      if (stop) return
      setOrders(details.flatMap((item) => (item.ok ? [item.data] : [])))
      setMessage('')
    }
    void pull()
    const timer = window.setInterval(() => void pull(), 2500)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [number, table])

  const current = board?.tables.find((item) => item.number === number)
  const live = orders.filter((order) => order.status !== 'cancelled')
  const due = live.filter((order) => !order.paid).reduce((sum, order) => sum + order.totalCents, 0)
  const total = live.reduce((sum, order) => sum + order.totalCents, 0)

  async function pay() {
    setAskPay(false)
    const unpaid = live.filter((order) => !order.paid)
    for (const order of unpaid) {
      const result = await apiSend<StaffOrder>(`/api/staff/orders/${order.id}/pay`, {
        method: 'POST',
        token: staffToken(),
        body: {},
      })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
    }
    setMessage(unpaid.length > 0 ? 'Paiement enregistré.' : 'Cette table est déjà encaissée.')
  }

  async function closeSession() {
    setAskClose(false)
    if (!current?.sessionId) {
      setMessage('Cette table n’a pas de service ouvert.')
      return
    }
    const result = await apiSend('/api/staff/sessions/' + current.sessionId + '/close', {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    setMessage(result.ok ? 'Table clôturée.' : result.message)
  }

  return (
    <main className="desk">
      <StaffGate>
        <article className="service-sheet">
          <p className="kicker light">Salle</p>
          <h1>Table {table}</h1>
          <p className="sheet-meta">{current?.label ?? 'Libre'}</p>
          {message ? <p role="status">{message}</p> : null}
          {live.length === 0 ? <p>Aucune commande confirmée sur cette table.</p> : null}
          <ul className="table-additions">
            {live.map((order, index) => (
              <li key={order.id}>
                <Link to={`/salle/commande/${order.id}`}>
                  <strong>
                    Envoi {index + 1}
                    <small>
                      {order.publicNumber} · {statusLabel[order.status]}
                      {order.paid ? ' · Payée' : ''}
                      {order.waitingSeconds != null ? ` · ${waitingLabel(order.waitingSeconds)}` : ''}
                    </small>
                  </strong>
                  <span>
                    {order.items.map((item) => `${item.qty} × ${item.name}`).join(' · ')}
                  </span>
                  <em>{formatEuro(order.totalCents)}</em>
                </Link>
              </li>
            ))}
          </ul>
          {live.length > 0 ? (
            <p className="order-total">
              <span>Addition</span>
              <strong>{formatEuro(total)}</strong>
            </p>
          ) : null}
          <div className="desk-tools">
            {due > 0 ? (
              <button type="button" className="is-solid" onClick={() => setAskPay(true)}>
                Passer au paiement · {formatEuro(due)}
              </button>
            ) : null}
            <button type="button" onClick={() => setAskClose(true)} disabled={!current?.sessionId}>
              Clôturer
            </button>
            <Link to="/salle">Salle</Link>
          </div>
        </article>
        {askPay ? (
          <div className="confirm-layer" role="dialog" aria-modal="true" aria-labelledby="pay-title">
            <div className="confirm-card">
              <h2 id="pay-title">Encaisser la table {table} ?</h2>
              <p>{formatEuro(due)} seront marqués comme payés.</p>
              <div className="desk-tools">
                <button type="button" className="is-solid" onClick={() => void pay()}>
                  Oui, encaisser
                </button>
                <button type="button" onClick={() => setAskPay(false)}>
                  Non
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {askClose ? (
          <div className="confirm-layer" role="dialog" aria-modal="true" aria-labelledby="close-title">
            <div className="confirm-card">
              <h2 id="close-title">Clôturer la table {table} ?</h2>
              <p>Les téléphones reliés à cette table ne pourront plus commander.</p>
              {due > 0 ? <p>L’addition n’est pas encore encaissée ({formatEuro(due)}).</p> : null}
              <div className="desk-tools">
                <button type="button" className="is-solid" onClick={() => void closeSession()}>
                  Oui, clôturer
                </button>
                <button type="button" onClick={() => setAskClose(false)}>
                  Non
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </StaffGate>
    </main>
  )
}
