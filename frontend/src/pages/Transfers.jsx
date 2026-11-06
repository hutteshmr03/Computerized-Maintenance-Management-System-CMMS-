import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, Loading, Modal, Pill, fmtDateTime, useLoad, useToast } from '../ui.jsx'

const TONE = { pending: 'amber', approved: 'green', rejected: 'red' }
const LABEL = { pending: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected' }

export default function Transfers() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useLoad(() => api.get('/api/transfers'), [])
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const decide = async (t, decision, why = '') => {
    setErr('')
    try {
      await api.post(`/api/transfers/${t.id}/${decision}`, { reason: why })
      toast(decision === 'approve' ? `Approved. ${t.asset.name} moved to ${t.to}.` : 'Transfer rejected.')
      setRejecting(null); setReason('')
      reload()
    } catch (e) { setErr(e.message) }
  }

  return (
    <div>
      <div className="page-head"><div><h1>Transfers</h1><p className="lead">Requests to move movable assets between locations.</p></div></div>
      <ErrorNote error={error || err} />
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty title="No transfers yet">Open a movable asset and choose Request transfer.</Empty>}
      {data && data.length > 0 && (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Asset</th><th>Move</th><th>Requested by</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`/assets/${t.asset.id}`}>{t.asset.name}</Link><div className="small muted">{t.asset.code}</div></td>
                  <td>{t.asset.from} to {t.to}</td>
                  <td>{t.requested_by}<div className="small muted">{fmtDateTime(t.created_at)}</div></td>
                  <td><Pill tone={TONE[t.status]}>{LABEL[t.status]}</Pill>{t.reason && <div className="small muted">{t.reason}</div>}</td>
                  <td>
                    {t.status === 'pending' && can('transfer.decide') && (
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <button className="primary" onClick={() => decide(t, 'approve')}>Approve</button>
                        <button className="danger" onClick={() => setRejecting(t)}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rejecting && (
        <Modal title="Reject transfer" onClose={() => setRejecting(null)}>
          <div className="field"><label htmlFor="r">Reason for rejecting</label>
            <textarea id="r" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <div className="hint">The person who asked will see this.</div></div>
          <div className="row"><button className="danger" disabled={!reason.trim()} onClick={() => decide(rejecting, 'reject', reason)}>Reject transfer</button>
            <button onClick={() => setRejecting(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  )
}
