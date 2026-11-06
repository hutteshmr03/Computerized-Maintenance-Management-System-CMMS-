import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  ErrorNote,
  Loading,
  Modal,
  fmtDateTime,
  useLoad,
  useToast,
} from '../ui.jsx'

const METRIC_DEFAULTS = {
  vibration: { unit: 'mm/s', warn: 4.5, crit: 7.1, label: 'Vibration Velocity' },
  temperature: { unit: '°C', warn: 75.0, crit: 90.0, label: 'Bearing / Oil Temperature' },
  oil_pressure: { unit: 'bar', warn: 2.5, crit: 1.5, label: 'Lube Oil Pressure' },
  running_hours: { unit: 'h', warn: 5000, crit: 8000, label: 'Operating Running Hours' },
}

export default function Readings() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: readings, loading, error, reload } = useLoad(() => api.get('/api/condition/readings'))
  const { data: assets } = useLoad(() => api.get('/api/assets'))
  const [showLogModal, setShowLogModal] = useState(false)
  const [filterAsset, setFilterAsset] = useState('')

  const filtered = (readings || []).filter((r) => {
    return !filterAsset || String(r.asset?.id) === String(filterAsset)
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Condition Monitoring & Sensors</h1>
          <p className="muted" style={{ margin: 0 }}>
            Real-time condition telemetry. Critical threshold breaches automatically trigger emergency repair work orders.
          </p>
        </div>
        <div className="row">
          {can('reading.log') && (
            <button className="primary" onClick={() => setShowLogModal(true)}>
              + Log Sensor Reading
            </button>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Threshold standard legend panel */}
      <div className="panel" style={{ backgroundColor: 'var(--paper)', padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
          ISO 10816 Condition Threshold Standards:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
          <div>⚡ Vibration: Warn &gt; 4.5 mm/s, Critical &gt; 7.1 mm/s</div>
          <div>🌡️ Temperature: Warn &gt; 75 °C, Critical &gt; 90 °C</div>
          <div>🛢️ Oil Pressure: Low Warn &lt; 2.5 bar, Critical &lt; 1.5 bar</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="panel row" style={{ padding: '12px', gap: '12px' }}>
        <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)} style={{ width: '250px' }}>
          <option value="">All Monitored Assets</option>
          {assets?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.code})
            </option>
          ))}
        </select>
        <div className="small muted right">
          Showing {filtered.length} recent telemetry readings
        </div>
      </div>

      {loading && <Loading />}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>Logged Time</th>
              <th style={{ padding: '12px' }}>Asset</th>
              <th style={{ padding: '12px' }}>Metric</th>
              <th style={{ padding: '12px' }}>Value</th>
              <th style={{ padding: '12px' }}>Threshold Limits</th>
              <th style={{ padding: '12px' }}>Condition Status</th>
              <th style={{ padding: '12px' }}>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>
                  No sensor readings recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {fmtDateTime(r.recorded_at)}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <Link to={`/assets/${r.asset?.id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                        {r.asset?.name}
                      </Link>
                      <div className="small muted">{r.asset?.code}</div>
                    </td>

                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                      <strong>{r.metric.replace('_', ' ')}</strong>
                    </td>

                    <td style={{ padding: '12px', fontSize: '1.05rem', fontWeight: 600 }}>
                      {r.value} {r.unit}
                    </td>

                    <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                      Warn: {r.threshold_warning || '—'} {r.unit} | Crit: {r.threshold_critical || '—'} {r.unit}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span
                        className={`badge ${
                          r.status === 'critical'
                            ? 'red'
                            : r.status === 'warning'
                            ? 'amber'
                            : 'green'
                        }`}
                        style={{ textTransform: 'capitalize', fontWeight: 600 }}
                      >
                        {r.status === 'critical' ? '🔴 Critical' : r.status === 'warning' ? '⚠️ Warning' : '✓ Normal'}
                      </span>
                    </td>

                    <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                      {r.recorded_by}
                      {r.notes && <div className="small muted">{r.notes}</div>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showLogModal && (
        <LogReadingModal
          assets={assets || []}
          onClose={() => setShowLogModal(false)}
          onAdded={(res) => {
            setShowLogModal(false)
            reload()
            if (res.auto_wo) {
              toast(`⚠️ Critical breach! Auto-generated emergency work order ${res.auto_wo.wo_number}.`, 'bad')
            } else {
              toast('Sensor reading logged successfully.', 'ok')
            }
          }}
        />
      )}
    </div>
  )
}

function LogReadingModal({ assets, onClose, onAdded }) {
  const [assetId, setAssetId] = useState('')
  const [metric, setMetric] = useState('vibration')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const defaults = METRIC_DEFAULTS[metric] || { unit: '', warn: 0, crit: 0 }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const res = await api.post('/api/condition/readings', {
        asset_id: parseInt(assetId, 10),
        metric,
        value: parseFloat(value),
        unit: defaults.unit,
        threshold_warning: defaults.warn,
        threshold_critical: defaults.crit,
        notes,
      })
      onAdded(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Log Manual Sensor Reading" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div>
          <label>Target Machine / Asset *</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select monitored asset...</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Measurement Metric *</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="vibration">Vibration Velocity (mm/s)</option>
              <option value="temperature">Bearing Temperature (°C)</option>
              <option value="oil_pressure">Lube Oil Pressure (bar)</option>
              <option value="running_hours">Running Hours (h)</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label>Reading Value ({defaults.unit}) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder={`e.g. ${defaults.warn}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
          <div>Warning Threshold: <strong>{defaults.warn} {defaults.unit}</strong></div>
          <div>Critical Emergency Threshold: <strong>{defaults.crit} {defaults.unit}</strong></div>
          <div className="small muted" style={{ marginTop: '4px' }}>
            Breaching the critical threshold will automatically raise a high-priority repair work order.
          </div>
        </div>

        <div>
          <label>Observations / Notes</label>
          <input
            type="text"
            placeholder="e.g. Measured at drive-end bearing with portable vibrometer"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Logging…' : 'Record Reading'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
