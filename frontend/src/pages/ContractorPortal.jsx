import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  DinTypeBadge,
  ErrorNote,
  Loading,
  Modal,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

export default function ContractorPortal() {
  const { user } = useAuth()
  const toast = useToast()
  const { data: jobs, loading, error, reload } = useLoad(() => api.get('/api/contractor/jobs'))
  const [activeJobModal, setActiveJobModal] = useState(null)

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>External Contractor Portal</h1>
          <p className="muted" style={{ margin: 0 }}>
            Welcome, {user.name} ({user.contractor_company || 'Authorized Vendor'}). Showing work orders assigned to your organization.
          </p>
        </div>
        <div className="row">
          <span className="badge purple" style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
            🏢 {user.contractor_company || 'Contractor'}
          </span>
        </div>
      </div>

      <ErrorNote error={error} />

      {loading && <Loading />}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '12px' }}>WO Number</th>
              <th style={{ padding: '12px' }}>Work Order Title</th>
              <th style={{ padding: '12px' }}>Asset & Location</th>
              <th style={{ padding: '12px' }}>DIN Type</th>
              <th style={{ padding: '12px' }}>Due Date</th>
              <th style={{ padding: '12px' }}>Safety / LOTO</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!jobs || jobs.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-3)' }}>
                  No jobs currently assigned to your vendor account.
                </td>
              </tr>
            ) : (
              jobs.map((j) => {
                return (
                  <tr key={j.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {j.wo_number || `#${j.id}`}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{j.title}</strong>
                      <div className="small muted">{j.priority.toUpperCase()} priority</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{j.asset?.name || j.asset}</div>
                      <div className="small muted">{j.asset?.code || j.asset_code}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <DinTypeBadge type={j.din_type} />
                    </td>

                    <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                      {j.due_date ? fmtDate(j.due_date) : 'Flexible'}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {j.loto_required ? (
                        <span className={`badge ${j.loto_signed ? 'green' : 'red'} small`}>
                          {j.loto_signed ? '🔒 LOTO Signed' : '⚠️ LOTO Required'}
                        </span>
                      ) : (
                        <span className="small muted">Standard</span>
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <span className="badge blue" style={{ textTransform: 'capitalize' }}>
                        {j.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <Link to={`/jobs/${j.id}`} className="btn small">
                          Open Job →
                        </Link>
                        {j.status === 'in_progress' && (
                          <button
                            type="button"
                            className="small ok"
                            style={{ backgroundColor: 'var(--ok)', color: '#fff' }}
                            onClick={() => setActiveJobModal(j)}
                          >
                            Submit Invoice
                          </button>
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

      {activeJobModal && (
        <SubmitInvoiceModal
          job={activeJobModal}
          onClose={() => setActiveJobModal(null)}
          onSuccess={() => {
            setActiveJobModal(null)
            reload()
            toast('Completion & invoice submitted to plant manager for review.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function SubmitInvoiceModal({ job, onClose, onSuccess }) {
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [workNotes, setWorkNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErr('')
    try {
      // 1. Update work log
      if (workNotes) {
        await api.put(`/api/jobs/${job.id}/work`, {
          action_taken: workNotes,
        })
      }
      // 2. Transition to review with invoice details
      await api.post(`/api/jobs/${job.id}/action/review`, {
        contractor_invoice_amount: parseFloat(invoiceAmount),
        contractor_invoice_ref: invoiceRef,
      })
      onSuccess()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Submit Work & Invoice for ${job.wo_number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />

        <div style={{ backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
          <div>Work Order: <strong>{job.title}</strong></div>
          <div>Machine: <strong>{job.asset?.name || job.asset}</strong></div>
        </div>

        <div>
          <label>Summary of Work Completed *</label>
          <textarea
            required
            rows="3"
            placeholder="Describe replacement, adjustments, and testing performed..."
            value={workNotes}
            onChange={(e) => setWorkNotes(e.target.value)}
          />
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Invoice Number / Reference *</label>
            <input
              type="text"
              required
              placeholder="e.g. INV-2026-8812"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label>Invoice Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="small muted">
          Submitting will move this job into Manager Review for final sign-off and payment processing.
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
