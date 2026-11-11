import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  ErrorNote,
  Loading,
  fmtDate,
  useToast,
} from '../ui.jsx'

export const BUILTIN_ROLES = [
  { id: 'admin', label: 'Admin', desc: 'Full enterprise access & user management' },
  { id: 'plant_head', label: 'Plant Head', desc: 'Plant oversight, assets, downtime & calibrations' },
  { id: 'maintenance_manager', label: 'Maintenance Manager', desc: 'Maintenance approvals, transfers, work orders, parts' },
  { id: 'maintenance_engineer', label: 'Maintenance Engineer', desc: 'Engineering execution, jobs, parts, calibrations' },
  { id: 'technician', label: 'Technician', desc: 'Execution, work orders, asset maintenance' },
  { id: 'store_manager', label: 'Store Manager', desc: 'Spare parts inventory & procurement management' },
  { id: 'production_manager', label: 'Production Manager', desc: 'Breakdown reporting & machine status tracking' },
  { id: 'purchase_manager', label: 'Purchase Manager', desc: 'Purchase orders approval & procurement placement' },
  { id: 'auditor', label: 'Auditor', desc: 'Read-only compliance audit & logs review' },
]

export const PRIVILEGE_GROUPS_FALLBACK = {
  "Master Data": [
    "asset.view", "asset.create", 
    "asset.edit", "asset.delete"
  ],
  "Work Orders": [
    "wo.view", "wo.create", 
    "wo.assign", "wo.close"
  ],
  "Preventive Maintenance": [
    "pm.view", "pm.create", "pm.generate"
  ],
  "Breakdown Management": [
    "bd.view", "bd.report", "bd.close"
  ],
  "Spare Parts & Inventory": [
    "part.view", "part.manage", 
    "part.transfer", "part.adjust"
  ],
  "Purchase & Procurement": [
    "pr.view", "pr.create", 
    "pr.approve", "pr.order"
  ],
  "Reports & Analytics": [
    "report.view", "report.export", 
    "kpi.view", "audit.view"
  ],
  "Calibration": [
    "calibration.view", "calibration.log"
  ],
  "Downtime Monitoring": [
    "downtime.view", "downtime.manage"
  ],
  "User Management": [
    "user.view", "user.create", 
    "user.edit", "user.deactivate"
  ],
}

const UNIT_OPTIONS = [
  'Unit 1',
  'Unit 2',
  'Unit 3',
  'Unit 4',
  'Production Line A',
  'Production Line B',
  'Utilities',
]

const DEPARTMENT_OPTIONS = [
  'Machining',
  'Assembly',
  'Fabrication',
  'Utilities',
  'Packing',
  'Quality',
  'Maintenance',
]

export default function Users() {
  const { user, can } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [activeTab, setActiveTab] = useState('users') // 'users' | 'roles'
  const [users, setUsers] = useState([])
  const [customRoles, setCustomRoles] = useState([])
  const [privilegeGroups, setPrivilegeGroups] = useState(PRIVILEGE_GROUPS_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  // Filters
  const [filterRole, setFilterRole] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [exportingId, setExportingId] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const uRes = await api.get('/api/admin/users')
      setUsers(uRes || [])

      if (isAdmin) {
        try {
          const [rRes, pRes] = await Promise.all([
            api.get('/api/roles'),
            api.get('/api/roles/privileges').catch(() => PRIVILEGE_GROUPS_FALLBACK),
          ])
          setCustomRoles(rRes || [])
          if (pRes && Object.keys(pRes).length > 0) {
            setPrivilegeGroups(pRes)
          }
        } catch (e) {
          console.warn('Failed loading roles:', e)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isAdmin])

  const handleUnlock = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/unlock`)
      toast('User account unlocked.', 'ok')
      loadData()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Are you sure you want to delete custom role "${role.display_name}"?`)) {
      return
    }
    try {
      await api.delete(`/api/roles/${role.id}`)
      toast(`Role "${role.display_name}" deleted.`, 'ok')
      loadData()
    } catch (err) {
      toast(err.message || 'Failed to delete role', 'bad')
    }
  }

  const handleGdprExport = async (targetUser) => {
    setExportingId(targetUser.id)
    try {
      const data = await api.get(`/api/gdpr/export/${targetUser.id}`)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr_data_${(targetUser.full_name || targetUser.name).replace(/\s+/g, '_')}_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(`Exported GDPR archive for ${targetUser.full_name || targetUser.name}.`, 'ok')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setExportingId(null)
    }
  }

  const allRolesList = [
    ...BUILTIN_ROLES,
    ...customRoles.map((cr) => ({ id: cr.name, label: cr.display_name, desc: 'Custom configured role' })),
  ]

  const filteredUsers = (users || []).filter((u) => {
    const matchesRole = !filterRole || u.role === filterRole
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.contractor_company && u.contractor_company.toLowerCase().includes(q))
    return matchesRole && matchesSearch
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      {/* Page Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>User Management & Governance</h1>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            Manage enterprise users, access credentials, custom role definitions, and GDPR Article 15/20 data portability.
          </p>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          {activeTab === 'users' && can('user.manage') && (
            <button
              className="primary"
              onClick={() => setShowAddUserModal(true)}
              style={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600 }}
            >
              + Create User
            </button>
          )}
          {activeTab === 'roles' && isAdmin && (
            <button
              className="primary"
              onClick={() => {
                setEditingRole(null)
                setShowRoleModal(true)
              }}
              style={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: 600 }}
            >
              + Create Role
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="row"
        style={{
          gap: '8px',
          borderBottom: '1px solid var(--line, #e5e7eb)',
          paddingBottom: '12px',
          marginTop: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.92rem',
            background: activeTab === 'users' ? '#1E3A5F' : '#ffffff',
            color: activeTab === 'users' ? '#ffffff' : '#4b5563',
            border: '1px solid ' + (activeTab === 'users' ? '#1E3A5F' : '#d1d5db'),
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Users ({users.length})
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.92rem',
              background: activeTab === 'roles' ? '#1E3A5F' : '#ffffff',
              color: activeTab === 'roles' ? '#ffffff' : '#4b5563',
              border: '1px solid ' + (activeTab === 'roles' ? '#1E3A5F' : '#d1d5db'),
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Roles ({customRoles.length})
          </button>
        )}
      </div>

      <ErrorNote error={error} />
      {loading && <Loading />}

      {/* USERS TAB CONTENT */}
      {activeTab === 'users' && !loading && (
        <div className="stack" style={{ gap: '1rem' }}>
          {/* Filter toolbar */}
          <div className="panel row" style={{ padding: '12px', gap: '12px', alignItems: 'center', background: '#fff', borderRadius: '10px' }}>
            <input
              type="search"
              placeholder="Search by username, name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{ width: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            >
              <option value="">All Roles</option>
              {allRolesList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="small muted" style={{ whiteSpace: 'nowrap' }}>
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>

          <div className="panel" style={{ padding: 0, overflowX: 'auto', background: '#fff', borderRadius: '10px' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line, #e5e7eb)', background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>User & Email</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Units & Departments</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Registered</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                      No users match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleMeta = allRolesList.find((r) => r.id === u.role) || { label: u.role, desc: 'Role' }
                    const isInactive = u.status === 'inactive'
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--line, #e5e7eb)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '0.95rem', color: '#111827' }}>
                              {u.full_name || u.name}
                            </strong>
                            {u.username && (
                              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>@{u.username}</span>
                            )}
                            <span className="small muted" style={{ fontSize: '0.8rem' }}>{u.email}</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="badge blue"
                            style={{
                              textTransform: 'capitalize',
                              fontWeight: 600,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {roleMeta.label}
                          </span>
                          {roleMeta.desc && (
                            <div className="small muted" style={{ marginTop: '2px', maxWidth: '240px', fontSize: '0.78rem' }}>
                              {roleMeta.desc}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {u.units && u.units.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {u.units.map((unit) => (
                                  <span
                                    key={unit}
                                    style={{
                                      fontSize: '0.75rem',
                                      background: '#f3f4f6',
                                      color: '#374151',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    📍 {unit}
                                  </span>
                                ))}
                              </div>
                            )}
                            {u.departments && u.departments.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {u.departments.map((dept) => (
                                  <span
                                    key={dept}
                                    style={{
                                      fontSize: '0.75rem',
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    🏭 {dept}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(!u.units || u.units.length === 0) && (!u.departments || u.departments.length === 0) && (
                              <span className="muted small" style={{ fontSize: '0.8rem' }}>All Plant Areas</span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {u.is_locked ? (
                            <span className="badge red" style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px' }}>
                              🔒 Locked Out
                            </span>
                          ) : isInactive ? (
                            <span className="badge gray" style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 8px', borderRadius: '6px' }}>
                              ○ Inactive
                            </span>
                          ) : (
                            <span className="badge green" style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '6px' }}>
                              ✓ Active
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563' }}>
                          {fmtDate(u.created_at)}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="small"
                              disabled={exportingId === u.id}
                              onClick={() => handleGdprExport(u)}
                              title="Download complete GDPR personal activity data archive as JSON"
                              style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                            >
                              {exportingId === u.id ? 'Exporting…' : 'GDPR Export 📥'}
                            </button>

                            {u.is_locked && (
                              <button
                                type="button"
                                className="small ok"
                                style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                                onClick={() => handleUnlock(u.id)}
                              >
                                Unlock 🔓
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROLES TAB CONTENT */}
      {activeTab === 'roles' && !loading && (
        <div className="stack" style={{ gap: '1rem' }}>
          <div className="panel" style={{ padding: 0, overflowX: 'auto', background: '#fff', borderRadius: '10px' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line, #e5e7eb)', background: '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Role Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Display Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Privileges Count</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase' }}>Created By</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4b5563', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customRoles.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>No custom roles created yet.</p>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          setEditingRole(null)
                          setShowRoleModal(true)
                        }}
                        style={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600 }}
                      >
                        + Create Role
                      </button>
                    </td>
                  </tr>
                ) : (
                  customRoles.map((role) => (
                    <tr key={role.id} style={{ borderBottom: '1px solid var(--line, #e5e7eb)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <code
                          style={{
                            background: '#f3f4f6',
                            color: '#1f2937',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                          }}
                        >
                          {role.name}
                        </code>
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                        {role.display_name}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          {(role.privileges || []).length} privileges
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: '0.88rem', color: '#4b5563' }}>
                        {role.created_by || 'Admin'}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            className="small"
                            onClick={() => {
                              setEditingRole(role)
                              setShowRoleModal(true)
                            }}
                            style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            Edit ✏️
                          </button>
                          <button
                            type="button"
                            className="small"
                            onClick={() => handleDeleteRole(role)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#dc2626',
                              borderColor: '#fca5a5',
                            }}
                          >
                            Delete 🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showAddUserModal && (
        <CreateUserModal
          customRoles={customRoles}
          onClose={() => setShowAddUserModal(false)}
          onAdded={() => {
            setShowAddUserModal(false)
            loadData()
            toast('User account created successfully.', 'ok')
          }}
        />
      )}

      {/* CREATE / EDIT ROLE MODAL */}
      {showRoleModal && (
        <RoleModal
          role={editingRole}
          privilegeGroups={privilegeGroups}
          onClose={() => {
            setShowRoleModal(false)
            setEditingRole(null)
          }}
          onSaved={() => {
            setShowRoleModal(false)
            setEditingRole(null)
            loadData()
            toast(editingRole ? 'Role updated successfully.' : 'Custom role created successfully.', 'ok')
          }}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------
   MULTI-SELECT DROPDOWN COMPONENT
---------------------------------------------------- */
function MultiSelect({ label, options, selected = [], onChange, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((x) => x !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  const removeOption = (e, opt) => {
    e.stopPropagation()
    onChange(selected.filter((x) => x !== opt))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={containerRef}>
      <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{label}</label>
      <div
        onClick={() => setOpen(!open)}
        style={{
          minHeight: '42px',
          padding: '6px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          boxSizing: 'border-box',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{placeholder}</span>
        ) : (
          selected.map((opt) => (
            <span
              key={opt}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#e0e7ff',
                color: '#1e3a8a',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 500,
              }}
            >
              {opt}
              <button
                type="button"
                onClick={(e) => removeOption(e, opt)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#1e3a8a',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            maxHeight: '220px',
            overflowY: 'auto',
            marginTop: '4px',
            padding: '4px 0',
          }}
        >
          {options.map((opt) => {
            const isSelected = selected.includes(opt)
            return (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  background: isSelected ? '#f3f4f6' : 'transparent',
                  fontSize: '0.875rem',
                  color: '#1f2937',
                  margin: 0,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOption(opt)}
                  style={{ accentColor: '#1E3A5F', cursor: 'pointer' }}
                />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------
   CREATE USER MODAL (CHANGE 3)
   Exact order:
   Row 1: Username * | Full Name *
   Row 2: Email Address *
   Row 3: Role *
   Row 4: Units (Select Multiple)
   Row 5: Departments (Select Multiple)
   Row 6: Password * (show/hide eye) | Status (Active/Inactive)
   Buttons: Cancel | Create User
---------------------------------------------------- */
function CreateUserModal({ customRoles, onClose, onAdded }) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(BUILTIN_ROLES[0].id)
  const [units, setUnits] = useState([])
  const [departments, setDepartments] = useState([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('active')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post('/api/admin/users', {
        username: username.trim(),
        full_name: fullName.trim(),
        name: fullName.trim(),
        email: email.trim(),
        role,
        units,
        departments,
        password,
        status,
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '28px',
          width: '100%',
          maxWidth: '620px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#111827' }}>Create New User</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '16px' }}>
          <ErrorNote error={err} />

          {/* Row 1 (two columns side by side): Username * | Full Name * */}
          <div className="row" style={{ gap: '16px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-username" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Username *
              </label>
              <input
                id="usr-username"
                type="text"
                required
                placeholder="e.g. h_richter"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem' }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-fullname" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Full Name *
              </label>
              <input
                id="usr-fullname"
                type="text"
                required
                placeholder="e.g. Hans Richter"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem' }}
              />
            </div>
          </div>

          {/* Row 2 (full width): Email Address * */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="usr-email" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Email Address *
            </label>
            <input
              id="usr-email"
              type="email"
              required
              placeholder="e.g. h.richter@plant.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem' }}
            />
          </div>

          {/* Row 3 (full width): Role * — dropdown showing 9 built-in roles PLUS custom roles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="usr-role" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Role *
            </label>
            <select
              id="usr-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem', background: '#fff' }}
            >
              <optgroup label="Built-in Roles">
                {BUILTIN_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.name}>
                      {cr.display_name} ({cr.name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Row 4 (full width): Units (Select Multiple) */}
          <MultiSelect
            label="Units (Select Multiple)"
            options={UNIT_OPTIONS}
            selected={units}
            onChange={setUnits}
            placeholder="Select applicable plant units..."
          />

          {/* Row 5 (full width): Departments (Select Multiple) */}
          <MultiSelect
            label="Departments (Select Multiple)"
            options={DEPARTMENT_OPTIONS}
            selected={departments}
            onChange={setDepartments}
            placeholder="Select applicable departments..."
          />

          {/* Row 6 (two columns side by side): Password * | Status */}
          <div className="row" style={{ gap: '16px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-password" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Password *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="usr-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 40px 9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#6b7280',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-status" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Status
              </label>
              <select
                id="usr-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem', background: '#fff' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Buttons: Cancel | Create User (blue primary #1E3A5F) */}
          <div className="row" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={saving}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#1E3A5F',
                color: '#ffffff',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ----------------------------------------------------
   CREATE / EDIT ROLE MODAL (CHANGE 2)
   - Role Name * (slug, lowercase, no spaces)
   - Display Name *
   - Privileges grouped checklist from PRIVILEGE_GROUPS:
     Section header with select-all checkbox + count badge
     Indented individual privilege checkboxes
     Accent color checkboxes
   - Cancel and Create Role / Save Changes buttons
---------------------------------------------------- */
function RoleModal({ role, privilegeGroups, onClose, onSaved }) {
  const isEdit = Boolean(role && role.id)
  const [name, setName] = useState(role ? role.name : '')
  const [displayName, setDisplayName] = useState(role ? role.display_name : '')
  const [selectedPrivileges, setSelectedPrivileges] = useState(role ? role.privileges || [] : [])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleToggleGroup = (groupPrivs) => {
    const allSelected = groupPrivs.every((p) => selectedPrivileges.includes(p))
    if (allSelected) {
      setSelectedPrivileges(selectedPrivileges.filter((p) => !groupPrivs.includes(p)))
    } else {
      const merged = new Set([...selectedPrivileges, ...groupPrivs])
      setSelectedPrivileges(Array.from(merged))
    }
  }

  const handleTogglePrivilege = (priv) => {
    if (selectedPrivileges.includes(priv)) {
      setSelectedPrivileges(selectedPrivileges.filter((p) => p !== priv))
    } else {
      setSelectedPrivileges([...selectedPrivileges, priv])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      if (isEdit) {
        await api.put(`/api/roles/${role.id}`, {
          display_name: displayName.trim(),
          privileges: selectedPrivileges,
        })
      } else {
        const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
        if (!cleanSlug) {
          throw new Error('Please enter a valid role name.')
        }
        await api.post('/api/roles', {
          name: cleanSlug,
          display_name: displayName.trim() || cleanSlug,
          privileges: selectedPrivileges,
        })
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '28px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#111827' }}>
            {isEdit ? 'Edit Custom Role' : 'Create Custom Role'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '16px' }}>
          <ErrorNote error={err} />

          {/* Role Name * (slug, lowercase, no spaces) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="role-name" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Role Name *
            </label>
            <input
              id="role-name"
              type="text"
              required
              disabled={isEdit}
              placeholder="e.g. shift_supervisor"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.92rem',
                backgroundColor: isEdit ? '#f3f4f6' : '#fff',
              }}
            />
            <span className="muted small" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Slug identifier: lowercase, no spaces, e.g. "shift_supervisor"
            </span>
          </div>

          {/* Display Name * */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="role-display-name" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Display Name *
            </label>
            <input
              id="role-display-name"
              type="text"
              required
              placeholder="e.g. Shift Supervisor"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.92rem' }}
            />
          </div>

          {/* Privileges Grouped Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Privileges ({selectedPrivileges.length} selected)
            </label>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '12px 16px',
                maxHeight: '340px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {Object.entries(privilegeGroups).map(([groupTitle, privs], index) => {
                const groupSelected = privs.filter((p) => selectedPrivileges.includes(p))
                const allInGroupSelected = privs.length > 0 && groupSelected.length === privs.length

                return (
                  <div
                    key={groupTitle}
                    style={{
                      borderTop: index === 0 ? 'none' : '1px solid #e5e7eb',
                      paddingTop: index === 0 ? '0' : '12px',
                    }}
                  >
                    {/* Group Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          color: '#1f2937',
                          margin: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allInGroupSelected}
                          onChange={() => handleToggleGroup(privs)}
                          style={{ accentColor: '#1E3A5F', cursor: 'pointer' }}
                        />
                        <span>{groupTitle}</span>
                      </label>
                      <span
                        style={{
                          background: groupSelected.length > 0 ? '#eff6ff' : '#f3f4f6',
                          color: groupSelected.length > 0 ? '#1d4ed8' : '#6b7280',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                      >
                        {groupSelected.length}
                      </span>
                    </div>

                    {/* Indented individual privilege checkboxes */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '6px 12px',
                        paddingLeft: '24px',
                      }}
                    >
                      {privs.map((priv) => {
                        const isChecked = selectedPrivileges.includes(priv)
                        return (
                          <label
                            key={priv}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontSize: '0.84rem',
                              color: isChecked ? '#111827' : '#4b5563',
                              margin: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePrivilege(priv)}
                              style={{ accentColor: '#1E3A5F', cursor: 'pointer' }}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{priv}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Buttons: Cancel | Create Role */}
          <div className="row" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={saving}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#1E3A5F',
                color: '#ffffff',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
