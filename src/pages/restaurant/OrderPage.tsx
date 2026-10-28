import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { statusLabel } from '../../lib/ordering/domain.ts'
import type { CartLine } from '../../lib/cart.ts'
import type { StaffOrder } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'
import { TicketEditor } from './TicketEditor.tsx'

export function OrderPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<StaffOrder | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = 'Commande — Chez Papa'
    let cancel = false
    void (async () => {
      const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}`, { token: staffToken() })
      if (cancel) return
      if (!result.ok) setMessage(result.message)
      else {
        setOrder(result.data)
        setLines(result.data.items.map((item) => ({ dishId: item.dishId, qty: item.qty, supplementQty: item.supplementQty, note: item.note })))
        setNote(result.data.note)
        setMessage('')
      }
    })()
    return () => {
      cancel = true
    }
  }, [id])

  function apply(next: StaffOrder, text: string) {
    setOrder(next)
    setLines(next.items.map((item) => ({ dishId: item.dishId, qty: item.qty, supplementQty: item.supplementQty, note: item.note })))
    setNote(next.note)
    setMessage(text)
  }

  async function saveLines(): Promise<StaffOrder | null> {
    const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}/items`, {
      method: 'POST',
      token: staffToken(),
      body: {
        note,
        lines: lines.map((line) => ({
          dishId: line.dishId,
          qty: line.qty,
          supplementQty: line.supplementQty,
          note: line.note ?? '',
        })),
      },
    })
    if (!result.ok) {
      setMessage(result.message)
      return null
    }
    return result.data
  }

  async function confirmOrder() {
    if (pending || lines.length === 0) return
    setPending(true)
    const saved = await saveLines()
    if (!saved) {
      setPending(false)
      return
    }
    const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}/confirm`, {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    setPending(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    apply(result.data, 'Commande confirmée. Le bon de préparation est prêt.')
  }

  async function saveOnly() {
    if (pending || lines.length === 0) return
    setPending(true)
    const saved = await saveLines()
    setPending(false)
    if (saved) apply(saved, 'Commande mise à jour.')
  }

  async function act(action: 'cancel' | 'pay') {
    const result = await apiSend<StaffOrder>(`/api/staff/orders/${id}/${action}`, {
      method: 'POST',
      token: staffToken(),
      body: {},
    })
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    apply(result.data, action === 'pay' ? 'Paiement enregistré.' : 'Commande annulée.')
  }

  const editable = order?.status === 'submitted' || order?.status === 'ready_for_pickup' || order?.status === 'claimed'
  const needsConfirm = order?.status === 'submitted' || order?.status === 'ready_for_pickup'

  return (
    <main className="desk">
      <StaffGate>
        {!order ? <p>{message || 'Chargement…'}</p> : null}
        {order ? (
          <article className="service-sheet">
            <p className="kicker light">Table {order.tableNumber}</p>
            <h1>{needsConfirm ? 'À confirmer' : order.status === 'claimed' ? 'Bon de préparation' : statusLabel[order.status]}</h1>
            <p className="sheet-meta">
              {order.publicNumber}
              {order.paid ? ' · Payée' : ' · Non payée'}
            </p>
            {order.status === 'claimed' ? (
              <ol className="prep-list">
                {order.items.map((item) => (
                  <li key={`${item.dishId}-${item.note}`}>
                    <b>{item.qty}</b>
                    <span>
                      {item.name}
                      {item.supplementLabel ? <small>{item.supplementLabel} × {item.supplementQty}</small> : null}
                      {item.note ? <small>{item.note}</small> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {order.note ? <p className="sheet-note">{order.note}</p> : null}
            <p className="order-total">
              <span>Total</span>
              <strong>{formatEuro(order.totalCents)}</strong>
            </p>
            {editable ? (
              <>
                <h2>{needsConfirm ? 'Modifier avant de confirmer' : 'Ajouter un article'}</h2>
                <TicketEditor lines={lines} note={note} onChange={setLines} onNote={setNote} />
              </>
            ) : null}
            {message ? <p role="status">{message}</p> : null}
            <div className="desk-tools">
              {needsConfirm ? (
                <button type="button" className="is-solid" disabled={pending || lines.length === 0} onClick={() => void confirmOrder()}>
                  {pending ? 'Confirmation…' : 'Confirmer la commande'}
                </button>
              ) : null}
              {order.status === 'claimed' ? (
                <button type="button" disabled={pending || lines.length === 0} onClick={() => void saveOnly()}>
                  {pending ? 'Enregistrement…' : 'Enregistrer l’ajout'}
                </button>
              ) : null}
              {!order.paid && order.status !== 'cancelled' ? (
                <button type="button" onClick={() => void act('pay')}>
                  Encaisser
                </button>
              ) : null}
              {order.status !== 'cancelled' && order.status !== 'completed' ? (
                <button type="button" onClick={() => void act('cancel')}>
                  Annuler
                </button>
              ) : null}
              <Link to={`/salle/table/${order.tableNumber}`}>Table {order.tableNumber}</Link>
              <Link to="/salle">Salle</Link>
            </div>
          </article>
        ) : null}
      </StaffGate>
    </main>
  )
}
