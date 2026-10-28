import { formatEuro } from '../../lib/format.ts'
import { useCartLines } from '../../lib/cartStore.ts'
import type { Dish } from '../../types/menu.ts'

export function DishList({ dishes, columns = false }: { dishes: Dish[]; columns?: boolean }) {
  const lines = useCartLines()
  return (
    <ul className={columns ? 'dishes columns' : 'dishes'}>
      {dishes.map((dish) => {
        const line = lines.find((item) => item.dishId === dish.id)
        const qty = line?.qty ?? 0
        const supplementQty = line?.supplementQty ?? 0
        return (
          <li key={dish.id} className="dish" data-dish={dish.id} data-cents={dish.priceCents}>
            <span className="dish-name">{dish.name}</span>
            <div className={qty > 0 ? 'dish-buy' : 'dish-buy is-empty'} data-buy={dish.id}>
              {dish.available ? (
                <span className="dish-price">{formatEuro(dish.priceCents)}</span>
              ) : (
                <span className="dish-price is-off">Indisponible</span>
              )}
              {dish.available ? (
                <>
                  <button
                    type="button"
                    className="step-btn"
                    data-cart="dec"
                    data-dish={dish.id}
                    disabled={qty === 0}
                    aria-label={`Retirer un ${dish.name}`}
                  >
                    −
                  </button>
                  <span className="step-qty" data-qty={dish.id}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    className="step-btn"
                    data-cart="inc"
                    data-dish={dish.id}
                    disabled={qty >= 12}
                    aria-label={`Ajouter un ${dish.name}`}
                  >
                    +
                  </button>
                </>
              ) : null}
            </div>
            <p className="dish-ingredients">{dish.ingredients}</p>
            <p className="dish-allergens">Allergènes : {dish.allergens}</p>
            {dish.supplement ? (
              <div className="dish-extra" data-extra={dish.id} hidden={qty === 0}>
                <span>{dish.supplement.label}</span>
                <button
                  type="button"
                  className="step-btn"
                  data-cart="sup-dec"
                  data-dish={dish.id}
                  disabled={supplementQty === 0}
                  aria-label={`Retirer ${dish.supplement.label}`}
                >
                  −
                </button>
                <span data-sup-qty={dish.id}>{supplementQty}</span>
                <button
                  type="button"
                  className="step-btn"
                  data-cart="sup-inc"
                  data-dish={dish.id}
                  disabled={supplementQty >= qty}
                  aria-label={`Ajouter ${dish.supplement.label}`}
                >
                  +
                </button>
                <span className="dish-extra-price">+{formatEuro(dish.supplement.priceCents)}</span>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
