import {
  formatSets,
  movementById,
  setsOfMovement,
  weekProgress,
  workoutTotals,
} from '../domain/selectors.ts'
import { currentStep, type AppData, type Workout } from '../domain/types.ts'
import { plural } from '../lib/plural.ts'

interface Props {
  data: AppData
  workout: Workout
  onDone: () => void
}

/** Итог тренировки. Рекорды и взятые ступени появятся здесь на шагах 4 и 6. */
export default function Summary({ data, workout, onDone }: Props) {
  const totals = workoutTotals(data, workout)
  const week = weekProgress(data)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-title font-semibold">Тренировка записана</h1>
        <p className="text-body text-muted">
          <span className="font-num text-text">{totals.durationMin}</span> мин ·{' '}
          <span className="font-num text-text">{totals.sets}</span>{' '}
          {plural(totals.sets, 'подход', 'подхода', 'подходов')} ·{' '}
          <span className="font-num text-text">{totals.reps}</span>{' '}
          {plural(totals.reps, 'повторение', 'повторения', 'повторений')}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        {workout.movementIds.map((movementId) => {
          const movement = movementById(data, movementId)
          const step = movement ? currentStep(movement) : undefined
          if (!movement || !step) return null

          const sets = setsOfMovement(data, workout.id, movementId)
          return (
            <div
              key={movementId}
              className="flex items-baseline justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3"
            >
              <span>
                <span className="text-title font-medium">{movement.name}</span>
                <span className="block text-body text-muted">{step.name}</span>
              </span>
              <span className="font-num text-body text-text">
                {sets.length > 0 ? formatSets(sets, step) : '—'}
              </span>
            </div>
          )
        })}
      </section>

      <p className="text-body text-muted">
        <span className="font-num text-text">{week.done}</span> из{' '}
        <span className="font-num text-text">{week.target}</span> на этой неделе
      </p>

      <button
        type="button"
        onClick={onDone}
        className="min-h-14 rounded-ctl bg-accent font-semibold text-on-accent"
      >
        Готово
      </button>
    </div>
  )
}
