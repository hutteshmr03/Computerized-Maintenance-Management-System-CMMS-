import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, resolveUrl } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  Empty,
  ErrorNote,
  Loading,
  fmtDateTime,
  useToast,
} from '../ui.jsx'

const CATEGORIES = [
  { id: 'breakdown', label: 'Breakdown / Failure', icon: '🛑' },
  { id: 'abnormal_noise', label: 'Abnormal Noise / Vibration', icon: '🔊' },
  { id: 'overheating', label: 'Overheating', icon: '🌡️' },
  { id: 'leakage', label: 'Oil / Air / Coolant Leak', icon: '💧' },
  { id: 'electrical', label: 'Electrical / Power Fault', icon: '⚡' },
  { id: 'safety', label: 'Safety / Guard Hazard', icon: '⚠️' },
  { id: 'other', label: 'Other Issue', icon: '🔧' },
]

const SEVERITIES = [
  { id: 'low', label: 'Low', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'medium', label: 'Medium', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'high', label: 'High', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { id: 'critical', label: 'Critical', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
]

const STATUS_BADGES = {
  submitted: { label: 'Pending Triage', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  converted: { label: 'Converted to WO', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  rejected: { label: 'Rejected / Closed', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
}

function SeverityPill({ severity }) {
  const s = SEVERITIES.find((x) => x.id === severity) || SEVERITIES[1]
  return (
    <span
      className="b"
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: '11.5px',
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

export default function Requests() {
  const { user, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const canTriage =
    can('job.approve') ||
    ['admin', 'super_admin', 'maintenance_manager', 'maintenance_engineer'].includes(user?.role)

  const [requests, setRequests] = useState([])
  const [assets, setAssets] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('submitted')
  const [searchTerm, setSearchTerm] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  const preselectedAssetId = params.get('asset_id') || ''
  const actionParam = params.get('action') || ''

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [reqRes, assetRes, userRes] = await Promise.all([
        api.get('/api/requests'),
        api.get('/api/assets').catch(() => []),
        api.get('/api/users').catch(() => []),
      ])
      setRequests(reqRes || [])
      setAssets((assetRes || []).filter((a) => !a.tier || a.tier === 'asset' || a.tier === 'component' || a.tier === 'system'))
      setUsers(userRes || [])
    } catch (err) {
      setError(err.message || 'Failed to load maintenance requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (actionParam === 'new' || preselectedAssetId) {
      setShowCreateModal(true)
    }
  }, [actionParam, preselectedAssetId])

  const pendingCount = requests.filter((r) => r.status === 'submitted').length
  const stoppedCount = requests.filter((r) => r.status === 'submitted' && r.machine_stopped).length
  const convertedCount = requests.filter((r) => r.status === 'converted').length

  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    const q = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !q ||
      r.req_number?.toLowerCase().includes(q) ||
      r.asset_code?.toLowerCase().includes(q) ||
      r.asset_name?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.requester_name?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const closeCreateModal = () => {
    setShowCreateModal(false)
    if (params.has('action') || params.has('asset_id')) {
      setParams({})
    }
  }

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Operator Maintenance Requests</h1>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
            2-click shop-floor breakdown reporting, equipment symptom capture &amp; Maintenance Manager triage (SCR-013 to SCR-015).
          </p>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          <Link to="/scan" className="bt">
            📷 Scan QR Tag
          </Link>
          <button
            type="button"
            className="bt p"
            onClick={() => setShowCreateModal(true)}
            style={{ fontWeight: 600 }}
          >
            + Report Breakdown / Issue
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid">
        <div className="kp" style={{ borderTopColor: '#d97706' }}>
          <span>Pending Triage</span>
          <b>{pendingCount}</b>
          <div className="small muted">Awaiting manager review</div>
        </div>
        <div className="kp" style={{ borderTopColor: '#dc2626' }}>
          <span>Machines Stopped</span>
          <b>{stoppedCount}</b>
          <div className="small muted">Active production halts</div>
        </div>
        <div className="kp" style={{ borderTopColor: '#059669' }}>
          <span>Converted to Work Orders</span>
          <b>{convertedCount}</b>
          <div className="small muted">Dispatched to maintenance</div>
        </div>
        <div className="kp">
          <span>Total Requests</span>
          <b>{requests.length}</b>
          <div className="small muted">All logged operator reports</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="tb" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="chips" role="group" aria-label="Filter maintenance requests" style={{ marginBottom: 0 }}>
          {[
            ['submitted', `Pending Triage (${pendingCount})`],
            ['converted', `Converted to WO (${convertedCount})`],
            ['rejected', 'Rejected'],
            ['all', `All (${requests.length})`],
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

        <input
          type="search"
          placeholder="Search REQ #, machine code, symptom, or reporter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '260px', maxWidth: '340px' }}
        />
      </div>

      <ErrorNote error={error} />
      {loading && <Loading />}

      {/* Requests Table (SCR-013) */}
      {!loading && (
        filteredRequests.length === 0 ? (
          <Empty title="No maintenance requests in this view">
            {statusFilter === 'submitted'
              ? 'All shop-floor breakdown reports have been triaged. Click "+ Report Breakdown / Issue" to submit a new request.'
              : 'Try changing the status filter or search query.'}
          </Empty>
        ) : (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '11px 14px' }}>Request #</th>
                  <th style={{ padding: '11px 14px' }}>Equipment &amp; Plant</th>
                  <th style={{ padding: '11px 14px' }}>Issue &amp; Category</th>
                  <th style={{ padding: '11px 14px' }}>Severity</th>
                  <th style={{ padding: '11px 14px' }}>Reporter &amp; Time</th>
                  <th style={{ padding: '11px 14px' }}>Status</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((r) => {
                  const cat = CATEGORIES.find((c) => c.id === r.category) || { icon: '🔧', label: r.category }
                  const st = STATUS_BADGES[r.status] || STATUS_BADGES.submitted
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(r)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '13px',
                            color: 'var(--accent, #1d4ed8)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          {r.req_number}
                        </button>
                        {r.photo_url && (
                          <div className="small muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                            📷 Photo attached
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'normal', minWidth: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>{r.asset_code}</span>
                          <CriticalityBadge grade={r.asset_criticality} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{r.asset_name}</div>
                        <div className="small muted" style={{ fontSize: '11px' }}>📍 {r.asset_location}</div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'normal', minWidth: '220px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.35 }}>{r.title}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span className="b" style={{ fontSize: '11px' }}>
                            {cat.icon} {cat.label}
                          </span>
                          {r.machine_stopped && (
                            <span
                              className="b"
                              style={{
                                fontSize: '11px',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                              }}
                            >
                              🛑 Machine Stopped
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <SeverityPill severity={r.severity} />
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 500, fontSize: '12.5px' }}>{r.requester_name}</div>
                        <div className="small muted" style={{ fontSize: '11px' }}>{fmtDateTime(r.reported_down_at || r.created_at)}</div>
                      </td>

                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          className="b"
                          style={{
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          {st.label}
                        </span>
                        {r.converted_job_id && (
                          <div style={{ marginTop: '4px' }}>
                            <Link
                              to={`/jobs/${r.converted_job_id}`}
                              style={{ fontSize: '11.5px', fontWeight: 600, fontFamily: 'monospace' }}
                            >
                              {r.converted_wo_number || `WO #${r.converted_job_id}`} →
                            </Link>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className={`bt ${r.status === 'submitted' && canTriage ? 'p' : ''}`}
                          style={{ fontSize: '11.5px', padding: '5px 12px' }}
                          onClick={() => setSelectedRequest(r)}
                        >
                          {r.status === 'submitted' && canTriage ? 'Triage & Convert →' : 'View Details'}
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

      {/* SCR-014: CREATE MAINTENANCE REQUEST MODAL */}
      {showCreateModal && (
        <CreateRequestModal
          assets={assets}
          initialAssetId={preselectedAssetId}
          onClose={closeCreateModal}
          onCreated={() => {
            closeCreateModal()
            loadData()
            toast('Maintenance request submitted! Maintenance Managers have been notified.', 'ok')
          }}
        />
      )}

      {/* SCR-015: MAINTENANCE REQUEST DETAILS & TRIAGE MODAL */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          users={users}
          canTriage={canTriage}
          onClose={() => setSelectedRequest(null)}
          onConverted={(job) => {
            setSelectedRequest(null)
            loadData()
            toast(`Approved & converted to Work Order ${job.wo_number}`, 'ok')
            if (job?.id) {
              navigate(`/jobs/${job.id}`)
            }
          }}
          onRejected={() => {
            setSelectedRequest(null)
            loadData()
            toast('Maintenance request closed / rejected.', 'ok')
          }}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------
   SCR-014: CREATE MAINTENANCE REQUEST MODAL (2-Click Report)
---------------------------------------------------- */
function CreateRequestModal({ assets, initialAssetId, onClose, onCreated }) {
  const [assetId, setAssetId] = useState(initialAssetId || (assets[0]?.id ? String(assets[0].id) : ''))
  const [category, setCategory] = useState('breakdown')
  const [severity, setSeverity] = useState('high')
  const [machineStopped, setMachineStopped] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assetId) {
      setErr('Please select the affected machine or equipment.')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const created = await api.post('/api/requests', {
        asset_id: Number(assetId),
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        machine_stopped: machineStopped,
      })

      if (photoFile && created?.id) {
        const fd = new FormData()
        fd.append('file', photoFile)
        await api.upload(`/api/requests/${created.id}/photo`, fd)
      }
      onCreated(created)
    } catch (e) {
      setErr(e.message || 'Failed to submit request')
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
        style={{ maxWidth: '600px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Report Breakdown / Maintenance Request</h3>
            <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '11.5px' }}>
              Select equipment &amp; symptom to alert Maintenance Engineering immediately (SCR-014).
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

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '12px' }}>
          <ErrorNote error={err} />

          {/* 1. Target Machine */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="req-asset" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              1. Affected Machine / Equipment *
            </label>
            <select
              id="req-asset"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              required
            >
              <option value="">-- Choose Equipment --</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name} ({a.location || 'Plant'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Quick Symptom Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              2. Failure / Symptom Category *
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORIES.map((c) => {
                const active = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '7px',
                      fontSize: '12px',
                      fontWeight: active ? 600 : 500,
                      border: `1px solid ${active ? 'var(--navy)' : 'var(--bd)'}`,
                      background: active ? 'var(--navy)' : 'var(--card)',
                      color: active ? '#fff' : 'var(--tx)',
                      cursor: 'pointer',
                    }}
                  >
                    {c.icon} {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Severity & Machine Stopped */}
          <div className="row" style={{ gap: '12px', display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>Severity Level</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SEVERITIES.map((s) => {
                  const active = severity === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: `1px solid ${active ? s.color : s.border}`,
                        background: active ? s.bg : 'var(--card)',
                        color: active ? s.color : 'var(--mu)',
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
              <input
                id="req-stopped"
                type="checkbox"
                checked={machineStopped}
                onChange={(e) => setMachineStopped(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="req-stopped" style={{ fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                🛑 Machine is Stopped
              </label>
            </div>
          </div>

          {/* 4. Issue Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="req-title" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Issue Summary *
            </label>
            <input
              id="req-title"
              type="text"
              required
              placeholder="e.g. Hydraulic oil leak near main cylinder seal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 5. Detailed Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="req-desc" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Observations / Shift Notes (Optional)
            </label>
            <textarea
              id="req-desc"
              rows={3}
              placeholder="Describe abnormal sounds, alarms, or operating conditions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 6. Photo Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="req-photo" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
              Attach Photo Evidence (Optional)
            </label>
            <input
              id="req-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="r" style={{ marginTop: '6px' }}>
            <button type="button" className="bt" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="bt p" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Maintenance Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ----------------------------------------------------
   SCR-015: MAINTENANCE REQUEST DETAILS & TRIAGE MODAL
---------------------------------------------------- */
function RequestDetailModal({ request, users, canTriage, onClose, onConverted, onRejected }) {
  const technicians = users.filter((u) => ['technician', 'maintenance_engineer', 'maintenance_manager'].includes(u.role))
  const [priority, setPriority] = useState(request.severity || 'high')
  const [assignedTo, setAssignedTo] = useState(technicians[0]?.id ? String(technicians[0].id) : '')
  const [lotoRequired, setLotoRequired] = useState(
    request.asset_criticality === 'A' || ['electrical', 'safety'].includes(request.category)
  )
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState(2.0)
  const [notes, setNotes] = useState('')

  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const cat = CATEGORIES.find((c) => c.id === request.category) || { icon: '🔧', label: request.category }
  const st = STATUS_BADGES[request.status] || STATUS_BADGES.submitted

  const handleConvert = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await api.post(`/api/requests/${request.id}/convert`, {
        priority,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        loto_required: lotoRequired,
        due_date: dueDate || null,
        estimated_hours: Number(estimatedHours) || 2.0,
        notes,
      })
      onConverted(res.job)
    } catch (e) {
      setErr(e.message || 'Failed to convert request')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setErr('Please provide a reason for rejecting this request.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await api.post(`/api/requests/${request.id}/reject`, { reason: rejectReason.trim() })
      onRejected()
    } catch (e) {
      setErr(e.message || 'Failed to reject request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal mb"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: 'var(--accent, #1d4ed8)' }}>
                {request.req_number}
              </span>
              <span
                className="b"
                style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: '11px', fontWeight: 600 }}
              >
                {st.label}
              </span>
              <SeverityPill severity={request.severity} />
              {request.machine_stopped && (
                <span className="b" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '11px' }}>
                  🛑 Machine Stopped
                </span>
              )}
            </div>
            <h3 style={{ margin: '6px 0 2px 0', fontSize: '16px' }}>{request.title}</h3>
            <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
              Reported by <strong>{request.requester_name}</strong> on {fmtDateTime(request.reported_down_at || request.created_at)}
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

        <ErrorNote error={err} />

        {/* Asset & Symptom Summary Box */}
        <div style={{ background: 'var(--subtle, #f8fafc)', border: '1px solid var(--bd)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
            <div>
              <div className="muted" style={{ fontSize: '11px' }}>Equipment</div>
              <div style={{ fontWeight: 600 }}>
                <span style={{ fontFamily: 'monospace' }}>{request.asset_code}</span> — {request.asset_name}
              </div>
              <div className="muted" style={{ fontSize: '11px' }}>📍 {request.asset_location}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: '11px' }}>Symptom Category</div>
              <div style={{ fontWeight: 600 }}>{cat.icon} {cat.label}</div>
            </div>
          </div>

          {request.description && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--bd)', fontSize: '12.5px', lineHeight: 1.45 }}>
              {request.description}
            </div>
          )}

          {request.photo_url && (
            <div style={{ marginTop: '10px' }}>
              <div className="muted" style={{ fontSize: '11px', marginBottom: '4px' }}>Operator Photo Evidence:</div>
              <img
                src={resolveUrl(request.photo_url)}
                alt="Breakdown evidence"
                style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '6px', border: '1px solid var(--bd)', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>

        {/* Already Converted or Rejected Info */}
        {request.status === 'converted' && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#065f46', marginBottom: '12px' }}>
            <strong>Approved &amp; Converted:</strong> Reviewed by {request.reviewer_name || 'Manager'}.
            {request.converted_job_id && (
              <div style={{ marginTop: '6px' }}>
                <Link to={`/jobs/${request.converted_job_id}`} className="bt p" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  Open Work Order {request.converted_wo_number || `#${request.converted_job_id}`} →
                </Link>
              </div>
            )}
          </div>
        )}

        {request.status === 'rejected' && (
          <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#334155', marginBottom: '12px' }}>
            <strong>Closed / Rejected</strong> by {request.reviewer_name || 'Manager'}: {request.rejection_reason}
          </div>
        )}

        {/* Manager Triage & Conversion Form */}
        {request.status === 'submitted' && canTriage && (
          <form onSubmit={handleConvert} className="stack" style={{ gap: '10px', borderTop: '1px solid var(--bd)', paddingTop: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px' }}>Manager Triage — Convert to Official Work Order</h4>

            <div className="row" style={{ gap: '12px', display: 'flex' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="triage-tech" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                  Assign Technician *
                </label>
                <select id="triage-tech" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required>
                  <option value="">-- Select Technician / Engineer --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="triage-priority" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                  Work Order Priority
                </label>
                <select id="triage-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="row" style={{ gap: '12px', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="triage-due" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                  Target Due Date (Optional)
                </label>
                <input id="triage-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="triage-hrs" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                  Estimated Hours
                </label>
                <input
                  id="triage-hrs"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="triage-loto"
                type="checkbox"
                checked={lotoRequired}
                onChange={(e) => setLotoRequired(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="triage-loto" style={{ fontSize: '12.5px', fontWeight: 600, margin: 0, cursor: 'pointer' }}>
                🔒 Require LOTO Safety Lockout Permit before repair starts
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="triage-notes" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)' }}>
                Supervisor Instructions (Optional)
              </label>
              <input
                id="triage-notes"
                type="text"
                placeholder="Instructions for technician, spare part prep, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {showRejectBox && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="reject-reason" style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b' }}>
                  Rejection / Duplicate Reason *
                </label>
                <div className="row" style={{ gap: '8px' }}>
                  <input
                    id="reject-reason"
                    type="text"
                    placeholder="e.g. Duplicate of existing WO, or false alarm"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="bt" onClick={handleReject} disabled={busy} style={{ color: '#b91c1c', borderColor: '#fca5a5' }}>
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}

            <div className="r" style={{ justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                type="button"
                className="bt"
                onClick={() => setShowRejectBox(!showRejectBox)}
                style={{ color: 'var(--mu)' }}
              >
                {showRejectBox ? 'Hide Reject' : 'Reject / Duplicate'}
              </button>
              <div className="row" style={{ gap: '8px' }}>
                <button type="button" className="bt" onClick={onClose}>
                  Close
                </button>
                <button type="submit" className="bt p" disabled={busy}>
                  {busy ? 'Converting…' : 'Approve & Create Work Order →'}
                </button>
              </div>
            </div>
          </form>
        )}

        {!(request.status === 'submitted' && canTriage) && (
          <div className="r" style={{ marginTop: '8px' }}>
            <button type="button" className="bt" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
