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
    <div className="stack" style={{ maxWidth: '100%', width: '100%', gap: '16px' }}>
      <form id="security-settings-form" onSubmit={handleSave} className="stack" style={{ gap: '16px', width: '100%' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Security Settings</h1>
          <button
            type="submit"
            className="bt p"
            disabled={saving}
            style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600 }}
          >
            {saving ? 'Saving Settings…' : '💾 Save Settings'}
          </button>
        </div>

        <ErrorNote error={error} />

        {successMsg && (
          <div className="al" style={{ borderLeftColor: 'var(--grn)', color: 'var(--grn)' }}>
            ✓ {successMsg}
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
          {/* Section 1 — 🔒 Password Policy */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="row" style={{ alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '1.35rem' }}>🔒</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Password Policy</h2>
                  <div style={{ fontSize: '11.5px', color: 'var(--mu)' }}>Credential rotation rule</div>
                </div>
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
                <span className="muted small" style={{ fontSize: '11px', color: 'var(--mu)' }}>
                  Maximum 90 days before mandatory password reset
                </span>
              </div>
            </div>
          </div>

          {/* Section 2 — 🔄 Session Policy */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="row" style={{ alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '1.35rem' }}>🔄</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Session Policy</h2>
                  <div style={{ fontSize: '11.5px', color: 'var(--mu)' }}>Inactivity timeout threshold</div>
                </div>
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
                <span className="muted small" style={{ fontSize: '11px', color: 'var(--mu)' }}>
                  Automatically ends session after inactivity
                </span>
              </div>
            </div>
          </div>

          {/* Section 3 — ⚠️ Account Policy */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="row" style={{ alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '1.35rem' }}>⚠️</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Account Policy</h2>
                  <div style={{ fontSize: '11.5px', color: 'var(--mu)' }}>Brute-force lockout prevention</div>
                </div>
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
                <span className="muted small" style={{ fontSize: '11px', color: 'var(--mu)' }}>
                  Temporarily locks account after consecutive failed attempts
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
