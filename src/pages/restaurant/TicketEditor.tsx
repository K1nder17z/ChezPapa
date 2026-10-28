import { allDishes } from '../../data/menu.ts'
import type { CartLine } from '../../lib/cart.ts'
import { formatEuro } from '../../lib/format.ts'
import { priceLines } from '../../lib/ticket.ts'

export function TicketEditor({
  lines,
  note,
  onChange,
  onNote,
}: {
  lines: CartLine[]
  note: string
  onChange: (lines: CartLine[]) => void
  onNote: (note: string) => void
}) {
  const priced = priceLines(lines)
  const catalog = allDishes().filter((dish) => dish.available)

  function setQty(dishId: string, qty: number) {
    const current = lines.find((line) => line.dishId === dishId)
    const nextQty = Math.max(0, Math.min(12, qty))
    const rest = lines.filter((line) => line.dishId !== dishId)
    if (nextQty === 0) {
      onChange(rest)
      return
    }
    const line: CartLine = {
      dishId,
      qty: nextQty,
      supplementQty: Math.min(current?.supplementQty ?? 0, nextQty),
    }
    if (current?.note) line.note = current.note
    onChange([...rest, line])
  }

  function addDish(dishId: string) {
    if (!dishId) return
    const current = lines.find((line) => line.dishId === dishId)
    setQty(dishId, (current?.qty ?? 0) + 1)
  }

  return (
    <div className="ticket-editor">
      <ul>
        {priced.lines.map((line) => (
          <li key={line.dishId}>
            <span>
              {line.name}
              <small>{formatEuro(line.lineCents)}</small>
            </span>
            <span className="qty-step">
              <button type="button" onClick={() => setQty(line.dishId, line.qty - 1)} aria-label={`Retirer un ${line.name}`}>
                −
              </button>
              <strong>{line.qty}</strong>
              <button type="button" onClick={() => setQty(line.dishId, line.qty + 1)} disabled={line.qty >= 12} aria-label={`Ajouter un ${line.name}`}>
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      {priced.lines.length === 0 ? <p>Aucun article. Ajoutez un plat, ou annulez la commande.</p> : null}
      <label>
        Ajouter un article
        <select value="" onChange={(event) => addDish(event.target.value)}>
          <option value="">Choisir dans la carte</option>
          {catalog.map((dish) => (
            <option key={dish.id} value={dish.id}>
              {dish.name} — {formatEuro(dish.priceCents)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Remarque
        <input value={note} maxLength={240} onChange={(event) => onNote(event.target.value)} />
      </label>
    </div>
  )
}
