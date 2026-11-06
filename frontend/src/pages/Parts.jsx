import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, Loading, Modal, Pill, money, useLoad, useToast } from '../ui.jsx'

function StockBar({ p }) {
  const top = Math.max(p.max_level, p.stock, 1)
  return (
    <div className={`bar ${p.low ? 'low' : ''}`} title={`Minimum ${p.min_level}, maximum ${p.max_level}`}>
      <span style={{ width: `${Math.min(100, (p.stock / top) * 100)}%` }} />
      <i style={{ left: `${(p.min_level / top) * 100}%` }} />
    </div>
  )
}

export default function Parts() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useLoad(() => api.get('/api/parts'), [])
  const [receiving, setReceiving] = useState(null)
  const [qty, setQty] = useState('')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ sku: '', name: '', unit: 'pcs', stock: '', min_level: '', max_level: '', vendor: '', unit_cost: '' })
  const [err, setErr] = useState('')
  const manage = can('part.manage')

  const low = (data || []).filter((p) => p.low)
  const byVendor = low.reduce((acc, p) => { (acc[p.vendor || 'No vendor set'] ||= []).push(p); return acc }, {})

  const receive = async () => {
    setErr('')
    try {
      const p = await api.post(`/api/parts/${receiving.id}/stock`, { qty: Number(qty) })
      toast(`Added ${qty}. ${p.name} now at ${p.stock}.`)
      setReceiving(null); setQty(''); reload()
    } catch (e) { setErr(e.message) }
  }
  const create = async (e) => {
    e.preventDefault(); setErr('')
    try {
      await api.post('/api/parts', { ...f, stock: +f.stock || 0, min_level: +f.min_level || 0, max_level: +f.max_level || 0, unit_cost: +f.unit_cost || 0 })
      toast('Part saved.')
      setAdding(false); setF({ sku: '', name: '', unit: 'pcs', stock: '', min_level: '', max_level: '', vendor: '', unit_cost: '' }); reload()
    } catch (e2) { setErr(e2.message) }
  }
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  return (
    <div>
      <div className="page-head">
        <div><h1>Spare parts</h1><p className="lead">Stock on hand, with a marker at the minimum level.</p></div>
        {manage && <button className="primary right" onClick={() => { setErr(''); setAdding(true) }}>Add part</button>}
      </div>
      <ErrorNote error={error} />
      {loading && !data && <Loading />}

      {low.length > 0 && (
        <section className="panel" style={{ marginBottom: '1.25rem', borderLeft: '5px solid var(--bad)' }}>
          <h2>Suggested purchase request</h2>
          <p className="muted">These parts are at or below their minimum. Quantities bring each one back up to its maximum.</p>
          {Object.entries(byVendor).map(([vendor, items]) => (
            <div key={vendor} style={{ marginBottom: '.75rem' }}>
              <h3>{vendor}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {items.map((p) => <li key={p.id}>{p.order_qty} x {p.name} ({p.sku}), about {money(p.order_qty * p.unit_cost)}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {data && data.length === 0 && <Empty title="No spare parts yet">{manage ? 'Add your first part to start tracking stock.' : 'A manager can add parts.'}</Empty>}
      {data && data.length > 0 && (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Part</th><th>Vendor</th><th className="n">In stock</th><th>Level</th><th className="n">Min / max</th><th className="n">Unit cost</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><div className="small muted">{p.sku}</div></td>
                  <td>{p.vendor}</td>
                  <td className="n">{p.stock} {p.unit} {p.low && <Pill tone="red">Low stock</Pill>}</td>
                  <td style={{ minWidth: 120 }}><StockBar p={p} /></td>
                  <td className="n">{p.min_level} / {p.max_level}</td>
                  <td className="n">{money(p.unit_cost)}</td>
                  <td>{manage && <button onClick={() => { setErr(''); setReceiving(p) }}>Add stock</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receiving && (
        <Modal title={`Add stock: ${receiving.name}`} onClose={() => setReceiving(null)}>
          <ErrorNote error={err} />
          <div className="field"><label htmlFor="rq">Quantity received</label><input id="rq" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            <div className="hint">Currently {receiving.stock} {receiving.unit} in stock.</div></div>
          <div className="row"><button className="primary" disabled={!(+qty > 0)} onClick={receive}>Add stock</button><button onClick={() => setReceiving(null)}>Cancel</button></div>
        </Modal>
      )}
      {adding && (
        <Modal title="Add spare part" onClose={() => setAdding(false)}>
          <form onSubmit={create}>
            <ErrorNote error={err} />
            <div className="grid2">
              <div className="field"><label htmlFor="s1">SKU</label><input id="s1" value={f.sku} onChange={(e) => set('sku', e.target.value)} required autoFocus /></div>
              <div className="field"><label htmlFor="s2">Name</label><input id="s2" value={f.name} onChange={(e) => set('name', e.target.value)} required /></div>
              <div className="field"><label htmlFor="s3">Vendor</label><input id="s3" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></div>
              <div className="field"><label htmlFor="s4">Unit cost (₹)</label><input id="s4" type="number" min="0" value={f.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} /></div>
              <div className="field"><label htmlFor="s5">Stock now</label><input id="s5" type="number" min="0" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></div>
              <div className="field"><label htmlFor="s6">Unit</label><input id="s6" value={f.unit} onChange={(e) => set('unit', e.target.value)} /></div>
              <div className="field"><label htmlFor="s7">Minimum level</label><input id="s7" type="number" min="0" value={f.min_level} onChange={(e) => set('min_level', e.target.value)} />
                <div className="hint">Reorder when stock falls to this.</div></div>
              <div className="field"><label htmlFor="s8">Maximum level</label><input id="s8" type="number" min="0" value={f.max_level} onChange={(e) => set('max_level', e.target.value)} /></div>
            </div>
            <div className="row"><button className="primary">Save part</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
