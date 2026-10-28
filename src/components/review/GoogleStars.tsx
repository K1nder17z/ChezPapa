const stars = [5, 4, 3, 2, 1] as const

export function GoogleStars({ url }: { url: string }) {
  return (
    <div className="google-rate">
      <p>Noter le service</p>
      <div className="google-stars">
        {stars.map((star) => (
          <a
            key={star}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-google-star={star}
            aria-label={`${star} ${star > 1 ? 'étoiles' : 'étoile'} sur Google`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.4 14.7 8l6.1.9-4.4 4.3 1 6.1L12 16.5 6.6 19.3l1-6.1L3.2 8.9 9.3 8 12 2.4z"
                fill="currentColor"
              />
            </svg>
          </a>
        ))}
      </div>
      <p className="google-rate-hint">L’avis s’écrit sur Google</p>
    </div>
  )
}
