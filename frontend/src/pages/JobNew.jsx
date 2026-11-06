import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  DinTypeBadge,
  ErrorNote,
  Loading,
  PRIORITY,
  SpeechInput,
  useLoad,
  useToast,
} from '../ui.jsx'

const STEPS = ['Select Target Machine', 'DIN Activity & Description', 'Assignment & Safety']

export default function JobNew() {
  const { user, can } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const assets = useLoad(() => api.get('/api/assets'), [])
  const users = useLoad(() => api.get('/api/users'), [])
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  const [f, setF] = useState({
    asset_id: params.get('asset_id') || params.get('asset') || '',
    type: 'repair',
    din_type: 'repair',
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    estimated_cost: '',
    estimated_hours: 2.0,
    assigned_to: user.role === 'technician' ? String(user.id) : '',
    contractor_id: '',
    loto_required: false,
  })

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const asset = assets.data?.find((a) => String(a.id) === String(f.asset_id))
  const blocked = asset?.open_job_id

  useEffect(() => {
    if (asset) {
      // Auto-flag LOTO if criticality is A or hydraulic press
      const needsLoto = asset.criticality === 'A' || asset.name.toLowerCase().includes('press')
      set('loto_required', needsLoto)
    }
  }, [asset?.id])

  if (!can('job.create')) return <ErrorNote error="Your role does not have permission to create work orders." />
  if (assets.loading || users.loading) return <Loading />

  const canNext = [
    !!asset && !blocked,
    f.title.trim() && (f.type === 'repair' || f.due_date),
    true,
  ][step]

  const create = async () => {
    setError('')
    try {
      const job = await api.post('/api/jobs', {
        type: f.type,
        din_type: f.din_type,
        asset_id: Number(f.asset_id),
        title: f.title.trim(),
        description: f.description.trim(),
        priority: f.priority,
        estimated_cost: Number(f.estimated_cost) || 0,
        estimated_hours: Number(f.estimated_hours) || 2.0,
        assigned_to: f.assigned_to ? Number(f.assigned_to) : null,
        contractor_id: f.contractor_id ? Number(f.contractor_id) : null,
        due_date: f.due_date || null,
        loto_required: f.loto_required,
      })
      toast(`Work Order ${job.wo_number || '#' + job.id} created successfully!`, 'ok')
      navigate(`/jobs/${job.id}`)
    } catch (e) {
      setError(e.message)
    }
  }

  const technicians = users.data?.filter((u) => u.role === 'technician') || []
  const contractors = users.data?.filter((u) => u.role === 'contractor') || []

  return (
    <div style={{ maxWidth: 720 }}>
      <p className="small">
        <Link to="/jobs">← All work orders</Link>
      </p>
      <h1>Raise Work Order (DIN 31051)</h1>

      <div className="wizard" aria-label="Steps" style={{ margin: '1rem 0' }}>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={i === step ? 'on' : i < step ? 'past' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <ErrorNote error={error} />

      {step === 0 && (
        <div className="panel stack">
          <div>
            <label htmlFor="asset">Select Target Machine or Component *</label>
            <select id="asset" value={f.asset_id} onChange={(e) => set('asset_id', e.target.value)}>
              <option value="">Choose an equipment node...</option>
              {assets.data.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.criticality ? `Crit ${a.criticality}` : a.tier || 'Asset'}] {a.name} ({a.code})
                </option>
              ))}
            </select>
            <div className="hint">Tip: Scanning the QR code on the machine pre-selects it instantly.</div>
          </div>

          {asset && (
            <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong>{asset.name}</strong>
                {asset.criticality && <CriticalityBadge grade={asset.criticality} />}
              </div>
              <dl className="facts" style={{ margin: 0 }}>
                <div><dt>Location</dt><dd>{asset.location}</dd></div>
                <div><dt>Warranty</dt><dd>{asset.under_warranty ? 'Active Warranty' : 'Out of Warranty'}</dd></div>
                <div><dt>Running Hours</dt><dd>{asset.running_hours ? `${asset.running_hours} h` : '—'}</dd></div>
              </dl>
            </div>
          )}

          {blocked && (
            <div className="note warn" style={{ marginTop: '0.5rem' }}>
              ⚠️ Invariant check: This machine already has an active work order (
              <Link to={`/jobs/${blocked}`}>WO #{blocked}</Link>). The open job must be closed before another can be raised.
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="panel stack">
          <div className="row">
            <div style={{ flex: 1 }}>
              <label htmlFor="din_type">DIN 31051 Activity Classification *</label>
              <select
                id="din_type"
                value={f.din_type}
                onChange={(e) => {
                  const val = e.target.value
                  set('din_type', val)
                  set('type', val === 'repair' ? 'repair' : 'scheduled')
                }}
              >
                <option value="repair">Repair (Instandsetzung) - Failure correction</option>
                <option value="servicing">Servicing (Wartung) - Preventative maintenance</option>
                <option value="inspection">Inspection (Inspektion) - Condition assessment</option>
                <option value="improvement">Improvement (Verbesserung) - Reliability upgrade</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label htmlFor="prio">Priority *</label>
              <select id="prio" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="title">Work Order Title *</label>
              <SpeechInput onTranscript={(text) => set('title', text)} />
            </div>
            <input
              id="title"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={f.din_type === 'repair' ? 'e.g. Spindle bearing temperature exceeding 85°C' : 'e.g. 500-hour preventive servicing'}
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="desc">Detailed Fault / Work Description</label>
              <SpeechInput
                onTranscript={(text) => set('description', f.description ? `${f.description} ${text}` : text)}
              />
            </div>
            <textarea
              id="desc"
              rows="3"
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe symptoms, error codes on HMI, or planned tasks..."
            />
          </div>

          <div className="row">
            <div style={{ flex: 1 }}>
              <label htmlFor="due">Target Due Date {f.din_type !== 'repair' && '*'}</label>
              <input
                id="due"
                type="date"
                required={f.din_type !== 'repair'}
                value={f.due_date}
                onChange={(e) => set('due_date', e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label htmlFor="hours">Estimated Hours</label>
              <input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                value={f.estimated_hours}
                onChange={(e) => set('estimated_hours', e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label htmlFor="est">Estimated Cost (₹)</label>
              <input
                id="est"
                type="number"
                min="0"
                value={f.estimated_cost}
                onChange={(e) => set('estimated_cost', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel stack">
          <div className="row">
            <div style={{ flex: 1 }}>
              <label htmlFor="who">Assign Internal Technician</label>
              <select id="who" value={f.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
                <option value="">(Unassigned)</option>
                {technicians.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label htmlFor="contractor">Or Assign External Contractor</label>
              <select id="contractor" value={f.contractor_id} onChange={(e) => set('contractor_id', e.target.value)}>
                <option value="">(None - Internal job)</option>
                {contractors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.contractor_company || 'Contractor'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Permit to Work / LOTO Safety Switch */}
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: f.loto_required ? 'var(--bad-bg)' : 'var(--paper)',
              border: `1px solid ${f.loto_required ? 'var(--bad)' : 'var(--line)'}`,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={f.loto_required}
                onChange={(e) => set('loto_required', e.target.checked)}
                style={{ width: '20px', height: '20px' }}
              />
              <div>
                <strong>Enforce Permit to Work / LOTO Isolation Checklist</strong>
                <div className="small muted">
                  Blocks technician/contractor from starting execution until physical safety sign-off is completed.
                </div>
              </div>
            </label>
          </div>

          <h3>Summary Verification</h3>
          <dl className="facts">
            <div><dt>Machine</dt><dd>{asset?.name} ({asset?.code})</dd></div>
            <div><dt>Classification</dt><dd><DinTypeBadge type={f.din_type} /></dd></div>
            <div><dt>Priority</dt><dd>{PRIORITY[f.priority]}</dd></div>
            <div><dt>Title</dt><dd>{f.title}</dd></div>
            {f.due_date && <div><dt>Target Due</dt><dd>{f.due_date}</dd></div>}
          </dl>
        </div>
      )}

      <div className="row" style={{ marginTop: '1.25rem' }}>
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {step < 2 && (
          <button className="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continue
          </button>
        )}
        {step === 2 && (
          <button className="primary" onClick={create}>
            Confirm & Create Work Order
          </button>
        )}
      </div>
    </div>
  )
}
