import { useState, useEffect } from 'react'
import { api } from '../api'
import { ErrorNote, Loading, useToast } from '../ui.jsx'

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
    <div className="stack" style={{ maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Security Settings</h1>
        <p className="muted" style={{ margin: '4px 0 0 0' }}>
          Configure enterprise password policies, session timeouts, and account lockout thresholds.
        </p>
      </div>

      <ErrorNote error={error} />

      {successMsg && (
        <div className="al" style={{ borderLeftColor: 'var(--grn)', color: 'var(--grn)' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="stack" style={{ gap: '1rem' }}>
        {/* Section 1 — 🔒 Password Policy */}
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>🔒</span>
            <h2 style={{ margin: 0, fontSize: '15px' }}>Password Policy</h2>
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
              style={{ maxWidth: '240px' }}
              required
            />
            <span className="muted small" style={{ fontSize: '11px', color: 'var(--mu)' }}>
              Max 90 days
            </span>
          </div>
        </div>

        {/* Section 2 — 🔄 Session Policy */}
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>🔄</span>
            <h2 style={{ margin: 0, fontSize: '15px' }}>Session Policy</h2>
          </div>

          <div className="stack" style={{ gap: '6px' }}>
            <label htmlFor="sec-session-timeout" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mu)' }}>
              Session Timeout
            </label>
            <select
              id="sec-session-timeout"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
              style={{ maxWidth: '240px' }}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>
        </div>

        {/* Section 3 — ⚠ Account Policy */}
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <h2 style={{ margin: 0, fontSize: '15px' }}>Account Policy</h2>
          </div>

          <div className="stack" style={{ gap: '6px' }}>
            <label htmlFor="sec-login-attempts" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--mu)' }}>
              Max Login Attempts Before Lockout
            </label>
            <select
              id="sec-login-attempts"
              value={maxLoginAttempts}
              onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
              style={{ maxWidth: '240px' }}
            >
              <option value={3}>3 attempts</option>
              <option value={5}>5 attempts</option>
              <option value={10}>10 attempts</option>
              <option value={0}>Unlimited</option>
            </select>
          </div>
        </div>

        {/* Save button at bottom */}
        <button
          type="submit"
          className="bt p"
          disabled={saving}
          style={{
            width: '100%',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving Settings…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
