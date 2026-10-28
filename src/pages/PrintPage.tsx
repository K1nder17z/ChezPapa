import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toString } from 'qrcode'
import { Emblem } from '../components/brand/Ornaments.tsx'
import { restaurant } from '../config/restaurant.ts'

export function PrintPage() {
  const [svg, setSvg] = useState<string | null>(null)
  const url = restaurant.publicMenuUrl

  useEffect(() => {
    document.title = 'QR code — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  useEffect(() => {
    if (!url) return
    let cancelled = false
    toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 280,
      color: { dark: '#100D0A', light: '#FFFFFF' },
    })
      .then((markup) => {
        if (!cancelled && markup.trimStart().startsWith('<svg')) setSvg(markup)
      })
      .catch(() => {
        if (!cancelled) setSvg(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <main className="print-page">
      <div className="print-actions no-print">
        <Link to="/menu">Retour à la carte</Link>
        <Link to="/impression/tables">QR des tables</Link>
        <button type="button" onClick={() => window.print()} disabled={!svg}>
          Imprimer
        </button>
      </div>
      <article className="tent">
        <Emblem />
        <h1>Chez Papa</h1>
        <p className="tent-sub">Cuisine traditionnelle marocaine</p>
        <p className="tent-invite">Scannez pour découvrir notre carte</p>
        {svg ? (
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="qr qr-missing">
            <p>URL publique non configurée.</p>
            <p>
              Définissez <code>VITE_PUBLIC_MENU_URL</code> avec l’adresse définitive du menu, par
              exemple <code>https://votre-domaine.be/menu</code>, puis relancez la construction du
              site avant d’imprimer.
            </p>
          </div>
        )}
        {url ? <p className="tent-url">{url}</p> : null}
      </article>
    </main>
  )
}
