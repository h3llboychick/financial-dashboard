import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getWrapped } from '../../api.js'
import { SLIDE_MS, buildSlides, money } from './wrappedSlides.js'

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const handler = event => setReduced(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])
  return reduced
}

function CountUp({ value, currency, enabled, prefix = '', suffix = '' }) {
  const [shown, setShown] = useState(enabled ? 0 : value)
  const frame = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setShown(value)
      return
    }
    const start = performance.now()
    const duration = 1100
    const step = now => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(value * eased)
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value, enabled])

  return <span className="tabular-nums">{prefix}{money(shown, currency)}{suffix}</span>
}

export default function Wrapped({ year, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  const touchStart = useRef(null)

  useEffect(() => {
    let alive = true
    getWrapped(year)
      .then(result => { if (alive) setData(result) })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [year])

  const slides = useMemo(() => (data ? buildSlides(data) : []), [data])
  const total = slides.length

  const next = useCallback(() => setIndex(current => Math.min(current + 1, total - 1)), [total])
  const prev = useCallback(() => setIndex(current => Math.max(current - 1, 0)), [total])

  useEffect(() => {
    if (paused || reduced || total === 0) return
    const timer = setTimeout(() => {
      setIndex(current => (current + 1 < total ? current + 1 : current))
    }, SLIDE_MS)
    return () => clearTimeout(timer)
  }, [index, paused, reduced, total])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') prev()
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  if (error) {
    return createPortal((
      <div className="fixed inset-0 z-[60] h-[100dvh] w-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-white/20">Close</button>
        </div>
      </div>
    ), document.body)
  }

  if (!data) {
    return createPortal((
      <div className="fixed inset-0 z-[60] h-[100dvh] w-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Putting your year together…</p>
      </div>
    ), document.body)
  }

  const slide = slides[index]

  return createPortal((
    <div className="fixed inset-0 z-[60] h-[100dvh] w-screen bg-gray-950 text-white overflow-hidden overscroll-contain">
      <div className={`absolute -inset-1/4 ${reduced ? '' : 'animate-[drift_18s_ease-in-out_infinite_alternate]'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.35),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(168,85,247,0.35),transparent_45%),radial-gradient(circle_at_50%_95%,rgba(16,185,129,0.30),transparent_50%)] blur-3xl" />
      </div>

      <div className="relative h-full max-w-lg mx-auto px-6 py-6 flex flex-col">
        <div className="flex gap-1.5">
          {slides.map((item, position) => (
            <span key={item.id} className="flex-1 h-[3px] rounded bg-white/20 overflow-hidden">
              <span
                className={`block h-full bg-white ${position < index ? 'w-full' : position === index ? 'w-full origin-left' : 'w-0'}`}
                style={position === index && !reduced ? { animation: `grow ${SLIDE_MS}ms linear` } : undefined}
              />
            </span>
          ))}
        </div>

        <button
          onClick={onClose}
          className="absolute right-5 top-10 text-white/60 hover:text-white text-sm"
          aria-label="Close wrapped"
        >
          ✕
        </button>

        <div
          className="flex-1 flex flex-col justify-center"
          onClick={event => {
            const { left, width } = event.currentTarget.getBoundingClientRect()
            const x = event.clientX - left
            if (x < width / 3) prev()
            else next()
          }}
          onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null }}
          onTouchEnd={event => {
            const start = touchStart.current
            const end = event.changedTouches[0]?.clientX ?? null
            touchStart.current = null
            if (start === null || end === null) return
            const delta = end - start
            if (Math.abs(delta) > 48) {
              if (delta > 0) prev()
              else next()
            }
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            key={slide.id}
            className={reduced ? '' : 'animate-[enter_600ms_cubic-bezier(0.2,0.8,0.2,1)]'}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/80 mb-4">{slide.kicker}</p>

            {slide.title && (
              <h2 className={`text-5xl font-extrabold tracking-tight ${slide.id === 'category' ? 'text-white' : ''}`}>
                {slide.title}
              </h2>
            )}

            {slide.value !== undefined && !slide.title && (
              <div className="flex items-baseline gap-2.5">
                <span className={`text-6xl font-extrabold tracking-tighter ${slide.tone === 'green' ? 'text-emerald-300' : slide.tone === 'red' ? 'text-red-300' : 'text-white'}`}>
                  {slide.raw ? Math.round(slide.value) : <CountUp value={slide.value} currency={data.currency} enabled={!reduced} prefix={slide.prefix ?? ''} />}
                </span>
                {slide.suffix && <span className="text-lg font-medium text-white/55">{slide.suffix}</span>}
              </div>
            )}

            {slide.id === 'category' && (
              <div className="mt-6 space-y-4">
                {slide.categories.map(category => (
                  <div key={category.name}>
                    <div className="flex justify-between text-sm text-white/85">
                      <span>{category.name}</span>
                      <span className="tabular-nums text-white/60">{money(category.amount, data.currency)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(100, category.share)}%`, background: category.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.bars && (
              <div className={`mt-8 ${slide.bars.length > 5 ? 'space-y-2' : 'space-y-5'}`}>
                {slide.bars.map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-sm text-white/85">
                      <span>{bar.label}</span>
                      <span className="tabular-nums">{bar.display ?? money(bar.value, data.currency)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded bg-gradient-to-r ${bar.color}`}
                        style={{ width: `${Math.max(2, (bar.value / slide.barMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {slide.weekdays && (
              <div className="mt-8 grid grid-cols-7 gap-2">
                {slide.weekdays.map((day, position) => (
                  <div key={`${day.label}-${position}`} className="text-center">
                    <div
                      className="h-12 rounded-lg"
                      style={{
                        background: `rgba(52, 211, 153, ${0.15 + day.ratio * 0.85})`,
                        transform: reduced ? 'none' : 'scale(1)',
                      }}
                    />
                    <div className="mt-1 text-[10px] uppercase text-white/50">{day.label}</div>
                  </div>
                ))}
              </div>
            )}

            {slide.body && <p className="mt-6 text-[15px] leading-relaxed text-white/75">{slide.body}</p>}

            {slide.final && (
              <button
                onClick={event => { event.stopPropagation(); onClose() }}
                className="mt-8 px-5 py-2.5 rounded-full border border-white/25 text-sm text-white/90 hover:bg-white/10"
              >
                Done
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between text-[11px] text-white/35">
          <span>wrapped {data.year}</span>
          <span>{index + 1} / {total}</span>
        </div>
      </div>

      <style>{`
        @keyframes enter {
          from { opacity: 0; transform: translateY(28px) scale(0.98); filter: blur(6px); }
          to { opacity: 1; transform: none; filter: none; }
        }
        @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes drift {
          from { transform: translate3d(-3%, -2%, 0) scale(1); }
          to { transform: translate3d(4%, 3%, 0) scale(1.12); }
        }
      `}</style>
    </div>
  ), document.body)
}
