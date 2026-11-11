import { useState } from 'react'
import { api } from '../api'
import { Empty, ErrorNote, Loading, fmtDateTime, useLoad } from '../ui.jsx'

export default function Audit() {
  const [q, setQ] = useState('')
  const { data, error, loading } = useLoad(() => api.get('/api/audit?q=' + encodeURIComponent(q)), [q])
  return (
    <div>
      <div className="page-head"><div><h1>Audit log</h1><p className="lead">Every action, with who did it and when. Entries cannot be changed.</p></div></div>
      <div className="card tb" style={{ maxWidth: 460, marginBottom: '14px' }}>
        <input
          id="aq"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by person, action or asset (e.g. approve, AST-0001)..."
          style={{ width: '100%', maxWidth: '100%' }}
        />
      </div>
      <ErrorNote error={error} />
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty title="No entries match your search" />}
      {data && data.length > 0 && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="num">{fmtDateTime(a.at)}</td><td>{a.user}</td>
                  <td>{a.action.replace(/_/g, ' ')}</td>
                  <td>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}{a.detail ? `: ${a.detail}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
