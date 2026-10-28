import { Emblem } from './Ornaments.tsx'
import { Corners } from './Ornaments.tsx'

export function CoverFace() {
  return (
    <div className="cover-face">
      <span className="paper-pattern" aria-hidden="true" />
      <span className="cover-sheen" aria-hidden="true" />
      <Corners />
      <div className="cover-frame">
        <Emblem className="emblem cover-emblem" />
        <p className="cover-brand">Chez Papa</p>
        <span className="cover-line" aria-hidden="true" />
        <p className="cover-restaurant">Restaurant</p>
        <p className="cover-cuisine">
          Cuisine traditionnelle
          <br />
          marocaine
        </p>
      </div>
    </div>
  )
}
