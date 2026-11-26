import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  Empty,
  ErrorNote,
  Loading,
  StatusBadge,
  fmtDateTime,
  useToast,
} from '../ui.jsx'

const DOWNTIME_TYPES = {
  unplanned: { label: 'Unplanned Breakdown', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  planned: { label: 'Planned Stop', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  minor_stop: { label: 'Minor Stop (<15m)', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  none: { label: 'No Production Stop', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
}

function fmtMinutes(mins) {
  const m = Math.round(Number(mins || 0))
  if (m <= 0) return '0m'
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h === 0) return `${rem}m`
  if (rem === 0) return `${h}h`
  return `${h}h ${rem}m`
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  const clean = isoStr.replace('Z', '')
  return clean.slice(0, 16)
}

export default function Breakdowns() {
  const { user } = useAuth()
  const toast = useToast()
  const canEditRca = !['auditor', 'store_manager', 'purchase_manager'].includes(user?.role)

  const [data, setData] = useState({ summary: {}, items: [] })
  const [failureCodes, setFailureCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedBreakdown, setSelectedBreakdown] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [bdRes, fcRes] = await Promise.all([
        api.get(`/api/breakdowns?status=${statusFilter}&downtime_type=${typeFilter}`),
        api.get('/api/failure-codes').catch(() => []),
      ])
      setData(bdRes || { summary: {}, items: [] })
      setFailureCodes(fcRes || [])
    } catch (err) {
      setError(err.message || 'Failed to load breakdown register')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter, typeFilter])

  const items = (data.items || []).filter((b) => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return true
    return (
      b.wo_number?.toLowerCase().includes(q) ||
      b.asset_code?.toLowerCase().includes(q) ||
      b.asset_name?.toLowerCase().includes(q) ||
      b.title?.toLowerCase().includes(q) ||
      b.failure_mode?.toLowerCase().includes(q) ||
      b.breakdown_reason?.toLowerCase().includes(q)
    )
  })

  const sum = data.summary || {}

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
            Breakdown Register &amp; Root Cause Analysis
          </h1>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
            Granular downtime timing, MTTA/MTTR breakdown &amp; ISO 14224 Root Cause Analysis (SCR-026 to SCR-028, URS-028 &amp; URS-029).
          </p>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          <Link to="/requests?action=new" className="bt p" style={{ fontWeight: 600 }}>
            ⚡ Report Breakdown
          </Link>
          <Link to="/reports" className="bt">
            📈 EN 13306 Analytics
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kp" style={{ borderTopColor: '#dc2626' }}>
          <span>Active Breakdowns</span>
          <b>{sum.active_breakdowns ?? 0}</b>
          <div className="small muted">Currently open repair events</div>
        </div>
        <div className="kp" style={{ borderTopColor: '#d97706' }}>
          <span>Total Downtime Logged</span>
          <b>{sum.total_downtime_hours ?? 0} h</b>
          <div className="small muted">Cumulative production impact</div>
        </div>
        <div className="kp" style={{ borderTopColor: '#2563eb' }}>
          <span>Average MTTR</span>
          <b>{sum.avg_mttr_hours ?? 0} h</b>
          <div className="small muted">Mean Time To Repair (closed)</div>
        </div>
        <div className="kp" style={{ borderTopColor: '#059669' }}>
          <span>RCA Completion Rate</span>
          <b>{sum.rca_completed_pct ?? 100}%</b>
          <div className="small muted">Root cause &amp; corrective actions</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="tb" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="chips" role="group" aria-label="Filter breakdowns" style={{ marginBottom: 0 }}>
          {[
            ['all', 'All Breakdowns'],
            ['active', 'Active / Open'],
            ['needs_rca', 'Needs RCA'],
            ['closed', 'Closed'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={statusFilter === k}
              onClick={() => setStatusFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: 'auto', maxWidth: '190px' }}
          >
            <option value="all">All Downtime Types</option>
            <option value="unplanned">Unplanned Breakdown</option>
            <option value="minor_stop">Minor Stop (&lt;15m)</option>
            <option value="planned">Planned Stop</option>
            <option value="none">No Production Stop</option>
          </select>
          <input
            type="search"
            placeholder="Search WO #, machine, failure mode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '240px', maxWidth: '300px' }}
          />
        </div>
      </div>

      <ErrorNote error={error} />
      {loading && <Loading />}

      {/* SCR-026 Breakdown Register Table */}
      {!loading && (
        items.length === 0 ? (
          <Empty title="No breakdown events match your filters">
            Adjust status/type filters or submit a new breakdown request.
          </Empty>
        ) : (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '11px 14px' }}>WO #</th>
                  <th style={{ padding: '11px 14px' }}>Equipment &amp; Plant</th>
                  <th style={{ padding: '11px 14px' }}>Fault &amp; Failure Mode</th>
                  <th style={{ padding: '11px 14px' }}>Downtime &amp; Type</th>
                  <th style={{ padding: '11px 14px' }}>MTTA / MTTR</th>
                  <th style={{ padding: '11px 14px' }}>Status &amp; RCA</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const dtStyle = DOWNTIME_TYPES[b.downtime_type] || DOWNTIME_TYPES.unplanned
                  return (
                    <tr key={b.id}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <Link to={`/jobs/${b.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px' }}>
                          {b.wo_number || `WO-${b.id}`}
                        </Link>
                        <div className="small muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                          {fmtDateTime(b.breakdown_start_at)}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'normal', minWidth: '170px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{b.asset_code}</span>
                          <CriticalityBadge grade={b.asset_criticality} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{b.asset_name}</div>
                        <div className="small muted" style={{ fontSize: '11px' }}>📍 {b.asset_location}</div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'normal', minWidth: '210px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.35 }}>{b.title}</div>
                        {(b.failure_mode || b.breakdown_reason) && (
                          <div className="small muted" style={{ fontSize: '11.5px', marginTop: '3px', lineHeight: 1.35 }}>
                            {b.failure_mode || b.breakdown_reason}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--tx)' }}>
                          {fmtMinutes(b.downtime_minutes)}
                          <span className="muted" style={{ fontWeight: 400, fontSize: '11px', marginLeft: '5px' }}>
                            ({b.downtime_hours}h)
                          </span>
                        </div>
                        <span
                          className="b"
                          style={{
                            marginTop: '3px',
                            background: dtStyle.bg,
                            color: dtStyle.color,
                            border: `1px solid ${dtStyle.border}`,
                            fontSize: '10.5px',
                          }}
                        >
                          {dtStyle.label}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        <div>
                          <span className="muted">MTTA:</span> <strong>{fmtMinutes(b.mtta_minutes)}</strong>
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          <span className="muted">MTTR:</span> <strong>{fmtMinutes(b.mttr_minutes)}</strong>
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={b.status} />
                        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {b.rca_completed ? (
                            <span className="b" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '10.5px' }}>
                              ✓ RCA Complete
                            </span>
                          ) : (
                            <span className="b" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '10.5px' }}>
                              ⚠ RCA Pending
                            </span>
                          )}
                          {b.production_confirmed_by && (
                            <span className="b" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '10.5px' }}>
                              ✓ Restart Verified
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className={`bt ${!b.rca_completed && canEditRca ? 'p' : ''}`}
                          style={{ fontSize: '11.5px', padding: '5px 12px' }}
                          onClick={() => setSelectedBreakdown(b)}
                        >
                          Details &amp; RCA →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* SCR-027 & SCR-028: BREAKDOWN DETAILS & ROOT CAUSE ANALYSIS MODAL */}
      {selectedBreakdown && (
        <BreakdownRCAModal
          breakdown={selectedBreakdown}
          failureCodes={failureCodes}
          canEdit={canEditRca}
          onClose={() => setSelectedBreakdown(null)}
          onSaved={() => {
            setSelectedBreakdown(null)
            loadData()
            toast('Downtime timing & Root Cause Analysis saved.', 'ok')
          }}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------
   SCR-027 & SCR-028: BREAKDOWN DETAIL & RCA MODAL
---------------------------------------------------- */
function BreakdownRCAModal({ breakdown, failureCodes, canEdit, onClose, onSaved }) {
  const [downStart, setDownStart] = useState(toDatetimeLocal(breakdown.breakdown_start_at))
  const [downEnd, setDownEnd] = useState(toDatetimeLocal(breakdown.breakdown_end_at))
  const [downtimeType, setDowntimeType] = useState(breakdown.downtime_type || 'unplanned')

  const [failureMode, setFailureMode] = useState(breakdown.failure_mode || '')
  const [failureCause, setFailureCause] = useState(breakdown.failure_cause || '')
  const [failureEffect, setFailureEffect] = useState(breakdown.failure_effect || '')
  const [breakdownReason, setBreakdownReason] = useState(breakdown.breakdown_reason || '')

  const [rootCauseAnalysis, setRootCauseAnalysis] = useState(breakdown.root_cause_analysis || '')
  const [correctiveAction, setCorrectiveAction] = useState(breakdown.corrective_action || breakdown.action_taken || '')
  const [preventiveAction, setPreventiveAction] = useState(breakdown.preventive_action || '')
  const [confirmRestart, setConfirmRestart] = useState(Boolean(breakdown.production_confirmed_by))

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const relevantCodes = failureCodes.filter(
    (fc) => !breakdown.asset_category || fc.asset_category?.toLowerCase() === breakdown.asset_category?.toLowerCase()
  )

  const handleSelectIsoCode = (codeStr) => {
    const match = failureCodes.find((fc) => fc.code === codeStr)
    if (match) {
      setFailureMode(match.failure_mode)
      setFailureCause(match.failure_cause)
      setFailureEffect(match.failure_effect)
      setBreakdownReason(`${match.failure_mode}: ${match.failure_cause}`)
    }
  }

  let liveDurationMins = breakdown.downtime_minutes || 0
  if (downStart && downEnd) {
    const diff = (new Date(downEnd) - new Date(downStart)) / 60000
    if (!Number.isNaN(diff) && diff >= 0) {
      liveDurationMins = Math.round(diff)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.put(`/api/breakdowns/${breakdown.id}/rca`, {
        breakdown_start_at: downStart ? new Date(downStart).toISOString() : null,
        breakdown_end_at: downEnd ? new Date(downEnd).toISOString() : null,
        downtime_type: downtimeType,
        breakdown_reason: breakdownReason,
        failure_mode: failureMode,
        failure_cause: failureCause,
        failure_effect: failureEffect,
        root_cause_analysis: rootCauseAnalysis,
        corrective_action: correctiveAction,
        preventive_action: preventiveAction,
        confirm_production_restart: confirmRestart && !breakdown.production_confirmed_by,
      })
      onSaved()
    } catch (e) {
      setErr(e.message || 'Failed to save RCA')
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
        style={{ maxWidth: '700px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Link to={`/jobs/${breakdown.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px' }}>
                {breakdown.wo_number || `WO-${breakdown.id}`}
              </Link>
              <StatusBadge status={breakdown.status} />
              <span className="b" style={{ fontSize: '11px' }}>
                {breakdown.asset_code} — {breakdown.asset_name}
              </span>
            </div>
            <h3 style={{ margin: '6px 0 2px 0', fontSize: '16px' }}>{breakdown.title}</h3>
            <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
              Assigned to <strong>{breakdown.assigned_to_name}</strong> &bull; Parts Cost: ₹{breakdown.parts_cost} &bull; Labour Cost: ₹{breakdown.labour_cost}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--mu)', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {/* SCR-027: 3-Stage Breakdown & Downtime Precision Timeline */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            background: 'var(--subtle, #f8fafc)',
            border: '1px solid var(--bd)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '14px',
            fontSize: '12px',
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 600 }}>1. Machine Stopped</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{fmtDateTime(breakdown.breakdown_start_at) || '—'}</div>
            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Response (MTTA): <strong>{fmtMinutes(breakdown.mtta_minutes)}</strong></div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 600 }}>2. Repair Started</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{fmtDateTime(breakdown.start_time) || 'Not started'}</div>
            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Wrench (MTTR): <strong>{fmtMinutes(breakdown.mttr_minutes)}</strong></div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 600 }}>3. Total Downtime</div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#b91c1c', marginTop: '2px' }}>{fmtMinutes(liveDurationMins)}</div>
            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
              {breakdown.production_confirmed_by ? `Restarted (${breakdown.production_confirmed_by})` : 'Awaiting restart check'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '12px' }}>
          <ErrorNote error={err} />

          {/* Downtime Timestamp Precision */}
          <div className="row" style={{ gap: '10px', display: 'flex', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-start" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Breakdown Start Time
              </label>
              <input
                id="rca-start"
                type="datetime-local"
                disabled={!canEdit}
                value={downStart}
                onChange={(e) => setDownStart(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-end" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Equipment Restored Time
              </label>
              <input
                id="rca-end"
                type="datetime-local"
                disabled={!canEdit}
                value={downEnd}
                onChange={(e) => setDownEnd(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-dtype" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Downtime Classification
              </label>
              <select
                id="rca-dtype"
                disabled={!canEdit}
                value={downtimeType}
                onChange={(e) => setDowntimeType(e.target.value)}
              >
                <option value="unplanned">Unplanned Breakdown</option>
                <option value="minor_stop">Minor Stop (&lt;15m)</option>
                <option value="planned">Planned Stop</option>
                <option value="none">No Production Stop</option>
              </select>
            </div>
          </div>

          {/* ISO 14224 Quick Selector */}
          {canEdit && failureCodes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-iso" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                ISO 14224 Standard Failure Code (Quick-Fill)
              </label>
              <select id="rca-iso" defaultValue="" onChange={(e) => handleSelectIsoCode(e.target.value)}>
                <option value="">-- Select ISO 14224 Failure Classification --</option>
                {(relevantCodes.length > 0 ? relevantCodes : failureCodes).map((fc) => (
                  <option key={fc.id} value={fc.code}>
                    {fc.code}: {fc.failure_mode} — {fc.failure_cause}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Failure Mode & Summary */}
          <div className="row" style={{ gap: '10px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-mode" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Failure Mode
              </label>
              <input
                id="rca-mode"
                type="text"
                disabled={!canEdit}
                placeholder="e.g. Spindle stall / overheat"
                value={failureMode}
                onChange={(e) => setFailureMode(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-cause" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Failure Cause
              </label>
              <input
                id="rca-cause"
                type="text"
                disabled={!canEdit}
                placeholder="e.g. Bearing lubrication starvation"
                value={failureCause}
                onChange={(e) => setFailureCause(e.target.value)}
              />
            </div>
          </div>

          {/* SCR-028: Root Cause Analysis (5-Why) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="rca-5why" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
              Root Cause Analysis / 5-Why Investigation (SCR-028)
            </label>
            <textarea
              id="rca-5why"
              rows={2}
              disabled={!canEdit}
              placeholder="Why did the failure occur? Identify underlying mechanical, electrical, or operational root cause..."
              value={rootCauseAnalysis}
              onChange={(e) => setRootCauseAnalysis(e.target.value)}
            />
          </div>

          {/* Corrective & Preventive Actions (URS-029) */}
          <div className="row" style={{ gap: '10px', display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-corrective" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Immediate Corrective Action
              </label>
              <textarea
                id="rca-corrective"
                rows={2}
                disabled={!canEdit}
                placeholder="Replaced faulty relay / cleared blockage..."
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="rca-preventive" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--mu)' }}>
                Preventive Action (Stop Recurrence)
              </label>
              <textarea
                id="rca-preventive"
                rows={2}
                disabled={!canEdit}
                placeholder="Add weekly lubrication check to PM plan..."
                value={preventiveAction}
                onChange={(e) => setPreventiveAction(e.target.value)}
              />
            </div>
          </div>

          {/* Trial Run Production Confirmation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: '6px' }}>
            <input
              id="rca-confirm"
              type="checkbox"
              disabled={!canEdit || Boolean(breakdown.production_confirmed_by)}
              checked={confirmRestart}
              onChange={(e) => setConfirmRestart(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <label htmlFor="rca-confirm" style={{ fontSize: '12px', fontWeight: 600, color: '#065f46', margin: 0, cursor: 'pointer' }}>
              {breakdown.production_confirmed_by
                ? `Trial Run & Production Restart Confirmed by ${breakdown.production_confirmed_by} (${fmtDateTime(breakdown.production_confirmed_at)})`
                : 'Confirm Trial Run & Machine Restarted for Production'}
            </label>
          </div>

          <div className="r" style={{ justifyContent: 'space-between', marginTop: '4px' }}>
            <Link to={`/jobs/${breakdown.id}`} className="bt" style={{ textDecoration: 'none' }}>
              Open Work Order #{breakdown.id} →
            </Link>
            <div className="row" style={{ gap: '8px' }}>
              <button type="button" className="bt" onClick={onClose}>
                Close
              </button>
              {canEdit && (
                <button type="submit" className="bt p" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Downtime & RCA'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
