import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { ErrorNote } from '../ui.jsx'

const DEMO = [
  ['Super Admin', 'superadmin@cmms.test', 'SuperAdmin@123', 'Full system access & user management'],
  ['Plant Head', 'planthead@cmms.test', 'PlantHead@123', 'Plant oversight, assets, downtime & calibrations'],
  ['Maintenance Manager', 'manager@cmms.test', 'Manager@123', 'Approvals, transfers, work orders, parts & cost oversight'],
  ['Maintenance Engineer', 'engineer@cmms.test', 'Engineer@123', 'Maintenance execution, work orders, parts & calibrations'],
  ['Technician', 'tech@cmms.test', 'Tech@123', 'Mobile execution, work orders & asset maintenance'],
  ['Store Manager', 'store@cmms.test', 'Store@123', 'Spare parts inventory & procurement management'],
  ['Production Manager', 'production@cmms.test', 'Prod@123', 'Breakdown reporting & machine status tracking'],
  ['Purchase Manager', 'purchase@cmms.test', 'Purchase@123', 'Purchase orders approval & procurement placement'],
  ['Auditor', 'auditor@cmms.test', 'Audit@123', 'Read-only compliance audit & logs review'],
]

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

        <div className="demo-list">
          <h3>Demo Enterprise Roles (9 Roles)</h3>
          <p className="small muted">Click any role to populate credentials:</p>
          <div className="stack" style={{ gap: '6px' }}>
            {DEMO.map(([role, e, p, what]) => (
              <button
                type="button"
                key={role}
                onClick={() => {
                  setEmail(e)
                  setPassword(p)
                }}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  minHeight: '44px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>
                    <strong>{role}</strong>
                    <span className="small muted" style={{ fontFamily: 'monospace', marginLeft: '8px' }}>
                      ({e})
                    </span>
                  </div>
                  <div className="small muted">{what}</div>
                </div>
                <span className="small muted">Select →</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
