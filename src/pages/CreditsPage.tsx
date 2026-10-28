import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { photoList } from '../data/photos.ts'

export function CreditsPage() {
  useEffect(() => {
    document.title = 'Illustrations — Chez Papa'
    return () => {
      document.title = 'Chez Papa — Cuisine traditionnelle marocaine'
    }
  }, [])

  return (
    <main className="credits-page">
      <article>
        <p className="kicker">Illustrations</p>
        <h1>Illustrations de la carte</h1>
        <p>
          Ces images ont été générées pour suggérer le type de plat. Ce ne sont pas des photographies
          du service de Chez Papa. Remplacez les fichiers du dossier <code>public/photos</code> pour
          utiliser les photos du restaurant.
        </p>
        <ul>
          {photoList.map((photo) => (
            <li key={photo.src}>
              <img src={photo.src} alt="" />
              <div>
                <strong>{photo.caption}</strong>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/menu">Retour à la carte</Link>
      </article>
    </main>
  )
}
