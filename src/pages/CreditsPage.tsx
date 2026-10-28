import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { photoList } from '../data/photos.ts'

export function CreditsPage() {
  useEffect(() => {
    document.title = 'Crédits photographiques — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  return (
    <main className="credits-page">
      <article>
        <p className="kicker">Illustrations</p>
        <h1>Crédits photographiques</h1>
        <p>
          Ces images suggèrent le type de plat. Ce ne sont pas des photographies du service de Chez
          Papa. Remplacez les fichiers du dossier <code>public/photos</code> pour utiliser les photos
          du restaurant.
        </p>
        <ul>
          {photoList.map((photo) => (
            <li key={photo.src}>
              <img src={photo.src} alt="" />
              <div>
                <strong>{photo.caption}</strong>
                <span>
                  {photo.author} —{' '}
                  {photo.licenseUrl ? (
                    <a href={photo.licenseUrl}>{photo.license}</a>
                  ) : (
                    photo.license
                  )}
                </span>
                <a href={photo.sourceUrl}>{photo.fileName}</a>
              </div>
            </li>
          ))}
        </ul>
        <p>
          Sources : <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>.
        </p>
        <Link to="/menu">Retour à la carte</Link>
      </article>
    </main>
  )
}
