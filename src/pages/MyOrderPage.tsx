import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleStars } from '../components/review/GoogleStars.tsx'
import { restaurant } from '../config/restaurant.ts'
import { allDishes } from '../data/menu.ts'
import { clearCart, dispatchCart, setCartNote, useCartLines } from '../lib/cartStore.ts'
import { formatEuro } from '../lib/format.ts'
import {
  apiSend,
  clearClientRequest,
  clientRequestId,
  currentTable,
  deviceToken,
  ensureDevice,
  orderNote,
  saveOrderNote,
} from '../lib/ordering/client.ts'
import type { OrderStatus } from '../lib/ordering/domain.ts'
import { priceLines } from '../lib/ticket.ts'
import type { ClientOrder } from '../server/contracts.ts'

const REVIEW_KEY = 'chezpapa-ask-review'

function reviewTarget(): string | null {
  try {
    return sessionStorage.getItem(REVIEW_KEY)
  } catch {
    return null
  }
}

function guestStatus(status: OrderStatus): string {
  if (status === 'claimed') return 'Confirmée par le restaurant'
  if (status === 'completed') return 'Terminée'
  if (status === 'cancelled') return 'Annulée'
  return 'Envoyée au restaurant'
}

export function MyOrderPage() {
  const lines = useCartLines()
  const priced = useMemo(() => priceLines(lines), [lines])
  const table = currentTable()
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [note, setNote] = useState(orderNote)
  const [message, setMessage] = useState('')
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [askReview, setAskReview] = useState<string | null>(reviewTarget)

  useEffect(() => {
    document.title = 'Votre commande — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  useEffect(() => {
    if (!table) return
    let cancel = false
    let timer = 0
    const pull = async () => {
      const session = await ensureDevice(table)
      if (cancel) return
      if (!session.ok) {
        setOffline(session.offline)
        setMessage(session.message)
        setLoaded(true)
        return
      }
      const listed = await apiSend<{ orders: ClientOrder[] }>('/api/client/orders', { token: deviceToken() })
      if (cancel) return
      if (!listed.ok) {
        setOffline(listed.offline)
        setMessage(listed.message)
      } else {
        setOrders(listed.data.orders)
        setMessage('')
        setOffline(false)
      }
      setLoaded(true)
      timer = window.setTimeout(() => void pull(), 4000)
    }
    void pull()
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [table])

  async function submit() {
    if (pending || !table || priced.lines.length === 0) return
    setPending(true)
    setMessage('')
    const session = await ensureDevice(table)
    if (!session.ok) {
      setPending(false)
      setOffline(session.offline)
      setMessage(session.message)
      return
    }
    const result = await apiSend<ClientOrder>('/api/client/orders', {
      method: 'POST',
      token: deviceToken(),
      keepCart: true,
      body: {
        clientRequestId: clientRequestId(),
        note,
        lines: lines.map((line) => ({
          dishId: line.dishId,
          qty: line.qty,
          supplementQty: line.supplementQty,
          note: line.note ?? '',
        })),
      },
    })
    setPending(false)
    if (!result.ok) {
      setOffline(result.offline)
      setMessage(result.message)
      return
    }
    clearClientRequest()
    saveOrderNote('')
    setNote('')
    clearCart()
    setOffline(false)
    setMessage('')
    try {
      sessionStorage.setItem(REVIEW_KEY, result.data.id)
    } catch {
      /* navigation privée */
    }
    setAskReview(result.data.id)
    setOrders((current) => {
      const rest = current.filter((order) => order.id !== result.data.id)
      return [...rest, result.data]
    })
  }

  const visible = orders.filter((order) => order.status !== 'cancelled')
  const reviewing = visible.find((order) => order.id === askReview) ?? null

  return (
    <main className="salle-page">
      <article className="salle-card order-confirm">
        <p className="kicker">Chez Papa</p>
        <h1>Votre commande</h1>
        {table ? (
          <>
            <p className="order-table-label">Table {table}</p>
            <p className="linked-note">
              Un seul QR pour cette table. Les autres téléphones qui le scannent partagent la même addition.
            </p>
          </>
        ) : (
          <p>Scannez le QR code posé sur votre table.</p>
        )}
        {offline || message ? (
          <p className="salle-error" role="alert">
            {message}
          </p>
        ) : null}
        {reviewing ? (
          <section className="review-ask">
            <p className="kicker">Merci</p>
            <h2>Commande confirmée</h2>
            <p>
              La table {reviewing.tableNumber} l’a reçue. Un avis sur le service aide beaucoup le restaurant.
            </p>
            <GoogleStars url={restaurant.reviewHref} />
            <a className="finish-order review-go" href={restaurant.reviewHref} rel="noopener noreferrer">
              Écrire un avis sur Google
            </a>
            <button
              type="button"
              className="text-dismiss"
              onClick={() => {
                try {
                  sessionStorage.removeItem(REVIEW_KEY)
                } catch {
                  /* navigation privée */
                }
                setAskReview(null)
              }}
            >
              Plus tard
            </button>
          </section>
        ) : null}
        {visible.map((order) => (
          <section className="ticket" key={order.id}>
            <p className="kicker">{guestStatus(order.status)}</p>
            <h2>
              Table {order.tableNumber}
              <small>Commande {order.publicNumber}</small>
            </h2>
            <ul className="service-lines">
              {order.items.map((item) => (
                <li key={`${item.dishId}-${item.note}`}>
                  <span>
                    {item.qty} × {item.name}
                    {item.note ? <small>{item.note}</small> : null}
                  </span>
                  <strong>{formatEuro(item.lineCents)}</strong>
                </li>
              ))}
            </ul>
            <p className="order-total">
              <span>Total</span>
              <strong>{formatEuro(order.totalCents)}</strong>
            </p>
          </section>
        ))}
        {table && loaded ? (
          <section className="cart-editor">
            {visible.length > 0 ? <h2>Ajouter à la table</h2> : null}
            {priced.lines.length === 0 ? (
              <p>{visible.length > 0 ? 'Le panier est vide. Vous pouvez encore commander.' : 'Le panier est vide.'}</p>
            ) : (
              <>
                <ul className="service-lines">
                  {priced.lines.map((line) => {
                    const supplement = allDishes().find((dish) => dish.id === line.dishId)?.supplement
                    const draft = lines.find((item) => item.dishId === line.dishId)
                    return (
                      <li key={line.dishId}>
                        <span>
                          {line.name}
                          <small>{formatEuro(line.unitCents)} l’unité</small>
                          {line.supplementLabel ? (
                            <small>
                              {line.supplementLabel} × {line.supplementQty}
                            </small>
                          ) : null}
                        </span>
                        <strong>{formatEuro(line.lineCents)}</strong>
                        <div className="dish-buy">
                          <button type="button" className="step-btn" onClick={() => dispatchCart('dec', line.dishId)} aria-label={`Retirer un ${line.name}`}>
                            −
                          </button>
                          <span>{line.qty}</span>
                          <button type="button" className="step-btn" onClick={() => dispatchCart('inc', line.dishId)} disabled={line.qty >= 12} aria-label={`Ajouter un ${line.name}`}>
                            +
                          </button>
                        </div>
                        {supplement ? (
                          <div className="dish-extra">
                            <span>{supplement.label}</span>
                            <button type="button" className="step-btn" onClick={() => dispatchCart('sup-dec', line.dishId)}>
                              −
                            </button>
                            <span>{line.supplementQty}</span>
                            <button type="button" className="step-btn" onClick={() => dispatchCart('sup-inc', line.dishId)} disabled={line.supplementQty >= line.qty}>
                              +
                            </button>
                          </div>
                        ) : null}
                        <label className="line-note">
                          Remarque
                          <input
                            value={draft?.note ?? ''}
                            maxLength={140}
                            onChange={(event) => setCartNote(line.dishId, event.target.value)}
                            placeholder="Sans oignon, peu épicé…"
                          />
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <label className="line-note">
                  Remarque pour la commande
                  <input
                    value={note}
                    maxLength={240}
                    onChange={(event) => {
                      setNote(event.target.value)
                      saveOrderNote(event.target.value)
                    }}
                  />
                </label>
                <p className="order-total">
                  <span>Total</span>
                  <strong>{formatEuro(priced.totalCents)}</strong>
                </p>
                <button type="button" className="finish-order" disabled={pending || priced.lines.length === 0} onClick={() => void submit()}>
                  {pending ? 'Enregistrement…' : 'Confirmer la commande'}
                </button>
              </>
            )}
          </section>
        ) : null}
        {!loaded && table ? <p>Chargement de la commande…</p> : null}
        <Link to={table ? `/t/${table}` : '/menu'}>Retour à la carte</Link>
      </article>
    </main>
  )
}
