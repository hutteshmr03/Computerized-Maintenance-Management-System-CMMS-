import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { ErrorNote } from '../ui.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate(loc.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="brand">
          <span className="mark">CM</span> Computerized Maintenance Management System (CMMS)
        </div>
        <div>
          <h1>Keep every machine running.</h1>
          <p>
            Enterprise maintenance aligned with German DIN 31051, EN 13306, and ISO 55001 standards.
          </p>
        </div>
        <div className="stripe" aria-hidden="true" />
      </div>
      <form className="login-form" onSubmit={submit}>
        <h1>Log in</h1>
        <p className="muted">Sign in with your enterprise credentials.</p>
        <ErrorNote error={error} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              id="pw"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
