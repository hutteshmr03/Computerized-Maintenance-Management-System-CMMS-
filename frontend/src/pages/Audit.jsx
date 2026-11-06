import { useState } from 'react'
import { api } from '../api'
import { Empty, ErrorNote, Loading, fmtDateTime, useLoad } from '../ui.jsx'

export default function Audit() {
  const [q, setQ] = useState('')
  const { data, error, loading } = useLoad(() => api.get('/api/audit?q=' + encodeURIComponent(q)), [q])
  return (
    <div>
      <div className="page-head"><div><h1>Audit log</h1><p className="lead">Every action, with who did it and when. Entries cannot be changed.</p></div></div>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="aq">Search by person, action or asset</label>
        <input id="aq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example approve or Tara" />
      </div>
      <ErrorNote error={error} />
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty title="No entries match your search" />}
      {data && data.length > 0 && (
        <div className="panel table-wrap" style={{ padding: 0 }}>
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
