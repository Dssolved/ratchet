import { useEffect, useRef, useState } from 'react'

import { restDoneFeedback, tapFeedback } from '../lib/haptics.ts'
import { playTick, playTone } from '../lib/sound.ts'
import { MIN_LOGGED_SEC, useHoldTimer } from '../store/useHoldTimer.ts'

interface Props {
  /** подпись строки: «1» или «1 Л» */
  label: string
  /**
   * Записать результат. `seconds` — цель, если досчитали до нуля, иначе фактически
   * выдержанное. Не вызывается, если удержание бросили в первые секунды.
   */
  onLog: (seconds: number) => void
  /** бросили: ни записи, ни отдыха */
  onCancel: () => void
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Бегущая строка удержания (Д-34).
 *
 * Разворачивается на месте обычной строки подхода: цифры крупные, потому что телефон
 * лежит на земле, а кнопка одна — «Стоп». Степперы на это время убраны: менять цель
 * посреди подхода бессмысленно.
 *
 * Отсчёт считается от момента окончания при каждом тике, а не уменьшается сам:
 * так возврат из фона показывает правильное время, а не отставшее.
 */
export default function HoldRow({ label, onLog, onCancel }: Props) {
  const startsAt = useHoldTimer((s) => s.startsAt)
  const endsAt = useHoldTimer((s) => s.endsAt)
  const targetSec = useHoldTimer((s) => s.targetSec)

  const [now, setNow] = useState(() => Date.now())
  /** сработать финиш можно только один раз */
  const done = useRef(false)
  /** на какой секунде изготовки уже щёлкнули */
  const ticked = useRef<number | null>(null)

  // тикер перезапускать на каждом кадре нельзя, а обработчики приходят новыми
  // при каждом рендере — держим их в ref и не тащим в зависимости эффекта
  const log = useRef(onLog)
  log.current = onLog

  useEffect(() => {
    const tick = () => {
      const at = Date.now()
      setNow(at)

      if (at < startsAt) {
        // изготовка: щелчок на каждую новую секунду
        const left = Math.ceil((startsAt - at) / 1000)
        if (ticked.current !== left) {
          ticked.current = left
          playTick()
          void tapFeedback()
        }
        return
      }

      if (at >= endsAt && !done.current) {
        done.current = true
        // до нуля досчитали — записываем цель. Выше цели не идём: верх диапазона взят,
        // дальше не выжимать секунды, а усложнять ступень (Д-34)
        playTone()
        void restDoneFeedback()
        log.current(targetSec)
      }
    }

    tick()
    const id = setInterval(tick, 200)

    // возврат из фона: пересчитать сразу, не дожидаясь тика
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [startsAt, endsAt, targetSec])

  const preroll = now < startsAt
  const elapsed = Math.max(0, Math.floor((now - startsAt) / 1000))
  const remaining = Math.ceil((endsAt - now) / 1000)
  const progress = targetSec > 0 ? Math.min(1, Math.max(0, elapsed / targetSec)) : 0

  const stop = () => {
    if (preroll || elapsed < MIN_LOGGED_SEC) {
      onCancel()
      return
    }
    onLog(elapsed)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 font-num text-body text-muted">{label}</span>

      <div className="flex-1 overflow-hidden rounded-ctl border-2 border-accent bg-accent/10">
        {/* полоса: сколько удержания уже прошло */}
        <div
          className="h-0.5 origin-left bg-accent transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${progress})` }}
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-body text-muted">{preroll ? 'приготовься' : 'держи'}</span>
          <span className="flex-1 text-center font-num text-timer font-semibold">
            {preroll ? Math.ceil((startsAt - now) / 1000) : formatClock(remaining)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="min-h-12 rounded-ctl border border-border px-4 text-body"
          >
            {preroll ? 'Отмена' : 'Стоп'}
          </button>
        </div>
      </div>
    </div>
  )
}
