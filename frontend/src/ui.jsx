import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { flushOfflineQueue, getOfflineQueue } from './api'

export const STATUS = {
  created: { label: 'Created', icon: '○', cls: 'blue' },
  planned: { label: 'Planned', icon: '📅', cls: 'blue' },
  open: { label: 'Open', icon: '○', cls: 'blue' },
  normal: { label: 'Normal', icon: '○', cls: 'blue' },
  sent_for_approval: { label: 'Waiting for approval', icon: '◔', cls: 'amber' },
  assigned: { label: 'Assigned', icon: '👤', cls: 'amber' },
  warning: { label: 'Warning', icon: '⚠', cls: 'amber' },
  high: { label: 'High', icon: '▲', cls: 'amber' },
  approved: { label: 'Approved', icon: '✓', cls: 'green' },
  operational: { label: 'Operational', icon: '✓', cls: 'green' },
  ok: { label: 'OK', icon: '✓', cls: 'green' },
  closed: { label: 'Closed', icon: '✓✓', cls: 'green' },
  in_progress: { label: 'In progress', icon: '▶', cls: 'teal' },
  completed: { label: 'Completed', icon: '✓✓', cls: 'teal' },
  review: { label: 'In review', icon: '🔍', cls: 'teal' },
  breakdown: { label: 'Breakdown', icon: '⚡', cls: 'red' },
  critical: { label: 'Critical', icon: '🚨', cls: 'red' },
  overdue: { label: 'Overdue', icon: '⌛', cls: 'red' },
  rejected: { label: 'Rejected', icon: '✕', cls: 'red' },
  low: { label: 'Low', icon: '▽', cls: 'red' },
}

export const PRIORITY = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const DIN_TYPES = {
  inspection: { label: 'Inspection', de: 'Inspektion', cls: 'din-insp', code: 'DIN-INSP' },
  servicing: { label: 'Servicing', de: 'Wartung', cls: 'din-serv', code: 'DIN-SERV' },
  repair: { label: 'Repair', de: 'Instandsetzung', cls: 'din-rep', code: 'DIN-REP' },
  improvement: { label: 'Improvement', de: 'Verbesserung', cls: 'din-imp', code: 'DIN-IMP' },
}

export const CRITICALITY = {
  A: { label: 'Criticality A (High)', cls: 'crit-a' },
  B: { label: 'Criticality B (Medium)', cls: 'crit-b' },
  C: { label: 'Criticality C (Low)', cls: 'crit-c' },
}

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
export const num = (n, d = 1) => (n == null ? 'n/a' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }))
export const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
export const fmtDateTime = (s) =>
  s ? new Date(s + (s.endsWith('Z') ? '' : 'Z')).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, icon: '', cls: 'grey' }
  return <span className={`badge ${s.cls}`}><span aria-hidden="true">{s.icon}</span> {s.label}</span>
}

export function DinTypeBadge({ type }) {
  const t = DIN_TYPES[type?.toLowerCase()] || { label: type || 'Standard', cls: 'grey' }
  return <span className={`badge ${t.cls}`} title={t.de ? `DIN 31051: ${t.de}` : ''}>{t.label}</span>
}

export function CriticalityBadge({ grade }) {
  const g = grade?.toUpperCase() || 'C'
  const c = CRITICALITY[g] || { label: `Crit ${g}`, cls: 'crit-c' }
  return <span className={`crit-badge ${c.cls}`} title={c.label}>Crit {g}</span>
}

export function Pill({ tone = 'grey', children }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

const STEPS = ['Created', 'Planned', 'Approval', 'Approved', 'In progress', 'Review', 'Closed']
const STEP_INDEX = {
  created: 0,
  planned: 1,
  sent_for_approval: 2,
  approved: 3,
  in_progress: 4,
  review: 5,
  completed: 6,
  closed: 6,
  rejected: 2,
}

export function StepBar({ status }) {
  const at = STEP_INDEX[status] ?? 0
  const rejected = status === 'rejected'
  return (
    <ol className="steps" aria-label="Job progress">
      {STEPS.map((label, i) => {
        let cls = 'todo'
        if (i < at || status === 'completed' || status === 'closed') cls = 'done'
        else if (i === at) cls = rejected ? 'stop' : 'now'
        const text = i === 2 && rejected ? 'Rejected' : label
        return (
          <li key={label} className={cls} aria-current={i === at ? 'step' : undefined}>
            <span className="rail" />
            <span className="steplabel">{text}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function JobRow({ job, showAsset = true }) {
  const title = job.title
  const asset = job.asset?.name ?? job.asset
  const code = job.asset?.code ?? job.asset_code
  const dinType = job.din_type || (job.type === 'repair' ? 'repair' : 'servicing')
  const prioTone = job.priority === 'critical' ? 'red' : job.priority === 'high' ? 'amber' : 'grey'
  const prioLabel = `${PRIORITY[job.priority] || job.priority} priority`

  const infoParts = []
  if (showAsset && (asset || code)) {
    infoParts.push(<span key="asset">{asset}{code ? ` (${code})` : ''}</span>)
  }
  if (job.due_date) {
    infoParts.push(
      <span key="due" className={job.overdue ? 'text-bad' : ''}>
        {job.overdue ? 'Overdue, was due ' : 'Due '}{fmtDate(job.due_date)}
      </span>
    )
  }
  if (job.assigned_to_name) {
    infoParts.push(<span key="assigned">For {job.assigned_to_name}</span>)
  } else if (job.contractor_company) {
    infoParts.push(<span key="vendor">Vendor: {job.contractor_company}</span>)
  }

  return (
    <Link to={`/jobs/${job.id}`} className={`ticket p-${job.priority}`}>
      <div className="ticket-main">
        {/* Row 1 (title row): Job title (bold, full width). WO number as a small muted monospace chip to the right */}
        <div className="ticket-title">
          <span>{title}</span>
          {job.wo_number && <span className="ticket-wo">[{job.wo_number}]</span>}
        </div>

        {/* Row 2 (tags row): DIN type badge + LOTO badge (if present) + Priority badge */}
        <div className="ticket-tags">
          <DinTypeBadge type={dinType} />
          {job.loto_required && (
            <span className="badge red small" title="Mandatory Lockout/Tagout Required">LOTO</span>
          )}
          <span className={`badge ${prioTone} small`}>{prioLabel}</span>
        </div>

        {/* Row 3 (info row): Asset name · Due date (overdue in red) · Assigned to — small muted text, separated by · dots */}
        {infoParts.length > 0 && (
          <div className="ticket-info">
            {infoParts.map((item, idx) => (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {idx > 0 && <span style={{ margin: '0 0.35rem', opacity: 0.5 }}>·</span>}
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status badge: Floated to the far right, vertically centered across all 3 rows */}
      <div className="ticket-status">
        <StatusBadge status={job.status} />
      </div>
    </Link>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Loading() { return <p className="muted" role="status">Loading…</p> }

export function ErrorNote({ error }) {
  if (!error) return null
  return <div className="note bad" role="alert">{error}</div>
}

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const id = useRef(0)
  const push = useCallback((message, tone = 'ok') => {
    const k = ++id.current
    setItems((x) => [...x, { k, message, tone }])
    setTimeout(() => setItems((x) => x.filter((i) => i.k !== k)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.k} className={`toast ${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div id="modal-overlay" className="modal-overlay scrim" onClick={onClose}>
      <div className="modal modal-box" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {children}
      </div>
    </div>
  )
}

/* ---------- data hook ---------- */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    return fn().then((d) => { setData(d); setError('') }).catch((e) => setError(e.message)).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { reload() }, [reload])
  return { data, error, loading, reload, setData }
}

/* ---------- Voice-to-Text Speech Dictation ---------- */
export function SpeechInput({ onTranscript, placeholder = 'Click mic to speak notes...' }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef(null)

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRec) {
      setSupported(true)
      const rec = new SpeechRec()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript || ''
        if (text && onTranscript) {
          onTranscript(text)
        }
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recRef.current = rec
    }
  }, [onTranscript])

  const toggle = () => {
    if (!recRef.current) return
    if (listening) {
      recRef.current.stop()
      setListening(false)
    } else {
      recRef.current.start()
      setListening(true)
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      className={`mic-btn ${listening ? 'listening' : ''}`}
      onClick={toggle}
      title={listening ? 'Stop listening' : placeholder}
      aria-label="Voice-to-text dictation"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        fontSize: '0.85rem',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true">{listening ? '🛑' : '🎙️'}</span>
      <span>{listening ? 'Listening…' : 'Dictate'}</span>
    </button>
  )
}

/* ---------- Persistent Offline & Sync Banner ---------- */
export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [queuedCount, setQueuedCount] = useState(getOfflineQueue().length)
  const [syncing, setSyncing] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      handleAutoSync()
    }
    const onOffline = () => setOnline(false)
    const onQueueChange = (e) => setQueuedCount(e.detail?.count ?? getOfflineQueue().length)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('cmms_queue_change', onQueueChange)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('cmms_queue_change', onQueueChange)
    }
  }, [])

  const handleAutoSync = async () => {
    if (syncing) return
    const currentQueue = getOfflineQueue()
    if (currentQueue.length === 0) return
    setSyncing(true)
    try {
      const result = await flushOfflineQueue()
      setQueuedCount(result.remaining)
      if (result.processed > 0) {
        toast(`Synced ${result.processed} queued changes to server.`, 'ok')
      }
    } catch {
      toast('Failed to sync some offline items. Will retry.', 'bad')
    } finally {
      setSyncing(false)
    }
  }

  if (online && queuedCount === 0) return null

  return (
    <div
      className={`banner ${!online ? 'banner-offline' : 'banner-sync'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: !online ? '#b42318' : '#a96a00',
        color: '#ffffff',
        fontWeight: 500,
        fontSize: '0.9rem',
        borderRadius: 'var(--radius)',
        marginBottom: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{!online ? '⚡ Offline mode' : '🔄 Sync Queue'}:</span>
        <span>
          {!online
            ? `Working locally. Changes are saved and will sync automatically when back online.`
            : `${queuedCount} item${queuedCount > 1 ? 's' : ''} waiting to sync.`}
        </span>
      </div>
      {online && queuedCount > 0 && (
        <button
          onClick={handleAutoSync}
          disabled={syncing}
          style={{
            padding: '4px 12px',
            backgroundColor: '#ffffff',
            color: '#1d2326',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}
