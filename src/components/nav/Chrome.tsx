import { categories } from '../../data/menu.ts'
import { categoryPageIndex, sheetLabel, type BookSheet } from '../../lib/sheets.ts'
import type { BookStatus } from '../book/FlipBook.tsx'
import { Emblem } from '../brand/Ornaments.tsx'

export function TopBar({
  view,
  fullscreenEnabled,
  fullscreen,
  orderCount,
  onSommaire,
  onToggleView,
  onFullscreen,
  onClose,
  onOrder,
}: {
  view: 'book' | 'list'
  fullscreenEnabled: boolean
  fullscreen: boolean
  orderCount: number
  onSommaire: () => void
  onToggleView: () => void
  onFullscreen: () => void
  onClose: () => void
  onOrder: () => void
}) {
  return (
    <header className="topbar">
      <p className="brand">
        <Emblem className="emblem emblem-sm" />
        <span>Chez Papa</span>
      </p>
      <div className="top-actions">
        <button type="button" onClick={onOrder}>
          Commande{orderCount > 0 ? ` ${orderCount}` : ''}
        </button>
        <button type="button" onClick={onSommaire}>
          Sommaire
        </button>
        <button type="button" aria-pressed={view === 'list'} onClick={onToggleView}>
          {view === 'list' ? 'Livre' : 'Liste'}
        </button>
        {fullscreenEnabled ? (
          <button type="button" onClick={onFullscreen}>
            {fullscreen ? 'Réduire' : 'Plein écran'}
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Fermer le livre">
          Fermer
        </button>
      </div>
    </header>
  )
}

export function BottomBar({
  sheets,
  status,
  onPrev,
  onNext,
}: {
  sheets: BookSheet[]
  status: BookStatus
  onPrev: () => void
  onNext: () => void
}) {
  const total = Math.max(status.count, 1)
  const single =
    status.orientation !== 'landscape' || status.index <= 0 || status.index >= total - 1
  const pageText = single
    ? `Page ${status.index + 1} sur ${total}`
    : `Pages ${status.index + 1}–${Math.min(total, status.index + 2)} sur ${total}`

  return (
    <footer className="bottombar">
      <button type="button" onClick={onPrev} disabled={status.index <= 0} aria-label="Page précédente">
        <span aria-hidden="true">‹</span>
      </button>
      <p className="page-status" aria-live="polite">
        <strong>{sheetLabel(sheets, status.index)}</strong>
        <span>{pageText}</span>
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={status.count > 0 && status.index >= status.count - 1}
        aria-label="Page suivante"
      >
        <span aria-hidden="true">›</span>
      </button>
    </footer>
  )
}

export function Sommaire({
  sheets,
  onClose,
  onSelect,
}: {
  sheets: BookSheet[]
  onClose: () => void
  onSelect: (index: number) => void
}) {
  return (
    <div className="sommaire-layer">
      <button type="button" className="sommaire-backdrop" aria-label="Fermer le sommaire" onClick={onClose} />
      <div className="sommaire" role="dialog" aria-modal="true" aria-label="Sommaire">
        <header>
          <p>Sommaire</p>
          <button type="button" onClick={onClose}>
            Fermer
          </button>
        </header>
        <ul>
          {categories.map((category) => {
            const page = categoryPageIndex(sheets, category.id)
            return (
              <li key={category.id}>
                <button type="button" onClick={() => onSelect(page)}>
                  <span>{category.title}</span>
                  <span>{page + 1}</span>
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => onSelect(sheets.findIndex((sheet) => sheet.kind === 'order'))}
            >
              <span>Votre commande</span>
              <span>{sheets.findIndex((sheet) => sheet.kind === 'order') + 1}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
