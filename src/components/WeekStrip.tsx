import type { WeekDay } from '../domain/selectors.ts'

/**
 * Неделя семью клетками: в какие дни была тренировка.
 *
 * **Ни одного акцентного цвета.** Акцент на экране один, и он принадлежит кнопке
 * «Начать» (Д-27); семь клеток — это повторяющийся элемент, а гасить надо повторяющееся,
 * а не главное (docs/design.md#правило-акцента).
 *
 * **Пропущенный день ничем не помечен.** Полоска показывает факт и не штрафует за дырки:
 * дневной стрик отвергнут ещё в Д-10, потому что толкает к перетренированности, и через
 * картинку он возвращаться не должен.
 */
export default function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="flex gap-1">
      {days.map((day) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-label text-muted">{day.label}</span>
          <span
            className={`h-8 w-full rounded-ctl ${
              day.done > 0
                ? 'bg-text'
                : day.future
                  ? 'border border-border'
                  : 'bg-surface-2'
            } ${day.today ? 'outline-2 outline-offset-2 outline-text' : ''}`}
          />
        </div>
      ))}
    </div>
  )
}
