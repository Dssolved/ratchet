import { weeklyStreak } from '../domain/achievements.ts'
import {
  daysSinceLastWorkout,
  suggestedTemplateId,
  weekDays,
  weekProgress,
} from '../domain/selectors.ts'
import type { AppData } from '../domain/types.ts'
import MovementCard from '../components/MovementCard.tsx'
import WeekStrip from '../components/WeekStrip.tsx'
import { plural } from '../lib/plural.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  data: AppData
  onStarted: (workoutId: string) => void
}

/**
 * «2 дня отдыха» — отвечает на «пора или ещё отдыхаю» прямее любой сетки.
 *
 * Считаются **прожитые дни отдыха, а не календарные промежутки**: тренировался в среду,
 * сегодня суббота — промежутков три, но отдыхал ты четверг и пятницу, а суббота ещё
 * не определилась. Поэтому от разницы дат отнимается единица.
 */
function restLine(days: number | undefined): string {
  if (days === undefined) return 'тренировок ещё не было'
  if (days === 0) return 'сегодня уже занимался'
  if (days === 1) return 'вчера была тренировка'
  const rest = days - 1
  return `${rest} ${plural(rest, 'день', 'дня', 'дней')} отдыха`
}

/**
 * Экран до тренировки.
 *
 * Порядок задан Д-27: сверху то, что только читают, ниже — то, что нажимают.
 * Главное действие уехало в полосу «Начать» над нижним меню, поэтому выбор дня здесь
 * сжат до ряда чипов: он стал запасным путём, а не основным.
 */
export default function Today({ data, onStarted }: Props) {
  const startWorkout = useStore((s) => s.startWorkout)
  const suggested = suggestedTemplateId(data)
  const week = weekProgress(data)
  const streak = weeklyStreak(data)
  const days = weekDays(data)
  const rest = daysSinceLastWorkout(data)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <WeekStrip days={days} />

        {/* одна строка, а не три: наверху экрана читают, а не изучают */}
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-title">{restLine(rest)}</span>
          <span className="flex shrink-0 items-baseline gap-2 text-body text-muted">
            <span className="font-num text-text">
              {week.done}/{week.target}
            </span>
            {streak.current > 0 && (
              <span className="text-accent-ink">
                стрик <span className="font-num">{streak.current}</span>
              </span>
            )}
          </span>
        </p>
      </section>

      {/* заголовок нужен: после Д-28 дни называются как упражнения, и без подписи
          чип «Подтягивания» стоит вплотную к карточке «Подтягивания» */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">День</h2>
        <div className="flex flex-wrap gap-2">
          {data.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() =>
                onStarted(startWorkout(template.movementIds.length > 0 ? template.id : null))
              }
              className={`min-h-12 flex-1 rounded-ctl border bg-surface px-3 text-body font-medium ${
                template.id === suggested
                  ? 'border-text text-text'
                  : 'border-border text-muted'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Упражнения</h2>
        {data.movements
          .filter((m) => !m.archived)
          .map((movement) => (
            <MovementCard key={movement.id} data={data} movement={movement} />
          ))}
      </section>
    </div>
  )
}
