import { formatEuro } from '../../lib/format.ts'
import type { Dish } from '../../types/menu.ts'

export function DishList({ dishes, columns = false }: { dishes: Dish[]; columns?: boolean }) {
  return (
    <ul className={columns ? 'dishes columns' : 'dishes'}>
      {dishes.map((dish) => (
        <li key={dish.id} className="dish" data-dish={dish.id} data-cents={dish.priceCents}>
          <span className="dish-name">{dish.name}</span>
          {dish.available ? (
            <span className="dish-price">{formatEuro(dish.priceCents)}</span>
          ) : (
            <span className="dish-price is-off">Indisponible</span>
          )}
          <p className="dish-ingredients">{dish.ingredients}</p>
          <p className="dish-allergens">Allergènes : {dish.allergens}</p>
          {dish.supplement ? (
            <p className="dish-note">
              {dish.supplement.label}&nbsp;: +{formatEuro(dish.supplement.priceCents)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
