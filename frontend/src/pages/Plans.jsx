import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  DinTypeBadge,
  ErrorNote,
  Loading,
  Modal,
  Pill,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

export default function Plans() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: plans, loading, error, reload } = useLoad(() => api.get('/api/plans'))
  const [showAddModal, setShowAddModal] = useState(false)
  const [triggeringId, setTriggeringId] = useState(null)
  const [filterTrigger, setFilterTrigger] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const handleTrigger = async (plan) => {
    setTriggeringId(plan.id)
    try {
      const res = await api.post(`/api/plans/${plan.id}/trigger`)
      toast(`Generated work order ${res.wo_number || '#' + res.id} from ${plan.code}!`, 'ok')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setTriggeringId(null)
    }
  }

  const filteredPlans = (plans || []).filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.asset?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTrigger = !filterTrigger || p.trigger_type === filterTrigger
    return matchesSearch && matchesTrigger
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Maintenance Plans (DIN 31051)</h1>
          <p className="muted" style={{ margin: 0 }}>
            Multi-trigger preventive maintenance: Calendar intervals, Running hours, Condition thresholds, and Events.
          </p>
        </div>
        <div className="row">
          {can('plan.manage') && (
            <button className="primary" onClick={() => setShowAddModal(true)}>
              + New Maintenance Plan
            </button>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="card tb" style={{ gap: '12px', marginBottom: '14px' }}>
        <input
          type="search"
          placeholder="Filter plans by code, title, machine..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select value={filterTrigger} onChange={(e) => setFilterTrigger(e.target.value)} style={{ width: '200px' }}>
          <option value="">All Trigger Types</option>
          <option value="calendar">Calendar Interval</option>
          <option value="running_hours">Running Hours</option>
          <option value="condition">Condition Threshold</option>
          <option value="event">Event-driven</option>
        </select>
      </div>

      {loading && <Loading />}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>Plan Code</th>
              <th style={{ padding: '12px' }}>Target Asset</th>
              <th style={{ padding: '12px' }}>DIN Activity</th>
              <th style={{ padding: '12px' }}>Trigger Rule</th>
              <th style={{ padding: '12px' }}>Next Due</th>
              <th style={{ padding: '12px' }}>Assigned</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>
                  No maintenance plans match the current filter.
                </td>
              </tr>
            ) : (
              filteredPlans.map((p) => {
                const isOverdue = p.next_due_date && new Date(p.next_due_date) < new Date()
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {p.code}
                      {p.loto_required && (
                        <div style={{ marginTop: '2px' }}>
                          <span className="badge red small">LOTO Req</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <Link to={`/assets/${p.asset?.id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--ink)' }}>
                        {p.asset?.name}
                      </Link>
                      <div className="small muted">{p.asset?.code} • {p.asset?.location}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <DinTypeBadge type={p.din_type} />
                      <div className="small" style={{ marginTop: '4px', fontWeight: 500 }}>{p.title}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span className="badge blue small" style={{ textTransform: 'capitalize' }}>
                        {p.trigger_type}
                      </span>
                      <div className="small muted" style={{ marginTop: '4px' }}>
                        {p.trigger_type === 'calendar' && `Every ${p.interval_days} days`}
                        {p.trigger_type === 'running_hours' && `Every ${p.interval_hours} operating hours`}
                        {p.trigger_type === 'condition' && `${p.condition_metric} > ${p.condition_threshold}`}
                        {p.trigger_type === 'event' && 'Triggered on specific event'}
                      </div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ color: isOverdue ? 'var(--bad)' : 'inherit', fontWeight: isOverdue ? 600 : 400 }}>
                        {p.next_due_date ? fmtDate(p.next_due_date) : 'On condition'}
                      </div>
                      {isOverdue && <span className="small text-bad">Due now</span>}
                    </td>

                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                      {p.assigned_to_name ? `👤 ${p.assigned_to_name}` : <span className="muted">Unassigned</span>}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="small primary"
                        disabled={triggeringId === p.id}
                        onClick={() => handleTrigger(p)}
                        title="Auto-generate an active Work Order from this maintenance plan"
                      >
                        {triggeringId === p.id ? 'Generating…' : '⚡ Trigger WO'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddPlanModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            reload()
            toast('Maintenance plan registered.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function AddPlanModal({ onClose, onAdded }) {
  const [assetId, setAssetId] = useState('')
  const [dinType, setDinType] = useState('servicing')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('calendar')
  const [intervalDays, setIntervalDays] = useState(30)
  const [intervalHours, setIntervalHours] = useState('')
  const [conditionMetric, setConditionMetric] = useState('vibration')
  const [conditionThreshold, setConditionThreshold] = useState('')
  const [priority, setPriority] = useState('medium')
  const [estimatedHours, setEstimatedHours] = useState(2.0)
  const [assignedTo, setAssignedTo] = useState('')
  const [lotoRequired, setLotoRequired] = useState(false)
  const [checklistText, setChecklistText] = useState('Inspect fluid levels\nCheck belt tension\nClean filter assembly')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const { data: assets } = useLoad(() => api.get('/api/assets'))
  const { data: users } = useLoad(() => api.get('/api/users'))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const checklist_template = checklistText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      await api.post('/api/plans', {
        asset_id: parseInt(assetId, 10),
        din_type: dinType,
        title,
        description,
        trigger_type: triggerType,
        interval_days: triggerType === 'calendar' ? parseInt(intervalDays, 10) : null,
        interval_hours: triggerType === 'running_hours' && intervalHours ? parseFloat(intervalHours) : null,
        condition_metric: triggerType === 'condition' ? conditionMetric : null,
        condition_threshold: triggerType === 'condition' && conditionThreshold ? parseFloat(conditionThreshold) : null,
        priority,
        estimated_hours: parseFloat(estimatedHours),
        assigned_to: assignedTo ? parseInt(assignedTo, 10) : null,
        loto_required: lotoRequired,
        checklist_template,
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Create Maintenance Plan (DIN 31051)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Machine / Asset *</label>
            <select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">Select target asset...</option>
              {assets?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label>DIN 31051 Activity *</label>
            <select value={dinType} onChange={(e) => setDinType(e.target.value)}>
              <option value="inspection">Inspection (Inspektion)</option>
              <option value="servicing">Servicing (Wartung)</option>
              <option value="repair">Repair (Instandsetzung)</option>
              <option value="improvement">Improvement (Verbesserung)</option>
            </select>
          </div>
        </div>

        <div>
          <label>Plan Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Monthly Hydraulic Fluid & Filter Overhaul"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Trigger Type *</label>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              <option value="calendar">Calendar Interval</option>
              <option value="running_hours">Running Hours</option>
              <option value="condition">Condition Threshold</option>
              <option value="event">Event-driven</option>
            </select>
          </div>

          {triggerType === 'calendar' && (
            <div style={{ flex: 1 }}>
              <label>Interval (Days) *</label>
              <input
                type="number"
                min="1"
                required
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
              />
            </div>
          )}

          {triggerType === 'running_hours' && (
            <div style={{ flex: 1 }}>
              <label>Running Hours Interval *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 500"
                value={intervalHours}
                onChange={(e) => setIntervalHours(e.target.value)}
              />
            </div>
          )}

          {triggerType === 'condition' && (
            <>
              <div style={{ flex: 1 }}>
                <label>Metric</label>
                <select value={conditionMetric} onChange={(e) => setConditionMetric(e.target.value)}>
                  <option value="vibration">Vibration (mm/s)</option>
                  <option value="temperature">Temperature (°C)</option>
                  <option value="oil_pressure">Oil Pressure (bar)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>Threshold Trigger</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 4.5"
                  value={conditionThreshold}
                  onChange={(e) => setConditionThreshold(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label>Est. Duration (Hours)</label>
            <input
              type="number"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Assignee</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">(Unassigned)</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={lotoRequired}
              onChange={(e) => setLotoRequired(e.target.checked)}
            />
            <strong>Enforce Mandatory LOTO Safety Checklist before work starts</strong>
          </label>
        </div>

        <div>
          <label>Checklist Steps Template (One per line)</label>
          <textarea
            rows="3"
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Creating…' : 'Save Plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
