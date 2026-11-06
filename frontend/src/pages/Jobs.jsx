import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { Empty, ErrorNote, JobRow, Loading, useLoad } from '../ui.jsx'

const FILTERS = [
  ['open', 'Open'],
  ['approval', 'Needs approval'],
  ['mine', 'Assigned to me'],
  ['repair', 'Repairs'],
  ['scheduled', 'Scheduled service'],
  ['completed', 'Completed'],
  ['all', 'All'],
]

export default function Jobs() {
  const { user, can } = useAuth()
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') || 'open'
  const { data, error, loading } = useLoad(() => api.get('/api/jobs'), [])

  const OPEN = ['created', 'sent_for_approval', 'approved', 'in_progress']
  const test = {
    open: (j) => OPEN.includes(j.status),
    approval: (j) => j.status === 'sent_for_approval',
    mine: (j) => j.assigned_to === user.id && OPEN.includes(j.status),
    repair: (j) => j.type === 'repair',
    scheduled: (j) => j.type === 'scheduled',
    completed: (j) => j.status === 'completed',
    warranty: (j) => j.type === 'repair' && j.warranty,
    all: () => true,
  }[filter] || (() => true)
  const rows = (data || []).filter(test)

  return (
    <div>
      <div className="page-head">
        <div><h1>Jobs</h1><p className="lead">Repairs and scheduled servicing.</p></div>
        {can('job.create') && <Link className="btn primary right" to="/jobs/new">New job</Link>}
      </div>
      <div className="chips" role="group" aria-label="Filter jobs">
        {FILTERS.map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setParams(k === 'open' ? {} : { filter: k })}>{label}</button>
        ))}
        {filter === 'warranty' && <button className="chip" aria-pressed>Repairs under warranty</button>}
      </div>
      <ErrorNote error={error} />
      {loading && !data && <Loading />}
      {data && rows.length === 0 && <Empty title="No jobs here">Try another filter, or create a new job.</Empty>}
      <div className="tickets">{rows.map((j) => <JobRow key={j.id} job={j} />)}</div>
    </div>
  )
}
