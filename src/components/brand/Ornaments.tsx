export function Emblem({ className = 'emblem' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="36.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <path
        d="M24 58 V40 C24 27 30.5 19 40 19 C49.5 19 56 27 56 40 V58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
      />
      <path
        fill="#2F6B45"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinejoin="round"
        d="M40 20.2 L41.7 24.6 L46.4 24.8 L42.7 27.7 L43.9 32.2 L40 29.6 L36.1 32.2 L37.3 27.7 L33.6 24.8 L38.3 24.6 Z"
      />
      <path
        fill="currentColor"
        d="M29.2 48.6 L40 34.2 L50.8 48.6 Q40 45.4 29.2 48.6 Z M21.5 48.2 H58.5 C58.5 56.4 50.6 60.2 40 60.2 C29.4 60.2 21.5 56.4 21.5 48.2 Z"
      />
    </svg>
  )
}

export function Rule() {
  return (
    <span className="rule" aria-hidden="true">
      <i />
      <svg viewBox="0 0 12 12">
        <rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="currentColor" />
      </svg>
      <i />
    </span>
  )
}

export function Corners() {
  return (
    <>
      <Corner className="orn tl" />
      <Corner className="orn tr" />
      <Corner className="orn bl" />
      <Corner className="orn br" />
    </>
  )
}

function Corner({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 58 V22 C6 12 12 6 22 6 H58" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 58 V28 C14 20 18 16 28 16 H58" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <path d="M6 6 L16 16" fill="none" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

export function Arch({ className = 'arch' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 220" aria-hidden="true">
      <path
        d="M24 214 V118 C24 48 78 16 180 16 C282 16 336 48 336 118 V214"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M52 214 V122 C52 68 96 40 180 40 C264 40 308 68 308 122 V214"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
      />
    </svg>
  )
}
