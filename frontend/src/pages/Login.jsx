import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'superadmin@cmms.test', password: 'SuperAdmin@123' },
  { role: 'Plant Head', email: 'planthead@cmms.test', password: 'PlantHead@123' },
  { role: 'Maint. Manager', email: 'manager@cmms.test', password: 'Manager@123' },
  { role: 'Maint. Engineer', email: 'engineer@cmms.test', password: 'Engineer@123' },
  { role: 'Technician', email: 'tech@cmms.test', password: 'Tech@123' },
  { role: 'Store Manager', email: 'store@cmms.test', password: 'Store@123' },
  { role: 'Prod. Manager', email: 'production@cmms.test', password: 'Prod@123' },
  { role: 'Purchase Mgr', email: 'purchase@cmms.test', password: 'Purchase@123' },
  { role: 'Auditor', email: 'auditor@cmms.test', password: 'Audit@123' },
]

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
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
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const selectDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setError('')
  }

  return (
    <div className="login-viewport">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

        .login-viewport {
          min-height: 100vh;
          width: 100%;
          position: relative;
          background-color: #0A0F1E;
          background-image: 
            radial-gradient(ellipse 80% 60% at 30% 50%, 
              rgba(99, 102, 241, 0.18) 0%, 
              rgba(14, 165, 233, 0.10) 40%, 
              transparent 70%),
            url("data:image/svg+xml,%3Csvg width='28' height='28' viewBox='0 0 28 28' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ffffff' opacity='0.04'/%3E%3C/svg%3E");
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 40px clamp(24px, 7vw, 100px);
          box-sizing: border-box;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #FFFFFF;
          overflow-x: hidden;
        }

        /* ---------------- Left Branding Area ---------------- */
        .login-brand-area {
          position: absolute;
          left: 60px;
          top: 50%;
          transform: translateY(-50%);
          width: 45%;
          max-width: 580px;
          z-index: 10;
          pointer-events: auto;
        }

        .login-brand-row {
          display: flex;
          align-items: center;
        }

        .login-logo-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366F1, #0EA5E9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.5);
          letter-spacing: -0.5px;
        }

        .login-brand-title {
          color: #FFFFFF;
          font-weight: 700;
          font-size: 20px;
          margin-left: 12px;
          letter-spacing: 0.5px;
        }

        .login-version-badge {
          background: rgba(255, 255, 255, 0.1);
          color: #94A3B8;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          margin-left: 8px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .login-headline {
          margin-top: 48px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: clamp(32px, 3.5vw, 52px);
          color: #FFFFFF;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .login-headline-line {
          display: block;
        }

        .login-subtext {
          margin-top: 20px;
          color: #94A3B8;
          font-size: 16px;
          line-height: 1.6;
          max-width: 460px;
        }

        .login-standards-row {
          margin-top: 36px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .login-std-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94A3B8;
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        /* ---------------- Right Glassmorphism Card ---------------- */
        .login-card-wrap {
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 20;
        }

        .login-glass-card {
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 44px 36px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .login-card-header {
          margin-bottom: 28px;
        }

        .login-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #FFFFFF;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          color: #94A3B8;
          font-size: 14px;
          margin: 0;
          line-height: 1.5;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .login-label {
          color: #CBD5E1;
          font-size: 13px;
          font-weight: 500;
        }

        .login-input-container {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .login-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #FFFFFF;
          font-size: 14.5px;
          padding: 13px 16px;
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        }

        .login-input:focus {
          border-color: #6366F1;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
        }

        .login-input::placeholder {
          color: #64748B;
        }

        .login-input-pwd {
          padding-right: 64px;
        }

        .login-toggle-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 6px;
          transition: color 0.15s, background-color 0.15s;
          user-select: none;
        }

        .login-toggle-btn:hover {
          color: #38BDF8;
          background: rgba(255, 255, 255, 0.06);
        }

        .login-submit {
          background: linear-gradient(135deg, #6366F1, #0EA5E9);
          color: #FFFFFF;
          font-weight: 600;
          font-size: 15px;
          border-radius: 12px;
          padding: 14px;
          width: 100%;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.45);
          margin-top: 6px;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-submit:hover:not(:disabled) {
          box-shadow: 0 12px 28px -4px rgba(99, 102, 241, 0.6);
          transform: translateY(-1px);
        }

        .login-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .login-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          padding: 10px 14px;
          color: #FCA5A5;
          font-size: 13px;
          text-align: center;
          line-height: 1.4;
        }

        /* ---------------- Demo Accounts Accordion ---------------- */
        .login-demo-toggle-wrap {
          margin-top: 22px;
          text-align: center;
        }

        .login-demo-toggle-btn {
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: color 0.15s;
        }

        .login-demo-toggle-btn:hover {
          color: #38BDF8;
        }

        .login-demo-chips {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .login-demo-chip {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #CBD5E1;
          border-radius: 8px;
          padding: 7px 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          transition: all 0.15s;
          font-family: inherit;
        }

        .login-demo-chip:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: #6366F1;
          color: #FFFFFF;
        }

        .login-card-footer {
          margin-top: 24px;
          text-align: center;
          color: #64748B;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        /* ---------------- Responsive (< 992px) ---------------- */
        @media (max-width: 991.98px) {
          .login-viewport {
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 48px 24px;
            min-height: 100vh;
            height: auto;
          }

          .login-brand-area {
            position: static;
            transform: none;
            width: 100%;
            max-width: 440px;
            margin-bottom: 32px;
            text-align: center;
          }

          .login-brand-row {
            justify-content: center;
          }

          .login-headline {
            margin-top: 24px;
            font-size: 32px;
          }

          .login-subtext {
            margin: 12px auto 0;
            font-size: 14px;
          }

          .login-standards-row {
            display: none;
          }

          .login-glass-card {
            padding: 36px 24px;
          }
        }
      `}</style>

      {/* Left Branding Area (Desktop Positioned) */}
      <div className="login-brand-area">
        <div className="login-brand-row">
          <div className="login-logo-box">CM</div>
          <span className="login-brand-title">CMMS</span>
          <span className="login-version-badge">v2.0</span>
        </div>

        <h1 className="login-headline">
          <span className="login-headline-line">Maintenance</span>
          <span className="login-headline-line">Intelligence</span>
          <span className="login-headline-line">for Industry.</span>
        </h1>

        <p className="login-subtext">
          Enterprise maintenance aligned with German DIN 31051, EN 13306, and ISO 55001 standards.
        </p>

        <div className="login-standards-row">
          <span className="login-std-pill">ISO 55001</span>
          <span className="login-std-pill">DIN 31051</span>
          <span className="login-std-pill">EN 13306</span>
        </div>
      </div>

      {/* Right Glass-morphism Card */}
      <div className="login-card-wrap">
        <div className="login-glass-card">
          <div className="login-card-header">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to your enterprise workspace</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Email address</label>
              <div className="login-input-container">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  className="login-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-pwd" className="login-label">Password</label>
              <div className="login-input-container">
                <input
                  id="login-pwd"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-input login-input-pwd"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}
          </form>

          {/* Quick Demo Access Toggle */}
          <div className="login-demo-toggle-wrap">
            <button
              type="button"
              className="login-demo-toggle-btn"
              onClick={() => setShowDemo(!showDemo)}
            >
              <span>{showDemo ? '▴ Hide Demo Roles' : '▾ Quick Fill Demo Credentials'}</span>
            </button>

            {showDemo && (
              <div className="login-demo-chips">
                {DEMO_ACCOUNTS.map(({ role, email: demoEmail, password: demoPassword }) => (
                  <button
                    key={role}
                    type="button"
                    className="login-demo-chip"
                    onClick={() => selectDemo(demoEmail, demoPassword)}
                    title={`Fill ${role}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="login-card-footer">
            <span>🔒 256-bit TLS Encrypted · Enterprise Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}
