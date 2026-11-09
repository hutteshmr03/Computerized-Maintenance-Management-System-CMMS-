import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, Loading, Modal, useLoad, useToast, fmtDate } from '../ui.jsx'

function LogCalibrationModal({ assets, onClose, onSaved }) {
  const toast = useToast()
  const todayStr = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({
    asset_id: assets[0]?.id || '',
    last_calibrated_date: todayStr,
    next_due_date: '',
    calibrated_by: '',
    certificate_number: '',
    standard_used: 'ISO 9001 / DIN EN ISO 7500-1',
    result: 'pass',
    notes: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!f.asset_id) return setError('Please select an asset.')
    if (!f.next_due_date) return setError('Please enter the next calibration due date.')
    if (!f.certificate_number.trim()) return setError('Please enter a certificate number.')
    if (!f.calibrated_by.trim()) return setError('Please specify who performed the calibration.')

    setBusy(true)
    try {
      const res = await api.post('/api/calibrations', {
        asset_id: Number(f.asset_id),
        last_calibrated_date: f.last_calibrated_date,
        next_due_date: f.next_due_date,
        calibrated_by: f.calibrated_by.trim(),
        certificate_number: f.certificate_number.trim(),
        standard_used: f.standard_used.trim() || null,
        result: f.result,
        notes: f.notes.trim(),
      })
      toast(`Logged calibration ${res.certificate_number} for ${res.asset_code}`)
      onSaved(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Log Calibration Record" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorNote error={error} />
        <div className="field">
          <label htmlFor="cal-asset">Asset</label>
          <select
            id="cal-asset"
            value={f.asset_id}
            onChange={(e) => set('asset_id', e.target.value)}
            required
            autoFocus
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name} ({a.location})
              </option>
            ))}
          </select>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="cal-last">Last Calibrated Date</label>
            <input
              id="cal-last"
              type="date"
              value={f.last_calibrated_date}
              onChange={(e) => set('last_calibrated_date', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cal-next">Next Due Date</label>
            <input
              id="cal-next"
              type="date"
              value={f.next_due_date}
              onChange={(e) => set('next_due_date', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="cal-by">Calibrated By</label>
            <input
              id="cal-by"
              value={f.calibrated_by}
              onChange={(e) => set('calibrated_by', e.target.value)}
              placeholder="e.g. TÜV SÜD or Internal Metrology"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cal-cert">Certificate Number</label>
            <input
              id="cal-cert"
              value={f.certificate_number}
              onChange={(e) => set('certificate_number', e.target.value)}
              placeholder="e.g. CAL-2026-0142"
              required
            />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="cal-std">Standard Used</label>
            <input
              id="cal-std"
              value={f.standard_used}
              onChange={(e) => set('standard_used', e.target.value)}
              placeholder="e.g. ISO 230-1 / DIN 1945"
            />
          </div>
          <div className="field">
            <label htmlFor="cal-res">Result</label>
            <select
              id="cal-res"
              value={f.result}
              onChange={(e) => set('result', e.target.value)}
              required
            >
              <option value="pass">Pass (Certified within tolerance)</option>
              <option value="conditional">Conditional (Minor drift / advisory)</option>
              <option value="fail">Fail (Out of tolerance / action required)</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="cal-notes">Notes / Observations</label>
          <textarea
            id="cal-notes"
            rows="3"
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Environmental conditions, sensor drift notes, or recalibration recommendations..."
          />
        </div>

        <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save Calibration'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Calibration() {
  const { can, user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [filterDueSoon, setFilterDueSoon] = useState(false)

  const { data: calibrations, error, loading, reload } = useLoad(() => api.get('/api/calibrations'), [])
  const { data: assets } = useLoad(() => api.get('/api/assets'), [])

  const canManage = can('asset.create') || can('asset.edit') || can('calibration.manage') || ['super_admin', 'admin', 'plant_head'].includes(user?.role)

  const filtered = useMemo(() => {
    if (!calibrations) return []
    return calibrations.filter((c) => {
      if (selectedAsset && String(c.asset_id) !== String(selectedAsset)) return false
      if (filterDueSoon && !c.due_soon && !c.overdue) return false
      return true
    })
  }, [calibrations, selectedAsset, filterDueSoon])

  const dueSoonCount = (calibrations || []).filter((c) => c.due_soon || c.overdue).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Calibration Management</h1>
          <p className="lead">
            Ensure metrological traceability and standard compliance (ISO 9001, DIN EN ISO 7500-1).
          </p>
        </div>
        {canManage && (
          <button
            className="primary right"
            onClick={() => setModalOpen(true)}
            disabled={!assets || assets.length === 0}
          >
            + Log Calibration
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div className="row" style={{ alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 260, marginBottom: 0 }}>
            <label htmlFor="filter-asset">Filter by Asset</label>
            <select
              id="filter-asset"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
            >
              <option value="">All Assets ({assets?.length || 0})</option>
              {(assets || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={filterDueSoon}
                onChange={(e) => setFilterDueSoon(e.target.checked)}
                style={{ width: 'auto', minHeight: 0 }}
              />
              <span>
                Show only due within 30 days
                {dueSoonCount > 0 && (
                  <span className="badge amber small" style={{ marginLeft: 6 }}>
                    {dueSoonCount}
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>
      </div>

      <ErrorNote error={error} />
      {loading && !calibrations && <Loading />}

      {calibrations && filtered.length === 0 && (
        <Empty title="No calibration records match">
          {filterDueSoon
            ? 'No equipment calibrations are currently due or overdue in the next 30 days.'
            : 'Click "Log Calibration" to record the first certificate.'}
        </Empty>
      )}

      {filtered.length > 0 && (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Last Calibrated</th>
                <th>Next Due</th>
                <th>Certificate No.</th>
                <th>Standard Used</th>
                <th>Result</th>
                <th>Calibrated By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isDueSoon = c.due_soon || c.overdue
                return (
                  <tr
                    key={c.id}
                    style={
                      isDueSoon
                        ? { background: 'rgba(245, 158, 11, 0.12)' }
                        : undefined
                    }
                  >
                    <td>
                      <Link to={`/assets/${c.asset_id}`} style={{ fontWeight: 600 }}>
                        {c.asset_name}
                      </Link>
                      <span className="muted small" style={{ marginLeft: '6px' }}>
                        ({c.asset_code})
                      </span>
                    </td>
                    <td>{fmtDate(c.last_calibrated_date)}</td>
                    <td>
                      <span style={{ fontWeight: isDueSoon ? 600 : 'normal' }}>
                        {fmtDate(c.next_due_date)}
                      </span>
                      {c.overdue ? (
                        <span className="badge red small" style={{ marginLeft: '6px' }}>
                          Overdue
                        </span>
                      ) : c.due_soon ? (
                        <span className="badge amber small" style={{ marginLeft: '6px' }}>
                          Due soon
                        </span>
                      ) : null}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>
                      {c.certificate_number}
                    </td>
                    <td className="muted small">{c.standard_used || '—'}</td>
                    <td>
                      {c.result === 'pass' && (
                        <span className="badge green small">Pass</span>
                      )}
                      {c.result === 'fail' && (
                        <span className="badge red small">Fail</span>
                      )}
                      {c.result === 'conditional' && (
                        <span className="badge amber small">Conditional</span>
                      )}
                      {!['pass', 'fail', 'conditional'].includes(c.result) && (
                        <span className="badge grey small">{c.result}</span>
                      )}
                    </td>
                    <td className="muted small">{c.calibrated_by}</td>
                    <td className="muted small" style={{ maxWidth: 260 }}>
                      {c.notes || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <LogCalibrationModal
          assets={assets || []}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}
