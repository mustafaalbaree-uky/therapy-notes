import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setErr((e as Error).message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="panel" onSubmit={submit}>
        <h1>Therapy Notes</h1>
        <p className="sub">A quiet place for your sessions. Sign in to continue.</p>

        <label className="field">
          <span className="lbl">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="lbl">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {err && <p className="error">{err}</p>}

        <div style={{ marginTop: 18 }}>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
