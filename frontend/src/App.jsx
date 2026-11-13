import { useEffect, useState, useRef } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth.jsx'
import { Loading, OfflineBanner, fmtDateTime } from './ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Hierarchy from './pages/Hierarchy.jsx'
import Assets from './pages/Assets.jsx'
import AssetDetail from './pages/AssetDetail.jsx'
import Kanban from './pages/Kanban.jsx'
import Gantt from './pages/Gantt.jsx'
import Plans from './pages/Plans.jsx'
import Jobs from './pages/Jobs.jsx'
import JobNew from './pages/JobNew.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Parts from './pages/Parts.jsx'
import Procurement from './pages/Procurement.jsx'
import Readings from './pages/Readings.jsx'
import Contracts from './pages/Contracts.jsx'
import Transfers from './pages/Transfers.jsx'
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import Audit from './pages/Audit.jsx'
import Scan from './pages/Scan.jsx'
import Calibration from './pages/Calibration.jsx'
import Security from './pages/Security.jsx'

const TAB_MAP = {
  dashboard: { to: '/', label: 'Dashboard', end: true },
  assets: { to: '/assets', label: 'Assets' },
  transfers: { to: '/transfers', label: 'Transfers' },
  jobs: { to: '/jobs', label: 'Work Orders' },
  parts: { to: '/parts', label: 'Spare Parts' },
  procurement: { to: '/procurement', label: 'Procurement' },
  reports: { to: '/reports', label: 'Reports & KPIs' },
  audit: { to: '/audit', label: 'Audit Log' },
  calibration: { to: '/calibration', label: 'Calibration' },
  users: { to: '/users', label: 'Users & GDPR' },
  security: { to: '/security', label: 'Security' },
}

const ROLE_LABELS = {
  admin: 'Admin',
  super_admin: 'Admin',
  plant_head: 'Plant Head',
  maintenance_manager: 'Maintenance Manager',
  maintenance_engineer: 'Maintenance Engineer',
  technician: 'Technician',
  store_manager: 'Store Manager',
  production_manager: 'Production Manager',
  purchase_manager: 'Purchase Manager',
  auditor: 'Auditor',
}

function Bell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ unread: 0, items: [] })
  const navigate = useNavigate()
  const bellRef = useRef(null)

  const load = () => api.get('/api/notifications').then(setData).catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && data.unread) {
      await api.post('/api/notifications/read-all').catch(() => {})
      setData((d) => ({ ...d, unread: 0 }))
    }
  }

  return (
    <div className="bell-container" ref={bellRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="bell-icon-btn"
        onClick={toggle}
        aria-label={`Notifications, ${data.unread} unread`}
        aria-expanded={open}
        title="Notifications"
      >
        <span style={{ fontSize: '15px', color: '#9fb3d1', lineHeight: 1 }}>🔔</span>
        {data.unread > 0 && <span className="bell-badge-count">{data.unread}</span>}
      </button>

      {open && (
        <div className="bell-popover">
          <div className="bell-popover-head">
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--tx)' }}>Notifications</span>
            {data.unread > 0 && <span className="small muted">{data.unread} unread</span>}
          </div>
          <div className="bell-popover-list">
            {data.items.length === 0 && <div className="bell-popover-item muted">No alerts yet.</div>}
            {data.items.map((n) => (
              <a
                key={n.id}
                href={n.link || '#'}
                className={`bell-popover-item ${n.read ? '' : 'unread'}`}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  load()
                  if (n.link) navigate(n.link)
                }}
              >
                <div style={{ color: 'var(--tx)', fontSize: '12px' }}>{n.message}</div>
                <div className="small muted" style={{ marginTop: '2px', fontSize: '11px' }}>{fmtDateTime(n.at)}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Shell() {
  const { user, ready, logout } = useAuth()
  const loc = useLocation()

  // Keep-alive heartbeat: pings backend /api/health every 3 minutes to prevent Render free instance sleep
  useEffect(() => {
    const pingBackend = () => {
      if (navigator.onLine) {
        api.get('/api/health').catch(() => {})
      }
    }
    const initialTimer = setTimeout(pingBackend, 15000)
    const interval = setInterval(pingBackend, 180000) // 3 minutes
    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [])

  if (!ready) return <div className="page"><Loading /></div>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />

  const allowedTabs = (user.menu || [])
    .map((k) => TAB_MAP[k])
    .filter(Boolean)

  const roleDisplay = ROLE_LABELS[user.role] || user.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="cmms-layout">
      {/* TOP HEADER (fixed, full width) */}
      <header className="top-header">
        <Link to="/" className="top-header-left" title="Sumant Cloud CMMS">
          <div className="brand-text-wrap">
            <span className="brand-title">Sumant Cloud CMMS</span>
            <span className="brand-subtitle">Equipment Maintenance Management for Manufacturing</span>
          </div>
        </Link>

        <div className="top-header-right">
          <div className="role-badge">
            <span className="role-label">Role: </span>
            <span className="role-name">{roleDisplay}</span>
          </div>

          <Bell />

          <button type="button" className="header-logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {/* SUB-NAV (below header, full width, sticky) */}
      <nav className="sub-nav" aria-label="Main navigation">
        {allowedTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `nav-tab ${isActive ? 'on active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        <OfflineBanner />
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="hierarchy" element={<Hierarchy />} />
        <Route path="assets" element={<Assets />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="kanban" element={<Kanban />} />
        <Route path="gantt" element={<Gantt />} />
        <Route path="plans" element={<Plans />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/new" element={<JobNew />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="parts" element={<Parts />} />
        <Route path="procurement" element={<Procurement />} />
        <Route path="readings" element={<Readings />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<Audit />} />
        <Route path="scan" element={<Scan />} />
        <Route path="calibration" element={<Calibration />} />
        <Route path="security" element={<Security />} />
        <Route path="scan/:code" element={<Scan />} />
        <Route
          path="*"
          element={
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 8px 0' }}>Page not found</h2>
              <p className="muted" style={{ margin: '0 0 16px 0' }}>The requested page could not be located.</p>
              <Link to="/" className="btn primary">Return to Dashboard</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
