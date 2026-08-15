import { useState } from 'react'

import ExercisePanel from '../components/ExercisePanel.tsx'
import { movementById, setsOfMovement, setsOfWorkout } from '../domain/selectors.ts'
import { currentStep, isMeasured, type AppData, type Workout } from '../domain/types.ts'
import { pluralize } from '../lib/plural.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  data: AppData
  workout: Workout
  onFinished: (workoutId: string) => void
}

/** Считает, закрыто ли движение в этой тренировке. */
function isComplete(data: AppData, workoutId: string, movementId: string): boolean {
  const movement = movementById(data, movementId)
  const step = movement ? currentStep(movement) : undefined
  if (!movement || !step) return true

  const done = setsOfMovement(data, workoutId, movementId).length
  if (!isMeasured(step)) return done > 0
  return done >= step.targetSets * (step.perSide === true ? 2 : 1)
}

export default function WorkoutScreen({ data, workout, onFinished }: Props) {
  const finishWorkout = useStore((s) => s.finishWorkout)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const addMovement = useStore((s) => s.addMovementToWorkout)

  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const planned = workout.movementIds
  const firstPending = planned.find((id) => !isComplete(data, workout.id, id))
  const open = openId ?? firstPending ?? null

  const logged = setsOfWorkout(data, workout.id).length
  const available = data.movements.filter((m) => !m.archived && !planned.includes(m.id))

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-title font-semibold">
          {data.templates.find((t) => t.id === workout.templateId)?.name ?? 'Свободная'}
        </h1>
        <span className="text-body text-muted">
          {pluralize(logged, 'подход', 'подхода', 'подходов')}
        </span>
      </header>

      {planned.map((movementId) => {
        const movement = movementById(data, movementId)
        if (!movement) return null
        return (
          <ExercisePanel
            key={movementId}
            data={data}
            workoutId={workout.id}
            movement={movement}
            open={open === movementId}
            onOpen={() => setOpenId(movementId)}
            onComplete={() => {
              // следующее незакрытое движение раскрывается само:
              // за тренировку не должно быть ни одного действия навигации
              const next = planned.find(
                (id) => id !== movementId && !isComplete(data, workout.id, id),
              )
              setOpenId(next ?? null)
            }}
          />
        )
      })}

      {adding ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-label tracking-wider text-muted uppercase">Добавить упражнение</h2>
          {available.length === 0 && <p className="text-body text-muted">Все уже в тренировке</p>}
          {available.map((movement) => (
            <button
              key={movement.id}
              type="button"
              onClick={() => {
                addMovement(workout.id, movement.id)
                setAdding(false)
              }}
              className="min-h-12 rounded-ctl border border-border px-3 text-left text-body"
            >
              {movement.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="min-h-12 rounded-ctl text-body text-muted"
          >
            Отмена
          </button>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-12 rounded-ctl border border-border text-body text-muted"
        >
          + упражнение
        </button>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            finishWorkout(workout.id)
            onFinished(workout.id)
          }}
          className="min-h-14 rounded-ctl bg-accent font-semibold text-on-accent"
        >
          Завершить тренировку
        </button>
        <button
          type="button"
          onClick={() => {
            if (logged > 0 && !confirm('Удалить тренировку вместе с записанными подходами?')) return
            deleteWorkout(workout.id)
          }}
          className="min-h-12 rounded-ctl text-body text-muted"
        >
          Отменить тренировку
        </button>
      </div>
    </div>
  )
}
