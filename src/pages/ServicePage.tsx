import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SalleGate } from '../components/salle/SalleGate.tsx'
import { formatEuro } from '../lib/format.ts'
import { statusLabel, type SalleAction } from '../lib/salle.ts'
import { ensureSalleOrder, runSalleAction, saveSalleTable, useSalleOrders } from '../lib/salleStore.ts'
import { decodeTicket, priceLines } from '../lib/ticket.ts'

export function ServicePage() {
  const { code = '' } = useParams()
  const lines = useMemo(() => decodeTicket(code), [code])
  const orders = useSalleOrders()
  const order = orders.find((item) => item.code === code) ?? null

  useEffect(() => {
    document.title = 'Commande — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  useLayoutEffect(() => {
    if (!lines) return
    ensureSalleOrder(code, lines)
  }, [code, lines])

  return (
    <main className="salle-page">
      <article className="salle-card">
        {!lines ? (
          <>
            <p className="kicker">Salle</p>
            <h1>Commande introuvable</h1>
            <p>Ce code ne correspond à aucune commande de la carte.</p>
            <Link to="/menu">Retour à la carte</Link>
          </>
        ) : order ? (
          <SalleGate>
            <ServiceOrder code={code} />
          </SalleGate>
        ) : null}
      </article>
    </main>
  )
}

function ServiceOrder({ code }: { code: string }) {
  const orders = useSalleOrders()
  const order = orders.find((item) => item.code === code)
  const [table, setTable] = useState(order?.tableLabel ?? '')
  const [editing, setEditing] = useState(!order?.tableLabel)
  const [confirm, setConfirm] = useState<'pay' | 'cancel' | null>(null)
  if (!order) return null
  const priced = priceLines(order.lines)

  function onTable(event: FormEvent) {
    event.preventDefault()
    if (!table.trim()) return
    saveSalleTable(code, table)
    setEditing(false)
  }

  function act(action: SalleAction) {
    runSalleAction(code, action)
    setConfirm(null)
  }

  return (
    <section className="service-order">
      <p className="kicker">Table</p>
      {editing ? (
        <form onSubmit={onTable}>
          <h1>Quelle table ?</h1>
          <label>
            Nom ou numéro
            <input
              value={table}
              onChange={(event) => setTable(event.target.value)}
              maxLength={40}
              required
              autoFocus
              placeholder="12 ou Terrasse"
            />
          </label>
          <button type="submit">Voir la commande</button>
        </form>
      ) : (
        <>
          <header className="service-head">
            <h1>Table {order.tableLabel}</h1>
            <button type="button" onClick={() => setEditing(true)}>
              Modifier
            </button>
          </header>
          <p className={`service-status status-${order.status}`}>
            {statusLabel[order.status]}
            {order.paid ? ' · Payée' : ''}
          </p>
          <ul className="service-lines">
            {priced.lines.map((line) => (
              <li key={line.dishId}>
                <span>
                  {line.qty} × {line.name}
                  {line.supplementLabel ? <small>{line.supplementLabel} × {line.supplementQty}</small> : null}
                </span>
                <strong>{formatEuro(line.lineCents)}</strong>
              </li>
            ))}
          </ul>
          <p className="order-total">
            <span>Total</span>
            <strong>{formatEuro(priced.totalCents)}</strong>
          </p>
          {confirm === 'pay' ? (
            <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-pay">
              <p id="confirm-pay">Êtes-vous sûr que cette commande a été payée ?</p>
              <button type="button" onClick={() => setConfirm(null)}>
                Pas encore
              </button>
              <button type="button" className="is-solid" onClick={() => act('pay')}>
                Oui, elle est payée
              </button>
            </div>
          ) : null}
          {confirm === 'cancel' ? (
            <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-cancel">
              <p id="confirm-cancel">Annuler cette commande ?</p>
              <button type="button" onClick={() => setConfirm(null)}>
                Retour
              </button>
              <button type="button" className="is-solid" onClick={() => act('cancel')}>
                Oui, annuler
              </button>
            </div>
          ) : null}
          {confirm ? null : (
            <div className="service-actions">
              {order.status === 'attente' ? (
                <button type="button" className="is-solid" onClick={() => act('start')}>
                  Démarrer
                </button>
              ) : null}
              {order.status === 'pause' ? (
                <button type="button" className="is-solid" onClick={() => act('start')}>
                  Reprendre
                </button>
              ) : null}
              {order.status === 'en_cours' ? (
                <button type="button" onClick={() => act('pause')}>
                  Pause
                </button>
              ) : null}
              {order.status === 'en_cours' || order.status === 'pause' ? (
                <button type="button" onClick={() => act('finish')}>
                  Terminer
                </button>
              ) : null}
              {order.status !== 'annulee' && order.status !== 'terminee' ? (
                <button type="button" onClick={() => setConfirm('cancel')}>
                  Annuler
                </button>
              ) : null}
              {!order.paid && order.status !== 'annulee' ? (
                <button type="button" onClick={() => setConfirm('pay')}>
                  Le client a payé
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  )
}
