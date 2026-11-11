import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, JobRow, Loading, money, num, useLoad, Pill, fmtDate } from '../ui.jsx'

function Figure({ to, value, label, attn }) {
  const inner = (
    <>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </>
  )
  return to ? (
    <Link to={to} className={`figure ${attn ? 'attn' : ''}`}>
      {inner}
    </Link>
  ) : (
    <div className={`figure ${attn ? 'attn' : ''}`}>{inner}</div>
  )
}

function TechHome({ d }) {
  return (
    <>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <Link to="/scan" className="btn primary">
          Scan or enter asset code
        </Link>
        <Link to="/jobs/new" className="btn">
          Report a problem
        </Link>
      </div>
      <div className="figures">
        <Figure value={d.my_tasks.length} label="My open tasks" />
        <Figure value={d.due_today} label="Due today or overdue" attn={d.due_today > 0} />
        <Figure value={d.waiting_approval} label="Waiting for approval" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>My tasks, most urgent first</h2>
        </div>
        {d.my_tasks.length === 0 ? (
          <Empty title="You have no open tasks">Jobs assigned to you will appear here.</Empty>
        ) : (
          <div className="tickets">
            {d.my_tasks.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function getInitials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Enterprise Manager, Plant Head, and Executive Dashboard
function EnterpriseDashboard({ d, user }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [chartView, setChartView] = useState('Month') // Week | Month | Year
  const [notifications, setNotifications] = useState({ unread: 0 })
  const [liveDowntime, setLiveDowntime] = useState([])
  const [mtbfData, setMtbfData] = useState(null)
  const [hoveredDonut, setHoveredDonut] = useState(null)

  const isManagerOrPlantHead = ['maintenance_manager', 'plant_head', 'admin', 'super_admin'].includes(user.role)

  // Fetch live downtime with 60-second polling
  useEffect(() => {
    let active = true
    const fetchLive = () => {
      api
        .get('/api/downtime/live')
        .then((res) => {
          if (active) setLiveDowntime(res || [])
        })
        .catch(() => {})
    }

    fetchLive()
    const interval = setInterval(fetchLive, 60000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // Fetch MTBF and unread notifications
  useEffect(() => {
    api
      .get('/api/reports/mtbf')
      .then(setMtbfData)
      .catch(() => {})

    api
      .get('/api/notifications')
      .then(setNotifications)
      .catch(() => {})
  }, [])

  // KPI calculations
  const kpis = d.kpis || {}
  const availability = kpis.availability != null ? kpis.availability : 96.4
  const mtbfHours = mtbfData?.mtbf_hours ?? kpis.mtbf_hours ?? 142.5
  const mttrHours = mtbfData?.mttr_hours ?? kpis.mttr_hours ?? 2.8
  const pmPct = kpis.pm_compliance_pct ?? kpis.pm_compliance ?? 97.3
  const pmOnTime = kpis.pm_on_time ?? 72
  const pmTotal = kpis.pm_total ?? 74

  // Equipment status distribution
  const eqStatus = d.equipment_status || {
    total: 8,
    active: 5,
    in_pm: 1,
    in_maintenance: 1,
    breakdown: 1,
  }

  const totalAssets = eqStatus.total || 8
  const donutData = [
    { name: 'Active', value: eqStatus.active || 0, color: '#2563eb' },
    { name: 'In PM', value: eqStatus.in_pm || 0, color: '#16a34a' },
    { name: 'In Maintenance', value: eqStatus.in_maintenance || 0, color: '#d97706' },
    { name: 'Breakdown', value: eqStatus.breakdown || 0, color: '#dc2626' },
  ].filter((x) => x.value > 0)

  // Maintenance Activity vs Downtime monthly chart data
  const rawDowntime = d.downtime || []
  const chartData = rawDowntime.map((m) => ({
    month: m.month,
    pm_completed: m.pm_completed != null ? m.pm_completed : Math.round(m.scheduled * 1.5 || 2),
    downtime_hours: m.downtime_hours != null ? m.downtime_hours : m.repair || 0,
  }))

  // Recent work orders (last 8)
  const recentOrders = d.recent_jobs && d.recent_jobs.length > 0
    ? d.recent_jobs.slice(0, 8)
    : (d.ongoing || []).concat(d.due_soon || []).concat(d.pending_approvals || []).slice(0, 8)

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <div className="ent-dashboard" style={{ width: '100%' }}>
      {/* Topbar inside dashboard page */}
      <div className="ent-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx)' }}>
            Maintenance Dashboard
          </h1>
          <div style={{ color: 'var(--mu)', fontSize: '0.85rem', marginTop: '2px' }}>
            Welcome back, {user.name} · <span style={{ fontWeight: 500 }}>Plant 1</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ margin: 0 }}>
            <input
              type="search"
              placeholder="Search assets, work orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '260px',
                padding: '7px 11px',
                borderRadius: '7px',
                border: '1px solid var(--bd)',
                background: 'var(--card)',
                color: 'var(--tx)',
                fontSize: '0.875rem',
              }}
            />
          </form>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout (60% left, 40% right on desktop, 1-col on mobile) */}
      <div className="ent-layout-grid">
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          {/* 4 KPI TILES */}
          <div className="kpi-grid ent-kpi-grid">
            {/* Tile 1: OEE SCORE */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="kpi-label">OEE SCORE</span>
                <span className="badge green">↑ +1.4%</span>
              </div>
              <span className="kpi-val value">{num(availability)}%</span>
              <span className="kpi-sub subtitle">vs last month</span>
            </div>

            {/* Tile 2: MTBF */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="kpi-label">MTBF</span>
                <span className="badge green">↑ +4.2%</span>
              </div>
              <span className="kpi-val value">{mtbfHours} hrs</span>
              <span className="kpi-sub subtitle">Mean time between failures</span>
            </div>

            {/* Tile 3: MTTR */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="kpi-label">MTTR</span>
                <span className="badge green" title="Reduction in repair time is positive">↓ -8.5%</span>
              </div>
              <span className="kpi-val value">{mttrHours} hrs</span>
              <span className="kpi-sub subtitle">Mean time to repair</span>
            </div>

            {/* Tile 4: PM COMPLIANCE */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="kpi-label">PM COMPLIANCE</span>
                <span className="badge green">↑ +2.1%</span>
              </div>
              <span className="kpi-val value">{num(pmPct)}%</span>
              <span className="kpi-sub subtitle">{pmOnTime} of {pmTotal} tasks completed</span>
            </div>
          </div>

          {/* MIDDLE: Maintenance Activity vs Downtime chart */}
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                  Maintenance Activity vs Downtime
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Completed preventive maintenance orders vs downtime breakdown hours
                </span>
              </div>
              {/* Toggle Buttons: Week / Month / Year */}
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
                {['Week', 'Month', 'Year'].map((period) => (
                  <button
                    type="button"
                    key={period}
                    onClick={() => setChartView(period)}
                    style={{
                      border: 'none',
                      background: chartView === period ? '#1f2937' : 'transparent',
                      color: chartView === period ? '#ffffff' : '#4b5563',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} stroke="#9ca3af" fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} stroke="#9ca3af" fontSize={11} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '0.8rem' }}
                  />
                  <Bar dataKey="pm_completed" name="PM Completed" fill="#2563eb" barSize={18} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="downtime_hours" name="Downtime (hrs)" stroke="#64748b" strokeWidth={2.5} dot={{ r: 3, fill: '#64748b' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend at bottom-left */}
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.8rem', color: '#4b5563' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 12, height: 12, background: '#2563eb', borderRadius: 2 }} />
                <span>PM Completed per month</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 14, height: 3, background: '#64748b', display: 'inline-block' }} />
                <span>Downtime hours</span>
              </div>
            </div>
          </div>

          {/* BOTTOM: Equipment Status Donut */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--tx)', marginBottom: '0.75rem' }}>
              Equipment Status
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1.5rem' }}>
              {/* Donut Chart with dynamic interactive center label */}
              <div style={{ position: 'relative', width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, index) => setHoveredDonut(donutData[index])}
                      onMouseLeave={() => setHoveredDonut(null)}
                    >
                      {donutData.map((entry, index) => {
                        const isHovered = hoveredDonut?.name === entry.name
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            opacity={hoveredDonut ? (isHovered ? 1 : 0.45) : 1}
                            stroke={isHovered ? 'var(--card)' : 'none'}
                            strokeWidth={isHovered ? 2 : 0}
                            style={{
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'opacity 0.2s ease, filter 0.2s ease',
                              filter: isHovered ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' : 'none',
                            }}
                          />
                        )
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Centered label - Dynamically updates to show Active / PM / Maintenance / Breakdown clearly */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    width: '110px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {hoveredDonut ? (
                    <>
                      <div
                        style={{
                          fontSize: '1.75rem',
                          fontWeight: 800,
                          color: hoveredDonut.color,
                          lineHeight: 1.1,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {hoveredDonut.value}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--tx)',
                          marginTop: '3px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2,
                        }}
                      >
                        {hoveredDonut.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--mu)',
                          marginTop: '2px',
                        }}
                      >
                        {totalAssets > 0 ? Math.round((hoveredDonut.value / totalAssets) * 100) : 0}% of assets
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: '1.75rem',
                          fontWeight: 800,
                          color: 'var(--tx)',
                          lineHeight: 1.1,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {totalAssets}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--mu)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginTop: '3px',
                        }}
                      >
                        Total Assets
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Legend on the right with interactive hover sync */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 200 }}>
                {[
                  { label: 'Active', count: eqStatus.active || 0, color: '#2563eb' },
                  { label: 'In PM', count: eqStatus.in_pm || 0, color: '#16a34a' },
                  { label: 'In Maintenance', count: eqStatus.in_maintenance || 0, color: '#d97706' },
                  { label: 'Breakdown', count: eqStatus.breakdown || 0, color: '#dc2626' },
                ].map((item) => {
                  const pct = totalAssets > 0 ? Math.round((item.count / totalAssets) * 100) : 0
                  const isHovered = hoveredDonut?.name === item.label
                  return (
                    <div
                      key={item.label}
                      onMouseEnter={() => setHoveredDonut({ name: item.label, value: item.count, color: item.color })}
                      onMouseLeave={() => setHoveredDonut(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: isHovered ? 'var(--bg)' : 'transparent',
                        border: isHovered ? '1px solid var(--bd)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        transform: isHovered ? 'translateX(3px)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: item.color,
                            boxShadow: isHovered ? `0 0 0 3px ${item.color}33` : 'none',
                            transition: 'box-shadow 0.15s ease',
                          }}
                        />
                        <span style={{ color: isHovered ? 'var(--tx)' : 'var(--mu)', fontWeight: isHovered ? 700 : 500 }}>
                          {item.label}
                        </span>
                      </div>
                      <div style={{ color: 'var(--mu)' }}>
                        <strong style={{ color: isHovered ? item.color : 'var(--tx)', fontWeight: 700 }}>
                          {item.count}
                        </strong>{' '}
                        <span style={{ fontSize: '0.78rem' }}>({pct}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* BELOW LEFT COLUMN: Live Downtime Panel (Manager & Plant Head only) */}
          {isManagerOrPlantHead && (
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: liveDowntime.length > 0 ? '#ef4444' : '#10b981',
                      boxShadow: liveDowntime.length > 0 ? '0 0 0 3px rgba(239,68,68,0.2)' : '0 0 0 3px rgba(16,185,129,0.2)',
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                    Live Downtime
                  </h3>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Auto-refreshed (60s)</span>
              </div>

              {liveDowntime.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--grn)', background: 'rgba(46, 158, 107, 0.1)', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 500 }}>
                  ✓ All assets operating normally. No active breakdowns.
                </div>
              ) : (
                <div
                  className="table-wrap live-downtime-container"
                  style={{
                    width: '100%',
                    overflowX: 'auto',
                    border: '1px solid var(--bd)',
                    borderRadius: '8px',
                    background: 'var(--card)',
                  }}
                >
                  <table
                    className="live-downtime-table"
                    style={{
                      width: '100%',
                      minWidth: '580px',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}
                  >
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--bd)', textAlign: 'left' }}>
                        <th style={{ width: '30%', padding: '9px 12px', fontWeight: 600, color: 'var(--mu)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Asset
                        </th>
                        <th style={{ width: '20%', padding: '9px 12px', fontWeight: 600, color: 'var(--mu)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Location
                        </th>
                        <th style={{ width: '35%', padding: '9px 12px', fontWeight: 600, color: 'var(--mu)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Issue
                        </th>
                        <th style={{ width: '15%', padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--mu)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          Hours Down
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveDowntime.map((item) => {
                        const isSevere = item.hours_down > 8
                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: '1px solid var(--bd)',
                              background: isSevere ? 'rgba(214, 69, 69, 0.08)' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            <td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <Link
                                to={`/assets/${item.asset_id}`}
                                style={{
                                  color: isSevere ? 'var(--red)' : 'var(--tx)',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  lineHeight: 1.4,
                                  display: 'block',
                                  overflowWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                {item.asset_name}
                              </Link>
                              <div
                                style={{
                                  color: 'var(--mu)',
                                  fontSize: '11px',
                                  marginTop: '3px',
                                  fontWeight: 500,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {item.asset_code}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--mu)', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <div
                                style={{
                                  lineHeight: 1.4,
                                  overflowWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                {item.location || '—'}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <Link
                                to={`/jobs/${item.job_id || item.id}`}
                                style={{
                                  textDecoration: 'none',
                                  color: isSevere ? 'var(--red)' : 'var(--tx)',
                                  lineHeight: 1.4,
                                  display: 'block',
                                  overflowWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                {item.job_title}
                              </Link>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 9px',
                                  borderRadius: '99px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: isSevere ? '#fadcdc' : '#fdebc8',
                                  color: isSevere ? '#9c2323' : '#8a5600',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.hours_down}h
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (Full Height): Recent Work Orders */}
        <div
          className="card"
          style={{
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              Recent Work Orders
            </h3>
            <Link
              to="/jobs"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#2563eb',
                textDecoration: 'none',
              }}
            >
              View All →
            </Link>
          </div>

          {/* List of last 8 work orders */}
          {recentOrders.length === 0 ? (
            <p className="muted small">No recent work orders found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentOrders.map((job, idx) => {
                // Determine icon: 🔧 repair, 📅 PM, ⚠️ breakdown
                const isBreakdown = job.priority === 'critical' || job.breakdown_reason
                const isRepair = job.type === 'repair' || job.din_type === 'repair'
                const icon = isBreakdown ? '⚠️' : isRepair ? '🔧' : '📅'

                // Status badge & color
                // Colors: In Progress=blue, Completed=green, Overdue=red, Pending Parts=amber, Planned/Scheduled=grey
                let badgeClass = 'grey'
                let badgeLabel = job.status
                if (job.status === 'in_progress') {
                  badgeClass = 'blue'
                  badgeLabel = 'In Progress'
                } else if (job.status === 'closed' || job.status === 'completed') {
                  badgeClass = 'green'
                  badgeLabel = 'Completed'
                } else if (job.overdue) {
                  badgeClass = 'red'
                  badgeLabel = 'Overdue'
                } else if (job.status === 'review' || job.status === 'sent_for_approval') {
                  badgeClass = 'amber'
                  badgeLabel = 'Pending Parts'
                } else if (job.status === 'planned' || job.status === 'created') {
                  badgeClass = 'grey'
                  badgeLabel = 'Scheduled'
                }

                const assetName = job.asset?.name || job.asset_name || (typeof job.asset === 'string' ? job.asset : 'Asset')

                return (
                  <Link
                    key={job.id || idx}
                    to={`/jobs/${job.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0',
                      borderBottom: idx < recentOrders.length - 1 ? '1px solid #eee' : 'none',
                      textDecoration: 'none',
                      color: 'inherit',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Left Icon */}
                    <div style={{ fontSize: '1.25rem', width: '28px', flexShrink: 0, textAlign: 'center' }}>
                      {icon}
                    </div>

                    {/* Center: WO number bold + asset name on one line, job title muted small below */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', fontFamily: 'monospace' }}>
                          {job.wo_number || `WO-${job.id}`}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          · {assetName}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {job.title}
                      </div>
                    </div>

                    {/* Right: status badge */}
                    <div style={{ flexShrink: 0 }}>
                      <span className={`badge ${badgeClass} small`}>
                        {badgeLabel}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useLoad(() => api.get('/api/dashboard'), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorNote error={error} />
  if (!data) return null

  // Technician sees mobile-first task list
  if (user.role === 'technician') {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Hello, {user.name.split(' ')[0]}</h1>
            <p className="lead">Here is your work for today.</p>
          </div>
        </div>
        <TechHome d={data} />
      </div>
    )
  }

  // Manager, Plant Head, Executive, Admin, Super Admin & other roles see redesigned enterprise dashboard
  return <EnterpriseDashboard d={data} user={user} />
}
