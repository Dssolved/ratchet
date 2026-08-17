import {
  formatSets,
  movementById,
  sessionStep,
  setsOfMovement,
  weekProgress,
  workoutTotals,
} from '../domain/selectors.ts'
import { recordsInWorkout } from '../domain/stats.ts'
import { type AppData, type Workout } from '../domain/types.ts'
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
  const records = recordsInWorkout(data, workout.id)
  // переходы этой тренировки: StepChange хранит дату, а не id тренировки —
  // для одной тренировки в день этого достаточно
  const advanced = data.stepChanges.filter(
    (c) => c.date === workout.date && c.direction === 'up',
  )

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

      {(records.length > 0 || advanced.length > 0) && (
        <section className="flex flex-col gap-2">
          {advanced.map((change) => {
            const movement = movementById(data, change.movementId)
            const step = movement?.steps.find((s) => s.order === change.toStepOrder)
            return (
              <div
                key={change.id}
                className="rounded-card border-2 border-accent-ink bg-accent/10 px-4 py-3"
              >
                <p className="text-label font-semibold tracking-wider text-accent-ink uppercase">
                  Ступень взята
                </p>
                <p className="text-body">
                  {movement?.name} · {step?.name}
                  {change.toWeightKg !== undefined && (
                    <>
                      {' '}
                      <span className="font-num">+{change.toWeightKg}</span> кг
                    </>
                  )}
                </p>
              </div>
            )
          })}

          {records.map((record) => (
            <div
              key={`${record.movementId}-${record.stepName}`}
              className="rounded-card border border-accent-ink/40 px-4 py-3"
            >
              <p className="text-label font-semibold tracking-wider text-accent-ink uppercase">
                Рекорд
              </p>
              <p className="text-body">
                {record.movementName} · {record.stepName} —{' '}
                <span className="font-num text-text">{record.value}</span>
                {record.unit === 'seconds' ? ' сек' : ''}
                {record.previous > 0 && (
                  <span className="text-muted">
                    {' '}
                    (было <span className="font-num">{record.previous}</span>)
                  </span>
                )}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {workout.movementIds.map((movementId) => {
          const movement = movementById(data, movementId)
          // ступень сессии: итог показывает, что делали сегодня, а не то, куда
          // упражнение уехало принятым в конце тренировки переходом (Д-32)
          const step = movement ? sessionStep(data, workout.id, movement) : undefined
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
