import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  ErrorNote,
  Loading,
  Modal,
  useLoad,
  useToast,
} from '../ui.jsx'

export default function Gantt() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: schedule, loading, error, reload } = useLoad(() => api.get('/api/jobs/gantt'))
  const [rescheduleJob, setRescheduleJob] = useState(null)
  const [filterTech, setFilterTech] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Compute date range for timeline display
  const timelineData = useMemo(() => {
    if (!schedule || schedule.length === 0) return { days: [], items: [] }

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 2) // start 2 days ago

    const days = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      days.push(d)
    }

    const filtered = schedule.filter((item) => {
      const matchesTech = !filterTech || item.assigned_to_name === filterTech
      const matchesSearch =
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.wo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.asset.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesTech && matchesSearch
    })

    return { days, items: filtered }
  }, [schedule, filterTech, searchTerm])

  const technicians = useMemo(() => {
    if (!schedule) return []
    const set = new Set(schedule.map((x) => x.assigned_to_name).filter(Boolean))
    return Array.from(set)
  }, [schedule])

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Maintenance Scheduling (Gantt)</h1>
          <p className="muted" style={{ margin: 0 }}>
            Timeline view of active work orders. Drag and reschedule work across technician calendars.
          </p>
        </div>
        <div className="row">
          <Link to="/kanban" className="btn">
            Kanban View
          </Link>
          <Link to="/jobs" className="btn">
            List View
          </Link>
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="card tb" style={{ gap: '12px', marginBottom: '14px' }}>
        <input
          type="search"
          placeholder="Filter scheduled jobs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} style={{ width: '200px' }}>
          <option value="">All Technicians</option>
          {technicians.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading && <Loading />}

      {/* Gantt Timeline Container */}
      <div className="panel" style={{ padding: '16px', overflowX: 'auto' }}>
        <div style={{ minWidth: '900px' }}>
          {/* Timeline Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '260px repeat(14, 1fr)',
              borderBottom: '2px solid var(--line)',
              paddingBottom: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <div>Work Order / Asset</div>
            {timelineData.days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  style={{
                    textAlign: 'center',
                    backgroundColor: isToday ? 'var(--warn-bg)' : 'transparent',
                    borderRadius: '4px',
                    padding: '2px 0',
                    color: isToday ? 'var(--warn)' : 'var(--ink-2)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div>{d.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Job Rows */}
          {timelineData.items.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--ink-3)' }}>
              No active work orders currently scheduled in this window.
            </div>
          ) : (
            timelineData.items.map((job) => {
              const startObj = new Date(job.start)
              const firstDay = timelineData.days[0]
              const diffTime = startObj - firstDay
              const startDayOffset = Math.max(0, Math.min(13, Math.floor(diffTime / (1000 * 60 * 60 * 24))))
              const durationDays = Math.max(1, Math.min(14 - startDayOffset, Math.ceil((job.estimated_hours || 4) / 8)))

              return (
                <div
                  key={job.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '260px repeat(14, 1fr)',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {/* Left Job Info */}
                  <div style={{ paddingRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link
                        to={`/jobs/${job.id}`}
                        style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', textDecoration: 'none' }}
                      >
                        {job.wo_number}
                      </Link>
                      {job.criticality && <CriticalityBadge grade={job.criticality} />}
                    </div>
                    <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title}
                    </div>
                    <div className="small" style={{ color: 'var(--info)' }}>
                      👤 {job.assigned_to_name || 'Unassigned'}
                    </div>
                  </div>

                  {/* Gantt Bar spanning grid columns */}
                  <div
                    style={{
                      gridColumn: `${startDayOffset + 2} / span ${durationDays}`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      onClick={() => can('job.plan') && setRescheduleJob(job)}
                      style={{
                        width: '100%',
                        backgroundColor:
                          job.priority === 'critical'
                            ? 'var(--bad)'
                            : job.priority === 'high'
                            ? 'var(--warn)'
                            : 'var(--info)',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: can('job.plan') ? 'pointer' : 'default',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                      title={can('job.plan') ? 'Click to reschedule' : undefined}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.asset} ({job.estimated_hours || 3}h)
                      </span>
                      {can('job.plan') && <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>✎</span>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {rescheduleJob && (
        <RescheduleModal
          job={rescheduleJob}
          onClose={() => setRescheduleJob(null)}
          onSuccess={() => {
            setRescheduleJob(null)
            reload()
            toast(`Job ${rescheduleJob.wo_number} rescheduled.`, 'ok')
          }}
        />
      )}
    </div>
  )
}

function RescheduleModal({ job, onClose, onSuccess }) {
  const [scheduledStart, setScheduledStart] = useState(job.start ? job.start.slice(0, 16) : '')
  const [estimatedHours, setEstimatedHours] = useState(job.estimated_hours || 4)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.put(`/api/jobs/${job.id}/reschedule`, {
        scheduled_start: new Date(scheduledStart).toISOString(),
        estimated_hours: parseFloat(estimatedHours),
      })
      onSuccess()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Reschedule ${job.wo_number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />
        <div>
          <label>Work Order</label>
          <div style={{ fontWeight: 600 }}>{job.title}</div>
          <div className="small muted">Machine: {job.asset}</div>
        </div>

        <div>
          <label>Scheduled Start Time *</label>
          <input
            type="datetime-local"
            required
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
          />
        </div>

        <div>
          <label>Estimated Duration (Hours) *</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            required
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
