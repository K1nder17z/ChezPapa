import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import {
  apiSend,
  beep,
  freshAlerts,
  saveStaffToken,
  setSoundEnabled,
  soundEnabled,
  staffToken,
} from '../../lib/ordering/client.ts'
import { connectionState, statusLabel, waitingLabel, type OrderStatus, type Tone } from '../../lib/ordering/domain.ts'
import type { Board, BoardAlert } from '../../server/contracts.ts'
import { FloorPlan } from './FloorPlan.tsx'
import { StaffGate } from './StaffGate.tsx'

export function BoardPage() {
  useEffect(() => {
    document.title = 'Restaurant — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  return (
    <main className="desk">
      <StaffGate>
        <LiveBoard />
      </StaffGate>
    </main>
  )
}

function LiveBoard() {
  const [board, setBoard] = useState<Board | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [error, setError] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const [notice, setNotice] = useState<BoardAlert | null>(null)
  const [count, setCount] = useState('10')

  useEffect(() => {
    let stop = false
    let timer = 0
    const pull = async () => {
      const online = navigator.onLine
      const result = await apiSend<Board>('/api/staff/board', { token: staffToken() })
      if (stop) return
      if (!result.ok) {
        setOffline(!online || result.offline)
        setError(true)
        if (result.status === 401) saveStaffToken(null)
      } else {
        setBoard(result.data)
        setCount(String(result.data.tableCount))
        setError(false)
        setOffline(!online)
        const fresh = freshAlerts(result.data.alerts.map((alert) => alert.orderId))
        const newest = [...result.data.alerts].reverse().find((alert) => fresh.includes(alert.orderId))
        if (newest) {
          setNotice(newest)
          if (soundEnabled()) beep()
        }
      }
      timer = window.setTimeout(() => void pull(), document.visibilityState === 'visible' ? 2000 : 8000)
    }
    void pull()
    const onLine = () => void pull()
    window.addEventListener('online', onLine)
    window.addEventListener('offline', onLine)
    return () => {
      stop = true
      window.clearTimeout(timer)
      window.removeEventListener('online', onLine)
      window.removeEventListener('offline', onLine)
    }
  }, [])

  const link = connectionState({ navigatorOnline: !offline && navigator.onLine, lastError: error })
  const live = (board?.tables ?? []).flatMap((table) =>
    table.orders
      .filter((order) => order.status === 'submitted' || order.status === 'ready_for_pickup')
      .map((order) => ({ ...order, tableNumber: table.number })),
  )
  live.sort((a, b) => rank(a.status) - rank(b.status) || a.tableNumber - b.tableNumber)

  async function saveCount() {
    const tableCount = Number(count)
    const result = await apiSend<{ tableCount: number }>('/api/staff/settings', {
      method: 'POST',
      token: staffToken(),
      body: { tableCount },
    })
    if (!result.ok) setError(true)
  }

  return (
    <div className="desk-wrap">
      <header className="desk-head">
        <div>
          <p className="kicker light">Chez Papa</p>
          <h1>Restaurant</h1>
        </div>
        <div className="desk-head-actions">
          <p className={link.online ? 'link-ok' : 'link-down'} role="status">
            {link.online ? 'En direct' : link.message}
          </p>
          <button
            type="button"
            onClick={() => {
              const next = !sound
              setSound(next)
              setSoundEnabled(next)
              if (next) beep()
            }}
          >
            {sound ? 'Son activé' : 'Activer le son'}
          </button>
        </div>
      </header>
      {notice ? (
        <div className="desk-alert" role="alert">
          <strong>Table {notice.tableNumber} — à confirmer</strong>
          <span>
            Commande {notice.publicNumber}. {waitingLabel(notice.waitingSeconds)}.
          </span>
          <Link to={`/salle/commande/${notice.orderId}`}>Ouvrir</Link>
        </div>
      ) : null}
      <section className="desk-live">
        <h2>À confirmer</h2>
        {live.length === 0 ? <p className="desk-empty">Aucune commande confirmée par les clients.</p> : null}
        <ul className="order-list">
          {live.map((order) => (
            <li key={order.id}>
              <Link to={`/salle/commande/${order.id}`} data-tone={toneFor(order.status)}>
                <strong>Table {order.tableNumber}</strong>
                <span>
                  {order.publicNumber}
                  <small>
                    {statusLabel[order.status]}
                    {order.waitingSeconds != null ? ` · ${waitingLabel(order.waitingSeconds)}` : ''}
                  </small>
                </span>
                <em>{formatEuro(order.totalCents)}</em>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="desk-tables">
        <h2>Salle</h2>
        <FloorPlan tables={board?.tables ?? []} />
        <form
          className="desk-count"
          onSubmit={(event) => {
            event.preventDefault()
            void saveCount()
          }}
        >
          <label>
            Tables suivies
            <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
          </label>
          <button type="submit">Enregistrer</button>
        </form>
      </section>
    </div>
  )
}

function rank(status: string): number {
  if (status === 'submitted' || status === 'ready_for_pickup') return 0
  return 1
}

function toneFor(status: OrderStatus): Tone {
  if (status === 'submitted' || status === 'ready_for_pickup') return 'red'
  if (status === 'claimed') return 'orange'
  if (status === 'completed') return 'green'
  return 'grey'
}
