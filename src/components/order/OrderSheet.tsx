import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { toDataURL } from 'qrcode'
import { Rule } from '../brand/Ornaments.tsx'
import { allDishes } from '../../data/menu.ts'
import { useCartLines } from '../../lib/cartStore.ts'
import { formatEuro } from '../../lib/format.ts'
import { encodeTicket, priceLines, ticketUrl } from '../../lib/ticket.ts'
import { syncBookDom } from '../book/syncBookDom.ts'

export function OrderSheet() {
  const lines = useCartLines()
  const priced = useMemo(() => priceLines(lines), [lines])
  const code = useMemo(() => encodeTicket(lines), [lines])
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let cancel = false
    toDataURL(ticketUrl(window.location.origin, code), {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
      color: { dark: '#100D0A', light: '#FFFFFF' },
    })
      .then((image) => {
        if (!cancel) setQr(image)
      })
      .catch(() => {
        if (!cancel) setQr(null)
      })
    return () => {
      cancel = true
    }
  }, [code])

  useLayoutEffect(() => {
    syncBookDom()
  })

  return (
    <div className="order-page">
      <header className="cat-head">
        <p className="kicker">La salle</p>
        <h2>Votre commande</h2>
        <Rule />
      </header>
      {priced.lines.length === 0 ? (
        <p className="lede">Ajoutez un plat avec +. Le total et le code pour la salle s’affichent ici.</p>
      ) : (
        <>
          <ul className="order-lines">
            {priced.lines.map((line) => {
              const supplement = allDishes().find((dish) => dish.id === line.dishId)?.supplement
              return (
              <li key={line.dishId}>
                <span className="dish-name">{line.name}</span>
                <strong>{formatEuro(line.lineCents)}</strong>
                <div className="dish-buy" data-buy={`order-${line.dishId}`}>
                  <button
                    type="button"
                    className="step-btn"
                    data-cart="dec"
                    data-dish={line.dishId}
                    aria-label={`Retirer un ${line.name}`}
                  >
                    −
                  </button>
                  <span className="step-qty" data-qty={`order-${line.dishId}`}>
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    className="step-btn"
                    data-cart="inc"
                    data-dish={line.dishId}
                    disabled={line.qty >= 12}
                    aria-label={`Ajouter un ${line.name}`}
                  >
                    +
                  </button>
                </div>
                {supplement ? (
                  <div className="dish-extra">
                    <span>{supplement.label}</span>
                    <button
                      type="button"
                      className="step-btn"
                      data-cart="sup-dec"
                      data-dish={line.dishId}
                      disabled={line.supplementQty === 0}
                      aria-label={`Retirer ${supplement.label}`}
                    >
                      −
                    </button>
                    <span data-sup-qty={`order-${line.dishId}`}>{line.supplementQty}</span>
                    <button
                      type="button"
                      className="step-btn"
                      data-cart="sup-inc"
                      data-dish={line.dishId}
                      disabled={line.supplementQty >= line.qty}
                      aria-label={`Ajouter ${supplement.label}`}
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </li>
              )
            })}
          </ul>
          <div className="order-foot">
            <p className="order-total">
              <span>Total</span>
              <strong>{formatEuro(priced.totalCents)}</strong>
            </p>
            {code && qr ? (
              <figure className="order-qr">
                <img src={qr} alt="Code à faire scanner par le restaurant" />
                <figcaption>Montrez ce code au restaurant. Il indique la table, puis suit la commande.</figcaption>
              </figure>
            ) : (
              <p className="lede">Préparation du code…</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
