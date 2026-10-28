import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toString } from 'qrcode'
import { Emblem } from '../components/brand/Ornaments.tsx'
import { apiSend } from '../lib/ordering/client.ts'

type Tent = { number: number; svg: string; url: string }

export function PrintTablesPage() {
  const [tents, setTents] = useState<Tent[]>([])
  const [message, setMessage] = useState('')
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)

  useEffect(() => {
    document.title = 'QR des tables — Chez Papa'
    let cancel = false
    void (async () => {
      const result = await apiSend<{ tables: Array<{ number: number; path: string }> }>('/api/tables')
      const tables = result.ok ? result.data.tables : Array.from({ length: 10 }, (_, index) => ({ number: index + 1, path: `/t/${index + 1}` }))
      if (!result.ok) setMessage('Le nombre de tables configuré n’a pas pu être lu. Dix tables sont proposées.')
      const origin = window.location.origin
      const next: Tent[] = []
      for (const table of tables) {
        const url = `${origin}${table.path}`
        const svg = await toString(url, {
          type: 'svg',
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 280,
          color: { dark: '#100D0A', light: '#FFFFFF' },
        })
        if (svg.trimStart().startsWith('<svg')) next.push({ number: table.number, svg, url })
      }
      if (!cancel) setTents(next)
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <main className="print-page">
      <div className="print-actions no-print">
        <Link to="/impression">QR de la carte</Link>
        <Link to="/salle">Tableau des tables</Link>
        <button type="button" onClick={() => window.print()} disabled={tents.length === 0}>
          Imprimer
        </button>
      </div>
      {local ? (
        <p className="no-print salle-error">
          Ces QR codes pointent vers cet ordinateur. Imprimez-les depuis le site public du restaurant.
        </p>
      ) : null}
      {message ? <p className="no-print">{message}</p> : null}
      {tents.map((tent) => (
        <article className="tent tent-sheet" key={tent.number}>
          <Emblem />
          <h1>Chez Papa</h1>
          <p className="tent-sub">Table {tent.number}</p>
          <p className="tent-invite">Scannez pour commander</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: tent.svg }} />
          <p className="tent-url">{tent.url}</p>
        </article>
      ))}
    </main>
  )
}
