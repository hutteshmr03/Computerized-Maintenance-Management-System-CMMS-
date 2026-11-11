import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  DinTypeBadge,
  ErrorNote,
  Loading,
  Modal,
  Pill,
  PRIORITY,
  SpeechInput,
  StatusBadge,
  StepBar,
  fmtDate,
  fmtDateTime,
  money,
  num,
  useLoad,
  useToast,
} from '../ui.jsx'

const ACTION_LABEL = {
  send: 'Send for approval',
  approve: 'Approve',
  reject: 'Reject',
  assign: 'Assign',
  start: 'Start work',
  review: 'Submit for Review',
  close: 'Close job',
  revise: 'Revise and resubmit',
}

export default function JobDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const { data: job, error, loading, reload, setData } = useLoad(() => api.get(`/api/jobs/${id}`), [id], `job:${id}`)
  const parts = useLoad(() => api.get('/api/parts'), [], 'static:parts')
  const failureCodes = useLoad(() => api.get('/api/failure-codes'), [], 'static:failureCodes')
  const bomItems = useLoad(() => (job?.asset?.id ? api.get(`/api/assets/${job.asset.id}/bom`) : Promise.resolve([])), [job?.asset?.id], `asset_bom:${job?.asset?.id}`)
  const usersList = useLoad(() => api.get('/api/users'), [], 'static:users')

  const [err, setErr] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [signingLoto, setSigningLoto] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Work done inputs
  const [work, setWork] = useState({
    breakdown_reason: '',
    action_taken: '',
    failure_mode: '',
    failure_cause: '',
    failure_effect: '',
    labour_hours: 0,
    labour_rate: 0,
    contractor_invoice_amount: 0,
    contractor_invoice_ref: '',
  })

  const [pick, setPick] = useState({ part_id: '', qty: 1 })
  const [note, setNote] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (job) {
      setWork({
        breakdown_reason: job.breakdown_reason || '',
        action_taken: job.action_taken || '',
        failure_mode: job.failure_mode || '',
        failure_cause: job.failure_cause || '',
        failure_effect: job.failure_effect || '',
        labour_hours: job.labour_hours || 0,
        labour_rate: job.labour_rate || 0,
        contractor_invoice_amount: job.contractor_invoice_amount || 0,
        contractor_invoice_ref: job.contractor_invoice_ref || '',
      })
    }
  }, [job?.id, job?.status])

  if (loading && !job) return <Loading />
  if (error) return <ErrorNote error={error} />

  const run = async (fn, okMsg) => {
    setErr('')
    try {
      const j = await fn()
      setData(j)
      if (okMsg) toast(okMsg, 'ok')
      return j
    } catch (e) {
      setErr(e.message)
      toast(e.message, 'bad')
    }
  }

  const act = (action, extraBody = {}) => {
    const messages = {
      send: 'Sent for approval.',
      approve: 'Approved.',
      reject: 'Job rejected.',
      assign: 'Work order assigned successfully.',
      start: 'Work started.',
      review: 'Submitted for review.',
      close: 'Job closed & completed.',
      revise: 'Back to Created. Edit and send again.',
    }
    return run(() => api.post(`/api/jobs/${job.id}/action/${action}`, extraBody), messages[action])
  }

  const handleSignLoto = async () => {
    setSigningLoto(true)
    try {
      await api.post(`/api/jobs/${job.id}/loto/sign`)
      toast('Permit to Work / LOTO safety verification signed off.', 'ok')
      reload()
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setSigningLoto(false)
    }
  }

  const handleToggleChecklist = async (stepId) => {
    try {
      await api.post(`/api/jobs/${job.id}/checklists/${stepId}/toggle`)
      reload()
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const saveWork = () =>
    run(
      () =>
        api.put(`/api/jobs/${job.id}/work`, {
          ...work,
          labour_hours: Number(work.labour_hours) || 0,
          labour_rate: Number(work.labour_rate) || 0,
        }),
      'Work details saved.'
    )

  const addPart = (partId, qty) =>
    run(() => api.post(`/api/jobs/${job.id}/parts`, { part_id: Number(partId), qty: Number(qty) }), 'Part added.').then(() =>
      setPick({ part_id: '', qty: 1 })
    )

  const removePart = (jp) => run(() => api.del(`/api/jobs/${job.id}/parts/${jp.id}`), 'Part removed.')

  const uploadPhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('note', note)
    await run(() => api.upload(`/api/jobs/${job.id}/photos`, form), 'Photo attached.')
    setNote('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const working = (job.status === 'in_progress' || job.status === 'review') && can('job.work')
  const chosen = parts.data?.find((p) => String(p.id) === String(pick.part_id))
  const canPhoto = can('job.work') && ['created', 'approved', 'in_progress', 'review'].includes(job.status)

  // Filter failure codes relevant to asset category
  const relevantCodes = (failureCodes.data || []).filter(
    (fc) => !job.asset?.category || fc.asset_category?.toLowerCase() === job.asset?.category?.toLowerCase()
  )

  const handleSelectFailureCode = (codeStr) => {
    const match = (failureCodes.data || []).find((fc) => fc.code === codeStr)
    if (match) {
      setWork((prev) => ({
        ...prev,
        breakdown_reason: `${match.failure_mode}: ${match.failure_cause}`,
        failure_mode: match.failure_mode,
        failure_cause: match.failure_cause,
        failure_effect: match.failure_effect,
      }))
    }
  }

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <p className="small">
        <Link to="/jobs">← All work orders</Link> | <Link to="/kanban">Kanban board</Link>
      </p>

      {/* Header */}
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{job.wo_number || `WO-#${job.id}`}</span>
            <DinTypeBadge type={job.din_type} />
            {job.asset?.criticality && <CriticalityBadge grade={job.asset.criticality} />}
          </div>
          <h1 style={{ margin: 0 }}>{job.title}</h1>
          <p className="lead" style={{ margin: '4px 0 0' }}>
            Target Machine: <Link to={`/assets/${job.asset.id}`}>{job.asset.name} ({job.asset.code})</Link>
          </p>
        </div>

        <div className="right row" style={{ gap: '8px' }}>
          <Pill tone={job.priority === 'critical' ? 'red' : job.priority === 'high' ? 'amber' : 'grey'}>
            {PRIORITY[job.priority] || job.priority} priority
          </Pill>
          <StatusBadge status={job.status} />
        </div>
      </div>

      <StepBar status={job.status} />
      <ErrorNote error={err} />

      {/* PERMIT TO WORK / LOTO MANDATORY SAFETY BANNER */}
      {job.loto_required && (
        <div
          className="panel"
          style={{
            borderLeft: `5px solid ${job.loto_signed ? 'var(--ok)' : 'var(--bad)'}`,
            backgroundColor: job.loto_signed ? 'var(--ok-bg)' : 'var(--bad-bg)',
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong style={{ fontSize: '1rem', color: job.loto_signed ? 'var(--ok)' : 'var(--bad)' }}>
                {job.loto_signed ? '🔒 Permit to Work / LOTO Safety Verification Signed' : '⚠️ MANDATORY LOCKOUT / TAGOUT (LOTO) REQUIRED'}
              </strong>
              <div className="small" style={{ color: 'var(--ink)' }}>
                {job.loto_signed
                  ? `Signed off by ${job.loto_signed_by || 'Authorized Technician'} on ${fmtDateTime(job.loto_signed_at)}. Machinery electrically and hydraulically isolated.`
                  : 'High-risk machine: Zero-energy state isolation must be physically verified and signed before work can commence.'}
              </div>
            </div>

            {!job.loto_signed && can('job.loto_sign') && (
              <button
                type="button"
                className="primary"
                style={{ backgroundColor: 'var(--bad)', borderColor: 'var(--bad)', minHeight: '44px' }}
                disabled={signingLoto}
                onClick={handleSignLoto}
              >
                {signingLoto ? 'Verifying…' : '✍️ Sign LOTO Safety Permit'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rejection Notice */}
      {job.status === 'rejected' && (
        <div className="note bad">
          <strong>Work order rejected:</strong> {job.rejection_reason}
        </div>
      )}

      {/* Action Buttons Toolbar */}
      {job.actions.length > 0 && (
        <div className="row" style={{ gap: '8px' }}>
          {job.actions
            .filter((a) => a !== 'edit')
            .map((a) => {
              const isStartDisabled = a === 'start' && job.loto_required && !job.loto_signed
              return (
                <button
                  key={a}
                  className={
                    a === 'reject'
                      ? 'danger'
                      : a === 'approve' || a === 'start' || a === 'send' || a === 'close'
                      ? 'primary'
                      : a === 'assign'
                      ? 'btn'
                      : ''
                  }
                  disabled={isStartDisabled}
                  title={isStartDisabled ? 'You must sign the LOTO permit above before starting.' : undefined}
                  onClick={() => {
                    if (a === 'reject') setRejecting(true)
                    else if (a === 'close') setShowCloseModal(true)
                    else if (a === 'assign') {
                      setAssigneeId(job.assigned_to ? String(job.assigned_to) : '')
                      setContractorId(job.contractor_id ? String(job.contractor_id) : '')
                      setShowAssignModal(true)
                    }
                    else act(a)
                  }}
                >
                  {ACTION_LABEL[a] || a}
                </button>
              )
            })}
        </div>
      )}

      <div className="cols">
        <div className="stack">
          {/* Details Panel */}
          <section className="card">
            <h2>Work Order Specifications</h2>
            <dl className="facts">
              <div><dt>DIN 31051 Type</dt><dd><DinTypeBadge type={job.din_type} /></dd></div>
              <div><dt>Machine Location</dt><dd>{job.asset.location}</dd></div>
              <div>
                <dt>Assigned To</dt>
                <dd style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{job.assigned_to_name || 'Unassigned'}</span>
                  {job.actions.includes('assign') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(job.assigned_to ? String(job.assigned_to) : '')
                        setContractorId(job.contractor_id ? String(job.contractor_id) : '')
                        setShowAssignModal(true)
                      }}
                      className="btn small"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', border: '1px solid var(--bd)' }}
                      title="Assign or reassign technician"
                    >
                      ✏️ Change
                    </button>
                  )}
                </dd>
              </div>
              <div><dt>Contractor</dt><dd>{job.contractor_company ? `🏢 ${job.contractor_company}` : 'Internal'}</dd></div>
              <div><dt>Due Date</dt><dd className={job.overdue ? 'text-bad' : ''}>{job.due_date ? fmtDate(job.due_date) : 'Flexible'}{job.overdue ? ' (Overdue)' : ''}</dd></div>
              <div><dt>Warranty Status</dt><dd>{job.warranty ? 'Covered under warranty' : 'Out of warranty'}</dd></div>
              {job.start_time && <div><dt>Work Started</dt><dd>{fmtDateTime(job.start_time)}</dd></div>}
              {job.end_time && <div><dt>Work Finished</dt><dd>{fmtDateTime(job.end_time)} ({num(job.downtime_hours)} h downtime)</dd></div>}
            </dl>
            {job.description && (
              <div style={{ marginTop: '1rem', padding: '10px', backgroundColor: 'var(--paper)', borderRadius: '6px' }}>
                <strong>Fault Description:</strong>
                <p style={{ margin: '4px 0 0' }}>{job.description}</p>
              </div>
            )}
          </section>

          {/* DIGITAL STEP-BY-STEP CHECKLIST */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0 }}>Digital Step-by-Step Checklist</h2>
              <span className="small muted">
                {job.checklists?.filter((s) => s.completed).length || 0} / {job.checklists?.length || 0} completed
              </span>
            </div>

            {!job.checklists || job.checklists.length === 0 ? (
              <p className="muted">No specific procedure steps defined for this job.</p>
            ) : (
              <div className="stack" style={{ gap: '8px' }}>
                {job.checklists.map((step) => (
                  <label
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px',
                      borderRadius: '6px',
                      backgroundColor: step.completed ? 'var(--ok-bg)' : 'var(--paper)',
                      cursor: can('job.work') ? 'pointer' : 'default',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={step.completed}
                      disabled={!can('job.work') || job.status === 'closed'}
                      onChange={() => handleToggleChecklist(step.id)}
                      style={{ marginTop: '3px', width: '20px', height: '20px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ textDecoration: step.completed ? 'line-through' : 'none', fontWeight: 500 }}>
                        {step.step_number}. {step.description}
                        {step.mandatory && <span className="badge red small" style={{ marginLeft: '6px' }}>Mandatory</span>}
                      </div>
                      {step.completed && (
                        <div className="small muted">
                          ✓ Signed by {step.completed_by || 'Technician'} at {fmtDateTime(step.completed_at)}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* WORK DONE & ISO 14224 FAILURE CODES */}
          {(working || job.breakdown_reason || job.action_taken) && (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={{ margin: 0 }}>Work Execution & Failure Analysis (ISO 14224)</h2>
                {working && (
                  <SpeechInput
                    onTranscript={(text) =>
                      setWork((prev) => ({
                        ...prev,
                        action_taken: prev.action_taken ? `${prev.action_taken} ${text}` : text,
                      }))
                    }
                  />
                )}
              </div>

              {working ? (
                <div className="stack" style={{ gap: '12px' }}>
                  {job.type === 'repair' && (
                    <>
                      <div>
                        <label>ISO 14224 Failure Code Library</label>
                        <select onChange={(e) => handleSelectFailureCode(e.target.value)}>
                          <option value="">Select from ISO 14224 library...</option>
                          {relevantCodes.map((fc) => (
                            <option key={fc.code} value={fc.code}>
                              [{fc.code}] {fc.failure_mode} — {fc.failure_cause}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="row">
                        <div style={{ flex: 1 }}>
                          <label>Failure Mode</label>
                          <input
                            type="text"
                            placeholder="e.g. Spindle stall / overheat"
                            value={work.failure_mode}
                            onChange={(e) => setWork({ ...work, failure_mode: e.target.value })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label>Failure Cause</label>
                          <input
                            type="text"
                            placeholder="e.g. Bearing lubrication starvation"
                            value={work.failure_cause}
                            onChange={(e) => setWork({ ...work, failure_cause: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label>Failure Effect</label>
                        <input
                          type="text"
                          placeholder="e.g. Machine stop / workpiece scrap"
                          value={work.failure_effect}
                          onChange={(e) => setWork({ ...work, failure_effect: e.target.value })}
                        />
                      </div>

                      <div>
                        <label>Breakdown Root Reason *</label>
                        <input
                          type="text"
                          required
                          placeholder="Required before closing repair"
                          value={work.breakdown_reason}
                          onChange={(e) => setWork({ ...work, breakdown_reason: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label>Action Taken / Technical Work Done</label>
                    <textarea
                      rows="3"
                      placeholder="Detail repairs, alignment measurements, and verification testing performed..."
                      value={work.action_taken}
                      onChange={(e) => setWork({ ...work, action_taken: e.target.value })}
                    />
                  </div>

                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <label>Labour Hours (h)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={work.labour_hours}
                        onChange={(e) => setWork({ ...work, labour_hours: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Labour Rate (₹/h)</label>
                      <input
                        type="number"
                        min="0"
                        value={work.labour_rate}
                        onChange={(e) => setWork({ ...work, labour_rate: e.target.value })}
                      />
                    </div>
                  </div>

                  {job.contractor_id && (
                    <div className="row">
                      <div style={{ flex: 1 }}>
                        <label>Contractor Invoice Ref</label>
                        <input
                          type="text"
                          placeholder="e.g. INV-2026-901"
                          value={work.contractor_invoice_ref}
                          onChange={(e) => setWork({ ...work, contractor_invoice_ref: e.target.value })}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>Contractor Invoice (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={work.contractor_invoice_amount}
                          onChange={(e) => setWork({ ...work, contractor_invoice_amount: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <button type="button" className="primary" onClick={saveWork}>
                    Save Work Details
                  </button>
                </div>
              ) : (
                <dl className="facts">
                  {job.breakdown_reason && <div><dt>Root Cause</dt><dd>{job.breakdown_reason}</dd></div>}
                  {job.failure_mode && <div><dt>Failure Mode</dt><dd>{job.failure_mode}</dd></div>}
                  {job.action_taken && <div><dt>Action Taken</dt><dd>{job.action_taken}</dd></div>}
                </dl>
              )}
            </section>
          )}

          {/* Photos */}
          <section className="card">
            <h2>Work Photos & Visual Records</h2>
            {job.photos.length === 0 && <p className="muted">No photos attached yet.</p>}
            <div className="photos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {job.photos.map((p) => (
                <figure key={p.id} style={{ margin: 0 }}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.note || 'Photo'} style={{ width: '100%', borderRadius: '4px', height: '100px', objectFit: 'cover' }} />
                  </a>
                  <figcaption className="small muted">{p.note}</figcaption>
                </figure>
              ))}
            </div>

            {canPhoto && (
              <div style={{ marginTop: '1rem' }} className="row">
                <input
                  type="text"
                  placeholder="Note (e.g. Damaged seal before overhaul)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ flex: 1 }}
                />
                <label className="btn" style={{ cursor: 'pointer' }}>
                  📷 Attach Photo
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={uploadPhoto} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Right column: Spare parts & Cost Centre Budgeting */}
        <div className="stack">
          {/* Spare Parts Section */}
          <section className="card">
            <h2>Spare Parts & Bill of Materials (BOM)</h2>

            {/* BOM Quick-add recommendation */}
            {working && bomItems.data && bomItems.data.length > 0 && (
              <div style={{ backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Asset Bill of Materials (BOM) Items:
                </div>
                <div className="stack" style={{ gap: '6px' }}>
                  {bomItems.data.map((b) => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>{b.name} ({b.sku})</span>
                      <button
                        type="button"
                        className="small"
                        onClick={() => addPart(b.part_id, b.qty_recommended)}
                      >
                        + Add {b.qty_recommended} {b.unit}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {job.parts.length === 0 ? (
              <p className="muted">No spare parts issued to this work order.</p>
            ) : (
              <div className="table-wrap">
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Cost</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {job.parts.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td style={{ textAlign: 'right' }}>{p.qty}</td>
                        <td style={{ textAlign: 'right' }}>{money(p.qty * p.unit_cost)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {working && (
                            <button
                              type="button"
                              className="danger small"
                              onClick={() => removePart(p)}
                              style={{ padding: '2px 6px' }}
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {working && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                <label>Add Spare Part from Inventory</label>
                <select
                  value={pick.part_id}
                  onChange={(e) => setPick({ ...pick, part_id: e.target.value })}
                  style={{ width: '100%', marginBottom: '6px' }}
                >
                  <option value="">Select inventory part...</option>
                  {parts.data?.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.stock === 0}>
                      {p.name} ({p.stock} in {p.location_bin})
                    </option>
                  ))}
                </select>

                {chosen && chosen.stock <= chosen.min_level && (
                  <div className="small text-bad" style={{ marginBottom: '6px' }}>
                    ⚠️ Low stock: only {chosen.stock} units remaining.
                  </div>
                )}

                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input
                    type="number"
                    min="1"
                    value={pick.qty}
                    onChange={(e) => setPick({ ...pick, qty: e.target.value })}
                    style={{ width: '80px' }}
                  />
                  <button
                    type="button"
                    disabled={!pick.part_id}
                    onClick={() => addPart(pick.part_id, pick.qty)}
                  >
                    Issue Part
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Cost Centre & Budget Tracking */}
          <section className="card">
            <h2>Cost Accounting</h2>
            <dl className="facts" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><dt>Cost Centre</dt><dd>{job.cost_centre_name || 'Standard Plant'}</dd></div>
              <div><dt>Budget Spent</dt><dd>{money(job.total_cost)}</dd></div>
              <div><dt>Parts Cost</dt><dd>{money(job.parts_cost)}</dd></div>
              <div><dt>Labour Cost</dt><dd>{money(job.labour_cost)}</dd></div>
              {job.contractor_invoice_amount > 0 && (
                <div><dt>Vendor Invoice</dt><dd>{money(job.contractor_invoice_amount)}</dd></div>
              )}
            </dl>
          </section>
        </div>
      </div>

      {/* Reject Modal */}
      {rejecting && (
        <Modal title="Reject Work Order" onClose={() => setRejecting(false)}>
          <div className="stack">
            <div>
              <label>State Reason for Rejection *</label>
              <textarea
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setRejecting(false)}>Cancel</button>
              <button
                className="danger"
                disabled={!rejectionReason.trim()}
                onClick={async () => {
                  await act('reject', { reason: rejectionReason })
                  setRejecting(false)
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close & Complete Modal */}
      {showCloseModal && (
        <Modal title={`Close & Complete ${job.wo_number}`} onClose={() => setShowCloseModal(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setShowCloseModal(false)
              await act('close', {
                breakdown_reason: work.breakdown_reason,
                action_taken: work.action_taken,
                failure_mode: work.failure_mode,
                failure_cause: work.failure_cause,
                failure_effect: work.failure_effect,
              })
            }}
            className="stack"
          >
            {job.type === 'repair' && !work.breakdown_reason && (
              <div>
                <label>Root Breakdown Reason * (Required before closing repairs)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bearing fatigue / thermal seizure"
                  value={work.breakdown_reason}
                  onChange={(e) => setWork({ ...work, breakdown_reason: e.target.value })}
                />
              </div>
            )}

            <div>
              <label>Work Summary</label>
              <textarea
                rows="3"
                placeholder="Final completion notes..."
                value={work.action_taken}
                onChange={(e) => setWork({ ...work, action_taken: e.target.value })}
              />
            </div>

            <p className="small muted">
              Closing this job records the downtime hours, deducts used spare parts from inventory stock, and books maintenance expenses to the cost centre.
            </p>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button type="submit" className="primary">Confirm Job Closure</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Work Order Modal */}
      {showAssignModal && (
        <Modal title="Assign Work Order" onClose={() => setShowAssignModal(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!assigneeId && !contractorId) {
                toast('Please select a technician or contractor.', 'bad')
                return
              }
              setAssigning(true)
              try {
                const updated = await api.post(`/api/jobs/${job.id}/action/assign`, {
                  assigned_to: assigneeId ? Number(assigneeId) : null,
                  contractor_id: contractorId ? Number(contractorId) : null,
                })
                setData(updated)
                toast('Work order assigned successfully.', 'ok')
                setShowAssignModal(false)
              } catch (err) {
                toast(err.message || 'Failed to assign work order.', 'bad')
              } finally {
                setAssigning(false)
              }
            }}
            className="stack"
            style={{ gap: '14px' }}
          >
            <div>
              <p className="small muted" style={{ margin: '0 0 12px', fontSize: '13px' }}>
                Assign technician or service contractor to execute <strong>{job.wo_number}</strong>: <em>{job.title}</em>.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--mu)', marginBottom: '5px' }}>
                Internal Assignee (Technician / Engineer)
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- Select Technician / Engineer --</option>
                {usersList.data
                  ?.filter((u) => ['technician', 'maintenance_engineer', 'maintenance_manager', 'admin'].includes(u.role))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.replace(/_/g, ' ')})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--mu)', marginBottom: '5px' }}>
                External Contractor (Optional)
              </label>
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- None (Internal Maintenance) --</option>
                {usersList.data
                  ?.filter((u) => u.contractor_company || u.role === 'contractor')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.contractor_company || 'Contractor'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn" onClick={() => setShowAssignModal(false)} disabled={assigning}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={assigning}>
                {assigning ? 'Assigning…' : 'Save Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
