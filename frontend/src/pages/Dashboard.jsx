import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, JobRow, Loading, money, num, useLoad, Pill } from '../ui.jsx'

function Figure({ to, value, label, attn }) {
  const inner = (<><div className="v">{value}</div><div className="l">{label}</div></>)
  return to
    ? <Link to={to} className={`figure ${attn ? 'attn' : ''}`}>{inner}</Link>
    : <div className={`figure ${attn ? 'attn' : ''}`}>{inner}</div>
}

function ManagerHome({ d }) {
  const attention = d.pending_approvals.length + d.pending_transfers
  return (
    <>
      <div className="figures">
        <Figure to="/jobs?filter=open" value={d.open_jobs} label="Open jobs" />
        <Figure to="/jobs?filter=completed" value={d.closed_jobs_month} label="Closed this month" />
        <Figure to="/jobs?filter=warranty" value={d.warranty_repairs_month} label="Repairs under warranty this month" />
        <Figure to="/jobs?filter=repair" value={d.breakdown_repairs_month} label="Breakdown repairs this month" />
        <Figure value={money(d.month_cost)} label="Maintenance cost this month" />
      </div>

      <div className="cols">
        <div className="stack">
          <section>
            <div className="panel-head">
              <h2>Waiting for your approval</h2>
              {attention > 0 && <Pill tone="amber">{d.pending_approvals.length} jobs, {d.pending_transfers} transfers</Pill>}
            </div>
            {d.pending_approvals.length === 0
              ? <Empty title="Nothing to approve">New requests from technicians will show up here.</Empty>
              : <div className="tickets">{d.pending_approvals.map((j) => <JobRow key={j.id} job={j} />)}</div>}
            {d.pending_transfers > 0 && <p style={{ marginTop: '.75rem' }}><Link to="/transfers">{d.pending_transfers} asset transfer(s) need a decision</Link></p>}
          </section>

          <section>
            <div className="panel-head"><h2>Servicing due within 10 days</h2></div>
            {d.due_soon.length === 0
              ? <Empty title="No servicing due soon" />
              : <div className="tickets">{d.due_soon.map((j) => <JobRow key={j.id} job={j} />)}</div>}
          </section>
        </div>

        <div className="stack">
          <section>
            <div className="panel-head"><h2>Repairs in progress</h2></div>
            {d.ongoing.length === 0
              ? <Empty title="No repairs running right now" />
              : <div className="tickets">{d.ongoing.map((j) => <JobRow key={j.id} job={j} />)}</div>}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Parts to reorder</h2><Link to="/parts" className="right small">See all parts</Link></div>
            {d.low_stock.length === 0 ? <p className="muted">All parts are above their minimum level.</p> : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {d.low_stock.map((p) => (
                  <li key={p.id}>{p.name}: {p.stock} left, minimum {p.min_level}. Order {p.order_qty} from {p.vendor || 'a vendor'}.</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function TechHome({ d }) {
  return (
    <>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <Link to="/scan" className="btn primary">Scan or enter asset code</Link>
        <Link to="/jobs/new" className="btn">Report a problem</Link>
      </div>
      <div className="figures" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Figure value={d.my_tasks.length} label="My open tasks" />
        <Figure value={d.due_today} label="Due today or overdue" attn={d.due_today > 0} />
        <Figure value={d.waiting_approval} label="Waiting for approval" />
      </div>
      <div className="panel-head"><h2>My tasks, most urgent first</h2></div>
      {d.my_tasks.length === 0
        ? <Empty title="You have no open tasks">Jobs assigned to you will appear here.</Empty>
        : <div className="tickets">{d.my_tasks.map((j) => <JobRow key={j.id} job={j} />)}</div>}
    </>
  )
}

function ExecHome({ d }) {
  const k = d.kpis
  const pct = (v) => (v == null ? 'n/a' : `${num(v)}%`)
  return (
    <>
      <div className="figures">
        <Figure value={money(d.month_cost)} label="Maintenance cost this month" />
        <Figure value={pct(k.availability)} label="Asset availability this year" />
        <Figure value={pct(k.planned_pct)} label="Planned maintenance share" />
        <Figure value={pct(k.pm_compliance)} label={`Servicing done on time (${k.pm_on_time} of ${k.pm_total})`} />
        <Figure value={d.open_jobs} label="Open jobs" />
      </div>
      <section className="panel">
        <h2>Downtime by month, all assets (hours)</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={d.downtime} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e3e6e1" vertical={false} />
              <XAxis dataKey="month" tickLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="repair" name="Repair" stroke="#b42318" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="scheduled" name="Scheduled service" stroke="#1f5fa8" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="muted small" style={{ marginTop: '.5rem' }}>Red is time lost to breakdowns. Blue is time spent on planned servicing. Less red is better.</p>
      </section>
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading } = useLoad(() => api.get('/api/dashboard'), [])
  const first = user.name.split(' ')[0]
  return (
    <div>
      <div className="page-head"><div><h1>Hello, {first}</h1>
        <p className="lead">
          {user.role === 'technician' ? 'Here is your work for today.' : user.role === 'executive' ? 'How maintenance is performing this year.' : 'Here is what needs attention.'}
        </p></div></div>
      <ErrorNote error={error} />
      {loading && !data && <Loading />}
      {data && (user.role === 'technician' ? <TechHome d={data} /> : user.role === 'executive' ? <ExecHome d={data} /> : <ManagerHome d={data} />)}
    </div>
  )
}
