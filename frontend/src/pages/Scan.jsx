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
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try { await videoRef.current.play() } catch {}
          setCameraActive(true)

          // Check if torch capability is available
          const track = stream.getVideoTracks()[0]
          if (track && track.getCapabilities) {
            const caps = track.getCapabilities()
            if (caps.torch) setHasTorch(true)
          }
        }
      } else {
        setError('Camera access not supported on this browser.')
      }
    } catch {
      setCameraActive(false)
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
        /* Authentic PhonePe QR Scanner Styles */
        .phonepe-scanner-card {
          position: relative;
          width: 100%;
          background: #000000;
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 36px 16px 28px 16px;
          box-sizing: border-box;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
        }

        .phonepe-viewfinder-area {
          position: relative;
          width: 270px;
          height: 270px;
          max-width: calc(100vw - 64px);
          max-height: calc(100vw - 64px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
          border-radius: 24px;
          cursor: pointer;
        }

        .phonepe-video-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 20px;
          background: #000000;
          transition: opacity 0.2s ease;
        }

        .phonepe-reticle-box {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .phonepe-corner {
          position: absolute;
          width: 54px;
          height: 54px;
          border-color: #8417f7;
          border-style: solid;
          border-width: 0;
        }

        .phonepe-corner.tl {
          top: 0;
          left: 0;
          border-top-width: 4.5px;
          border-left-width: 4.5px;
          border-top-left-radius: 22px;
        }

        .phonepe-corner.tr {
          top: 0;
          right: 0;
          border-top-width: 4.5px;
          border-right-width: 4.5px;
          border-top-right-radius: 22px;
        }

        .phonepe-corner.bl {
          bottom: 0;
          left: 0;
          border-bottom-width: 4.5px;
          border-left-width: 4.5px;
          border-bottom-left-radius: 22px;
        }

        .phonepe-corner.br {
          bottom: 0;
          right: 0;
          border-bottom-width: 4.5px;
          border-right-width: 4.5px;
          border-bottom-right-radius: 22px;
        }

        .phonepe-laser-beam {
          position: absolute;
          left: 14px;
          right: 14px;
          height: 2.5px;
          background: linear-gradient(90deg, transparent 0%, #8417f7 20%, #c084fc 50%, #8417f7 80%, transparent 100%);
          box-shadow: 0 0 12px 2px rgba(132, 23, 247, 0.85);
          border-radius: 2px;
          animation: phonepe-laser-sweep 2.2s ease-in-out infinite alternate;
        }

        @keyframes phonepe-laser-sweep {
          0% {
            top: 12px;
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: calc(100% - 14px);
            opacity: 0.75;
          }
        }

        .phonepe-actions-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 52px;
          margin-top: 32px;
          margin-bottom: 6px;
          width: 100%;
        }

        .phonepe-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          outline: none;
          user-select: none;
          transition: transform 0.15s ease;
        }

        .phonepe-action-btn:hover {
          transform: translateY(-2px);
        }

        .phonepe-action-icon {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }

        .phonepe-action-btn:hover .phonepe-action-icon {
          background: rgba(255, 255, 255, 0.22);
        }

        .phonepe-action-icon.torch-active {
          background: #8417f7;
          box-shadow: 0 0 16px rgba(132, 23, 247, 0.65);
        }

        .phonepe-action-label {
          color: #f3f4f6;
          font-size: 13px;
          font-weight: 500;
          margin-top: 10px;
          font-family: inherit;
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#111827' }}>
          QR & Equipment Scanner
        </h1>
      </div>

      <ErrorNote error={error} />

      {/* PhonePe-Style QR Scanner Viewport matching reference */}
      <div className="phonepe-scanner-card">
        {/* Hidden File Input for Gallery Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Viewfinder frame */}
        <div
          className="phonepe-viewfinder-area"
          onClick={() => {
            if (!cameraActive) startCamera(facingMode)
          }}
          title={cameraActive ? '' : 'Tap to open camera'}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="phonepe-video-feed"
            style={{ opacity: cameraActive ? 1 : 0 }}
          />

          {/* 4 Purple Corner Brackets exactly matching screenshot */}
          <div className="phonepe-reticle-box">
            <span className="phonepe-corner tl" />
            <span className="phonepe-corner tr" />
            <span className="phonepe-corner bl" />
            <span className="phonepe-corner br" />
            <span className="phonepe-laser-beam" />
          </div>
        </div>

        {/* Bottom Circular Action Buttons: Upload QR & Torch */}
        <div className="phonepe-actions-row">
          <button
            type="button"
            className="phonepe-action-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="phonepe-action-icon">
              {/* Photo/Gallery Icon matching PhonePe */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                <circle cx="16" cy="8.5" r="1.5" fill="#ffffff" stroke="none" />
                <path d="M4 17.5c2.5-3 5-4.5 7.5-2 2.5 2.5 5-0.5 8 2" />
              </svg>
            </div>
            <span className="phonepe-action-label">Upload QR</span>
          </button>

          <button
            type="button"
            className="phonepe-action-btn"
            onClick={() => {
              if (!cameraActive) {
                startCamera(facingMode).then(() => toggleTorch())
              } else {
                toggleTorch()
              }
            }}
          >
            <div className={`phonepe-action-icon ${torchOn ? 'torch-active' : ''}`}>
              {/* Flashlight/Torch Icon matching PhonePe */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 2h10l2 6H5l2-6z" />
                <line x1="5" y1="8" x2="19" y2="8" />
                <path d="M6.5 8l1.2 12a2 2 0 0 0 2 1.8h4.6a2 2 0 0 0 2-1.8L17.5 8" />
                <line x1="12" y1="12" x2="12" y2="15" />
              </svg>
            </div>
            <span className="phonepe-action-label">Torch</span>
          </button>
        </div>
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
              No recently searched equipment tags yet.
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
