import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  DinTypeBadge,
  ErrorNote,
  Loading,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

const COLUMNS = [
  { id: 'created', title: 'Created', hint: 'Newly logged faults' },
  { id: 'planned', title: 'Planned', hint: 'Scheduled & assigned' },
  { id: 'sent_for_approval', title: 'Pending Approval', hint: 'Waiting manager sign-off' },
  { id: 'approved', title: 'Approved', hint: 'Ready to start' },
  { id: 'in_progress', title: 'In Progress', hint: 'Work underway' },
  { id: 'review', title: 'Review', hint: 'Quality / invoice review' },
  { id: 'closed', title: 'Closed', hint: 'Completed & signed off' },
]

export default function Kanban() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: board, loading, error, reload } = useLoad(() => api.get('/api/jobs/kanban'))
  const [searchTerm, setSearchTerm] = useState('')
  const [dinFilter, setDinFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const handleAction = async (job, action, extraBody = {}) => {
    try {
      await api.post(`/api/jobs/${job.id}/action/${action}`, extraBody)
      toast(`Job ${job.wo_number || '#' + job.id} updated.`, 'ok')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  // Filter jobs within each column
  const filteredBoard = useMemo(() => {
    if (!board) return {}
    const res = {}
    for (const col of COLUMNS) {
      const list = board[col.id] || (col.id === 'closed' ? board['completed'] || [] : [])
      res[col.id] = list.filter((j) => {
        const matchesSearch =
          !searchTerm ||
          j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (j.wo_number && j.wo_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (j.asset && j.asset.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesDin = !dinFilter || j.din_type === dinFilter
        const matchesPri = !priorityFilter || j.priority === priorityFilter

        return matchesSearch && matchesDin && matchesPri
      })
    }
    return res
  }, [board, searchTerm, dinFilter, priorityFilter])

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Work Order Lifecycle (Kanban)</h1>
          <p className="muted" style={{ margin: 0 }}>
            DIN 31051 activity lifecycle: Created → Planned → Approved → In Progress → Review → Closed.
          </p>
        </div>
        <div className="row">
          <Link to="/jobs/new" className="btn primary">
            + Raise Work Order
          </Link>
          <Link to="/jobs" className="btn">
            List View
          </Link>
          <Link to="/gantt" className="btn">
            Gantt View
          </Link>
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="card tb" style={{ gap: '12px', marginBottom: '14px' }}>
        <input
          type="search"
          placeholder="Filter by WO#, title, or asset..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />

        <select value={dinFilter} onChange={(e) => setDinFilter(e.target.value)} style={{ width: '180px' }}>
          <option value="">All DIN Types</option>
          <option value="inspection">Inspection (Inspektion)</option>
          <option value="servicing">Servicing (Wartung)</option>
          <option value="repair">Repair (Instandsetzung)</option>
          <option value="improvement">Improvement (Verbesserung)</option>
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ width: '150px' }}>
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading && <Loading />}

      {/* Kanban Board Horizontal Scroll Container */}
      <div
        className="kanban-container"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: '320px',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '16px',
          alignItems: 'start',
          minHeight: '600px',
        }}
      >
        {COLUMNS.map((col) => {
          const items = filteredBoard[col.id] || []
          return (
            <div
              key={col.id}
              className="kanban-col panel"
              style={{
                backgroundColor: 'var(--paper)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                minHeight: '400px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--line)', paddingBottom: '6px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{col.title}</strong>
                  <div className="small muted">{col.hint}</div>
                </div>
                <span className="badge grey" style={{ fontWeight: 600 }}>{items.length}</span>
              </div>

              {items.length === 0 ? (
                <div style={{ padding: '2rem 0.5rem', textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.85rem' }}>
                  No work orders
                </div>
              ) : (
                items.map((job) => (
                  <div
                    key={job.id}
                    className="kanban-card panel"
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--panel)',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${
                        job.priority === 'critical' ? 'var(--bad)' : job.priority === 'high' ? 'var(--warn)' : 'var(--line)'
                      }`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="small muted" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {job.wo_number || `WO-#${job.id}`}
                      </span>
                      {job.criticality && <CriticalityBadge grade={job.criticality} />}
                    </div>

                    <Link
                      to={`/jobs/${job.id}`}
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      {job.title}
                    </Link>

                    <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🛠️ {job.asset?.name || job.asset}</span>
                    </div>

                    <div className="row" style={{ gap: '6px', marginTop: '2px' }}>
                      <DinTypeBadge type={job.din_type} />
                      {job.loto_required && (
                        <span
                          className={`badge ${job.loto_signed ? 'green' : 'red'} small`}
                          title={job.loto_signed ? 'LOTO Signed' : 'LOTO Mandatory Sign-off Required'}
                        >
                          {job.loto_signed ? '🔒 LOTO OK' : '⚠️ LOTO Req'}
                        </span>
                      )}
                    </div>

                    {job.due_date && (
                      <div className="small" style={{ color: job.overdue ? 'var(--bad)' : 'var(--ink-3)' }}>
                        📅 {job.overdue ? 'Overdue: ' : 'Due: '} {fmtDate(job.due_date)}
                      </div>
                    )}

                    {/* Quick action buttons according to status and role */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      {job.status === 'created' && (
                        <>
                          {can('job.plan') && (
                            <button
                              type="button"
                              className="small"
                              onClick={() => handleAction(job, 'plan')}
                              title="Mark planned"
                            >
                              Plan
                            </button>
                          )}
                          <button
                            type="button"
                            className="small primary"
                            onClick={() => handleAction(job, 'send')}
                          >
                            Submit Approval
                          </button>
                        </>
                      )}

                      {job.status === 'planned' && (
                        <button
                          type="button"
                          className="small primary"
                          onClick={() => handleAction(job, 'send')}
                        >
                          Submit Approval
                        </button>
                      )}

                      {job.status === 'sent_for_approval' && can('job.approve') && (
                        <>
                          <button
                            type="button"
                            className="small ok"
                            style={{ backgroundColor: 'var(--ok)', color: '#fff' }}
                            onClick={() => handleAction(job, 'approve')}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            className="small bad"
                            onClick={() => {
                              const reason = window.prompt('Reason for rejection:')
                              if (reason) handleAction(job, 'reject', { reason })
                            }}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {job.status === 'approved' && can('job.start') && (
                        <button
                          type="button"
                          className="small primary"
                          onClick={() => handleAction(job, 'start')}
                          title={job.loto_required && !job.loto_signed ? 'LOTO sign-off needed before start' : 'Start execution'}
                        >
                          ▶ Start Work
                        </button>
                      )}

                      {job.status === 'in_progress' && (
                        <>
                          <Link to={`/jobs/${job.id}`} className="btn small" style={{ fontSize: '0.8rem' }}>
                            Log Work
                          </Link>
                          {can('job.review') && (
                            <button
                              type="button"
                              className="small"
                              onClick={() => handleAction(job, 'review')}
                            >
                              To Review
                            </button>
                          )}
                        </>
                      )}

                      {job.status === 'review' && can('job.close') && (
                        <Link
                          to={`/jobs/${job.id}`}
                          className="btn small ok"
                          style={{ backgroundColor: 'var(--ok)', color: '#fff', fontSize: '0.8rem' }}
                        >
                          Review & Close
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
