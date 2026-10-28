import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toDataURL } from 'qrcode'
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
import { statusLabel, type OrderStatus } from '../lib/ordering/domain.ts'
import { priceLines } from '../lib/ticket.ts'
import type { ClientOrder } from '../server/contracts.ts'

export function MyOrderPage() {
  const lines = useCartLines()
  const priced = useMemo(() => priceLines(lines), [lines])
  const table = currentTable()
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [note, setNote] = useState(orderNote)
  const [message, setMessage] = useState('')
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState<'submit' | 'ready' | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    document.title = 'Votre commande — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  useEffect(() => {
    if (!table) return
    let cancel = false
    void (async () => {
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
    })()
    return () => {
      cancel = true
    }
  }, [table])

  async function reload() {
    const listed = await apiSend<{ orders: ClientOrder[] }>('/api/client/orders', { token: deviceToken() })
    if (!listed.ok) {
      setOffline(listed.offline)
      setMessage(listed.message)
      return
    }
    setOrders(listed.data.orders)
    setOffline(false)
  }

  async function submit() {
    if (pending || !table || priced.lines.length === 0) return
    setPending('submit')
    setMessage('')
    const session = await ensureDevice(table)
    if (!session.ok) {
      setPending(null)
      setOffline(session.offline)
      setMessage(session.offline ? session.message : session.message)
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
    setPending(null)
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
    await reload()
  }

  async function finish(orderId: string) {
    if (pending) return
    setPending('ready')
    setMessage('')
    const result = await apiSend<ClientOrder>(`/api/client/orders/${orderId}/ready`, {
      method: 'POST',
      token: deviceToken(),
      body: {},
    })
    setPending(null)
    if (!result.ok) {
      setOffline(result.offline)
      setMessage(result.message)
      return
    }
    setOffline(false)
    await reload()
  }

  const active = orders.filter((order) => order.status === 'submitted' || order.status === 'ready_for_pickup')

  return (
    <main className="salle-page">
      <article className="salle-card order-confirm">
        <p className="kicker">Chez Papa</p>
        <h1>Votre commande</h1>
        {table ? <p className="order-table-label">Table {table}</p> : <p>Scannez le QR code posé sur votre table.</p>}
        {offline || message ? (
          <p className="salle-error" role="alert">
            {message}
          </p>
        ) : null}
        {active.map((order) =>
          order.status === 'ready_for_pickup' ? (
            <ReadyTicket key={order.id} order={order} />
          ) : (
            <SubmittedTicket key={order.id} order={order} pending={pending === 'ready'} onFinish={() => void finish(order.id)} />
          ),
        )}
        {table && loaded && (priced.lines.length > 0 || active.length === 0) ? (
          <section className="cart-editor">
            {active.length > 0 ? <h2>Autre commande</h2> : null}
            {priced.lines.length === 0 ? (
              <p>Le panier est vide.</p>
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
                <button type="button" className="finish-order" disabled={pending !== null || priced.lines.length === 0} onClick={() => void submit()}>
                  {pending === 'submit' ? 'Enregistrement…' : 'Valider la commande'}
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

function SubmittedTicket({ order, pending, onFinish }: { order: ClientOrder; pending: boolean; onFinish: () => void }) {
  return (
    <section className="ticket">
      <p className="kicker">Récapitulatif</p>
      <h2>
        Table {order.tableNumber}
        <small>Commande {order.publicNumber}</small>
      </h2>
      <OrderLines order={order} />
      <p className="order-total">
        <span>Total</span>
        <strong>{formatEuro(order.totalCents)}</strong>
      </p>
      <button type="button" className="finish-order" disabled={pending} onClick={onFinish}>
        {pending ? 'Enregistrement…' : 'J’ai terminé ma commande'}
      </button>
    </section>
  )
}

function ReadyTicket({ order }: { order: ClientOrder }) {
  const [image, setImage] = useState<string | null>(null)
  useEffect(() => {
    if (!order.qrPayload) return
    let cancel = false
    void toDataURL(order.qrPayload, {
      margin: 2,
      width: 360,
      errorCorrectionLevel: 'H',
      color: { dark: '#100D0A', light: '#FFFFFF' },
    }).then((value) => {
      if (!cancel) setImage(value)
    })
    return () => {
      cancel = true
    }
  }, [order.qrPayload])
  return (
    <section className="ticket">
      <p className="kicker">{statusLabel[order.status as OrderStatus]}</p>
      <h2>
        Table {order.tableNumber}
        <small>Commande {order.publicNumber}</small>
      </h2>
      <OrderLines order={order} />
      <p className="order-total">
        <span>Total</span>
        <strong>{formatEuro(order.totalCents)}</strong>
      </p>
      {image ? (
        <figure className="pickup-qr">
          <img src={image} alt={`QR code de la commande ${order.publicNumber}`} />
        </figure>
      ) : (
        <p>Préparation du QR code…</p>
      )}
      <p className="pickup-note">
        Votre commande est prête à être récupérée par le restaurant. Gardez ce QR code affiché sur votre téléphone
        jusqu’au passage du restaurateur.
      </p>
    </section>
  )
}

function OrderLines({ order }: { order: ClientOrder }) {
  return (
    <ul className="service-lines">
      {order.items.map((item) => (
        <li key={item.dishId}>
          <span>
            {item.qty} × {item.name}
            <small>{formatEuro(item.unitCents)}</small>
            {item.supplementLabel ? (
              <small>
                {item.supplementLabel} × {item.supplementQty}
              </small>
            ) : null}
            {item.note ? <small>{item.note}</small> : null}
          </span>
          <strong>{formatEuro(item.lineCents)}</strong>
        </li>
      ))}
      {order.note ? (
        <li>
          <span>{order.note}</span>
        </li>
      ) : null}
    </ul>
  )
}
