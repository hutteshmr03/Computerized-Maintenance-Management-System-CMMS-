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
  { id: 'admin', label: 'Admin', desc: 'Full enterprise access & user management', count: 'Full Access (*)' },
  { id: 'plant_head', label: 'Plant Head', desc: 'Plant oversight, assets, downtime & calibrations', count: '8 privileges' },
  { id: 'maintenance_manager', label: 'Maintenance Manager', desc: 'Maintenance approvals, transfers, work orders, parts', count: '11 privileges' },
  { id: 'maintenance_engineer', label: 'Maintenance Engineer', desc: 'Engineering execution, jobs, parts, calibrations', count: '7 privileges' },
  { id: 'technician', label: 'Technician', desc: 'Execution, work orders, asset maintenance', count: '4 privileges' },
  { id: 'store_manager', label: 'Store Manager', desc: 'Spare parts inventory & procurement management', count: '3 privileges' },
  { id: 'production_manager', label: 'Production Manager', desc: 'Breakdown reporting & machine status tracking', count: '4 privileges' },
  { id: 'purchase_manager', label: 'Purchase Manager', desc: 'Purchase orders approval & procurement placement', count: '2 privileges' },
  { id: 'quality_manager', label: 'Quality Manager', desc: 'Calibration governance, quality audit & inspection reports', count: '7 privileges' },
  { id: 'auditor', label: 'Auditor', desc: 'Read-only compliance audit & logs review', count: '5 privileges' },
]

export const PRIVILEGE_GROUPS_FALLBACK = {
  "Master Data & Assets": [
    "asset.view",
    "asset.create",
    "asset.edit",
    "asset.delete",
    "asset.transfer",
    "transfer.decide",
    "bom.manage",
  ],
  "Work Orders & Repairs": [
    "job.view",
    "job.create",
    "job.plan",
    "job.send",
    "job.approve",
    "job.start",
    "job.work",
    "job.loto_sign",
    "job.review",
    "job.close",
  ],
  "Preventive Maintenance (PM)": [
    "plan.view",
    "plan.manage",
  ],
  "Spare Parts & Inventory": [
    "part.view",
    "part.manage",
  ],
  "Purchase & Procurement": [
    "procurement.view",
    "procurement.manage",
    "procurement.approve",
    "procurement.order",
  ],
  "Condition Monitoring & Readings": [
    "reading.view",
    "reading.log",
  ],
  "Calibration (ISO 9001)": [
    "calibration.view",
    "calibration.manage",
  ],
  "Service Contracts & SLAs": [
    "contract.view",
    "contract.manage",
  ],
  "Reports, KPIs & Analytics": [
    "report.view",
    "report.export",
    "kpi.view",
    "oee.view",
    "downtime.view",
    "downtime.manage",
    "audit.view",
  ],
  "User Management & Security": [
    "user.view",
    "user.manage",
  ],
}

export const PRIVILEGE_DESCRIPTIONS = {
  "asset.view": "View equipment specs & hierarchy tree",
  "asset.create": "Add new assets & upload manuals/documents",
  "asset.edit": "Edit equipment specs & replacement value",
  "asset.delete": "Decommission / delete assets",
  "asset.transfer": "Request equipment relocation transfer",
  "transfer.decide": "Approve / reject transfer requests",
  "bom.manage": "Manage Bill of Materials (BOM) parts",
  "job.view": "View work orders, Kanban & Gantt",
  "job.create": "Raise work orders & breakdown tickets",
  "job.plan": "Schedule & assign technicians",
  "job.send": "Send work orders for manager approval",
  "job.approve": "Approve work orders & repair requests",
  "job.start": "Start approved work orders",
  "job.work": "Execute checklists, log hours & ISO failure codes",
  "job.loto_sign": "Sign Lockout/Tagout (LOTO) safety permits",
  "job.review": "Review completed maintenance work",
  "job.close": "Sign off and close work orders",
  "plan.view": "View preventive maintenance plans",
  "plan.manage": "Create & configure PM trigger rules",
  "part.view": "View spare parts stock & bin locations",
  "part.manage": "Manage inventory stock & replenish",
  "procurement.view": "View purchase requests",
  "procurement.manage": "Create purchase requests & manage PRs",
  "procurement.approve": "Approve purchase requests",
  "procurement.order": "Place purchase orders with vendors",
  "reading.view": "View sensor telemetry & readings",
  "reading.log": "Log manual gauge & sensor measurements",
  "calibration.view": "View calibration status & certificates",
  "calibration.manage": "Log ISO 9001 calibration certificates",
  "contract.view": "View service contracts & warranties",
  "contract.manage": "Manage vendor service agreements",
  "report.view": "View EN 13306 reports & KPI dashboards",
  "report.export": "Export reports & maintenance summaries",
  "kpi.view": "View executive KPI tiles (OEE, MTBF, MTTR)",
  "oee.view": "View OEE availability & performance",
  "downtime.view": "Monitor live plant downtime breakdown",
  "downtime.manage": "Acknowledge & manage downtime stoppages",
  "audit.view": "View immutable system audit logs",
  "user.view": "View user accounts directory",
  "user.manage": "Create users, manage roles & unlock",
}

const DEFAULT_LOCATION_OPTIONS = [
  'Plant A',
  'Plant B',
  'Warehouse',
  'Workshop',
]

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

function TrashIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M9 3.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3.5V6H9V3.5z" />
      <path d="M4.5 6h15" />
      <path d="M6 6l1.1 13.2a2 2 0 0 0 2 1.8h5.8a2 2 0 0 0 2-1.8L18 6" />
      <line x1="10" y1="10" x2="10" y2="17" />
      <line x1="14" y1="10" x2="14" y2="17" />
    </svg>
  )
}

function EditIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

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
  const [editingUser, setEditingUser] = useState(null)
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

  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === user?.id) {
      toast('You cannot deactivate your own account.', 'bad')
      return
    }
    const isCurrentlyInactive = targetUser.status === 'inactive'
    const nextStatus = isCurrentlyInactive ? 'active' : 'inactive'
    try {
      await api.put(`/api/admin/users/${targetUser.id}/status`, { status: nextStatus })
      toast(`User "${targetUser.full_name || targetUser.name}" switched to ${nextStatus}.`, 'ok')
      loadData()
    } catch (err) {
      toast(err.message || 'Failed to update user status', 'bad')
    }
  }

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user?.id) {
      toast('You cannot delete your own account.', 'bad')
      return
    }
    const name = targetUser.full_name || targetUser.name
    if (!window.confirm(`Are you sure you want to delete user "${name}" (${targetUser.email})?`)) {
      return
    }
    try {
      const res = await api.delete(`/api/admin/users/${targetUser.id}`)
      toast(res.message || `User "${name}" deleted successfully.`, 'ok')
      loadData()
    } catch (err) {
      toast(err.message || 'Failed to delete user', 'bad')
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

  const BUILTIN_DESC_MAP = {
    admin: 'Full enterprise access & user management',
    plant_head: 'Plant oversight, assets, downtime & calibrations',
    maintenance_manager: 'Maintenance approvals, transfers, work orders, parts',
    maintenance_engineer: 'Engineering execution, jobs, parts, calibrations',
    technician: 'Floor execution, digital work checklists, LOTO',
    store_manager: 'Spares inventory, stock adjustments, PR requisitions',
    production_manager: 'Breakdown reporting & machine status tracking',
    purchase_manager: 'PR approval & vendor purchase order issue',
    auditor: 'Compliance audits, calibration protocols, read-only logs',
  }

  const displayRolesList = (customRoles && customRoles.length > 0)
    ? customRoles
    : BUILTIN_ROLES.map((r) => ({
        id: r.id,
        name: r.id,
        display_name: r.label,
        desc: r.desc,
        privileges: r.privileges,
        is_builtin: true,
        created_by: 'System Built-in',
      }))

  const allRolesList = displayRolesList.map((cr) => ({
    id: cr.name || cr.id,
    label: cr.display_name || cr.name,
    desc: cr.desc || BUILTIN_DESC_MAP[cr.name] || 'Custom configured role',
  }))

  const filteredUsers = (users || []).filter((u) => {
    const matchesRole = !filterRole || u.role === filterRole
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.contractor_company && u.contractor_company.toLowerCase().includes(q)) ||
      (u.locations && u.locations.some((loc) => loc.toLowerCase().includes(q)))
    return matchesRole && matchesSearch
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      {/* Page Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>User Management & Governance</h1>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
            Manage enterprise users, access credentials, custom role definitions, and GDPR Article 15/20 data portability.
          </p>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          {activeTab === 'users' && (isAdmin || can('user.manage') || can('user.create')) && (
            <button
              className="bt p"
              onClick={() => setShowAddUserModal(true)}
            >
              + Create User
            </button>
          )}
          {activeTab === 'roles' && isAdmin && (
            <button
              className="bt p"
              onClick={() => {
                setEditingRole(null)
                setShowRoleModal(true)
              }}
            >
              + Create Role
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="tb"
        style={{
          gap: '6px',
          borderBottom: '1px solid var(--bd)',
          paddingBottom: '8px',
          marginTop: '6px',
        }}
      >
        <button
          type="button"
          className={`bt ${activeTab === 'users' ? 'on p' : ''}`}
          onClick={() => setActiveTab('users')}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            fontWeight: 600,
            fontSize: '13px',
            background: activeTab === 'users' ? 'var(--navy)' : 'var(--card)',
            color: activeTab === 'users' ? '#ffffff' : 'var(--mu)',
            border: `1px solid ${activeTab === 'users' ? 'var(--navy)' : 'var(--bd)'}`,
            cursor: 'pointer',
          }}
        >
          Users ({users.length})
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`bt ${activeTab === 'roles' ? 'on p' : ''}`}
            onClick={() => setActiveTab('roles')}
            style={{
              padding: '7px 16px',
              borderRadius: '7px',
              fontWeight: 600,
              fontSize: '13px',
              background: activeTab === 'roles' ? 'var(--navy)' : 'var(--card)',
              color: activeTab === 'roles' ? '#ffffff' : 'var(--mu)',
              border: `1px solid ${activeTab === 'roles' ? 'var(--navy)' : 'var(--bd)'}`,
              cursor: 'pointer',
            }}
          >
            Roles ({displayRolesList.length})
          </button>
        )}
      </div>

      <ErrorNote error={error} />
      {loading && <Loading />}

      {/* USERS TAB CONTENT */}
      {activeTab === 'users' && !loading && (
        <div className="stack" style={{ gap: '10px' }}>
          {/* Filter toolbar */}
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search by username, name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '320px' }}
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ maxWidth: '200px', width: 'auto' }}
              >
                <option value="">All Roles</option>
                {allRolesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="small muted" style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>User & Email</th>
                  <th>Role</th>
                  <th>Plants, Units & Depts</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--mu)' }}>
                      No users match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleMeta = allRolesList.find((r) => r.id === u.role) || { label: u.role, desc: 'Role' }
                    const isInactive = u.status === 'inactive'
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--tx)' }}>
                              {u.full_name || u.name}
                            </strong>
                            {u.username && (
                              <span style={{ fontSize: '11px', color: 'var(--mu)' }}>@{u.username}</span>
                            )}
                            <span className="small muted" style={{ fontSize: '11px' }}>{u.email}</span>
                          </div>
                        </td>

                        <td>
                          <span className="b t">
                            {roleMeta.label}
                          </span>
                          {roleMeta.desc && (
                            <div className="small muted" style={{ marginTop: '2px', maxWidth: '240px', fontSize: '11px' }}>
                              {roleMeta.desc}
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {u.locations && u.locations.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {u.locations.map((loc) => (
                                  <span
                                    key={loc}
                                    className="b"
                                    style={{
                                      fontSize: '11px',
                                      padding: '1px 6px',
                                      background: '#e0f2fe',
                                      color: '#0369a1',
                                      border: '1px solid #bae6fd',
                                    }}
                                  >
                                    📍 {loc}
                                  </span>
                                ))}
                              </div>
                            )}
                            {u.units && u.units.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {u.units.map((unit) => (
                                  <span
                                    key={unit}
                                    className="b"
                                    style={{
                                      fontSize: '11px',
                                      padding: '1px 6px',
                                    }}
                                  >
                                    ⚙️ {unit}
                                  </span>
                                ))}
                              </div>
                            )}
                            {u.departments && u.departments.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {u.departments.map((dept) => (
                                  <span
                                    key={dept}
                                    className="b a"
                                    style={{
                                      fontSize: '11px',
                                      padding: '1px 6px',
                                    }}
                                  >
                                    🏭 {dept}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(!u.locations || u.locations.length === 0) && (!u.units || u.units.length === 0) && (!u.departments || u.departments.length === 0) && (
                              <span className="muted small" style={{ fontSize: '12px' }}>All Plant Areas</span>
                            )}
                          </div>
                        </td>

                        <td>
                          {u.is_locked ? (
                            <span className="b r" title="Account locked due to multiple failed logins">
                              🔒 Locked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              disabled={u.id === user?.id}
                              title={
                                u.id === user?.id
                                  ? 'You cannot deactivate your own account'
                                  : isInactive
                                  ? 'Click to switch to Active'
                                  : 'Click to switch to Inactive'
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                padding: '3px 8px 3px 5px',
                                borderRadius: '20px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: u.id === user?.id ? 'not-allowed' : 'pointer',
                                opacity: u.id === user?.id ? 0.7 : 1,
                                border: isInactive ? '1px solid var(--bd)' : '1px solid #86efac',
                                background: isInactive ? '#f1f5f9' : '#ecfdf5',
                                color: isInactive ? '#64748b' : '#047857',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <span
                                style={{
                                  position: 'relative',
                                  display: 'inline-block',
                                  width: '26px',
                                  height: '14px',
                                  background: isInactive ? '#cbd5e1' : '#10b981',
                                  borderRadius: '14px',
                                  transition: 'background 0.2s ease',
                                  flexShrink: 0,
                                }}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '1px',
                                    left: isInactive ? '2px' : '13px',
                                    width: '12px',
                                    height: '12px',
                                    background: '#ffffff',
                                    borderRadius: '50%',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                                    transition: 'left 0.2s ease',
                                  }}
                                />
                              </span>
                              <span>{isInactive ? 'Inactive' : 'Active'}</span>
                            </button>
                          )}
                        </td>

                        <td style={{ fontSize: '12px', color: 'var(--mu)' }}>
                          {fmtDate(u.created_at)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div className="row" style={{ justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="bt"
                              disabled={exportingId === u.id}
                              onClick={() => handleGdprExport(u)}
                              title="Download complete GDPR personal activity data archive as JSON"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              {exportingId === u.id ? 'Exporting…' : 'GDPR Export 📥'}
                            </button>

                            {u.is_locked && (
                              <button
                                type="button"
                                className="bt p"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => handleUnlock(u.id)}
                              >
                                Unlock 🔓
                              </button>
                            )}

                            {(isAdmin || can('user.manage')) && (
                              <button
                                type="button"
                                onClick={() => setEditingUser(u)}
                                title={`Edit user ${u.full_name || u.name}`}
                                aria-label={`Edit user ${u.full_name || u.name}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '26px',
                                  padding: 0,
                                  background: 'transparent',
                                  border: '1px solid var(--bd)',
                                  borderRadius: '5px',
                                  color: 'var(--mu)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--accent, #2563eb)'
                                  e.currentTarget.style.borderColor = 'var(--accent, #93c5fd)'
                                  e.currentTarget.style.background = '#eff6ff'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--mu)'
                                  e.currentTarget.style.borderColor = 'var(--bd)'
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <EditIcon size={14} />
                              </button>
                            )}

                            {(isAdmin || can('user.manage')) && u.id !== user?.id && !['superadmin@cmms.test', 'admin@cmms.test'].includes(u.email?.toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title={`Delete user ${u.full_name || u.name}`}
                                aria-label={`Delete user ${u.full_name || u.name}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '26px',
                                  padding: 0,
                                  background: 'transparent',
                                  border: '1px solid var(--bd)',
                                  borderRadius: '5px',
                                  color: 'var(--mu)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#dc2626'
                                  e.currentTarget.style.borderColor = '#fca5a5'
                                  e.currentTarget.style.background = '#fef2f2'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--mu)'
                                  e.currentTarget.style.borderColor = 'var(--bd)'
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <TrashIcon size={15} />
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
        <div className="stack" style={{ gap: '10px' }}>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Display Name</th>
                  <th>Privileges Count</th>
                  <th>Type / Created By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* All Roles (Built-in + Custom Roles) */}
                {displayRolesList.map((role) => {
                  const roleName = role.name || role.id
                  const displayName = role.display_name || role.label
                  const desc = role.desc || BUILTIN_DESC_MAP[roleName] || 'Enterprise configured role'
                  const isBuiltin = role.is_builtin || Boolean(BUILTIN_DESC_MAP[roleName])
                  const isFullAccess = roleName === 'admin' || (role.privileges && role.privileges.includes('*'))
                  const privCount = isFullAccess
                    ? 'Full Access (*)'
                    : `${(role.privileges || []).length} privileges`

                  return (
                    <tr key={role.id || roleName}>
                      <td>
                        <code
                          style={{
                            background: 'var(--bg)',
                            color: 'var(--tx)',
                            border: '1px solid var(--bd)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                        >
                          {roleName}
                        </code>
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--tx)' }}>
                        {displayName}
                        {desc && (
                          <div className="small muted" style={{ fontSize: '11px', marginTop: '2px', fontWeight: 400 }}>
                            {desc}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="b t">
                          {privCount}
                        </span>
                      </td>

                      <td>
                        {isBuiltin ? (
                          <span className="b g1" style={{ fontSize: '11px' }}>
                            System Built-in
                          </span>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--mu)' }}>
                            <span className="b a" style={{ fontSize: '11px', marginRight: '6px' }}>
                              Custom
                            </span>
                            {role.created_by || 'Admin'}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="bt"
                            onClick={() => {
                              setEditingRole({
                                ...role,
                                id: role.id || roleName,
                                name: roleName,
                                display_name: displayName,
                                privileges: role.privileges || (roleName === 'admin' ? ['*'] : []),
                                is_builtin: isBuiltin,
                              })
                              setShowRoleModal(true)
                            }}
                            title={`Edit privileges and display name for ${displayName}`}
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            Edit ✏️
                          </button>

                          {!isBuiltin && (
                            <button
                              type="button"
                              className="bt"
                              onClick={() => handleDeleteRole(role)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                color: 'var(--red)',
                                borderColor: 'var(--red)',
                              }}
                            >
                              Delete 🗑️
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

      {/* EDIT USER MODAL */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          customRoles={customRoles}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            loadData()
            toast('User profile updated successfully.', 'ok')
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
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', margin: 0 }}>{label}</label>
      <div
        onClick={() => setOpen(!open)}
        style={{
          minHeight: '38px',
          padding: '5px 10px',
          border: '1px solid var(--bd)',
          borderRadius: '7px',
          background: 'var(--card)',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          boxSizing: 'border-box',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ color: 'var(--mu)', fontSize: '13px' }}>{placeholder}</span>
        ) : (
          selected.map((opt) => (
            <span
              key={opt}
              className="b t"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                fontSize: '11px',
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
                  color: 'inherit',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--mu)' }}>
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
            background: 'var(--card)',
            border: '1px solid var(--bd)',
            borderRadius: '7px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            maxHeight: '200px',
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
                  padding: '7px 12px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg)' : 'transparent',
                  fontSize: '13px',
                  color: 'var(--tx)',
                  margin: 0,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOption(opt)}
                  style={{ accentColor: 'var(--teal)', cursor: 'pointer', width: 'auto' }}
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
  const builtinRoleIds = new Set(BUILTIN_ROLES.map((r) => r.id))
  const userDefinedCustomRoles = (customRoles || []).filter((cr) => !builtinRoleIds.has(cr.name || cr.id))

  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(BUILTIN_ROLES[0].id)
  const [locations, setLocations] = useState([])
  const [locationOptions, setLocationOptions] = useState(DEFAULT_LOCATION_OPTIONS)
  const [units, setUnits] = useState([])
  const [departments, setDepartments] = useState([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('active')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .get('/api/locations')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          const names = Array.from(new Set([...res.map((l) => l.name), ...DEFAULT_LOCATION_OPTIONS]))
          setLocationOptions(names)
        }
      })
      .catch(() => {})
  }, [])

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
        locations,
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
        className="modal mb"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '580px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Create New User</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--mu)', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '12px' }}>
          <ErrorNote error={err} />

          {/* Row 1 (two columns side by side): Username * | Full Name * */}
          <div className="row" style={{ gap: '12px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-username" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Username *
              </label>
              <input
                id="usr-username"
                type="text"
                required
                placeholder="e.g. h_richter"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-fullname" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Full Name *
              </label>
              <input
                id="usr-fullname"
                type="text"
                required
                placeholder="e.g. Hans Richter"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2 (full width): Email Address * */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="usr-email" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Email Address *
            </label>
            <input
              id="usr-email"
              type="email"
              required
              placeholder="e.g. h.richter@plant.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Row 3 (full width): Role * — dropdown showing 9 built-in roles PLUS custom roles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="usr-role" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Role *
            </label>
            <select
              id="usr-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <optgroup label="Built-in Roles">
                {BUILTIN_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              {userDefinedCustomRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {userDefinedCustomRoles.map((cr) => (
                    <option key={cr.id} value={cr.name}>
                      {cr.display_name} ({cr.name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Row 4 (full width): Location (Select Multiple) */}
          <MultiSelect
            label="Location (Select Multiple)"
            options={locationOptions}
            selected={locations}
            onChange={setLocations}
            placeholder="Select applicable locations (e.g. Plant A, Plant B)..."
          />

          {/* Row 5 (full width): Units (Select Multiple) */}
          <MultiSelect
            label="Units (Select Multiple)"
            options={UNIT_OPTIONS}
            selected={units}
            onChange={setUnits}
            placeholder="Select applicable plant units..."
          />

          {/* Row 6 (full width): Departments (Select Multiple) */}
          <MultiSelect
            label="Departments (Select Multiple)"
            options={DEPARTMENT_OPTIONS}
            selected={departments}
            onChange={setDepartments}
            placeholder="Select applicable departments..."
          />

          {/* Row 6 (two columns side by side): Password * | Status */}
          <div className="row" style={{ gap: '12px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-password" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
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
                    paddingRight: '38px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--mu)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="usr-status" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Status
              </label>
              <select
                id="usr-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Buttons: Cancel | Create User */}
          <div className="r">
            <button
              type="button"
              className="bt"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bt p"
              disabled={saving}
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
   EDIT USER MODAL (SCR-059 Enterprise Administration)
---------------------------------------------------- */
function EditUserModal({ user, customRoles, onClose, onSaved }) {
  const builtinRoleIds = new Set(BUILTIN_ROLES.map((r) => r.id))
  const userDefinedCustomRoles = (customRoles || []).filter((cr) => !builtinRoleIds.has(cr.name || cr.id))

  const [username, setUsername] = useState(user.username || '')
  const [fullName, setFullName] = useState(user.full_name || user.name || '')
  const [email, setEmail] = useState(user.email || '')
  const [role, setRole] = useState(user.role || BUILTIN_ROLES[0].id)
  const [locations, setLocations] = useState(Array.isArray(user.locations) ? user.locations : [])
  const [locationOptions, setLocationOptions] = useState(DEFAULT_LOCATION_OPTIONS)
  const [units, setUnits] = useState(Array.isArray(user.units) ? user.units : [])
  const [departments, setDepartments] = useState(Array.isArray(user.departments) ? user.departments : [])
  const [phone, setPhone] = useState(user.phone || '')
  const [contractorCompany, setContractorCompany] = useState(user.contractor_company || '')
  const [status, setStatus] = useState(user.status || 'active')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .get('/api/locations')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          const names = Array.from(new Set([...res.map((l) => l.name), ...DEFAULT_LOCATION_OPTIONS]))
          setLocationOptions(names)
        }
      })
      .catch(() => {})
  }, [])

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
      const payload = {
        username: username.trim() || null,
        full_name: fullName.trim(),
        name: fullName.trim(),
        email: email.trim(),
        role,
        locations,
        units,
        departments,
        phone: phone.trim(),
        contractor_company: contractorCompany.trim(),
        status,
      }
      if (password.trim()) {
        payload.password = password.trim()
      }
      await api.put(`/api/admin/users/${user.id}`, payload)
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
        className="modal mb"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '580px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Edit User: {user.full_name || user.name}</h3>
            <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '11px' }}>ID: #{user.id} &bull; {user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--mu)', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '12px' }}>
          <ErrorNote error={err} />

          {/* Row 1: Username | Full Name * */}
          <div className="row" style={{ gap: '12px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-username" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Username
              </label>
              <input
                id="edit-usr-username"
                type="text"
                placeholder="e.g. h_richter"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-fullname" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Full Name *
              </label>
              <input
                id="edit-usr-fullname"
                type="text"
                required
                placeholder="e.g. Hans Richter"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Email Address * | Phone */}
          <div className="row" style={{ gap: '12px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-email" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Email Address *
              </label>
              <input
                id="edit-usr-email"
                type="email"
                required
                placeholder="e.g. h.richter@plant.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-phone" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Phone Number
              </label>
              <input
                id="edit-usr-phone"
                type="tel"
                placeholder="+49 170 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Role * */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="edit-usr-role" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Enterprise Role *
            </label>
            <select
              id="edit-usr-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <optgroup label="Built-in Roles">
                {BUILTIN_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              {userDefinedCustomRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {userDefinedCustomRoles.map((cr) => (
                    <option key={cr.id} value={cr.name}>
                      {cr.display_name} ({cr.name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Row 4: Location (Select Multiple) */}
          <MultiSelect
            label="Assigned Plants / Locations (Select Multiple)"
            options={locationOptions}
            selected={locations}
            onChange={setLocations}
            placeholder="Select applicable plants / locations..."
          />

          {/* Row 5: Units (Select Multiple) */}
          <MultiSelect
            label="Assigned Plant Units (Select Multiple)"
            options={UNIT_OPTIONS}
            selected={units}
            onChange={setUnits}
            placeholder="Select applicable plant units..."
          />

          {/* Row 6: Departments (Select Multiple) */}
          <MultiSelect
            label="Assigned Departments (Select Multiple)"
            options={DEPARTMENT_OPTIONS}
            selected={departments}
            onChange={setDepartments}
            placeholder="Select applicable departments..."
          />

          {/* Row 7: Contractor / Vendor Company */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="edit-usr-contractor" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Contractor / External Company (Optional)
            </label>
            <input
              id="edit-usr-contractor"
              type="text"
              placeholder="e.g. Siemens Energy Service GmbH"
              value={contractorCompany}
              onChange={(e) => setContractorCompany(e.target.value)}
            />
          </div>

          {/* Row 8: Status | Password Reset (Optional) */}
          <div className="row" style={{ gap: '12px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-status" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Account Status
              </label>
              <select
                id="edit-usr-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="edit-usr-password" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Reset Password (Optional)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="edit-usr-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  placeholder="Leave blank to keep current"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    paddingRight: '38px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--mu)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>
          </div>

          {/* Buttons: Cancel | Save Changes */}
          <div className="r" style={{ marginTop: '6px' }}>
            <button
              type="button"
              className="bt"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bt p"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
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
        className="modal mb"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>
            {isEdit ? `Edit Role: ${role?.display_name || displayName || name}` : 'Create Custom Role'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--mu)', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '12px' }}>
          <ErrorNote error={err} />

          {/* Role Name * (slug, lowercase, no spaces) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="role-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Role Name * {isEdit && role?.is_builtin && <span style={{ fontWeight: 400, color: 'var(--mu)' }}>(Built-in System Role)</span>}
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
                backgroundColor: isEdit ? 'var(--bg)' : 'var(--card)',
                cursor: isEdit ? 'not-allowed' : 'text',
              }}
            />
            <span className="muted small" style={{ fontSize: '11px', color: 'var(--mu)' }}>
              {isEdit ? 'Slug identifier cannot be changed once created.' : 'Slug identifier: lowercase, no spaces, e.g. "shift_supervisor"'}
            </span>
          </div>

          {/* Display Name * */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="role-display-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Display Name *
            </label>
            <input
              id="role-display-name"
              type="text"
              required
              placeholder="e.g. Shift Supervisor"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {name === 'admin' && (
            <div style={{ padding: '8px 12px', background: '#f0faff', border: '1px solid #b9e5ec', borderRadius: '6px', fontSize: '12px', color: '#0b5561' }}>
              ℹ️ <strong>Administrator Role:</strong> Automatically retains full enterprise wildcard access (<code>*</code>). Module privileges below are displayed for capability reference.
            </div>
          )}

          {/* Privileges Grouped Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              Privileges ({selectedPrivileges.length} selected)
            </label>

            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--bd)',
                borderRadius: '8px',
                padding: '12px 14px',
                maxHeight: '340px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {Object.entries(privilegeGroups).map(([groupTitle, privs], index) => {
                const groupSelected = privs.filter((p) => selectedPrivileges.includes(p))
                const allInGroupSelected = privs.length > 0 && groupSelected.length === privs.length

                return (
                  <div
                    key={groupTitle}
                    style={{
                      borderTop: index === 0 ? 'none' : '1px solid var(--bd)',
                      paddingTop: index === 0 ? '0' : '10px',
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
                          fontWeight: 650,
                          fontSize: '13px',
                          color: 'var(--tx)',
                          margin: 0,
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allInGroupSelected}
                          onChange={() => handleToggleGroup(privs)}
                          style={{ accentColor: 'var(--teal)', cursor: 'pointer', width: 'auto' }}
                        />
                        <span>{groupTitle}</span>
                      </label>
                      <span
                        className={groupSelected.length > 0 ? "b t" : "b"}
                        style={{
                          padding: '1px 8px',
                          fontSize: '11px',
                          borderRadius: '10px',
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
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '6px 10px',
                        paddingLeft: '22px',
                      }}
                    >
                      {privs.map((priv) => {
                        const isChecked = selectedPrivileges.includes(priv)
                        const desc = PRIVILEGE_DESCRIPTIONS[priv]
                        return (
                          <label
                            key={priv}
                            title={desc || priv}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: isChecked ? 'rgba(14, 154, 167, 0.05)' : 'transparent',
                              border: isChecked ? '1px solid rgba(14, 154, 167, 0.2)' : '1px solid transparent',
                              cursor: 'pointer',
                              margin: 0,
                              lineHeight: 1.35,
                              transition: 'all 0.15s ease',
                              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                            }}
                            onMouseEnter={(e) => {
                              if (!isChecked) e.currentTarget.style.background = 'var(--bg)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isChecked) e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePrivilege(priv)}
                              style={{
                                accentColor: 'var(--teal)',
                                cursor: 'pointer',
                                width: '14px',
                                height: '14px',
                                marginTop: '2px',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: isChecked ? 'var(--navy)' : 'var(--tx)',
                                  letterSpacing: '-0.01em',
                                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                }}
                              >
                                {priv}
                              </span>
                              {desc && (
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '11px',
                                    color: 'var(--mu)',
                                    marginTop: '2px',
                                    lineHeight: 1.3,
                                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                  }}
                                >
                                  {desc}
                                </span>
                              )}
                            </div>
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
          <div className="r">
            <button
              type="button"
              className="bt"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bt p"
              disabled={saving}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
