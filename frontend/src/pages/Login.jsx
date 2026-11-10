import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const DEMO_ROLES = [
  { label: 'Super Admin', email: 'superadmin@cmms.test', password: 'SuperAdmin@123' },
  { label: 'Plant Head', email: 'planthead@cmms.test', password: 'PlantHead@123' },
  { label: 'Maint. Manager', email: 'manager@cmms.test', password: 'Manager@123' },
  { label: 'Engineer', email: 'engineer@cmms.test', password: 'Engineer@123' },
  { label: 'Technician', email: 'tech@cmms.test', password: 'Tech@123' },
  { label: 'Store Manager', email: 'store@cmms.test', password: 'Store@123' },
  { label: 'Production Mgr', email: 'production@cmms.test', password: 'Prod@123' },
  { label: 'Purchase Mgr', email: 'purchase@cmms.test', password: 'Purchase@123' },
  { label: 'Auditor', email: 'auditor@cmms.test', password: 'Audit@123' },
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
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDemoSelect = (demoEmail, demoPassword) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setError('')
  }

  return (
    <div className="minimal-login-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .minimal-login-page {
          background: #FFFFFF;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 40px 24px;
          box-sizing: border-box;
          color: #111827;
        }

        .minimal-login-container {
          width: 400px;
          max-width: calc(100vw - 48px);
          margin: 0 auto;
          padding: 0;
          box-sizing: border-box;
        }

        /* Logo Row */
        .minimal-logo-row {
          display: flex;
          align-items: center;
          margin-bottom: 40px;
        }

        .minimal-logo-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #111827;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -0.5px;
          user-select: none;
        }

        .minimal-logo-text {
          color: #111827;
          font-weight: 600;
          font-size: 16px;
          margin-left: 10px;
          letter-spacing: -0.01em;
        }

        /* Headings */
        .minimal-heading {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }

        .minimal-subtext {
          font-size: 14px;
          color: #6B7280;
          margin: 0 0 32px 0;
          line-height: 1.5;
        }

        /* Form Fields */
        .minimal-field {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }

        .minimal-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          display: block;
        }

        .minimal-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          background: #FFFFFF;
          outline: none;
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.15s;
        }

        .minimal-input:focus {
          border-color: #111827;
          box-shadow: none;
        }

        .minimal-input::placeholder {
          color: #9CA3AF;
        }

        .minimal-pwd-wrapper {
          position: relative;
          width: 100%;
        }

        .minimal-input-pwd {
          padding-right: 64px;
        }

        .minimal-toggle-btn {
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

        .minimal-toggle-btn:hover {
          color: #111827;
        }

        /* Submit Button */
        .minimal-submit-btn {
          margin-top: 24px;
          width: 100%;
          padding: 11px;
          background: #111827;
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: inherit;
        }

        .minimal-submit-btn:hover:not(:disabled) {
          background: #1F2937;
        }

        .minimal-submit-btn:disabled {
          background: #9CA3AF;
          cursor: not-allowed;
        }

        /* Error Note */
        .minimal-error {
          margin-top: 10px;
          font-size: 13px;
          color: #EF4444;
          text-align: left;
          line-height: 1.4;
        }

        /* Divider */
        .minimal-divider {
          margin: 28px 0;
          height: 1px;
          background: #F3F4F6;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .minimal-divider-label {
          position: absolute;
          background: #FFFFFF;
          padding: 0 12px;
          color: #9CA3AF;
          font-size: 12px;
          white-space: nowrap;
          user-select: none;
        }

        /* Demo Buttons Grid */
        .minimal-demo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .minimal-demo-btn {
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          padding: 10px 8px;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }

        .minimal-demo-btn:hover {
          background: #F3F4F6;
          border-color: #D1D5DB;
        }

        .minimal-demo-role {
          display: block;
          color: #111827;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .minimal-demo-email {
          display: block;
          color: #9CA3AF;
          font-size: 10px;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Footer */
        .minimal-footer {
          margin-top: 32px;
          text-align: center;
          color: #9CA3AF;
          font-size: 12px;
          user-select: none;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .minimal-login-page {
            padding: 32px 24px;
          }

          .minimal-demo-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <div className="minimal-login-container">
        {/* Logo row */}
        <div className="minimal-logo-row">
          <div className="minimal-logo-box">CM</div>
          <span className="minimal-logo-text">CMMS</span>
        </div>

        {/* Heading & Subtext */}
        <h1 className="minimal-heading">Sign in</h1>
        <p className="minimal-subtext">Use your work email to continue.</p>

        {/* Form */}
        <form onSubmit={submit}>
          <div className="minimal-field">
            <label htmlFor="minimal-email" className="minimal-label">Email</label>
            <input
              id="minimal-email"
              type="email"
              autoComplete="username"
              className="minimal-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="minimal-field">
            <label htmlFor="minimal-pwd" className="minimal-label">Password</label>
            <div className="minimal-pwd-wrapper">
              <input
                id="minimal-pwd"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="minimal-input minimal-input-pwd"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="minimal-toggle-btn"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="minimal-submit-btn" disabled={busy}>
            {busy ? 'Continuing…' : 'Continue'}
          </button>

          {error && (
            <div className="minimal-error">
              {error}
            </div>
          )}
        </form>

        {/* Divider */}
        <div className="minimal-divider">
          <span className="minimal-divider-label">or sign in as</span>
        </div>

        {/* Demo Buttons Grid */}
        <div className="minimal-demo-grid">
          {DEMO_ROLES.map(({ label, email: demoEmail, password: demoPassword }) => (
            <button
              key={label}
              type="button"
              className="minimal-demo-btn"
              onClick={() => handleDemoSelect(demoEmail, demoPassword)}
              title={`Click to fill ${label} credentials`}
            >
              <span className="minimal-demo-role">{label}</span>
              <span className="minimal-demo-email">{demoEmail.split('@')[0]}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="minimal-footer">
          CMMS 2.0 · Manufacturing Edition
        </div>
      </div>
    </div>
  )
}
