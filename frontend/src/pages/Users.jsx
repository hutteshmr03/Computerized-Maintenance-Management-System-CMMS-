import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  ErrorNote,
  Loading,
  Modal,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', desc: 'Full enterprise access & user management' },
  { id: 'plant_head', label: 'Plant Head', desc: 'Plant oversight, assets, downtime & calibrations' },
  { id: 'maintenance_manager', label: 'Maintenance Manager', desc: 'Maintenance approvals, transfers, work orders, parts' },
  { id: 'maintenance_engineer', label: 'Maintenance Engineer', desc: 'Engineering execution, jobs, parts, calibrations' },
  { id: 'technician', label: 'Technician', desc: 'Execution, work orders, asset maintenance' },
  { id: 'store_manager', label: 'Store Manager', desc: 'Spare parts inventory & procurement management' },
  { id: 'production_manager', label: 'Production Manager', desc: 'Breakdown reporting & machine status tracking' },
  { id: 'purchase_manager', label: 'Purchase Manager', desc: 'Purchase orders approval & procurement placement' },
  { id: 'auditor', label: 'Auditor', desc: 'Read-only compliance audit & logs review' },
]

export default function Users() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: users, loading, error, reload } = useLoad(() => api.get('/api/admin/users'))
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [exportingId, setExportingId] = useState(null)

  const handleUnlock = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/unlock`)
      toast('User account unlocked.', 'ok')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const handleGdprExport = async (targetUser) => {
    setExportingId(targetUser.id)
    try {
      const data = await api.get(`/api/gdpr/export/${targetUser.id}`)
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr_data_${targetUser.name.replace(/\s+/g, '_')}_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(`Exported GDPR archive for ${targetUser.name}.`, 'ok')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setExportingId(null)
    }
  }

  const filtered = (users || []).filter((u) => {
    const matchesRole = !filterRole || u.role === filterRole
    const matchesSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.contractor_company && u.contractor_company.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesRole && matchesSearch
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>User Management & GDPR Compliance</h1>
          <p className="muted" style={{ margin: 0 }}>
            Manage the 7 system roles, security lockout statuses, and exercise GDPR Article 15/20 data portability.
          </p>
        </div>
        <div className="row">
          {can('user.manage') && (
            <button className="primary" onClick={() => setShowAddModal(true)}>
              + Create User
            </button>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="panel row" style={{ padding: '12px', gap: '12px' }}>
        <input
          type="search"
          placeholder="Search by name, email, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ width: '200px' }}>
          <option value="">All 7 Roles</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="small muted right">
          Showing {filtered.length} active users
        </div>
      </div>

      {loading && <Loading />}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>Name & Email</th>
              <th style={{ padding: '12px' }}>System Role</th>
              <th style={{ padding: '12px' }}>Vendor Organization</th>
              <th style={{ padding: '12px' }}>Security Status</th>
              <th style={{ padding: '12px' }}>Registered</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>GDPR & Account Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const roleMeta = ROLES.find((r) => r.id === u.role) || { label: u.role }
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{u.name}</strong>
                    <div className="small muted">{u.email}</div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span className="badge blue" style={{ textTransform: 'capitalize' }}>
                      {roleMeta.label}
                    </span>
                    <div className="small muted" style={{ marginTop: '2px', maxWidth: '240px' }}>
                      {roleMeta.desc}
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    {u.contractor_company ? (
                      <span className="badge purple small">🏢 {u.contractor_company}</span>
                    ) : (
                      <span className="muted small">Internal Staff</span>
                    )}
                  </td>

                  <td style={{ padding: '12px' }}>
                    {u.is_locked ? (
                      <span className="badge red">🔒 Locked Out</span>
                    ) : (
                      <span className="badge green">✓ Active</span>
                    )}
                  </td>

                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                    {fmtDate(u.created_at)}
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        type="button"
                        className="small"
                        disabled={exportingId === u.id}
                        onClick={() => handleGdprExport(u)}
                        title="Download complete GDPR personal activity data archive as JSON"
                      >
                        {exportingId === u.id ? 'Exporting…' : 'GDPR Export 📥'}
                      </button>

                      {u.is_locked && (
                        <button
                          type="button"
                          className="small ok"
                          style={{ backgroundColor: 'var(--ok)', color: '#fff' }}
                          onClick={() => handleUnlock(u.id)}
                        >
                          Unlock 🔓
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <CreateUserModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            reload()
            toast('User account created.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function CreateUserModal({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('technician')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post('/api/admin/users', {
        name,
        email,
        password,
        role,
        contractor_company: role === 'contractor' ? company : '',
        phone,
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Create Enterprise User Account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Hans Richter"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Work Email Address *</label>
            <input
              type="email"
              required
              placeholder="h.richter@plant.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Password *</label>
            <input
              type="password"
              required
              minLength="6"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Enterprise Role *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {role === 'contractor' && (
          <div>
            <label>Contractor / Vendor Organization Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Atlas Copco Service GmbH"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        )}

        <div>
          <label>Contact Phone Number</label>
          <input
            type="tel"
            placeholder="+49 711 987654"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
