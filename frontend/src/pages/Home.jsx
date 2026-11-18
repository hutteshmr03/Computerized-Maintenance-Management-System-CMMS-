import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const MODULE_CONFIG = {
  dashboard: {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '📊',
    color: '#0b2447',
    bg: '#e8f0fb',
    border: '#c7d9f7',
    description: 'KPIs, OEE score, MTBF, downtime & recent work orders',
  },
  assets: {
    to: '/assets',
    label: 'Assets',
    icon: '🏭',
    color: '#065f46',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    description: 'Equipment registry, hierarchy, BOM & asset lifecycle',
  },
  transfers: {
    to: '/transfers',
    label: 'Transfers',
    icon: '🔄',
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#bfdbfe',
    description: 'Request & approve equipment relocation between plants',
  },
  jobs: {
    to: '/jobs',
    label: 'Work Orders',
    icon: '🔧',
    color: '#92400e',
    bg: '#fffbeb',
    border: '#fde68a',
    description: 'Maintenance jobs, repairs, checklists & technician assignments',
  },
  parts: {
    to: '/parts',
    label: 'Spare Parts',
    icon: '📦',
    color: '#5b21b6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    description: 'Inventory stock, bin locations & replenishment',
  },
  procurement: {
    to: '/procurement',
    label: 'Procurement',
    icon: '🛒',
    color: '#be185d',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    description: 'Purchase requests, approvals & vendor orders',
  },
  reports: {
    to: '/reports',
    label: 'Reports & KPIs',
    icon: '📈',
    color: '#0e7490',
    bg: '#ecfeff',
    border: '#a5f3fc',
    description: 'EN 13306 maintenance analytics, OEE & performance reports',
  },
  audit: {
    to: '/audit',
    label: 'Audit Log',
    icon: '📋',
    color: '#374151',
    bg: '#f9fafb',
    border: '#d1d5db',
    description: 'Immutable compliance & activity trail for all system events',
  },
  calibration: {
    to: '/calibration',
    label: 'Calibration',
    icon: '🔬',
    color: '#065f46',
    bg: '#f0fdf4',
    border: '#86efac',
    description: 'ISO 9001 calibration certificates, standards & due dates',
  },
  users: {
    to: '/users',
    label: 'Users & Roles',
    icon: '👥',
    color: '#1e3a5f',
    bg: '#f0f7ff',
    border: '#bfdbfe',
    description: 'User accounts, role assignments & privilege management',
  },
  security: {
    to: '/security',
    label: 'Security',
    icon: '🔒',
    color: '#7f1d1d',
    bg: '#fff5f5',
    border: '#fecaca',
    description: 'Password policy, session timeout & account lockout settings',
  },
}

export default function Home() {
  const { user } = useAuth()
  const menu = user?.menu || []

  // Filter to modules the user has access to, skip 'dashboard' — it appears as the first special card
  const modules = menu
    .filter((k) => MODULE_CONFIG[k])
    .map((k) => ({ key: k, ...MODULE_CONFIG[k] }))

  const firstName = (user?.full_name || user?.name || 'User').split(' ')[0]
  const roleLabel = user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 100px)',
        padding: '32px 24px 48px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Welcome header */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--tx)',
            letterSpacing: '-0.02em',
          }}
        >
          Welcome back, {firstName} 👋
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--mu)' }}>
          {roleLabel} &middot; Select a module below to get started
        </p>
      </div>

      {/* Module Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '18px',
        }}
      >
        {modules.map((mod) => (
          <Link
            key={mod.key}
            to={mod.to}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--bd)',
                borderRadius: '14px',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.18s ease',
                cursor: 'pointer',
                height: '100%',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = mod.border
                e.currentTarget.style.boxShadow = `0 4px 20px 0 rgba(0,0,0,0.08), 0 0 0 2px ${mod.border}`
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--bd)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: mod.bg,
                  border: `1px solid ${mod.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}
              >
                {mod.icon}
              </div>

              {/* Label + description */}
              <div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--tx)',
                    letterSpacing: '-0.01em',
                    marginBottom: '5px',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {mod.label}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--mu)',
                    lineHeight: 1.45,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {mod.description}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  right: '18px',
                  fontSize: '14px',
                  color: mod.color,
                  opacity: 0.6,
                  fontWeight: 700,
                }}
              >
                →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
