import { useEffect, useState } from 'react'

import { restDoneFeedback } from '../lib/haptics.ts'
import { useRestTimer } from '../store/useRestTimer.ts'

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Плашка отдыха над нижним меню.
 *
 * Отсчёт считается от endsAt при каждом тике, а не уменьшается сам по себе:
 * так возврат из фона показывает правильное время, а не отставшее.
 */
export default function RestBar() {
  const endsAt = useRestTimer((s) => s.endsAt)
  const totalSec = useRestTimer((s) => s.totalSec)
  const finished = useRestTimer((s) => s.finished)
  const addTime = useRestTimer((s) => s.addTime)
  const dismiss = useRestTimer((s) => s.dismiss)
  const markFinished = useRestTimer((s) => s.markFinished)

  const [remaining, setRemaining] = useState(() =>
    endsAt === null ? 0 : Math.ceil((endsAt - Date.now()) / 1000),
  )

  useEffect(() => {
    if (endsAt === null) return

    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0) markFinished()
    }

    tick()
    const id = setInterval(tick, 250)

    // возврат из фона: пересчитать сразу, не дожидаясь тика
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt, markFinished])

  // вибрация ровно один раз на переход в «окончен»
  useEffect(() => {
    if (finished) void restDoneFeedback()
  }, [finished])

  if (endsAt === null) return null

  const progress = totalSec > 0 ? Math.min(1, Math.max(0, 1 - remaining / totalSec)) : 1

  return (
    <div className="border-t border-border bg-surface-2">
      {/* полоса прогресса: сколько отдыха уже прошло */}
      <div
        className={`h-0.5 origin-left transition-transform duration-200 ease-linear ${
          finished ? 'bg-accent' : 'bg-accent/50'
        }`}
        style={{ transform: `scaleX(${progress})` }}
      />

      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-body text-muted">{finished ? 'отдых окончен' : 'отдых'}</span>

        <span
          className={`flex-1 text-center font-num text-timer font-semibold ${
            finished ? 'text-accent-ink' : 'text-text'
          }`}
        >
          {formatClock(remaining)}
        </span>

        <button
          type="button"
          onClick={() => addTime(30)}
          className="min-h-12 rounded-ctl border border-border px-3 text-body"
        >
          +30
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-12 px-3 text-body text-muted"
          aria-label={finished ? 'Закрыть' : 'Пропустить отдых'}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
