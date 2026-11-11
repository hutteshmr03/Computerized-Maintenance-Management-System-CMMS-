import { useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  Empty,
  ErrorNote,
  JobRow,
  Loading,
  Modal,
  Pill,
  fmtDate,
  fmtDateTime,
  money,
  num,
  useLoad,
  useToast,
} from '../ui.jsx'

export default function AssetDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const { data: a, error, loading, reload } = useLoad(() => api.get(`/api/assets/${id}`), [id], `asset:${id}`)
  const locs = useLoad(() => api.get('/api/locations'), [], 'static:locs')
  const parts = useLoad(() => api.get('/api/parts'), [], 'static:parts')
  const [tab, setTab] = useState('jobs')
  const [target, setTarget] = useState('')
  const [err, setErr] = useState('')

  // Modals
  const [showUploadDoc, setShowUploadDoc] = useState(false)
  const [showAddBom, setShowAddBom] = useState(false)

  if (loading && !a) return <Loading />
  if (error) return <ErrorNote error={error} />

  const scanUrl = `${window.location.origin}/scan/${a.code}`
  const transfer = async () => {
    setErr('')
    try {
      await api.post(`/api/assets/${a.id}/transfer`, { to_location_id: Number(target) })
      toast('Transfer requested. A manager will review and approve.', 'ok')
      setTarget('')
      reload()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <p className="small">
        <Link to="/assets">← Assets list</Link> | <Link to="/hierarchy">Asset tree hierarchy</Link>
      </p>

      <div className="page-head">
        <div>
          <div className="row" style={{ gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.code}</span>
            <span className="badge grey" style={{ textTransform: 'capitalize' }}>Tier: {a.tier || 'Asset'}</span>
            {a.criticality && <CriticalityBadge grade={a.criticality} />}
            {a.under_warranty && <span className="badge green">Warranty Active</span>}
          </div>
          <h1 style={{ margin: 0 }}>{a.name}</h1>
          <p className="lead" style={{ margin: '4px 0 0' }}>
            {a.category || 'Equipment'} • {a.manufacturer ? `Mfg: ${a.manufacturer}` : ''} {a.serial_number ? `(S/N: ${a.serial_number})` : ''}
          </p>
        </div>

        <div className="right row" style={{ gap: '8px' }}>
          {can('job.create') && (
            <Link className="btn primary" to={`/jobs/new?asset_id=${a.id}`}>
              + Raise Work Order
            </Link>
          )}
        </div>
      </div>

      {a.open_job_id && (
        <div className="note warn">
          ⚠️ Open Work Order Active: <Link to={`/jobs/${a.open_job_id}`}>WO #{a.open_job_id}</Link> must be completed before raising another job on this equipment.
        </div>
      )}

      {/* Main Details and QR Card */}
      <div className="cols">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>Equipment Specification (ISO 55001)</h2>
              <span className="badge grey small">Technical Specs</span>
            </div>
            <dl className="facts">
              <div>
                <dt>Physical Location</dt>
                <dd>{a.location}</dd>
              </div>
              <div>
                <dt>Cost Centre</dt>
                <dd>{a.cost_centre || 'Standard Plant'}</dd>
              </div>
              <div>
                <dt>Mobility</dt>
                <dd>{a.is_movable ? 'Movable Equipment' : 'Fixed Installation'}</dd>
              </div>
              <div>
                <dt>Running Hours</dt>
                <dd>{a.running_hours != null ? `${a.running_hours} h` : '—'}</dd>
              </div>
              <div>
                <dt>Replacement Value</dt>
                <dd>{money(a.replacement_value)}</dd>
              </div>
              <div>
                <dt>Installation Date</dt>
                <dd>{a.install_date ? fmtDate(a.install_date) : '—'}</dd>
              </div>
              <div>
                <dt>Expected Life</dt>
                <dd>{a.expected_life_years ? `${a.expected_life_years} years` : '—'}</dd>
              </div>
              <div>
                <dt>Hierarchy Parent</dt>
                <dd>{a.parent ? `${a.parent.name} (${a.parent.code})` : 'Top Node'}</dd>
              </div>
            </dl>
          </div>

          {a.is_movable && can('asset.transfer') && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--bd)', paddingTop: '12px' }}>
              <h3 style={{ fontSize: '13px', marginBottom: '8px' }}>Relocate Asset (Location Transfer)</h3>
              {a.pending_transfer ? (
                <p className="muted small">A transfer request for this equipment is currently pending manager approval.</p>
              ) : (
                <>
                  <ErrorNote error={err} />
                  <div className="row" style={{ flexWrap: 'nowrap', gap: '8px' }}>
                    <select
                      aria-label="New location"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select target destination...</option>
                      {locs.data?.filter((l) => l.name !== a.location).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <button onClick={transfer} disabled={!target} className="primary small">
                      Request Transfer
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx)' }}>Equipment QR Tag</h2>
              <span className="badge blue small" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', padding: '3px 8px' }}>{a.code}</span>
            </div>

            <div className="qr-box" style={{ display: 'flex', gap: '18px', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--bd)' }}>
              <div className="qr-frame" style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid var(--bd)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)' }}>
                <QRCodeSVG value={scanUrl} size={144} level="M" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--tx)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                  {a.name}
                </div>
                <p className="small muted" style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: 'var(--mu)' }}>
                  Industrial identification tag. Scanning directly opens equipment context and telemetry in under 2 seconds.
                </p>
                <div className="row" style={{ gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="small bt primary"
                    style={{ fontWeight: 600, padding: '7px 14px' }}
                  >
                    Print QR Tag
                  </button>
                  <a
                    href={scanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="small bt"
                    style={{ fontWeight: 500, padding: '7px 14px' }}
                  >
                    Test Scan ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden print label: strictly for window.print() output */}
          <div className="label-print" style={{ display: 'none' }} aria-hidden="true">
            <QRCodeSVG value={scanUrl} size={180} level="H" />
            <div style={{ fontWeight: 800, fontSize: 20, marginTop: '12px', letterSpacing: '0.05em' }}>
              {a.code}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: '4px' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: '4px' }}>
              {a.category || 'Equipment'} • {a.location}
            </div>
          </div>
        </section>
      </div>

      {/* Tabs Section */}
      <div style={{ marginTop: '1rem' }}>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'jobs'} onClick={() => setTab('jobs')}>
            Work Orders ({a.jobs?.length || 0})
          </button>
          <button role="tab" aria-selected={tab === 'documents'} onClick={() => setTab('documents')}>
            Documents & Manuals ({a.documents?.length || 0})
          </button>
          <button role="tab" aria-selected={tab === 'bom'} onClick={() => setTab('bom')}>
            Bill of Materials ({a.bom?.length || 0})
          </button>
          <button role="tab" aria-selected={tab === 'readings'} onClick={() => setTab('readings')}>
            Condition Telemetry ({a.readings?.length || 0})
          </button>
          <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
            Location Log ({a.history?.length || 0})
          </button>
        </div>

        {/* Tab 1: Work orders */}
        {tab === 'jobs' && (
          <div>
            {!a.jobs || a.jobs.length === 0 ? (
              <Empty title="No work orders on record">
                Report a problem or trigger scheduled servicing to begin maintenance logging.
              </Empty>
            ) : (
              <div className="tickets">
                {a.jobs.map((j) => (
                  <JobRow key={j.id} job={j} showAsset={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Documents */}
        {tab === 'documents' && (
          <div className="card stack" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Attached Manuals, CE Certificates & Schematics</h3>
              {can('asset.create') && (
                <button className="small primary" onClick={() => setShowUploadDoc(true)}>
                  + Upload Document
                </button>
              )}
            </div>

            {!a.documents || a.documents.length === 0 ? (
              <p className="muted">No technical manuals or calibration certificates attached yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title & File</th>
                      <th>Document Type</th>
                      <th>Version</th>
                      <th>Uploaded By</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.documents.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>📄 {d.title}</strong>
                          <div className="small muted">{d.filename}</div>
                        </td>
                        <td>
                          <span className="badge blue small" style={{ textTransform: 'uppercase' }}>
                            {d.doc_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>v{d.version}</td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {d.uploaded_by}
                          <div className="small muted">{fmtDate(d.uploaded_at)}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <a href={d.url} target="_blank" rel="noreferrer" className="btn small">
                            Download 📥
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Bill of Materials (BOM) */}
        {tab === 'bom' && (
          <div className="card stack" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Asset Bill of Materials (BOM)</h3>
              {can('bom.manage') && (
                <button className="small primary" onClick={() => setShowAddBom(true)}>
                  + Add Spare Part to BOM
                </button>
              )}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              These components automatically pre-fill work orders raised against this equipment.
            </p>

            {!a.bom || a.bom.length === 0 ? (
              <p className="muted">No spare parts linked to this asset's BOM.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Component Name</th>
                      <th>SKU</th>
                      <th>Recommended Qty</th>
                      <th>Warehouse Stock</th>
                      <th>Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.bom.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{b.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{b.sku}</td>
                        <td style={{ fontWeight: 600 }}>
                          {b.qty_recommended} {b.unit}
                        </td>
                        <td>
                          <span className={`badge ${b.stock <= 4 ? 'amber' : 'green'} small`}>
                            {b.stock} {b.unit} available
                          </span>
                        </td>
                        <td>{money(b.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Condition Telemetry */}
        {tab === 'readings' && (
          <div className="card stack" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Recent Condition Monitoring Telemetry</h3>
              <Link to="/readings" className="btn small">
                All Sensor Logs →
              </Link>
            </div>

            {!a.readings || a.readings.length === 0 ? (
              <p className="muted">No manual sensor measurements recorded for this machine.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Condition</th>
                      <th>Technician</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.readings.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtDateTime(r.recorded_at)}</td>
                        <td style={{ textTransform: 'capitalize' }}>
                          {r.metric.replace('_', ' ')}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {r.value} {r.unit}
                        </td>
                        <td>
                          <span className={`badge ${r.status === 'critical' ? 'red' : r.status === 'warning' ? 'amber' : 'green'} small`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.recorded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Location History */}
        {tab === 'history' && (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Origin</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {a.history.map((h, i) => (
                  <tr key={i}>
                    <td>{fmtDateTime(h.at)}</td>
                    <td>{h.from || 'Installation'}</td>
                    <td><strong>{h.to}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUploadDoc && (
        <UploadDocModal
          assetId={a.id}
          onClose={() => setShowUploadDoc(false)}
          onSuccess={() => {
            setShowUploadDoc(false)
            reload()
            toast('Technical document attached.', 'ok')
          }}
        />
      )}

      {showAddBom && (
        <AddBomModal
          assetId={a.id}
          parts={parts.data || []}
          onClose={() => setShowAddBom(false)}
          onSuccess={() => {
            setShowAddBom(false)
            reload()
            toast('Part added to Bill of Materials.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function UploadDocModal({ assetId, onClose, onSuccess }) {
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('manual')
  const [version, setVersion] = useState('1.0')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setErr('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', title)
      form.append('doc_type', docType)
      form.append('version', version)
      form.append('notes', notes)
      await api.upload(`/api/assets/${assetId}/documents`, form)
      onSuccess()
    } catch (e) {
      setErr(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="Attach Equipment Document" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div>
          <label>Document Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Electrical Manifold Schematic DIN EN 61082"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Document Type *</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="manual">Operation & Maintenance Manual</option>
              <option value="ce_certificate">CE Declaration of Conformity</option>
              <option value="calibration">Calibration Protocol (ISO 17025)</option>
              <option value="schematic">Hydraulic / Electrical Schematic</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label>Revision / Version *</label>
            <input
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>File Upload (PDF, DWG, Image) *</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <div>
          <label>Notes / Context</label>
          <input
            type="text"
            placeholder="e.g. TÜV Rheinland certified overhaul document"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Attach Document'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddBomModal({ assetId, parts, onClose, onSuccess }) {
  const [partId, setPartId] = useState('')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post(`/api/assets/${assetId}/bom`, {
        part_id: parseInt(partId, 10),
        qty_recommended: parseInt(qty, 10),
        notes,
      })
      onSuccess()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Item to Bill of Materials (BOM)" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div>
          <label>Select Spare Part *</label>
          <select required value={partId} onChange={(e) => setPartId(e.target.value)}>
            <option value="">Choose spare part from catalog...</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {money(p.unit_cost)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Recommended Quantity per Job *</label>
          <input
            type="number"
            min="1"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>

        <div>
          <label>Application Notes</label>
          <input
            type="text"
            placeholder="e.g. Recommended replacement on every 500h service interval"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add to BOM'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
