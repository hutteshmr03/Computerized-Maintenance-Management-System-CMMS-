import { useState, useEffect } from 'react'
import { api } from '../api'
import { ErrorNote, Loading, useToast } from '../ui.jsx'

function IconPassword() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconSession() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '5px' }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const ICON_STYLE = {
  width: '42px',
  height: '42px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

export default function Security() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30)
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5)

  useEffect(() => {
    let mounted = true
    api.get('/api/security-settings')
      .then((data) => {
        if (!mounted) return
        if (data) {
          setPasswordExpiryDays(data.password_expiry_days ?? 90)
          setSessionTimeoutMinutes(data.session_timeout_minutes ?? 30)
          setMaxLoginAttempts(data.max_login_attempts ?? 5)
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Failed to load security settings')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await api.put('/api/security-settings', {
        password_expiry_days: Math.min(90, Math.max(1, parseInt(passwordExpiryDays, 10) || 90)),
        session_timeout_minutes: parseInt(sessionTimeoutMinutes, 10),
        max_login_attempts: parseInt(maxLoginAttempts, 10),
      })
      setPasswordExpiryDays(res.password_expiry_days)
      setSessionTimeoutMinutes(res.session_timeout_minutes)
      setMaxLoginAttempts(res.max_login_attempts)
      setSuccessMsg('Security settings updated successfully.')
      toast('Security settings saved successfully.', 'ok')
    } catch (err) {
      setError(err.message || 'Failed to save security settings')
      toast(err.message || 'Failed to save security settings', 'bad')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="stack" style={{ maxWidth: '100%', width: '100%', gap: '16px' }}>
      <form id="security-settings-form" onSubmit={handleSave} className="stack" style={{ gap: '16px', width: '100%' }}>
        {/* Header row */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Security Settings</h1>
          <button
            type="submit"
            className="bt p"
            disabled={saving}
            style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}
          >
            {saving ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <IconSave />
                Save Settings
              </>
            )}
          </button>
        </div>

        <ErrorNote error={error} />

        {successMsg && (
          <div className="al" style={{ borderLeftColor: 'var(--grn)', color: 'var(--grn)', display: 'flex', alignItems: 'center' }}>
            <IconCheck />{successMsg}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px',
            width: '100%',
          }}
        >
          {/* Section 1 — Password Policy */}
          <div className="card">
            <div className="row" style={{ alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ ...ICON_STYLE, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                <IconPassword />
              </div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Password Policy</h2>
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label htmlFor="sec-password-expiry" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mu)' }}>
                Password Expiry (Days)
              </label>
              <input
                id="sec-password-expiry"
                type="number"
                min="1"
                max="90"
                value={passwordExpiryDays}
                onChange={(e) => setPasswordExpiryDays(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          {/* Section 2 — Session Policy */}
          <div className="card">
            <div className="row" style={{ alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ ...ICON_STYLE, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                <IconSession />
              </div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Session Policy</h2>
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label htmlFor="sec-session-timeout" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mu)' }}>
                Session Timeout
              </label>
              <select
                id="sec-session-timeout"
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>
          </div>

          {/* Section 3 — Account Policy */}
          <div className="card">
            <div className="row" style={{ alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ ...ICON_STYLE, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                <IconShield />
              </div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Account Policy</h2>
            </div>

            <div className="stack" style={{ gap: '6px' }}>
              <label htmlFor="sec-login-attempts" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mu)' }}>
                Max Login Attempts Before Lockout
              </label>
              <select
                id="sec-login-attempts"
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
                <option value={10}>10 attempts</option>
                <option value={0}>Unlimited</option>
              </select>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
