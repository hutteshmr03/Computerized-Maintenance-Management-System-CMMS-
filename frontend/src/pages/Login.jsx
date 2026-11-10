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
    <div className="login-split-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

        .login-split-page {
          display: flex;
          height: 100vh;
          width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #F9FAFB;
          overflow: hidden;
        }

        /* ---------------- LEFT PANEL ---------------- */
        .login-left-panel {
          width: 45%;
          background: #111827;
          padding: 56px 64px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
          color: #FFFFFF;
        }

        /* Top: Brand Header */
        .login-left-header {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .login-brand-title {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #FFFFFF;
          line-height: 1.4;
          letter-spacing: -0.01em;
          max-width: 440px;
        }

        /* Middle */
        .login-left-middle {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 440px;
          padding: 32px 0;
        }

        .login-left-headline {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 800;
          font-size: clamp(34px, 3.2vw, 48px);
          color: #FFFFFF;
          line-height: 1.18;
          max-width: 420px;
          margin: 0 0 18px 0;
          letter-spacing: -0.025em;
        }

        .login-left-body {
          font-size: 15.5px;
          color: #9CA3AF;
          line-height: 1.65;
          max-width: 380px;
          margin: 0;
          font-weight: 400;
        }

        .login-left-bottom {
          width: 100%;
          max-width: 440px;
        }

        .industrial-stripe {
          height: 10px;
          width: 100%;
          background: linear-gradient(
            135deg,
            #f2b705 25%,
            #23282b 25%,
            #23282b 50%,
            #f2b705 50%,
            #f2b705 75%,
            #23282b 75%,
            #23282b 100%
          );
          background-size: 40px 40px;
          animation: industrial-stripe-crawl 1.6s linear infinite;
          border-radius: 3px;
        }

        @keyframes industrial-stripe-crawl {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 40px 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .industrial-stripe {
            animation: none;
          }
        }

        /* ---------------- RIGHT PANEL ---------------- */
        .login-right-panel {
          width: 55%;
          background: #F9FAFB;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          box-sizing: border-box;
          height: 100%;
        }

        .login-form-wrapper {
          width: 380px;
          max-width: 100%;
          box-sizing: border-box;
        }

        .login-mobile-header {
          display: none;
          margin-bottom: 28px;
        }

        .login-mobile-brand {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          line-height: 1.4;
          display: block;
        }

        .login-heading {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 8px 0;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }

        .login-subtext {
          font-size: 14px;
          color: #6B7280;
          margin: 0 0 32px 0;
          line-height: 1.5;
        }

        .login-field {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }

        .login-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          display: block;
        }

        .login-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #E5E7EB;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          background: #FFFFFF;
          outline: none;
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .login-input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }

        .login-input::placeholder {
          color: #9CA3AF;
        }

        .login-pwd-wrapper {
          position: relative;
          width: 100%;
        }

        .login-input-pwd {
          padding-right: 64px;
        }

        .login-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9CA3AF;
          font-size: 13px;
          font-weight: 500;
          padding: 4px 6px;
          border-radius: 4px;
          user-select: none;
          transition: color 0.15s;
        }

        .login-toggle-btn:hover {
          color: #111827;
        }

        .login-submit-btn {
          margin-top: 10px;
          width: 100%;
          padding: 12px;
          background: #111827;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 14px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: background 0.15s;
          font-family: inherit;
        }

        .login-submit-btn:hover:not(:disabled) {
          background: #1F2937;
        }

        .login-submit-btn:disabled {
          background: #9CA3AF;
          cursor: not-allowed;
        }

        .login-error {
          font-size: 13px;
          color: #DC2626;
          margin-top: 12px;
          text-align: left;
          line-height: 1.4;
          background: #FEF2F2;
          border: 1px solid #FEE2E2;
          border-radius: 6px;
          padding: 10px 12px;
        }

        /* Mobile (< 768px) */
        @media (max-width: 768px) {
          .login-split-page {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
          }

          .login-left-panel {
            display: none;
          }

          .login-right-panel {
            width: 100%;
            padding: 48px 24px;
            min-height: 100vh;
          }

          .login-mobile-header {
            display: block;
          }
        }
      `}</style>

      {/* LEFT PANEL */}
      <div className="login-left-panel">
        <div className="login-left-header">
          <span className="login-brand-title">
            Computerized Maintenance Management System (CMMS)
          </span>
        </div>

        <div className="login-left-middle">
          <h1 className="login-left-headline">Keep every machine running.</h1>
          <p className="login-left-body">
            Track assets, schedule servicing, approve repairs and monitor downtime — all in one place.
          </p>
        </div>

        <div className="login-left-bottom">
          <div className="industrial-stripe" aria-hidden="true" />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-right-panel">
        <div className="login-form-wrapper">
          <div className="login-mobile-header">
            <span className="login-mobile-brand">
              Computerized Maintenance Management System (CMMS)
            </span>
          </div>

          <h2 className="login-heading">Log in</h2>
          <p className="login-subtext">Sign in with your work email.</p>

          <form onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                className="login-input"
                placeholder="Enter your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-pwd" className="login-label">Password</label>
              <div className="login-pwd-wrapper">
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

            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in →'}
            </button>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
