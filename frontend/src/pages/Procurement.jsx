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

export default function Procurement() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: requests, loading, error, reload } = useLoad(() => api.get('/api/procurement/requests'))
  const { data: parts } = useLoad(() => api.get('/api/parts'))
  const [showAddModal, setShowAddModal] = useState(false)
  const [preselectedPartId, setPreselectedPartId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const lowStockParts = (parts || []).filter((p) => p.low)

  const handleAction = async (prId, action) => {
    try {
      await api.post(`/api/procurement/requests/${prId}/action/${action}`)
      toast(`Purchase request updated (${action}).`, 'ok')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const openNewPrForPart = (partId) => {
    setPreselectedPartId(partId)
    setShowAddModal(true)
  }

  const filteredRequests = (requests || []).filter((r) => {
    return !filterStatus || r.status === filterStatus
  })

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Spare Parts Procurement Workflow</h1>
          <p className="muted" style={{ margin: 0 }}>
            Automated stock monitoring: Reorder → Purchase Request → Approval → Order → Warehouse Receipt.
          </p>
        </div>
        <div className="row">
          {can('procurement.manage') && (
            <button className="primary" onClick={() => { setPreselectedPartId(''); setShowAddModal(true) }}>
              + Create Purchase Request
            </button>
          )}
          <Link to="/parts" className="btn">
            Parts Inventory
          </Link>
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Low stock reorder alert banner */}
      {lowStockParts.length > 0 && (
        <div
          className="panel"
          style={{
            backgroundColor: 'var(--warn-bg)',
            borderLeft: '4px solid var(--warn)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong style={{ color: 'var(--warn)' }}>⚠️ {lowStockParts.length} Parts Below Reorder Level</strong>
              <div className="small muted">Stock levels have dropped below safe minimum thresholds.</div>
            </div>
            <div className="row" style={{ gap: '8px' }}>
              {lowStockParts.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className="small"
                  onClick={() => openNewPrForPart(p.id)}
                  style={{ backgroundColor: '#ffffff', borderColor: 'var(--warn)' }}
                >
                  Order {p.name} ({p.order_qty} {p.unit})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="panel row" style={{ padding: '12px', gap: '12px' }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '200px' }}>
          <option value="">All PR Statuses</option>
          <option value="requested">Requested (Pending Approval)</option>
          <option value="approved">Approved</option>
          <option value="ordered">Ordered from Vendor</option>
          <option value="received">Received in Warehouse</option>
        </select>
        <div className="small muted right">
          Showing {filteredRequests.length} purchase requests
        </div>
      </div>

      {loading && <Loading />}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>PR Number</th>
              <th style={{ padding: '12px' }}>Spare Part</th>
              <th style={{ padding: '12px' }}>Order Qty</th>
              <th style={{ padding: '12px' }}>Est. Cost</th>
              <th style={{ padding: '12px' }}>Vendor</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Workflow Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>
                  No purchase requests found.
                </td>
              </tr>
            ) : (
              filteredRequests.map((r) => {
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {r.pr_number}
                      <div className="small muted">{fmtDate(r.created_at)}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{r.part?.name}</div>
                      <div className="small muted">
                        SKU: {r.part?.sku} • Curr Stock: {r.part?.stock}
                      </div>
                    </td>

                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {r.qty} pcs
                    </td>

                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {money(r.estimated_cost)}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {r.vendor || 'Standard Supplier'}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span
                        className={`badge ${
                          r.status === 'received'
                            ? 'green'
                            : r.status === 'ordered'
                            ? 'blue'
                            : r.status === 'approved'
                            ? 'amber'
                            : 'grey'
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        {r.status === 'requested' && can('procurement.approve') && (
                          <button
                            type="button"
                            className="small ok"
                            style={{ backgroundColor: 'var(--ok)', color: '#fff' }}
                            onClick={() => handleAction(r.id, 'approve')}
                          >
                            ✓ Approve
                          </button>
                        )}

                        {r.status === 'approved' && can('procurement.manage') && (
                          <button
                            type="button"
                            className="small primary"
                            onClick={() => handleAction(r.id, 'order')}
                          >
                            📦 Place Order
                          </button>
                        )}

                        {r.status === 'ordered' && can('procurement.manage') && (
                          <button
                            type="button"
                            className="small ok"
                            style={{ backgroundColor: 'var(--ok)', color: '#fff' }}
                            onClick={() => handleAction(r.id, 'receive')}
                            title="Receive goods into stock (increments inventory level)"
                          >
                            📥 Mark Received
                          </button>
                        )}

                        {r.status === 'received' && (
                          <span className="small muted">Stock Replenished</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <CreatePRModal
          initialPartId={preselectedPartId}
          parts={parts || []}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            reload()
            toast('Purchase request submitted.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function CreatePRModal({ initialPartId, parts, onClose, onAdded }) {
  const [partId, setPartId] = useState(initialPartId || '')
  const [qty, setQty] = useState(10)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const selectedPart = parts.find((p) => String(p.id) === String(partId))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post('/api/procurement/requests', {
        part_id: parseInt(partId, 10),
        qty: parseInt(qty, 10),
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Create Purchase Request" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div>
          <label>Spare Part *</label>
          <select required value={partId} onChange={(e) => setPartId(e.target.value)}>
            <option value="">Select spare part...</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — Stock: {p.stock} / Min: {p.min_level}
              </option>
            ))}
          </select>
        </div>

        {selectedPart && (
          <div style={{ backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
            <div>Vendor: <strong>{selectedPart.vendor}</strong></div>
            <div>Unit Cost: <strong>{money(selectedPart.unit_cost)}</strong></div>
            <div>Bin Location: <strong>{selectedPart.location_bin}</strong></div>
          </div>
        )}

        <div>
          <label>Quantity to Order *</label>
          <input
            type="number"
            min="1"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>

        {selectedPart && (
          <div>
            <label>Estimated Total Cost</label>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)' }}>
              {money(selectedPart.unit_cost * (qty || 0))}
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
