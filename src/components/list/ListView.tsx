import { Link } from 'react-router-dom'
import { categories } from '../../data/menu.ts'
import { DishList } from '../menu/DishList.tsx'
import { Rule } from '../brand/Ornaments.tsx'

export function ListView({
  reducedMotion,
  onOpenCategory,
}: {
  reducedMotion: boolean
  onOpenCategory: (categoryId: string) => void
}) {
  return (
    <div className="list-view">
      <div className="list-paper">
        <p className="kicker">La carte</p>
        <h2>Toutes les catégories</h2>
        <Rule />
        <nav className="chips" aria-label="Catégories">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                document.getElementById(`liste-${category.id}`)?.scrollIntoView({
                  behavior: reducedMotion ? 'auto' : 'smooth',
                  block: 'start',
                })
              }}
            >
              {category.kicker}
            </button>
          ))}
        </nav>
        {categories.map((category) => (
          <section key={category.id} id={`liste-${category.id}`} className="list-section">
            <header>
              <h3>{category.title}</h3>
              <button type="button" onClick={() => onOpenCategory(category.id)}>
                Voir dans le livre
              </button>
            </header>
            <DishList dishes={category.dishes} />
          </section>
        ))}
        <p className="list-note">
          Allergènes selon la recette habituelle. En cas d’allergie, prévenez la maison avant de commander.
        </p>
        <p className="list-note">
          Les photographies sont des illustrations détourées. Elles ne montrent pas le dressage exact de Chez Papa.
        </p>
        <p className="list-note">
          <Link to="/credits">Crédits photographiques</Link>
        </p>
      </div>
    </div>
  )
}
