import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isSalleUnlocked, lockSalle, salleCode, unlockSalle } from '../../lib/salleStore.ts'

export function SalleGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(isSalleUnlocked)
  if (!open) return <SalleLogin onUnlock={() => setOpen(true)} />
  return (
    <>
      <div className="salle-tools">
        <Link to="/salle">Commandes</Link>
        <button
          type="button"
          onClick={() => {
            lockSalle()
            setOpen(false)
          }}
        >
          Verrouiller
        </button>
      </div>
      {children}
    </>
  )
}

function SalleLogin({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const configured = salleCode().length > 0

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (unlockSalle(value)) {
      onUnlock()
      return
    }
    setError(configured ? 'Code salle incorrect.' : 'Le code salle n’est pas configuré.')
  }

  return (
    <form className="salle-login" onSubmit={onSubmit}>
      <p className="kicker">Un seul accès</p>
      <h1>Espace salle</h1>
      <p>Les clients commandent sans compte. Seul le restaurant entre ici.</p>
      <label>
        Code salle
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="current-password"
          autoFocus
          disabled={!configured}
        />
      </label>
      {error ? <p className="salle-error">{error}</p> : null}
      <button type="submit" disabled={!configured}>
        Entrer
      </button>
    </form>
  )
}
