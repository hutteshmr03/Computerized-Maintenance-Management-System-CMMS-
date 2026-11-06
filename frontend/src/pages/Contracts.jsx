import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  ErrorNote,
  Loading,
  Modal,
  money,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

export default function Contracts() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: contracts, loading, error, reload } = useLoad(() => api.get('/api/contracts'))
  const { data: assets } = useLoad(() => api.get('/api/assets'))
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterType, setFilterType] = useState('')

  const filtered = (contracts || []).filter((c) => {
    return !filterType || c.contract_type === filterType
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Warranty & SLA Contracts</h1>
          <p className="muted" style={{ margin: 0 }}>
            Vendor service level agreements and warranty tracking. Automatic alerts before contract expiration.
          </p>
        </div>
        <div className="row">
          {can('contract.manage') && (
            <button className="primary" onClick={() => setShowAddModal(true)}>
              + Register Contract
            </button>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="panel row" style={{ padding: '12px', gap: '12px' }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '220px' }}>
          <option value="">All Contract Types</option>
          <option value="warranty">Manufacturer Warranty</option>
          <option value="service_sla">24/7 Service SLA</option>
          <option value="preventive_sla">Preventive Maintenance SLA</option>
        </select>
        <div className="small muted right">
          Tracking {filtered.length} active service agreements
        </div>
      </div>

      {loading && <Loading />}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>Vendor & Partner</th>
              <th style={{ padding: '12px' }}>Target Asset</th>
              <th style={{ padding: '12px' }}>Agreement Type</th>
              <th style={{ padding: '12px' }}>SLA Response</th>
              <th style={{ padding: '12px' }}>Annual Cost</th>
              <th style={{ padding: '12px' }}>Valid Period</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>
                  No service contracts recorded.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const endDate = new Date(c.end_date)
                const now = new Date()
                const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
                const expiringSoon = daysRemaining > 0 && daysRemaining <= 60

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{c.vendor_name}</strong>
                      {c.terms && <div className="small muted" style={{ maxWidth: '280px' }}>{c.terms}</div>}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <Link to={`/assets/${c.asset?.id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                        {c.asset?.name}
                      </Link>
                      <div className="small muted">{c.asset?.code} • {c.asset?.location}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span className="badge blue small" style={{ textTransform: 'capitalize' }}>
                        {c.contract_type.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      ⚡ {c.sla_response_hours} hours
                    </td>

                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {money(c.cost)}
                    </td>

                    <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                      <div>{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
                      {daysRemaining > 0 ? (
                        <div className={`small ${expiringSoon ? 'text-bad' : 'muted'}`}>
                          {daysRemaining} days remaining {expiringSoon && '⚠️ Renew soon'}
                        </div>
                      ) : (
                        <span className="small text-bad">Expired</span>
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span className={`badge ${daysRemaining > 0 ? 'green' : 'red'}`} style={{ textTransform: 'capitalize' }}>
                        {daysRemaining > 0 ? 'Active' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <CreateContractModal
          assets={assets || []}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            reload()
            toast('Service contract registered successfully.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function CreateContractModal({ assets, onClose, onAdded }) {
  const [assetId, setAssetId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [contractType, setContractType] = useState('warranty')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [slaHours, setSlaHours] = useState(4.0)
  const [cost, setCost] = useState('')
  const [terms, setTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post('/api/contracts', {
        asset_id: parseInt(assetId, 10),
        vendor_name: vendorName,
        contract_type: contractType,
        start_date: startDate,
        end_date: endDate,
        sla_response_hours: parseFloat(slaHours),
        cost: cost ? parseFloat(cost) : 0,
        terms,
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Register Warranty / SLA Contract" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div>
          <label>Target Machine / Asset *</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Select covered asset...</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Vendor / Contractor Company *</label>
            <input
              type="text"
              required
              placeholder="e.g. DMG Mori Services GmbH"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Agreement Type *</label>
            <select value={contractType} onChange={(e) => setContractType(e.target.value)}>
              <option value="warranty">Manufacturer Warranty</option>
              <option value="service_sla">24/7 Breakdown SLA</option>
              <option value="preventive_sla">Preventive Maintenance SLA</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Start Date *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>End Date *</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Guaranteed SLA Response (Hours) *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Contract Value (₹)</label>
            <input
              type="number"
              placeholder="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>Terms & Conditions / Coverage</label>
          <textarea
            rows="2"
            placeholder="e.g. 24/7 technician dispatch; covers all spindle and controller electronics."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Registering…' : 'Save Contract'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
