import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatEuro } from '../../lib/format.ts'
import { apiSend, staffToken } from '../../lib/ordering/client.ts'
import { connectionState, statusLabel } from '../../lib/ordering/domain.ts'
import type { StaffOrder } from '../../server/contracts.ts'
import { StaffGate } from './StaffGate.tsx'

export function ScanPage() {
  useEffect(() => {
    document.title = 'Scanner — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])
  return (
    <main className="desk">
      <StaffGate>
        <Scanner />
      </StaffGate>
    </main>
  )
}

function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [order, setOrder] = useState<StaffOrder | null>(null)
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState('')
  const link = connectionState({ navigatorOnline: navigator.onLine && !offline, lastError: offline })

  async function lookup(value: string) {
    setError('')
    setDone('')
    setToken(value)
    const result = await apiSend<StaffOrder>('/api/staff/verify', {
      method: 'POST',
      token: staffToken(),
      body: { pickupToken: value },
    })
    if (!result.ok) {
      setOffline(result.offline)
      setOrder(null)
      setError(result.message)
      return
    }
    setOffline(false)
    setOrder(result.data)
  }

  useEffect(() => {
    if (order) return
    const video = videoRef.current
    if (!video) return
    let stop = false
    let controls: { stop: () => void } | null = null
    const onCode = (value: string) => {
      if (stop) return
      stop = true
      controls?.stop()
      const stream = video.srcObject
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
      void lookup(value)
    }
    void (async () => {
      try {
        const Detector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
        if (Detector) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (stop) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          video.srcObject = stream
          await video.play()
          controls = { stop: () => stream.getTracks().forEach((track) => track.stop()) }
          const detector = new Detector({ formats: ['qr_code'] })
          const tick = async () => {
            if (stop) return
            try {
              const value = (await detector.detect(video))[0]?.rawValue
              if (value) {
                onCode(value)
                return
              }
            } catch {
              /* image pas encore prête */
            }
            if (!stop) requestAnimationFrame(() => void tick())
          }
          void tick()
          return
        }
        const zxing = await import('@zxing/browser')
        const reader = new zxing.BrowserMultiFormatReader()
        const started = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          const value = result?.getText()
          if (value) onCode(value)
        })
        controls = started
        if (stop) started.stop()
      } catch {
        if (!stop) setError('La caméra est indisponible. Autorisez-la pour scanner le QR code du client.')
      }
    })()
    return () => {
      stop = true
      controls?.stop()
      const stream = video.srcObject
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    }
  }, [order])

  async function claim() {
    if (!token || pending) return
    setPending(true)
    const result = await apiSend<StaffOrder>('/api/staff/claim', {
      method: 'POST',
      token: staffToken(),
      body: { pickupToken: token },
    })
    setPending(false)
    if (!result.ok) {
      setOffline(result.offline)
      setError(result.message)
      setDone('')
      return
    }
    setOrder(result.data)
    setDone('Récupération confirmée. Le QR code ne peut plus servir une seconde fois.')
  }

  return (
    <section className="scanner">
      <p className="kicker light">Récupération</p>
      <h1>Scanner la commande</h1>
      <p className={link.online ? 'link-ok' : 'link-down'} role="status">
        {link.online ? 'Connecté' : link.message}
      </p>
      {!order ? <video ref={videoRef} className="viewfinder" muted playsInline /> : null}
      {error ? (
        <p className="salle-error" role="alert">
          {error}
        </p>
      ) : null}
      {order ? (
        <article className="scan-card">
          <h2>
            Table {order.tableNumber}
            <small>Commande {order.publicNumber}</small>
          </h2>
          <p>
            {statusLabel[order.status]}
            {order.paid ? ' · Payée' : ''}
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
          <p>Commandée à {new Date(order.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
          {done ? <p role="status">{done}</p> : null}
          {order.recoverable && !done ? (
            <button type="button" className="finish-order" disabled={pending || !link.online} onClick={() => void claim()}>
              {pending ? 'Confirmation…' : 'Confirmer la récupération'}
            </button>
          ) : (
            <Link to="/salle">Retour au tableau</Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOrder(null)
              setToken('')
              setDone('')
              setError('')
            }}
          >
            Scanner une autre commande
          </button>
        </article>
      ) : null}
    </section>
  )
}
