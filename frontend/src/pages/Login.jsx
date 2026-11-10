import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

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
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');

        .login-root {
          min-height: 100vh;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0D1B2A;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        /* ---------------- Left Panel ---------------- */
        .login-left-panel {
          background-color: #0D1B2A;
          background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          box-sizing: border-box;
          min-height: 100vh;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .login-logo-mark {
          width: 36px;
          height: 36px;
          background: #00C2E0;
          color: #ffffff;
          font-weight: 700;
          font-size: 15px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          box-shadow: 0 2px 8px rgba(0, 194, 224, 0.25);
        }

        .login-brand-text {
          color: #ffffff;
          font-weight: 600;
          font-size: 18px;
          letter-spacing: 0.5px;
        }

        .login-hero {
          margin: auto 0;
          padding: 40px 0;
        }

        .login-headline {
          color: #ffffff;
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(24px, 2.6vw, 38px);
          font-weight: 700;
          line-height: 1.25;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .login-headline-row {
          display: block;
          white-space: nowrap;
        }

        .login-subtext {
          color: #8B9BB4;
          font-size: 15px;
          margin: 16px 0 0 0;
          line-height: 1.5;
        }

        .login-pills {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .login-pill {
          background: rgba(0, 194, 224, 0.12);
          border: 1px solid rgba(0, 194, 224, 0.3);
          color: #00C2E0;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        /* ---------------- Right Panel ---------------- */
        .login-right-panel {
          background-color: #F7F9FC;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          box-sizing: border-box;
          min-height: 100vh;
        }

        .login-form-container {
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
        }

        .login-form-title {
          color: #0D1B2A;
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }

        .login-form-subtitle {
          color: #8B9BB4;
          font-size: 14px;
          margin: 0 0 32px 0;
        }

        .login-form-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }

        .login-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .login-label {
          font-size: 13px;
          color: #4A5568;
          font-weight: 500;
        }

        .login-input {
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 15px;
          background: #ffffff;
          color: #0D1B2A;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .login-input:focus {
          border-color: #00C2E0;
          box-shadow: 0 0 0 3px rgba(0, 194, 224, 0.15);
        }

        .login-password-wrapper {
          position: relative;
          width: 100%;
        }

        .login-input-password {
          padding-right: 64px;
        }

        .login-toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #718096;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          transition: color 0.15s ease;
          user-select: none;
        }

        .login-toggle-password:hover {
          color: #00C2E0;
        }

        .login-submit-btn {
          background: #00C2E0;
          color: #0D1B2A;
          font-weight: 700;
          border-radius: 10px;
          padding: 14px;
          width: 100%;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease, opacity 0.15s ease;
          margin-top: 4px;
          font-family: inherit;
        }

        .login-submit-btn:hover:not(:disabled) {
          background: #00A8C4;
        }

        .login-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-error-text {
          color: #E53E3E;
          font-size: 13px;
          margin: 4px 0 0 0;
          text-align: center;
          line-height: 1.4;
        }

        /* ---------------- Responsive ---------------- */
        @media (max-width: 767.98px) {
          .login-root {
            grid-template-columns: 1fr;
            min-height: 100vh;
          }

          .login-left-panel {
            min-height: auto;
            height: auto;
            padding: 40px 24px;
            gap: 24px;
          }

          .login-hero {
            margin: 0;
            padding: 0;
          }

          .login-headline {
            font-size: clamp(20px, 5.5vw, 26px);
          }

          .login-pills {
            display: none !important;
          }

          .login-right-panel {
            min-height: auto;
            padding: 40px 24px 48px;
          }
        }
      `}</style>

      {/* Left Branding Panel */}
      <div className="login-left-panel">
        <div className="login-brand">
          <div className="login-logo-mark">CM</div>
          <span className="login-brand-text">CMMS</span>
        </div>

        <div className="login-hero">
          <h1 className="login-headline">
            <span className="login-headline-row">Maintenance Intelligence</span>
            <span className="login-headline-row">for Industry</span>
          </h1>
          <p className="login-subtext">
            Asset management · Work orders · Downtime analytics
          </p>
        </div>

        <div className="login-pills">
          <span className="login-pill">ISO 55001</span>
          <span className="login-pill">DIN 31051</span>
          <span className="login-pill">EN 13306</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-right-panel">
        <div className="login-form-container">
          <h2 className="login-form-title">Welcome back</h2>
          <p className="login-form-subtitle">Sign in to your workspace</p>

          <form onSubmit={submit} className="login-form-body">
            <div className="login-field-group">
              <label htmlFor="login-email" className="login-label">Email address</label>
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

            <div className="login-field-group">
              <label htmlFor="login-password" className="login-label">Password</label>
              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-input login-input-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>

            {error && <p className="login-error-text">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
