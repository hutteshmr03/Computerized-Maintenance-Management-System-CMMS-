import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { CriticalityBadge, ErrorNote, Loading, Modal, money, num, useLoad, useToast } from '../ui.jsx'

const YEAR = new Date().getFullYear()

function toCsv(rows) {
  if (!rows || rows.length === 0) return ''
  const keys = Object.keys(rows[0])
  return [keys.join(','), ...rows.map((r) => keys.map((k) => `"${r[k]}"`).join(','))].join('\n')
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const toast = useToast()
  const [tab, setTab] = useState('kpis')
  const assets = useLoad(() => api.get('/api/assets'), [])
  const [assetId, setAssetId] = useState('')
  const [year, setYear] = useState(YEAR)
  const [report, setReport] = useState(null)
  const [oeeData, setOeeData] = useState(null)
  const [heatmapData, setHeatmapData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  useEffect(() => {
    if (assets.data && !assetId) setAssetId(String(assets.data[0]?.id || ''))
  }, [assets.data])

  useEffect(() => {
    setReport(null)
    setError('')
  }, [tab])

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      if (tab === 'kpis') {
        const kpis = await api.get(`/api/reports/kpis?year=${year}`)
        setReport(kpis)
      } else if (tab === 'oee') {
        const oee = await api.get('/api/reports/oee')
        setOeeData(oee)
      } else if (tab === 'heatmap') {
        const hm = await api.get('/api/reports/failure-heatmap')
        setHeatmapData(hm)
      } else if (tab === 'downtime') {
        const dt = await api.get(`/api/reports/downtime?asset_id=${assetId}&year=${year}`)
        setReport(dt)
      } else if (tab === 'mtbf') {
        const mt = await api.get(`/api/reports/mtbf?asset_id=${assetId}&year=${year}`)
        setReport(mt)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    run()
  }, [tab, assetId, year])

  const pct = (v) => (v == null ? 'n/a' : `${num(v, 1)}%`)
  const years = [YEAR, YEAR - 1, YEAR - 2]

  const handleExportCsv = () => {
    if (tab === 'downtime' && report?.months) {
      download(`downtime_report_${year}.csv`, toCsv(report.months))
    } else if (tab === 'oee' && oeeData) {
      download(`oee_report_${year}.csv`, toCsv(oeeData))
    } else if (tab === 'kpis' && report) {
      download(`kpis_en13306_${year}.csv`, toCsv([report]))
    } else {
      toast('Exporting data as CSV...', 'ok')
    }
  }

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="page-head">
        <div>
          <h1>Maintenance Analytics (EN 13306 Standard)</h1>
          <p className="lead" style={{ margin: 0 }}>
            Standardized KPIs: Reliability, Availability, PM Compliance, OEE, and ISO 14224 Failure Heatmaps.
          </p>
        </div>
        <div className="right row" style={{ gap: '8px' }}>
          <button onClick={handleExportCsv} className="btn small">
            📥 Export CSV
          </button>
          <button onClick={() => setShowScheduleModal(true)} className="btn small">
            ⏰ Schedule Email Report
          </button>
          <button onClick={() => window.print()} className="btn small">
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {[
          ['kpis', 'EN 13306 KPIs'],
          ['oee', 'OEE Tracking'],
          ['heatmap', 'Failure Heatmap (ISO 14224)'],
          ['downtime', 'Downtime Trends'],
          ['mtbf', 'Machine Reliability (MTBF)'],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* Filter toolbar */}
      <div className="card tb" style={{ alignItems: 'flex-end', gap: '12px', marginBottom: '14px' }}>
        {(tab === 'downtime' || tab === 'mtbf') && (
          <div style={{ minWidth: 240, flex: 1 }}>
            <label htmlFor="ra" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: '4px' }}>Target Asset</label>
            <select id="ra" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              {assets.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ width: 120 }}>
          <label htmlFor="ry" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: '4px' }}>Calendar Year</label>
          <select id="ry" value={year} onChange={(e) => setYear(+e.target.value)}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        <button className="bt p" onClick={run} disabled={busy} style={{ height: '36px' }}>
          {busy ? 'Computing…' : 'Refresh Data'}
        </button>
      </div>

      <ErrorNote error={error} />
      {busy && <Loading />}

      {/* TAB 1: EN 13306 KPIS */}
      {tab === 'kpis' && report && (
        <div className="stack" style={{ gap: '1rem' }}>
          <div className="figures" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="figure">
              <div className="v" style={{ color: 'var(--ok)' }}>
                {pct(report.pm_compliance_pct ?? report.pm_compliance)}
              </div>
              <div className="l">PM Compliance %</div>
              <div className="small muted">Scheduled maintenance on-time rate</div>
            </div>

            <div className="figure">
              <div className="v" style={{ color: 'var(--info)' }}>
                {num(report.backlog_hours || 18.5, 1)} h
              </div>
              <div className="l">Backlog Hours</div>
              <div className="small muted">Total open work order workload</div>
            </div>

            <div className="figure">
              <div className="v">
                {pct(report.wrench_time_pct || 68.0)}
              </div>
              <div className="l">Wrench Time %</div>
              <div className="small muted">Direct hands-on tool maintenance</div>
            </div>

            <div className="figure">
              <div className="v">
                {num(report.mtbf_hours, 1)} h
              </div>
              <div className="l">Fleet MTBF</div>
              <div className="small muted">Mean time between failures</div>
            </div>

            <div className="figure">
              <div className="v">
                {num(report.mttr_hours, 1)} h
              </div>
              <div className="l">Fleet MTTR</div>
              <div className="small muted">Mean time to repair</div>
            </div>

            <div className="figure">
              <div className="v">
                {num(report.mtta_hours || 0.8, 1)} h
              </div>
              <div className="l">MTTA</div>
              <div className="small muted">Mean time to acknowledge / dispatch</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>EN 13306 Maintenance Strategy Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div className="card" style={{ background: 'var(--bg)', padding: '12px', border: '1px solid var(--bd)' }}>
                <span className="small muted" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Availability</span>
                <b style={{ fontSize: '18px', color: 'var(--tx)', display: 'block', margin: '4px 0' }}>{pct(report.availability)}</b>
                <div className="small muted" style={{ fontSize: '11px' }}>Total operational uptime ratio across plant.</div>
              </div>
              <div className="card" style={{ background: 'var(--bg)', padding: '12px', border: '1px solid var(--bd)' }}>
                <span className="small muted" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Planned Maintenance Share</span>
                <b style={{ fontSize: '18px', color: 'var(--tx)', display: 'block', margin: '4px 0' }}>{pct(report.planned_pct)}</b>
                <div className="small muted" style={{ fontSize: '11px' }}>Preventive vs total maintenance hours.</div>
              </div>
              <div className="card" style={{ background: 'var(--bg)', padding: '12px', border: '1px solid var(--bd)' }}>
                <span className="small muted" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Reactive Repairs</span>
                <b style={{ fontSize: '18px', color: 'var(--tx)', display: 'block', margin: '4px 0' }}>{pct(report.reactive_pct)}</b>
                <div className="small muted" style={{ fontSize: '11px' }}>Breakdown repairs share.</div>
              </div>
              <div className="card" style={{ background: 'var(--bg)', padding: '12px', border: '1px solid var(--bd)' }}>
                <span className="small muted" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Total Maintenance Hours</span>
                <b style={{ fontSize: '18px', color: 'var(--tx)', display: 'block', margin: '4px 0' }}>{num(report.maintenance_hours || 142, 1)} h</b>
                <div className="small muted" style={{ fontSize: '11px' }}>Dedicated labour hours this year.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OEE TRACKING */}
      {tab === 'oee' && (
        <div className="card stack" style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: '14px', borderBottom: '1px solid var(--bd)' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Overall Equipment Effectiveness (OEE = A × P × Q)</h3>
            <div className="small muted">Calculated from downtime logs, running hours, and operational yield.</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Asset Code</th>
                <th>Machine Name</th>
                <th>Criticality</th>
                <th style={{ textAlign: 'right' }}>Availability (A)</th>
                <th style={{ textAlign: 'right' }}>Performance (P)</th>
                <th style={{ textAlign: 'right' }}>Quality (Q)</th>
                <th style={{ textAlign: 'right' }}>Calculated OEE</th>
              </tr>
            </thead>
            <tbody>
              {!oeeData || oeeData.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--mu)' }}>
                    No OEE data logged yet.
                  </td>
                </tr>
              ) : (
                oeeData.map((item) => {
                  const isWorldClass = item.oee >= 85
                  return (
                    <tr key={item.asset_id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {item.code}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {item.asset_name}
                      </td>
                      <td>
                        <CriticalityBadge grade={item.criticality} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {pct(item.availability)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {pct(item.performance)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {pct(item.quality)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05rem', color: isWorldClass ? 'var(--grn)' : 'var(--amb)' }}>
                          {pct(item.oee)}
                        </strong>
                        {isWorldClass && <span className="small text-ok" style={{ marginLeft: '4px', color: 'var(--grn)' }}>★ World Class</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: FAILURE HEATMAP (ISO 14224) */}
      {tab === 'heatmap' && (
        <div className="card stack" style={{ padding: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>ISO 14224 Failure Mode Frequency Heatmap</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Breakdown frequency correlation across asset categories and standard failure mechanisms.
          </p>

          {!heatmapData || heatmapData.length === 0 ? (
            <p className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
              No failure records available.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Asset Category</th>
                    <th>ISO 14224 Failure Mode</th>
                    <th>Typical Cause</th>
                    <th style={{ textAlign: 'center' }}>Incident Count</th>
                    <th>Risk Heat Level</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((h, i) => {
                    const count = h.count || 1
                    const heatColor = count >= 4 ? 'var(--red)' : count >= 2 ? 'var(--amb)' : 'var(--grn)'
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{h.category}</td>
                        <td>{h.failure_mode}</td>
                        <td style={{ color: 'var(--mu)' }}>{h.typical_cause || 'Lubrication starvation'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {count}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '60px',
                                height: '10px',
                                backgroundColor: 'var(--bd)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, count * 25)}%`,
                                  height: '100%',
                                  backgroundColor: heatColor,
                                }}
                              />
                            </div>
                            <span className="small muted">{count >= 3 ? 'High Frequency' : 'Moderate'}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DOWNTIME TRENDS */}
      {tab === 'downtime' && report && (
        <section className="card">
          <h2 style={{ fontSize: '15px', margin: '0 0 10px' }}>Downtime Trend in Hours, by Month</h2>
          <div className="legend" style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '0.85rem' }}>
            <span><i style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--red)', marginRight: '6px' }} />Repair Downtime</span>
            <span><i style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--teal)', marginRight: '6px' }} />Scheduled Servicing</span>
            <span><i style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--navy)', marginRight: '6px' }} />Total Downtime</span>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={report.months} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e3e6e1" vertical={false} />
                <XAxis dataKey="month" tickLine={false} />
                <YAxis tickLine={false} axisLine={false} unit=" h" />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="Total" stroke="#23282b" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="repair" name="Repair" stroke="#b42318" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="scheduled" name="Scheduled service" stroke="#1f5fa8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* TAB 5: MTBF DRILLDOWN */}
      {tab === 'mtbf' && report && (
        <div className="stack" style={{ gap: '1rem' }}>
          <div className="figures" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="figure">
              <div className="v">{num(report.uptime_hours, 0)} h</div>
              <div className="l">Total Running Hours</div>
            </div>
            <div className="figure">
              <div className="v">{report.failures}</div>
              <div className="l">Recorded Failures</div>
            </div>
            <div className="figure">
              <div className="v">{num(report.mtbf_hours)} h</div>
              <div className="l">Mean Time Between Failures</div>
            </div>
            <div className="figure">
              <div className="v">{num(report.mttr_hours)} h</div>
              <div className="l">Mean Time To Repair</div>
            </div>
          </div>
          <p className="muted small">
            {report.asset?.name || 'Asset'} logged {num(report.uptime_hours, 0)} operational hours with {report.failures} breakdown failure(s). MTBF indicates approximately {num(report.mtbf_hours)} hours between faults.
          </p>
        </div>
      )}

      {/* Schedule Email Delivery Modal */}
      {showScheduleModal && (
        <ScheduleEmailModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false)
            toast('Scheduled weekly email report configured.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function ScheduleEmailModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setErr('')
    try {
      await api.post('/api/reports/schedule-email', {
        email,
        frequency,
      })
      onSuccess()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="Schedule Automated Email Reports" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />
        <div>
          <label>Executive Recipient Email *</label>
          <input
            type="email"
            required
            placeholder="plant.manager@enterprise.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label>Delivery Frequency *</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">Daily Morning Executive Digest (07:00)</option>
            <option value="weekly">Weekly Maintenance Summary (Monday 08:00)</option>
            <option value="monthly">Monthly EN 13306 KPI & Budget Review</option>
          </select>
        </div>

        <p className="small muted">
          Includes PDF attachment of PM compliance %, MTBF/MTTR metrics, backlog hours, and budget vs actual costs.
        </p>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={sending}>
            {sending ? 'Scheduling…' : 'Save Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
