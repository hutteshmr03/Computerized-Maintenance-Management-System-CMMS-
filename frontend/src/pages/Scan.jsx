import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { CriticalityBadge, ErrorNote, Loading, fmtDate, money, useToast } from '../ui.jsx'

const QUICK_TAGS = ['AST-0001', 'AST-0002', 'AST-0003', 'AST-0004', 'AST-0005', 'AST-0006', 'CMP-0001']

export default function Scan() {
  const { code: urlCode } = useParams()
  const [code, setCode] = useState(urlCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assetContext, setAssetContext] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const navigate = useNavigate()
  const toast = useToast()

  const lookupAsset = async (targetCode) => {
    if (!targetCode || !targetCode.trim()) return
    setError('')
    setLoading(true)
    const startTime = performance.now()
    try {
      const a = await api.get('/api/assets/by-code/' + encodeURIComponent(targetCode.trim()))
      const elapsed = Math.round(performance.now() - startTime)
      setAssetContext(a)
      toast(`Asset identified in ${elapsed} ms: ${a.name}`, 'ok')
    } catch (e) {
      setError(e.message)
      setAssetContext(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlCode) lookupAsset(urlCode)
  }, [urlCode])

  const startCamera = async () => {
    setError('')
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setCameraActive(true)
        }
      } else {
        setError('Camera access not supported on this browser.')
      }
    } catch {
      setError('Unable to activate camera. Please grant camera permission or use manual code entry.')
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="stack">
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>QR & Equipment Scanner</h1>
        <p className="lead muted" style={{ margin: '4px 0 0' }}>
          Instant equipment context in &lt; 2 seconds. Glove-friendly touch targets.
        </p>
      </div>

      <ErrorNote error={error} />

      {/* Camera / Scanner Frame */}
      <div
        className="panel"
        style={{
          position: 'relative',
          padding: '16px',
          backgroundColor: '#1d2326',
          color: '#ffffff',
          borderRadius: '12px',
          textAlign: 'center',
          overflow: 'hidden',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {cameraActive ? (
          <div style={{ width: '100%', position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'cover' }}
            />
            {/* Viewfinder crosshair overlay */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '180px',
                height: '180px',
                border: '3px solid var(--yellow)',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
              }}
            />
            <button
              onClick={stopCamera}
              className="small"
              style={{ marginTop: '8px', backgroundColor: '#333', color: '#fff' }}
            >
              Close Camera
            </button>
          </div>
        ) : (
          <div className="stack" style={{ alignItems: 'center', gap: '12px', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem' }}>📷</div>
            <button
              type="button"
              className="primary"
              onClick={startCamera}
              style={{ minHeight: '48px', minWidth: '180px', fontSize: '1rem', fontWeight: 600 }}
            >
              Scan Machine QR Tag
            </button>
            <div className="small" style={{ color: '#aaa' }}>
              Or enter asset code below or tap a quick machine tag
            </div>
          </div>
        )}
      </div>

      {/* Manual Code Entry Form */}
      <div className="panel stack" style={{ padding: '16px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            lookupAsset(code)
          }}
          className="row"
          style={{ gap: '8px', flexWrap: 'nowrap' }}
        >
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Type code e.g. AST-0001"
            style={{
              flex: 1,
              minHeight: '48px',
              fontSize: '1.05rem',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
            autoFocus
          />
          <button
            type="submit"
            className="primary"
            disabled={!code.trim() || loading}
            style={{ minHeight: '48px', padding: '0 20px', fontWeight: 600 }}
          >
            {loading ? 'Locating…' : 'Search'}
          </button>
        </form>

        {/* Quick Tag Chips for Instant Testing */}
        <div>
          <div className="small muted" style={{ marginBottom: '6px' }}>Quick Plant Equipment Tags:</div>
          <div className="row" style={{ gap: '6px' }}>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="small"
                onClick={() => {
                  setCode(tag)
                  lookupAsset(tag)
                }}
                style={{
                  minHeight: '36px',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--paper)',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Identified Asset Context Result */}
      {assetContext && (
        <div
          className="panel stack"
          style={{
            borderLeft: '5px solid var(--ok)',
            backgroundColor: 'var(--panel)',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{assetContext.code}</span>
                {assetContext.criticality && <CriticalityBadge grade={assetContext.criticality} />}
                {assetContext.under_warranty && <span className="badge green small">Warranty</span>}
              </div>
              <h2 style={{ margin: '2px 0' }}>{assetContext.name}</h2>
              <div className="small muted">
                📍 {assetContext.location} • Cost Centre: {assetContext.cost_centre || 'Plant'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>
            <div>
              <span className="muted small">Running Hours:</span>
              <div style={{ fontWeight: 600 }}>{assetContext.running_hours ? `${assetContext.running_hours} h` : '—'}</div>
            </div>
            <div>
              <span className="muted small">Replacement Value:</span>
              <div style={{ fontWeight: 600 }}>{money(assetContext.replacement_value)}</div>
            </div>
          </div>

          {/* Action buttons (min 48px height for glove-friendly use) */}
          <div className="row" style={{ gap: '10px', marginTop: '4px' }}>
            <Link
              to={`/jobs/new?asset_id=${assetContext.id}`}
              className="btn primary"
              style={{
                flex: 1,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ⚠️ Report Problem / Raise WO
            </Link>

            <Link
              to={`/assets/${assetContext.id}`}
              className="btn"
              style={{
                flex: 1,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ⚙️ Full Machine Context →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
