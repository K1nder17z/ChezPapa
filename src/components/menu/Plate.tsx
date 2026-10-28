import type { PhotoCredit } from '../../data/photos.ts'

export function Plate({
  photo,
  eager = false,
  position,
}: {
  photo: PhotoCredit
  eager?: boolean
  position?: string
}) {
  return (
    <figure className="plate">
      <img
        src={photo.src}
        alt={photo.alt}
        style={{ objectPosition: position ?? photo.position }}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'low'}
      />
      <figcaption className="sr-only">{photo.caption}</figcaption>
    </figure>
  )
}
