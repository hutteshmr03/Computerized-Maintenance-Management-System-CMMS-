import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, Loading, Modal, Pill, useLoad, useToast } from '../ui.jsx'

function AddAsset({ locations, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: '',
    category: '',
    utility_type: '',
    is_movable: false,
    under_warranty: false,
    replacement_value: '',
    location_id: locations[0]?.id
  })
  const [error, setError] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const save = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const a = await api.post('/api/assets', {
        ...f,
        replacement_value: Number(f.replacement_value) || 0,
        location_id: Number(f.location_id),
        utility_type: f.utility_type || null,
      })
      toast(`Saved ${a.name} as ${a.code}`)
      onSaved(a)
    } catch (err) { setError(err.message) }
  }
  return (
    <Modal title="Add asset" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorNote error={error} />
        <div className="field"><label htmlFor="an">Asset name</label><input id="an" value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="ac">Category</label><input id="ac" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="For example Power" /></div>
          <div className="field"><label htmlFor="al">Location</label>
            <select id="al" value={f.location_id} onChange={(e) => set('location_id', e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="aut">Utility Type (optional)</label>
            <select id="aut" value={f.utility_type} onChange={(e) => set('utility_type', e.target.value)}>
              <option value="">None (Standard Machine)</option>
              <option value="compressor">Compressor</option>
              <option value="boiler">Boiler</option>
              <option value="chiller">Chiller</option>
              <option value="generator">Generator</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field"><label htmlFor="av">Replacement value (₹)</label><input id="av" type="number" min="0" value={f.replacement_value} onChange={(e) => set('replacement_value', e.target.value)} />
            <div className="hint">Used to judge whether an old asset is worth repairing.</div></div>
        </div>
        <div className="field"><label><input type="checkbox" style={{ width: 'auto', minHeight: 0, marginRight: 8 }} checked={f.is_movable} onChange={(e) => set('is_movable', e.target.checked)} />This asset can move between locations</label></div>
        <div className="field"><label><input type="checkbox" style={{ width: 'auto', minHeight: 0, marginRight: 8 }} checked={f.under_warranty} onChange={(e) => set('under_warranty', e.target.checked)} />Under warranty</label></div>
        <div className="row"><button className="primary">Save asset</button><button type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  )
}

export default function Assets() {
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [utilityType, setUtilityType] = useState('')
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const { data, error, loading, reload } = useLoad(
    () => api.get(`/api/assets?q=${encodeURIComponent(q)}&utility_type=${encodeURIComponent(utilityType)}`),
    [q, utilityType]
  )
  const locs = useLoad(() => api.get('/api/locations'), [])
  return (
    <div>
      <div className="page-head">
        <div><h1>Assets</h1><p className="lead">Every machine and vehicle you maintain.</p></div>
        {can('asset.create') && <button className="bt p right" onClick={() => setAdding(true)} disabled={!locs.data}>+ Add asset</button>}
      </div>

      <div className="card tb" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'flex-end' }}>
        <div className="field" style={{ maxWidth: 360, marginBottom: 0, flex: 1 }}>
          <label htmlFor="q" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: '4px' }}>Search by name or code</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example press or AST-0003" />
        </div>
        <div className="field" style={{ minWidth: 220, marginBottom: 0 }}>
          <label htmlFor="util-filter" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: '4px' }}>Filter by Utility Type</label>
          <select id="util-filter" value={utilityType} onChange={(e) => setUtilityType(e.target.value)}>
            <option value="">All Utility Types</option>
            <option value="compressor">Compressor</option>
            <option value="boiler">Boiler</option>
            <option value="chiller">Chiller</option>
            <option value="generator">Generator</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <ErrorNote error={error} />
      {loading && !data && <Loading />}
      {data && data.length === 0 && <Empty title="No assets match your search">Try a different filter or search term.</Empty>}
      {data && data.length > 0 && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Code</th><th>Asset</th><th>Category</th><th>Utility Type</th><th>Location</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="click" onClick={() => navigate(`/assets/${a.id}`)}>
                  <td className="num"><Link to={`/assets/${a.id}`}>{a.code}</Link></td>
                  <td>{a.name}</td>
                  <td>{a.category}</td>
                  <td>
                    {a.utility_type ? (
                      <span className="badge grey small" style={{ textTransform: 'capitalize' }}>
                        {a.utility_type}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{a.location}{a.is_movable ? '' : ' (fixed)'}</td>
                  <td>
                    {a.open_job_id ? <Pill tone="amber">Open job #{a.open_job_id}</Pill> : <Pill tone="green">No open job</Pill>}{' '}
                    {a.under_warranty && <Pill tone="blue">Warranty</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && locs.data && <AddAsset locations={locs.data} onClose={() => setAdding(false)} onSaved={(a) => { setAdding(false); reload(); navigate(`/assets/${a.id}`) }} />}
    </div>
  )
}
