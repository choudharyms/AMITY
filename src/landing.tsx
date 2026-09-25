import { useEffect, useRef, useState, useCallback } from 'react'

/* ─── Constants ─── */
const TOTAL_FRAMES = 300
const SCROLL_HEIGHT_MULTIPLIER = 14 // Much taller scroll = slower, more cinematic pacing

/* ─── Frame path helper ─── */
function framePath(i: number): string {
  const base = import.meta.env.BASE_URL || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  return `${cleanBase}frames/ezgif-frame-${String(i).padStart(3, '0')}.jpg`
}

/* ─── Story chapters (synced to frame ranges) ─── */
interface Chapter {
  label: string
  title: string
  subtitle: string
  startFrame: number
  endFrame: number
  align: 'left' | 'right' | 'center'
}

const chapters: Chapter[] = [
  {
    label: 'ORIGIN',
    title: 'A restaurant closes.\nFood remains.',
    subtitle: 'Every night, tonnes of edible food are discarded — not because nobody wants it, but because there is no bridge between surplus and need.',
    startFrame: 1,
    endFrame: 40,
    align: 'left',
  },
  {
    label: 'SIGNAL',
    title: 'A donor posts surplus\nin under 30 seconds.',
    subtitle: '2–6 hours. That\'s the window before edible food becomes waste. AaharSetu captures what\'s available, where, and how long it\'s safe.',
    startFrame: 48,
    endFrame: 90,
    align: 'right',
  },
  {
    label: 'MATCHING',
    title: 'The algorithm finds\nthe nearest need.',
    subtitle: 'Safety countdown × proximity × capacity × dietary fit. A multi-variable equation solved in milliseconds — every rescue, optimised.',
    startFrame: 98,
    endFrame: 140,
    align: 'left',
  },
  {
    label: 'OPTIMIZATION',
    title: 'Global VRP solver\noptimises the city.',
    subtitle: 'Joint multi-vehicle dispatch with expiry deadlines as hard time windows (VROOM via ORS & Google OR-Tools). Live before/after shows road km saved with zero spoiled meals.',
    startFrame: 148,
    endFrame: 190,
    align: 'center',
  },
  {
    label: 'DRIVER',
    title: 'A volunteer picks up.\nVerified. Tracked.',
    subtitle: 'QR handover, chain-of-custody logging, cold-chain compliance. Every link in the rescue chain is transparent and accountable.',
    startFrame: 198,
    endFrame: 240,
    align: 'right',
  },
  {
    label: 'DELIVERY',
    title: 'A shelter receives\na warm meal.',
    subtitle: 'Weight verified. Temperature logged. Zero waste in transit. Every delivery preserves nutrition — and dignity.',
    startFrame: 248,
    endFrame: 275,
    align: 'left',
  },
  {
    label: 'NETWORK',
    title: 'One rescue becomes\na living network.',
    subtitle: 'Every successful rescue makes the next one faster, smarter, and closer. The city learns to feed itself.',
    startFrame: 278,
    endFrame: 286,
    align: 'center',
  },
]

/* ─── Stats for the final CTA section ─── */
const stats = [
  { value: '2.4T', label: 'kg rescued' },
  { value: '12K+', label: 'meals served' },
  { value: '< 47', label: 'min avg delivery' },
  { value: '94%', label: 'safety score' },
]

/* ─── Smooth lerp helper ─── */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/* ─── Main Landing Component ─── */
export default function Landing({
  onEnter,
  onJoinUs,
  onLogin,
}: {
  onEnter: () => void
  onJoinUs?: () => void
  onLogin?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const [displayFrame, setDisplayFrame] = useState(1)
  const [loadedCount, setLoadedCount] = useState(0)
  const [isReady, setIsReady] = useState(false)

  // Smooth interpolation refs
  const targetFrameRef = useRef(1)
  const currentSmoothFrame = useRef(1)
  const rafRef = useRef<number>(0)
  const dprRef = useRef(Math.min(window.devicePixelRatio || 1, 2))

  /* ─── Fast priority preload (immediate hero entry) ─── */
  useEffect(() => {
    let loaded = 0
    let readyTriggered = false
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES + 1)
    imagesRef.current = images

    const triggerReady = () => {
      if (!readyTriggered) {
        readyTriggered = true
        setIsReady(true)
      }
    }

    // Auto-reveal within 500ms max under all conditions
    const safetyTimer = setTimeout(() => {
      triggerReady()
    }, 500)

    const loadFrame = (i: number, onDone?: () => void) => {
      const img = new Image()
      img.src = framePath(i)
      img.onload = () => {
        loaded++
        setLoadedCount(loaded)
        if (i === 1 || loaded >= 2) {
          triggerReady()
        }
        if (i === 1) {
          drawFrame(1)
        }
        if (onDone) onDone()
      }
      img.onerror = () => {
        loaded++
        setLoadedCount(loaded)
        triggerReady()
        if (onDone) onDone()
      }
      images[i] = img
    }

    // Priority 1: Load initial 10 frames immediately
    for (let i = 1; i <= Math.min(10, TOTAL_FRAMES); i++) {
      loadFrame(i)
    }

    // Priority 2: Stream remaining frames in background chunks
    let nextFrame = 11
    const chunkSize = 15

    const queueNextChunk = () => {
      if (nextFrame > TOTAL_FRAMES) return
      const end = Math.min(nextFrame + chunkSize, TOTAL_FRAMES + 1)
      let chunkRemaining = end - nextFrame
      for (let i = nextFrame; i < end; i++) {
        loadFrame(i, () => {
          chunkRemaining--
          if (chunkRemaining === 0) {
            setTimeout(queueNextChunk, 30)
          }
        })
      }
      nextFrame = end
    }

    const bgTimer = setTimeout(queueNextChunk, 60)

    return () => {
      clearTimeout(safetyTimer)
      clearTimeout(bgTimer)
    }
  }, [])

  /* ─── Draw frame to canvas (DPR-aware with fallback to nearest loaded frame) ─── */
  const drawFrame = useCallback((frameNum: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // Find requested frame, or fallback to closest loaded frame
    let img = imagesRef.current[frameNum]
    if (!img || !img.complete || !img.naturalWidth) {
      // Look backwards for closest loaded frame
      for (let k = frameNum - 1; k >= 1; k--) {
        if (imagesRef.current[k]?.complete && imagesRef.current[k]?.naturalWidth) {
          img = imagesRef.current[k]
          break
        }
      }
      // If none backwards, search forwards
      if (!img || !img.complete || !img.naturalWidth) {
        for (let k = frameNum + 1; k <= TOTAL_FRAMES; k++) {
          if (imagesRef.current[k]?.complete && imagesRef.current[k]?.naturalWidth) {
            img = imagesRef.current[k]
            break
          }
        }
      }
    }
    if (!img || !img.complete || !img.naturalWidth) return

    const dpr = dprRef.current
    const displayW = window.innerWidth
    const displayH = window.innerHeight

    // Set canvas buffer size to DPR-scaled resolution (sharp rendering)
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr

    // Set CSS display size
    canvas.style.width = `${displayW}px`
    canvas.style.height = `${displayH}px`

    // Scale context so drawing ops use logical pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Use high-quality image rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Cover-fit the image
    const imgRatio = img.naturalWidth / img.naturalHeight
    const canvasRatio = displayW / displayH

    let drawW: number, drawH: number, drawX: number, drawY: number
    if (imgRatio > canvasRatio) {
      drawH = displayH
      drawW = displayH * imgRatio
      drawX = (displayW - drawW) / 2
      drawY = 0
    } else {
      drawW = displayW
      drawH = displayW / imgRatio
      drawX = 0
      drawY = (displayH - drawH) / 2
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH)
  }, [])

  /* ─── Smooth animation loop + scroll listener ─── */
  useEffect(() => {
    if (!isReady) return
    drawFrame(1)

    // Scroll → target frame (instant mapping)
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const progress = Math.min(scrollTop / maxScroll, 1)
      targetFrameRef.current = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(progress * (TOTAL_FRAMES - 1)) + 1))
    }

    // Smooth animation loop — lerps current toward target each tick
    const animate = () => {
      const diff = targetFrameRef.current - currentSmoothFrame.current
      // Lerp speed: 0.07 = very smooth & cinematic, slightly sluggish feel
      if (Math.abs(diff) > 0.1) {
        currentSmoothFrame.current = lerp(currentSmoothFrame.current, targetFrameRef.current, 0.07)
        const frameInt = Math.round(currentSmoothFrame.current)
        setDisplayFrame(frameInt)
        drawFrame(frameInt)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    // Resize handler
    const handleResize = () => {
      dprRef.current = Math.min(window.devicePixelRatio || 1, 2)
      drawFrame(Math.round(currentSmoothFrame.current))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [isReady, drawFrame])

  /* ─── Compute chapter visibility (smooth opacity) ─── */
  function getChapterOpacity(chapter: Chapter): number {
    const f = currentSmoothFrame.current
    const fadeIn = 12
    const fadeOut = 12
    if (f < chapter.startFrame) return 0
    if (f > chapter.endFrame) return 0
    // Chapter 1 is the initial hero chapter — 100% visible immediately at frame 1!
    if (chapter.startFrame === 1 && f < chapter.startFrame + fadeIn) {
      return 1
    }
    if (f < chapter.startFrame + fadeIn) {
      return (f - chapter.startFrame) / fadeIn
    }
    if (f > chapter.endFrame - fadeOut) {
      return (chapter.endFrame - f) / fadeOut
    }
    return 1
  }

  function getChapterTranslateY(chapter: Chapter): number {
    const f = currentSmoothFrame.current
    const fadeIn = 12
    if (f < chapter.startFrame) return 60
    if (f > chapter.endFrame) return -30
    // Chapter 1 is at resting position 0 immediately
    if (chapter.startFrame === 1 && f < chapter.startFrame + fadeIn) {
      return 0
    }
    if (f < chapter.startFrame + fadeIn) {
      const t = (f - chapter.startFrame) / fadeIn
      return 60 * (1 - easeOutCubic(t))
    }
    return 0
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  const loadProgress = Math.min(100, Math.round((loadedCount / 3) * 100))

  /* ─── Progress dots ─── */
  const activeChapterIdx = chapters.findIndex(
    ch => displayFrame >= ch.startFrame && displayFrame <= ch.endFrame
  )

  /* ─── CTA opacity ─── */
  const ctaOpacity = displayFrame >= 294 ? Math.min(1, (displayFrame - 294) / 6) : 0

  return (
    <div
      ref={containerRef}
      className="landing-root"
      style={{
        height: `${SCROLL_HEIGHT_MULTIPLIER * 100}vh`,
        backgroundImage: `url(${framePath(1)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ─── Loading overlay ─── */}
      {!isReady && (
        <div className="landing-loader">
          <div className="loader-inner">
            <div className="loader-icon-ring">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="loader-logo">
                <rect x="4" y="4" width="48" height="48" rx="16" fill="#0a1a12" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
                <path d="M18 29L28 19L38 29" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 24C28 24 25 29 25 32.5C25 34.5 26.3 35.5 28 35.5C29.7 35.5 31 34.5 31 32.5C31 29 28 24 28 24Z" fill="#22c55e" />
                <path d="M20 35C23 38 25 39 28 39C31 39 33 38 36 35" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="loader-ring-spin" />
            </div>
            <div className="loader-text">
              <span className="loader-brand">AAHARSETU</span>
            </div>
            <div className="loader-bar-track">
              <div className="loader-bar-fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Sticky canvas ─── */}
      <canvas
        ref={canvasRef}
        className="landing-canvas"
        style={{ opacity: isReady ? 1 : 0 }}
      />

      {/* ─── Persistent gradient overlays ─── */}
      <div className="landing-gradient-top" />
      <div className="landing-gradient-bottom" />
      <div className="landing-vignette" />

      {/* ─── Navigation bar ─── */}
      <nav className="landing-nav" style={{ opacity: isReady ? 1 : 0 }}>
        <div className="nav-left">
          <div className="nav-brand-group">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" className="nav-icon">
              <rect width="48" height="48" rx="12" fill="rgba(10,26,18,0.8)" stroke="rgba(134,239,172,0.3)" strokeWidth="1" />
              <path d="M14 25L24 15L34 25" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 20C24 20 21 25 21 28.5C21 30.5 22.3 27.5 24 27.5C25.7 27.5 27 30.5 27 28.5C27 25 24 20 24 20Z" fill="#22c55e" />
              <path d="M16 31C19 34 21 35 24 35C27 35 29 34 32 31" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="nav-brand-text">
              <span className="nav-brand-name">AaharSetu</span>
              <span className="nav-brand-sub">Food Rescue Network</span>
            </div>
          </div>
        </div>
        <div className="nav-center">
          {chapters.map((ch, i) => (
            <div key={ch.label} className="nav-dot-group">
              <span
                className={`nav-dot${i === activeChapterIdx ? ' active' : i < activeChapterIdx ? ' past' : ''}`}
                title={ch.label}
              />
              {i === activeChapterIdx && <span className="nav-dot-label">{ch.label}</span>}
            </div>
          ))}
        </div>
        <div className="nav-right nav-actions">
          <button className="nav-link-btn" onClick={onLogin ?? onEnter}>
            Sign In
          </button>
          <button className="nav-cta nav-cta-join" onClick={onJoinUs ?? onEnter}>
            Join Us
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="nav-cta" onClick={onEnter} title="Open live operations workspace">
            Dashboard
          </button>
        </div>
      </nav>

      {/* ─── Chapter text overlays ─── */}
      {chapters.map((ch) => {
        const opacity = getChapterOpacity(ch)
        const translateY = getChapterTranslateY(ch)
        if (opacity <= 0.01) return null

        return (
          <div
            key={ch.label}
            className={`chapter-overlay chapter-${ch.align}`}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
            }}
          >
            <div className="chapter-glass">
              <span className="chapter-label">{ch.label}</span>
              <h2 className="chapter-title">{ch.title}</h2>
              <p className="chapter-subtitle">{ch.subtitle}</p>
            </div>
          </div>
        )
      })}


      {/* ─── Final CTA section ─── */}
      <div className="landing-cta-section" style={{
        opacity: ctaOpacity,
        pointerEvents: ctaOpacity > 0.3 ? 'auto' : 'none',
        transform: `translateY(${(1 - ctaOpacity) * 30}px)`,
      }}>
        <div className="cta-glass">
          <div className="cta-stats">
            {stats.map(s => (
              <div key={s.label} className="cta-stat">
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="cta-divider" />
          <div className="cta-content">
            <h2 className="cta-headline">Ready to rescue<br />your city's surplus?</h2>
            <p className="cta-desc">Join Bengaluru's real-time food rescue network.<br />Every meal saved is a life touched.</p>
            <div className="cta-actions-group">
              <button className="cta-button" onClick={onJoinUs ?? onEnter}>
                <span>Join Us / Register Partner</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="cta-secondary-btn" onClick={onLogin ?? onEnter}>
                <span>Sign In to Account</span>
              </button>
            </div>
            <button className="nav-link-btn cta-explore-btn" onClick={onEnter}>
              Explore Dashboard Directly →
            </button>
          </div>
        </div>
      </div>

      {/* ─── Scroll prompt ─── */}
      {isReady && displayFrame <= 3 && (
        <div className="scroll-prompt">
          <div className="scroll-line" />
          <span>Scroll to explore the rescue journey</span>
        </div>
      )}
    </div>
  )
}
