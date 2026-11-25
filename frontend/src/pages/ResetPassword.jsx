import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Loading, useToast } from '../ui.jsx'

export default function ResetPassword() {
  const { user, ready, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ready) return <div className="page"><Loading /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.must_reset_password) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    const pw = newPassword.trim()
    if (pw.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (pw !== confirmPassword.trim()) {
      setError('Passwords do not match. Please re-enter carefully.')
      return
    }

    setBusy(true)
    try {
      const res = await api.post('/api/auth/reset-password', { new_password: pw })
      if (res?.user) {
        setUser(res.user)
      } else {
        setUser({ ...user, must_reset_password: false })
      }
      toast('Password updated successfully!', 'ok')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to reset password')
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

        .login-brand-title {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #FFFFFF;
          line-height: 1.4;
        }

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
          font-size: clamp(32px, 3vw, 44px);
          color: #FFFFFF;
          line-height: 1.18;
          margin: 0 0 18px 0;
        }

        .login-left-body {
          font-size: 15.5px;
          color: #9CA3AF;
          line-height: 1.65;
          margin: 0;
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
          background-size: 28px 28px;
          border-radius: 3px;
        }

        .login-right-panel {
          width: 55%;
          background: #F9FAFB;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          box-sizing: border-box;
        }

        .login-form-wrapper {
          width: 100%;
          max-width: 400px;
        }

        .login-heading {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px 0;
        }

        .login-subtext {
          font-size: 14px;
          color: #6B7280;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .login-field {
          margin-bottom: 18px;
        }

        .login-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .login-pwd-wrapper {
          position: relative;
        }

        .login-input {
          width: 100%;
          padding: 11px 44px 11px 14px;
          font-size: 14.5px;
          color: #111827;
          background: #FFFFFF;
          border: 1px solid #D1D5DB;
          border-radius: 8px;
          box-sizing: border-box;
          outline: none;
        }

        .login-input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
        }

        .login-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 13px;
          color: #6B7280;
          cursor: pointer;
          font-weight: 500;
          padding: 4px 6px;
        }

        .login-submit-btn {
          margin-top: 8px;
          width: 100%;
          padding: 12px;
          background: #111827;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 14px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .login-submit-btn:disabled {
          background: #9CA3AF;
          cursor: not-allowed;
        }

        .login-error {
          font-size: 13px;
          color: #DC2626;
          margin-top: 12px;
          background: #FEF2F2;
          border: 1px solid #FEE2E2;
          border-radius: 6px;
          padding: 10px 12px;
        }

        .reset-notice-banner {
          background: #FEF3C7;
          border: 1px solid #FDE68A;
          color: #92400E;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.45;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .login-left-panel { display: none; }
          .login-right-panel { width: 100%; }
        }
      `}</style>

      <div className="login-left-panel">
        <div>
          <span className="login-brand-title">
            Computerized Maintenance Management System (CMMS)
          </span>
        </div>

        <div className="login-left-middle">
          <h1 className="login-left-headline">Secure your account.</h1>
          <p className="login-left-body">
            For security compliance, new accounts and administrator-reset credentials require setting a personal password before accessing plant operations.
          </p>
        </div>

        <div>
          <div className="industrial-stripe" aria-hidden="true" />
        </div>
      </div>

      <div className="login-right-panel">
        <div className="login-form-wrapper">
          <h2 className="login-heading">Set New Password</h2>
          <p className="login-subtext">
            Signed in as <strong>{user.full_name || user.name}</strong> ({user.email})
          </p>

          <div className="reset-notice-banner">
            <strong>Password Reset Required:</strong> Please create your new personal password to access the CMMS workspace.
          </div>

          <form onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="reset-new-pwd" className="login-label">New Password *</label>
              <div className="login-pwd-wrapper">
                <input
                  id="reset-new-pwd"
                  type={showNew ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="login-toggle-btn"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reset-confirm-pwd" className="login-label">Confirm New Password *</label>
              <div className="login-pwd-wrapper">
                <input
                  id="reset-confirm-pwd"
                  type={showConfirm ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="login-toggle-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy ? 'Updating Password…' : 'Save Password & Continue →'}
            </button>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <div style={{ marginTop: '18px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={logout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Log out and sign in with another account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
