import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CoverFace } from '../brand/CoverFace.tsx'
import { Arch, Corners, Emblem, Rule } from '../brand/Ornaments.tsx'
import { restaurant } from '../../config/restaurant.ts'
import { categories } from '../../data/menu.ts'
import { photos } from '../../data/photos.ts'
import { categoryPageIndex, type BookSheet } from '../../lib/sheets.ts'
import { DishList } from '../menu/DishList.tsx'
import { OrderSheet } from '../order/OrderSheet.tsx'
import { Plate } from '../menu/Plate.tsx'
import { GoogleStars } from '../review/GoogleStars.tsx'

export function BookSheets({ sheets }: { sheets: BookSheet[] }) {
  return sheets.map((sheet, index) => {
    const hard = sheet.kind === 'cover' || sheet.kind === 'closing'
    return (
      <article
        key={sheet.id}
        className={`sheet sheet--${sheet.kind}`}
        data-sheet={sheet.id}
        data-density={hard ? 'hard' : 'soft'}
      >
        {sheet.kind === 'cover' ? <CoverFace /> : null}
        {sheet.kind === 'welcome' ? <WelcomeSheet index={index} total={sheets.length} /> : null}
        {sheet.kind === 'toc' ? <TocSheet sheets={sheets} index={index} /> : null}
        {sheet.kind === 'category' ? (
          <CategorySheet categoryId={sheet.categoryId} index={index} total={sheets.length} />
        ) : null}
        {sheet.kind === 'order' ? <OrderPaper index={index} total={sheets.length} /> : null}
        {sheet.kind === 'closing' ? <ClosingSheet index={index} total={sheets.length} /> : null}
      </article>
    )
  })
}

function Paper({
  children,
  index,
  total,
}: {
  children: ReactNode
  index: number
  total: number
}) {
  return (
    <div className="sheet-body">
      <Corners />
      <div className="sheet-content">{children}</div>
      <p className="folio">
        {index + 1}
        <span> / {total}</span>
      </p>
    </div>
  )
}

function WelcomeSheet({ index, total }: { index: number; total: number }) {
  return (
    <Paper index={index} total={total}>
      <div className="welcome">
        <Arch className="arch welcome-arch" />
        <p className="kicker">La maison</p>
        <h2>Bienvenue chez Papa</h2>
        <Rule />
        <p className="lede">Découvrez les saveurs de la cuisine traditionnelle marocaine.</p>
        <Plate photo={photos.couscous} eager position="42% 40%" />
        <p className="swipe-hint">Glissez ou touchez un coin pour tourner la page.</p>
        <p className="swipe-hint">Allergènes selon la recette habituelle. Prévenez la maison en cas d’allergie.</p>
      </div>
    </Paper>
  )
}

function TocSheet({ sheets, index }: { sheets: BookSheet[]; index: number }) {
  return (
    <Paper index={index} total={sheets.length}>
      <div className="toc-page">
        <p className="kicker">Sommaire</p>
        <h2>La carte</h2>
        <Rule />
        <ul className="toc-list">
          {categories.map((category) => {
            const page = categoryPageIndex(sheets, category.id)
            return (
              <li key={category.id}>
                <button type="button" data-turn-to={page}>
                  <span>{category.title}</span>
                  <span className="toc-page-no">{page + 1}</span>
                </button>
              </li>
            )
          })}
          <li>
            <button type="button" data-turn-to={sheets.findIndex((sheet) => sheet.kind === 'order')}>
              <span>Votre commande</span>
              <span className="toc-page-no">
                {sheets.findIndex((sheet) => sheet.kind === 'order') + 1}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </Paper>
  )
}

function CategorySheet({
  categoryId,
  index,
  total,
}: {
  categoryId: string
  index: number
  total: number
}) {
  const category = categories.find((item) => item.id === categoryId)
  if (!category) return null
  const photo = category.photo ? photos[category.photo] : null

  return (
    <Paper index={index} total={total}>
      <div className={`category layout-${category.layout}`} data-count={category.dishes.length}>
        <header className="cat-head">
          <p className="kicker">{category.kicker}</p>
          <h2>{category.title}</h2>
          <Rule />
          {category.intro ? <p className="lede">{category.intro}</p> : null}
        </header>
        {photo ? <Plate photo={photo} eager={index < 5} /> : null}
        <DishList dishes={category.dishes} columns={category.layout === 'columns'} />
      </div>
    </Paper>
  )
}

function OrderPaper({ index, total }: { index: number; total: number }) {
  return (
    <Paper index={index} total={total}>
      <OrderSheet />
    </Paper>
  )
}

function ClosingSheet({ index, total }: { index: number; total: number }) {
  const showContact = Boolean(
    restaurant.address ||
      restaurant.phone ||
      restaurant.hours ||
      restaurant.mapsUrl ||
      restaurant.instagram ||
      restaurant.facebook,
  )
  return (
    <div className="closing-face">
      <span className="paper-pattern" aria-hidden="true" />
      <Corners />
      <Emblem />
      <p className="kicker light">Chez Papa</p>
      <h2>Merci de votre visite</h2>
      <p className="closing-wish">Toute l’équipe de Chez Papa vous souhaite un bon appétit !</p>
      {restaurant.reviewsUrl ? <GoogleStars url={restaurant.reviewsUrl} /> : null}
      <p className="closing-note">Allergènes selon la recette habituelle. Prévenez-nous en cas d’allergie.</p>
      {showContact ? (
        <ul className="contact-list">
          {restaurant.address ? <li>{restaurant.address}</li> : null}
          {restaurant.phone ? (
            <li>
              <a href={`tel:${restaurant.phone.replace(/\s/g, '')}`}>{restaurant.phone}</a>
            </li>
          ) : null}
          {restaurant.hours ? <li>{restaurant.hours}</li> : null}
          {restaurant.mapsUrl ? (
            <li>
              <a href={restaurant.mapsUrl}>Itinéraire</a>
            </li>
          ) : null}
          {restaurant.instagram ? (
            <li>
              <a href={restaurant.instagram}>Instagram</a>
            </li>
          ) : null}
          {restaurant.facebook ? (
            <li>
              <a href={restaurant.facebook}>Facebook</a>
            </li>
          ) : null}
        </ul>
      ) : null}
      <p className="folio light">
        {index + 1}
        <span> / {total}</span>
      </p>
      <Link className="credits-link" to="/credits">
        Illustrations
      </Link>
    </div>
  )
}
