import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { statusLabel } from '../../lib/ordering/domain.ts'
import type { StaffOrder } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'

export function OrderPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<StaffOrder | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.title = 'Commande — Chez Papa'
    let cancel = false
    void (async () => {
      const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}`, { token: staffToken() })
      if (cancel) return
      if (!result.ok) setMessage(result.message)
      else {
        setOrder(result.data)
        setMessage('')
      }
    })()
    return () => {
      cancel = true
    }
  }, [id])

  async function act(action: 'complete' | 'cancel' | 'pay') {
    const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}/${action}`, {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setOrder(result.data)
    setMessage(action === 'pay' ? 'Paiement enregistré. La commande n’est pas pour autant servie.' : 'Statut enregistré.')
  }

  return (
    <main className="desk">
      <StaffGate>
        {!order ? <p>{message || 'Chargement…'}</p> : null}
        {order ? (
          <article className="scan-card">
            <p className="kicker light">Table {order.tableNumber}</p>
            <h1>{order.publicNumber}</h1>
            <p>
              {statusLabel[order.status]}
              {order.paid ? ' · Payée' : ' · Non payée'}
            </p>
            <ul>
              {order.items.map((item) => (
                <li key={`${item.dishId}-${item.note}`}>
                  <span>
                    {item.qty} × {item.name}
                    {item.supplementLabel ? ` · ${item.supplementLabel} × ${item.supplementQty}` : ''}
                    {item.note ? ` · ${item.note}` : ''}
                  </span>
                  <strong>{formatEuro(item.lineCents)}</strong>
                </li>
              ))}
            </ul>
            {order.note ? <p>{order.note}</p> : null}
            <p className="order-total">
              <span>Total</span>
              <strong>{formatEuro(order.totalCents)}</strong>
            </p>
            <p>Passée à {new Date(order.createdAt).toLocaleString('fr-BE')}</p>
            {order.status === 'ready_for_pickup' ? (
              <p>La récupération se confirme en scannant le QR code du client.</p>
            ) : null}
            {message ? <p role="status">{message}</p> : null}
            <div className="desk-tools">
              {order.status === 'ready_for_pickup' ? <Link to="/salle/scanner">Scanner</Link> : null}
              {order.status === 'claimed' ? (
                <button type="button" onClick={() => void act('complete')}>
                  Clôturer
                </button>
              ) : null}
              {order.status !== 'cancelled' && order.status !== 'completed' ? (
                <button type="button" onClick={() => void act('cancel')}>
                  Annuler
                </button>
              ) : null}
              {!order.paid && order.status !== 'cancelled' ? (
                <button type="button" onClick={() => void act('pay')}>
                  Le client a payé
                </button>
              ) : null}
              <Link to="/salle">Tableau</Link>
              <Link to={`/salle/table/${order.tableNumber}`}>Table {order.tableNumber}</Link>
            </div>
          </article>
        ) : null}
      </StaffGate>
    </main>
  )
}
