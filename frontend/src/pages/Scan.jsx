import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { CriticalityBadge, ErrorNote, Loading, fmtDate, money, useToast } from '../ui.jsx'

export default function Scan() {
  const { user } = useAuth()
  const { code: urlCode } = useParams()
  const [code, setCode] = useState(urlCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assetContext, setAssetContext] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [permissionPrompt, setPermissionPrompt] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')

  // User-scoped recently searched tags
  const userKey = user?.id || user?.email || 'guest'
  const storageKey = `cmms_recent_searches_${userKey}`
  const [recentSearches, setRecentSearches] = useState([])

  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const toast = useToast()

  // Load recently searched tags for the individual logged-in user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setRecentSearches(parsed)
      } else {
        setRecentSearches([])
      }
    } catch {
      setRecentSearches([])
    }
  }, [storageKey])

  const addRecentSearch = (itemCode) => {
    if (!itemCode || !itemCode.trim()) return
    const upper = itemCode.trim().toUpperCase()
    setRecentSearches((prev) => {
      const filtered = prev.filter((c) => c !== upper)
      const updated = [upper, ...filtered].slice(0, 8)
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    try {
      localStorage.removeItem(storageKey)
    } catch {}
  }

  const lookupAsset = async (targetCode) => {
    if (!targetCode || !targetCode.trim()) return
    const cleanCode = targetCode.trim().toUpperCase()
    setError('')
    setLoading(true)
    const startTime = performance.now()
    try {
      const a = await api.get('/api/assets/by-code/' + encodeURIComponent(cleanCode))
      const elapsed = Math.round(performance.now() - startTime)
      setAssetContext(a)
      addRecentSearch(cleanCode)
      toast(`Asset identified in ${elapsed} ms: ${a.name}`, 'ok')
    } catch (e) {
      setError(e.message)
      setAssetContext(null)
      addRecentSearch(cleanCode)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (urlCode) lookupAsset(urlCode)
  }, [urlCode])

  const startCamera = async (mode = facingMode) => {
    setError('')
    setPermissionPrompt(false)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setCameraActive(true)
          setPermissionPrompt(false)

          // Check if torch capability is available
          const track = stream.getVideoTracks()[0]
          if (track && track.getCapabilities) {
            const caps = track.getCapabilities()
            if (caps.torch) setHasTorch(true)
          }
        }
      } else {
        setPermissionPrompt(true)
        setError('Camera access not supported on this browser.')
      }
    } catch {
      setPermissionPrompt(true)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setTorchOn(false)
  }

  const toggleTorch = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const track = videoRef.current.srcObject.getVideoTracks()[0]
      if (track) {
        try {
          const nextTorch = !torchOn
          await track.applyConstraints({ advanced: [{ torch: nextTorch }] })
          setTorchOn(nextTorch)
        } catch {
          toast('Flashlight not supported on this camera', 'info')
        }
      }
    }
  }

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    stopCamera()
    await startCamera(nextMode)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] })
        const img = new Image()
        img.src = URL.createObjectURL(file)
        await img.decode()
        const barcodes = await detector.detect(img)
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue
          const match = raw.match(/AST-\d+|CMP-\d+/i) ? raw.match(/AST-\d+|CMP-\d+/i)[0] : raw.split('/').pop()
          if (match) {
            setCode(match.toUpperCase())
            lookupAsset(match)
            return
          }
        }
      }
      const fnMatch = file.name.match(/AST-\d+|CMP-\d+/i)
      if (fnMatch) {
        setCode(fnMatch[0].toUpperCase())
        lookupAsset(fnMatch[0])
        return
      }
      toast('Could not detect QR code in image. Please enter code manually.', 'warn')
    } catch {
      toast('Failed to process image file.', 'bad')
    }
  }

  // Auto-request camera access on landing
  useEffect(() => {
    startCamera(facingMode)
    return () => stopCamera()
  }, [])

  // QR Code detection loop using native BarcodeDetector if available
  useEffect(() => {
    if (!cameraActive) return
    let intervalId = null

    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] })
        intervalId = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes && barcodes.length > 0) {
                const raw = barcodes[0].rawValue
                const match = raw.match(/AST-\d+|CMP-\d+/i) ? raw.match(/AST-\d+|CMP-\d+/i)[0] : raw.split('/').pop()
                if (match && match.toUpperCase() !== code) {
                  if (navigator.vibrate) navigator.vibrate(100)
                  setCode(match.toUpperCase())
                  lookupAsset(match)
                }
              }
            } catch {}
          }
        }, 350)
      } catch {}
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [cameraActive, code])

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="stack">
      <style>{`
        /* PhonePe-Inspired QR Scanner Styles */
        .phonepe-scanner-wrapper {
          position: relative;
          width: 100%;
          background: #0d0c1d;
          background: radial-gradient(circle at 50% 30%, #1c1836 0%, #0d0c1d 85%);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(13, 12, 29, 0.4), inset 0 0 0 1px rgba(124, 58, 237, 0.25);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 380px;
          box-sizing: border-box;
        }

        .phonepe-video-container {
          position: relative;
          width: 100%;
          height: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .phonepe-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .phonepe-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .phonepe-reticle {
          position: relative;
          width: 230px;
          height: 230px;
          box-shadow: 0 0 0 9999px rgba(8, 7, 18, 0.65);
          border-radius: 16px;
        }

        .phonepe-corner {
          position: absolute;
          width: 32px;
          height: 32px;
          border-color: #8b5cf6;
          border-style: solid;
          border-width: 0;
          filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.8));
        }

        .phonepe-corner.tl {
          top: -2px;
          left: -2px;
          border-top-width: 4px;
          border-left-width: 4px;
          border-top-left-radius: 14px;
        }

        .phonepe-corner.tr {
          top: -2px;
          right: -2px;
          border-top-width: 4px;
          border-right-width: 4px;
          border-top-right-radius: 14px;
        }

        .phonepe-corner.bl {
          bottom: -2px;
          left: -2px;
          border-bottom-width: 4px;
          border-left-width: 4px;
          border-bottom-left-radius: 14px;
        }

        .phonepe-corner.br {
          bottom: -2px;
          right: -2px;
          border-bottom-width: 4px;
          border-right-width: 4px;
          border-bottom-right-radius: 14px;
        }

        .phonepe-laser-beam {
          position: absolute;
          left: 8px;
          right: 8px;
          height: 2.5px;
          background: linear-gradient(90deg, transparent 0%, #8b5cf6 20%, #c084fc 50%, #8b5cf6 80%, transparent 100%);
          box-shadow: 0 0 14px 3px rgba(168, 85, 247, 0.85), 0 0 28px 6px rgba(139, 92, 246, 0.45);
          border-radius: 2px;
          animation: phonepe-laser-sweep 2s ease-in-out infinite alternate;
        }

        @keyframes phonepe-laser-sweep {
          0% {
            top: 8px;
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: calc(100% - 11px);
            opacity: 0.85;
          }
        }

        .phonepe-hint-pill {
          margin-top: 24px;
          background: rgba(15, 13, 30, 0.85);
          border: 1px solid rgba(139, 92, 246, 0.25);
          color: #f1f5f9;
          font-size: 0.8rem;
          font-weight: 500;
          padding: 6px 18px;
          border-radius: 20px;
          backdrop-filter: blur(8px);
          letter-spacing: 0.01em;
          pointer-events: auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .phonepe-controls-bar {
          position: absolute;
          bottom: 14px;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 5;
          pointer-events: auto;
        }

        .phonepe-control-btn {
          background: rgba(30, 27, 56, 0.85);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 24px;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;
          backdrop-filter: blur(8px);
        }

        .phonepe-control-btn:hover {
          background: rgba(59, 49, 108, 0.9);
          border-color: #8b5cf6;
          transform: translateY(-1px);
        }

        .phonepe-control-btn.active {
          background: #7c3aed;
          border-color: #a78bfa;
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.6);
        }

        .phonepe-perm-card {
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          z-index: 2;
        }

        .phonepe-pulse-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(124, 58, 237, 0.15);
          border: 2px solid rgba(139, 92, 246, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin-bottom: 20px;
          animation: phonepe-pulse 2s infinite;
        }

        @keyframes phonepe-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5);
          }
          70% {
            box-shadow: 0 0 0 16px rgba(139, 92, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
          }
        }

        .phonepe-primary-btn {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px 28px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }

        .phonepe-primary-btn:hover {
          background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.6);
          transform: translateY(-1px);
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#111827' }}>
          QR & Equipment Scanner
        </h1>
      </div>

      <ErrorNote error={error} />

      {/* PhonePe-Style QR Scanner Viewport */}
      <div className="phonepe-scanner-wrapper">
        {/* Hidden File Input for Gallery Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {cameraActive ? (
          <div className="phonepe-video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="phonepe-video"
            />

            {/* Viewfinder Overlay with 4 Corner Brackets & Animated Laser */}
            <div className="phonepe-overlay">
              <div className="phonepe-reticle">
                <span className="phonepe-corner tl" />
                <span className="phonepe-corner tr" />
                <span className="phonepe-corner bl" />
                <span className="phonepe-corner br" />
                <span className="phonepe-laser-beam" />
              </div>
              <div className="phonepe-hint-pill">
                Align QR code inside the frame to scan
              </div>
            </div>

            {/* Bottom Floating Control Bar */}
            <div className="phonepe-controls-bar">
              {hasTorch && (
                <button
                  type="button"
                  className={`phonepe-control-btn ${torchOn ? 'active' : ''}`}
                  onClick={toggleTorch}
                  title="Toggle Flashlight"
                >
                  ⚡ {torchOn ? 'Torch On' : 'Torch Off'}
                </button>
              )}
              <button
                type="button"
                className="phonepe-control-btn"
                onClick={toggleCameraFacing}
                title="Switch Camera"
              >
                🔄 Flip
              </button>
              <button
                type="button"
                className="phonepe-control-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload QR Code Image"
              >
                🖼️ Gallery
              </button>
              <button
                type="button"
                className="phonepe-control-btn"
                onClick={stopCamera}
                title="Pause Camera"
              >
                ✕ Close
              </button>
            </div>
          </div>
        ) : (
          /* PhonePe Style Camera Permission Prompt Card */
          <div className="phonepe-perm-card">
            <div className="phonepe-pulse-circle">
              <span>📷</span>
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 700 }}>
              Allow Camera Access
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: '0.88rem', maxWidth: '320px', lineHeight: 1.5 }}>
              Camera permission is required to scan machine QR tags instantly.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="phonepe-primary-btn"
                onClick={() => startCamera(facingMode)}
              >
                Allow Camera Access
              </button>
              <button
                type="button"
                className="phonepe-control-btn"
                style={{ padding: '12px 20px', borderRadius: '10px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                🖼️ Upload from Gallery
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Code Entry Form */}
      <div className="panel stack" style={{ padding: '16px', borderRadius: '12px' }}>
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

        {/* Recently Searched for current individual user */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="small muted" style={{ fontWeight: 600 }}>
              Recently Searched:
            </span>
            {recentSearches.length > 0 && (
              <button
                type="button"
                onClick={clearRecentSearches}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear history
              </button>
            )}
          </div>

          {recentSearches.length > 0 ? (
            <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
              {recentSearches.map((tag) => (
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
                    fontWeight: 600,
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title={`Search ${tag}`}
                >
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>⏱</span>
                  {tag}
                </button>
              ))}
            </div>
          ) : (
            <div className="small muted" style={{ fontStyle: 'italic', color: '#9ca3af' }}>
              No recently searched equipment tags yet. Enter an equipment code above or scan a QR tag to begin.
            </div>
          )}
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
            borderRadius: '12px',
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
