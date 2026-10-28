import { CoverFace } from '../brand/CoverFace.tsx'
import { Emblem } from '../brand/Ornaments.tsx'
import { restaurant } from '../../config/restaurant.ts'

export function IntroScreen({
  opening,
  onOpen,
  onSkip,
  onList,
}: {
  opening: boolean
  onOpen: () => void
  onSkip: () => void
  onList: () => void
}) {
  return (
    <section className={opening ? 'intro is-opening' : 'intro'}>
      <div className="intro-actions">
        <button type="button" className="text-link" onClick={onList}>
          Lire en liste
        </button>
        <button type="button" className="text-link" onClick={onSkip}>
          Voir la carte
        </button>
      </div>
      <div className="intro-copy">
        <Emblem className="emblem intro-emblem" />
        <p className="intro-brand">Chez Papa</p>
        <p className="intro-restaurant">Restaurant</p>
        <p className="intro-cuisine">Cuisine traditionnelle marocaine</p>
        <p className="intro-tagline">{restaurant.tagline}</p>
      </div>
      <button
        type="button"
        className={opening ? 'book3d is-opening' : 'book3d'}
        onClick={onOpen}
        aria-label="Ouvrir la carte"
      >
        <span className="book3d-inner">
          <span className="book3d-pages" aria-hidden="true" />
          <span className="book3d-cover">
            <CoverFace />
          </span>
        </span>
      </button>
      <p className="intro-hint">
        Découvrez notre carte
        <span className="chevron" aria-hidden="true" />
      </p>
    </section>
  )
}
