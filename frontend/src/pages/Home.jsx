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

  const modules = menu
    .filter((k) => MODULE_CONFIG[k])
    .map((k) => ({ key: k, ...MODULE_CONFIG[k] }))

  const firstName = (user?.full_name || user?.name || 'User').split(' ')[0]
  const count = modules.length

  // Decide columns: ≤4 mods → 2 cols, 5–6 → 3, 7–9 → 3, 10+ → 4
  const cols = count <= 4 ? 2 : count <= 6 ? 3 : count <= 9 ? 3 : 4

  return (
    <div
      style={{
        padding: '20px 24px 32px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Welcome header — compact */}
      <div style={{ marginBottom: '18px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--tx)',
            letterSpacing: '-0.02em',
          }}
        >
          Welcome back, {firstName} 👋
        </h1>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/requests?action=new"
            className="bt p"
            style={{ textDecoration: 'none', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px' }}
          >
            ⚡ Report Breakdown
          </Link>
          <Link
            to="/requests"
            className="bt"
            style={{ textDecoration: 'none', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px' }}
          >
            📋 Operator Requests
          </Link>
          <Link
            to="/breakdowns"
            className="bt"
            style={{ textDecoration: 'none', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px' }}
          >
            📉 Breakdown &amp; RCA
          </Link>
          <Link
            to="/scan"
            className="bt"
            style={{ textDecoration: 'none', fontWeight: 600, fontSize: '12.5px', padding: '7px 14px' }}
          >
            📷 Scan QR
          </Link>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '14px',
        }}
      >
        {modules.map((mod) => (
          <Link
            key={mod.key}
            to={mod.to}
            style={{ textDecoration: 'none', display: 'flex' }}
          >
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--bd)',
                borderRadius: '12px',
                padding: '16px 18px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.18s ease',
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = mod.border
                e.currentTarget.style.boxShadow = `0 4px 16px 0 rgba(0,0,0,0.07), 0 0 0 2px ${mod.border}`
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
                  width: '38px',
                  height: '38px',
                  borderRadius: '9px',
                  background: mod.bg,
                  border: `1px solid ${mod.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '19px',
                  flexShrink: 0,
                }}
              >
                {mod.icon}
              </div>

              {/* Label + description */}
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--tx)',
                    letterSpacing: '-0.01em',
                    marginBottom: '4px',
                  }}
                >
                  {mod.label}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--mu)',
                    lineHeight: 1.4,
                  }}
                >
                  {mod.description}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  right: '14px',
                  fontSize: '13px',
                  color: mod.color,
                  opacity: 0.55,
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
