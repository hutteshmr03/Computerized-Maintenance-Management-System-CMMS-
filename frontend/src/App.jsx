import { useEffect, useState, useRef, useCallback } from 'react'
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
import ContractorPortal from './pages/ContractorPortal.jsx'
import Transfers from './pages/Transfers.jsx'
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import Audit from './pages/Audit.jsx'
import Scan from './pages/Scan.jsx'

const MENU = {
  dashboard: { to: '/', label: 'Home', end: true, icon: '🏠' },
  hierarchy: { to: '/hierarchy', label: 'Hierarchy (ISO 55001)', icon: '🌳' },
  assets: { to: '/assets', label: 'Assets', icon: '🛠️' },
  jobs: { to: '/jobs', label: 'Work Orders', icon: '📋' },
  kanban: { to: '/kanban', label: 'Kanban Board', icon: '🗂️' },
  gantt: { to: '/gantt', label: 'Gantt Scheduler', icon: '📅' },
  plans: { to: '/plans', label: 'PM Plans (DIN 31051)', icon: '⚡' },
  parts: { to: '/parts', label: 'Spare Parts', icon: '🔩' },
  procurement: { to: '/procurement', label: 'Procurement', icon: '📦' },
  readings: { to: '/readings', label: 'Condition Telemetry', icon: '📡' },
  contracts: { to: '/contracts', label: 'Contracts & SLAs', icon: '📜' },
  contractor_portal: { to: '/contractor-portal', label: 'My Jobs', icon: '🛠️' },
  transfers: { to: '/transfers', label: 'Transfers', icon: '🚚' },
  reports: { to: '/reports', label: 'Reports & KPIs', icon: '📊' },
  users: { to: '/users', label: 'Users & GDPR', icon: '👥' },
  audit: { to: '/audit', label: 'Audit Log', icon: '🔍' },
  scan: { to: '/scan', label: 'Scan Asset', icon: '📷' },
}

function Bell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ unread: 0, items: [] })
  const navigate = useNavigate()
  const load = () => api.get('/api/notifications').then(setData).catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
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
    <div className="bell" style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open}>
        Alerts
        {data.unread > 0 && <span className="count">{data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ minWidth: '280px', zIndex: 100 }}>
          {data.items.length === 0 && <div className="item muted">No alerts yet.</div>}
          {data.items.map((n) => (
            <a
              key={n.id}
              href={n.link || '#'}
              className={n.read ? '' : 'unread'}
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                load()
                if (n.link) navigate(n.link)
              }}
            >
              {n.message}
              <div className="small muted">{fmtDateTime(n.at)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Shell() {
  const { user, ready, logout } = useAuth()
  const loc = useLocation()
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('cmms_theme') === 'dark' } catch { return false }
  })
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false)
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('cmms_sidebar_width')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 180 && parsed <= 600) return parsed
      }
    } catch { /* ignore */ }
    return 250
  })
  const [isResizing, setIsResizing] = useState(false)
  const isResizingRef = useRef(false)
  const latestWidthRef = useRef(sidebarWidth)

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
  }, [sidebarWidth])

  const startResizing = useCallback((e) => {
    e.preventDefault()
    isResizingRef.current = true
    setIsResizing(true)
    document.body.classList.add('is-resizing')
  }, [])

  const resetSidebarWidth = useCallback(() => {
    const defaultWidth = 250
    setSidebarWidth(defaultWidth)
    latestWidthRef.current = defaultWidth
    document.documentElement.style.setProperty('--sidebar-width', `${defaultWidth}px`)
    try {
      localStorage.setItem('cmms_sidebar_width', String(defaultWidth))
    } catch { /* ignore */ }
  }, [])

  const handleResizerKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setSidebarWidth((prev) => {
        const next = Math.max(180, prev - 10)
        latestWidthRef.current = next
        try { localStorage.setItem('cmms_sidebar_width', String(next)) } catch { /* ignore */ }
        return next
      })
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setSidebarWidth((prev) => {
        const maxWidth = Math.min(520, Math.floor(window.innerWidth * 0.45))
        const next = Math.min(maxWidth, prev + 10)
        latestWidthRef.current = next
        try { localStorage.setItem('cmms_sidebar_width', String(next)) } catch { /* ignore */ }
        return next
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      resetSidebarWidth()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setSidebarWidth(180)
      latestWidthRef.current = 180
      try { localStorage.setItem('cmms_sidebar_width', '180') } catch { /* ignore */ }
    } else if (e.key === 'End') {
      e.preventDefault()
      const maxWidth = Math.min(520, Math.floor(window.innerWidth * 0.45))
      setSidebarWidth(maxWidth)
      latestWidthRef.current = maxWidth
      try { localStorage.setItem('cmms_sidebar_width', String(maxWidth)) } catch { /* ignore */ }
    }
  }, [resetSidebarWidth])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const maxWidth = Math.min(520, Math.floor(window.innerWidth * 0.45))
      const newWidth = Math.max(180, Math.min(maxWidth, clientX))
      latestWidthRef.current = newWidth
      setSidebarWidth(newWidth)
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        setIsResizing(false)
        document.body.classList.remove('is-resizing')
        try {
          localStorage.setItem('cmms_sidebar_width', String(latestWidthRef.current))
        } catch { /* ignore */ }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove, { passive: false })
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
      document.body.classList.remove('is-resizing')
    }
  }, [])

  useEffect(() => {
    delete document.documentElement.dataset.contrast
    try { localStorage.removeItem('cmms_contrast') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try { localStorage.setItem('cmms_theme', darkMode ? 'dark' : 'light') } catch { /* ignore */ }
  }, [darkMode])

  // Close menus on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false)
    setMobileOverflowOpen(false)
  }, [loc.pathname])

  if (!ready) return <div className="page"><Loading /></div>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />

  const userMenuItems = (user.menu || [])
    .map((k) => MENU[k])
    .filter(Boolean)

  // Mobile bottom navigation bar items (top 5 role-relevant shortcuts)
  let mobileItems = userMenuItems.slice(0, 5)
  if (user.role === 'technician') {
    mobileItems = [MENU.dashboard, MENU.scan, MENU.jobs, MENU.kanban, MENU.readings].filter(Boolean)
  } else if (user.role === 'contractor') {
    mobileItems = [MENU.dashboard, MENU.contractor_portal].filter(Boolean)
  } else if (user.role === 'planner') {
    mobileItems = [MENU.dashboard, MENU.plans, MENU.kanban, MENU.gantt, MENU.jobs].filter(Boolean)
  } else if (user.role === 'manager') {
    mobileItems = [MENU.dashboard, MENU.jobs, MENU.kanban, MENU.transfers, MENU.reports].filter(Boolean)
  } else if (user.role === 'super_admin') {
    mobileItems = [MENU.dashboard, MENU.hierarchy, MENU.jobs, MENU.kanban, MENU.users].filter(Boolean)
  } else if (user.role === 'admin') {
    mobileItems = [MENU.dashboard, MENU.hierarchy, MENU.jobs, MENU.parts, MENU.plans].filter(Boolean)
  } else if (user.role === 'executive') {
    mobileItems = [MENU.dashboard, MENU.reports].filter(Boolean)
  }

  const roleName = user.role === 'executive' ? 'Executive' : user.role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div
      className={`shell ${tabletSidebarOpen ? 'tablet-open' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
    >
      {/* Desktop & Tablet Sidebar */}
      <aside className={`side ${tabletSidebarOpen ? 'tablet-expanded' : ''}`}>
        <Link to="/" className="brand" title="Computerized Maintenance Management System (CMMS)">
          <span className="mark">CM</span> <span className="brand-text">CMMS</span>
        </Link>
        <nav className="nav" aria-label="Main Navigation">
          {userMenuItems.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              title={i.label}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="nav-icon" aria-hidden="true">{i.icon}</span>
              <span className="nav-label">{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-name-text" style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="user-role-text small muted">
            {roleName} {user.contractor_company ? `(${user.contractor_company})` : ''}
          </div>
          <button className="dark" onClick={logout} style={{ marginTop: '8px' }}>
            Log out
          </button>
        </div>
      </aside>

      {/* Horizontally Draggable Sidebar Resizer Handle */}
      <div
        className={`sidebar-resizer ${isResizing ? 'is-resizing' : ''}`}
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        onDoubleClick={resetSidebarWidth}
        onKeyDown={handleResizerKeyDown}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuenow={sidebarWidth}
        aria-valuemin={180}
        aria-valuemax={500}
        aria-label="Sidebar width resize handle"
        title="Drag to resize sidebar width (Double-click to reset to 250px)"
      />

      {/* Main View Area */}
      <div className="main">
        {/* Offline sync persistent banner */}
        <OfflineBanner />

        <header className="topbar">
          {/* Topbar Left Controls */}
          <div className="topbar-left">
            {/* Tablet hamburger toggle button */}
            <button
              type="button"
              className="tablet-sidebar-toggle"
              onClick={() => setTabletSidebarOpen(!tabletSidebarOpen)}
              aria-label="Toggle navigation sidebar"
              title="Toggle sidebar"
            >
              ☰
            </button>

            {/* Mobile hamburger button */}
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open full menu"
            >
              ☰
            </button>

            {/* Mobile topbar brand logo */}
            <Link to="/" className="mobile-topbar-brand">
              <span className="mark">CM</span> <strong>CMMS</strong>
            </Link>

            {/* Desktop / Tablet: Find / Scan Asset */}
            <Link to="/scan" className="btn desktop-only-btn" style={{ fontWeight: 600 }}>
              🔍 Find / Scan Asset
            </Link>
            {user.role === 'planner' && (
              <Link to="/gantt" className="btn small desktop-only-btn">
                📅 Gantt View
              </Link>
            )}
          </div>

          {/* Desktop & Tablet Topbar Right Controls: single row, no wrapping */}
          <div className="topbar-right desktop-topbar-controls">
            <button
              type="button"
              className="small"
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Dark / Light Theme"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>

            <span className="who" style={{ fontWeight: 500 }} title={user.name}>
              {user.name}
            </span>

            <Bell />

            <button className="dark" onClick={logout}>
              Log out
            </button>
          </div>

          {/* Mobile Topbar Right Controls: Alerts + Overflow Menu (⋮) */}
          <div className="topbar-right mobile-topbar-controls">
            <Bell />

            <div className="mobile-overflow-container" style={{ position: 'relative' }}>
              <button
                type="button"
                className="mobile-overflow-btn"
                onClick={() => setMobileOverflowOpen(!mobileOverflowOpen)}
                aria-label="More options"
                aria-expanded={mobileOverflowOpen}
              >
                ⋮
              </button>

              {mobileOverflowOpen && (
                <div className="dropdown mobile-overflow-dropdown">
                  <div className="item muted" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{user.name}</div>
                    <div className="small">{roleName}</div>
                  </div>
                  <Link
                    to="/scan"
                    className="item"
                    onClick={() => setMobileOverflowOpen(false)}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: '8px 12px' }}
                  >
                    🔍 Find / Scan Asset
                  </Link>
                  <button
                    type="button"
                    className="item"
                    onClick={() => {
                      setDarkMode(!darkMode)
                      setMobileOverflowOpen(false)
                    }}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '8px 12px' }}
                  >
                    {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                  <button
                    type="button"
                    className="item text-bad"
                    onClick={() => {
                      setMobileOverflowOpen(false)
                      logout()
                    }}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '8px 12px', borderTop: '1px solid var(--line)' }}
                  >
                    🚪 Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Full-Screen Navigation Drawer */}
        {mobileDrawerOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
            <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-drawer-header">
                <div className="brand">
                  <span className="mark">CM</span> <strong style={{ color: '#fff' }}>CMMS Menu</strong>
                </div>
                <button
                  type="button"
                  className="mobile-drawer-close-btn"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>

              <nav className="nav mobile-drawer-nav" aria-label="Mobile Drawer Navigation">
                {userMenuItems.map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.end}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{i.icon}</span>
                    <span>{i.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="mobile-drawer-footer">
                <div style={{ fontWeight: 600, color: '#fff' }}>{user.name}</div>
                <div className="small muted">{roleName}</div>
                <button
                  className="dark"
                  onClick={() => {
                    setMobileDrawerOpen(false)
                    logout()
                  }}
                  style={{ marginTop: '10px', width: '100%', minHeight: '48px' }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="page">
          <Outlet />
        </main>
      </div>

      {/* Mobile Glove-Friendly Bottom Navigation Bar */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {mobileItems.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
          >
            <span style={{ fontSize: '1.2rem' }}>{i.icon}</span>
            <span style={{ fontSize: '0.72rem', marginTop: '2px' }}>{i.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
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
        <Route path="contractor-portal" element={<ContractorPortal />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<Audit />} />
        <Route path="scan" element={<Scan />} />
        <Route path="scan/:code" element={<Scan />} />
        <Route
          path="*"
          element={
            <div>
              <h1>Page not found</h1>
              <Link to="/">Go to home</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
