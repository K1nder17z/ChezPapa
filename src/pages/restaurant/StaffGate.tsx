import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiSend, saveStaffToken, useStaffToken } from '../../lib/ordering/client.ts'

export function StaffGate({ children }: { children: ReactNode }) {
  const token = useStaffToken()
  const location = useLocation()
  if (!token) return <StaffLogin />
  return (
    <>
      <nav className="desk-nav">
        <Link to="/salle" aria-current={location.pathname === '/salle' ? 'page' : undefined}>
          Tableau
        </Link>
        <Link to="/salle/scanner" aria-current={location.pathname === '/salle/scanner' ? 'page' : undefined}>
          Scanner
        </Link>
        <Link to="/salle/historique" aria-current={location.pathname === '/salle/historique' ? 'page' : undefined}>
          Historique
        </Link>
        <button
          type="button"
          onClick={() => {
            void apiSend('/api/staff/logout', { method: 'POST', token, body: {} })
            saveStaffToken(null)
          }}
        >
          Quitter
        </button>
      </nav>
      {children}
    </>
  )
}

function StaffLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    const result = await apiSend<{ token: string }>('/api/staff/login', {
      method: 'POST',
      body: { password },
    })
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    saveStaffToken(result.data.token)
  }

  return (
    <form className="desk-login" onSubmit={(event) => void onSubmit(event)}>
      <p className="kicker">Chez Papa</p>
      <h1>Restaurant</h1>
      <p>Un seul identifiant. Une fois connecté, cet appareil reste ouvert.</p>
      <label>
        Identifiant
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
        />
      </label>
      {error ? (
        <p className="salle-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="is-solid" disabled={pending || password.length < 4}>
        {pending ? 'Connexion…' : 'Entrer'}
      </button>
    </form>
  )
}
