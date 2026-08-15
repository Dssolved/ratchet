import { useState } from 'react'

import { stepAmount } from '../components/SetRow.tsx'
import { formatDateShort } from '../domain/dates.ts'
import {
  movementById,
  setsOfMovement,
  setsOfWorkout,
  workoutsNewestFirst,
  workoutTotals,
} from '../domain/selectors.ts'
import {
  findStep,
  isMeasured,
  type AppData,
  type SetEntry,
  type Workout,
} from '../domain/types.ts'
import { plural } from '../lib/plural.ts'
import { useStore } from '../store/useStore.ts'

const SIDE_LABEL = { both: '', left: 'Л', right: 'П' } as const

export default function History({ data }: { data: AppData }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const workouts = workoutsNewestFirst(data).filter((w) => w.finishedAt !== undefined)

  if (workouts.length === 0) {
    return <p className="text-body text-muted">Тренировок пока нет.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {workouts.map((workout) =>
        openId === workout.id ? (
          <WorkoutDetail
            key={workout.id}
            data={data}
            workout={workout}
            onClose={() => setOpenId(null)}
          />
        ) : (
          <WorkoutRow
            key={workout.id}
            data={data}
            workout={workout}
            onOpen={() => setOpenId(workout.id)}
          />
        ),
      )}
    </div>
  )
}

function WorkoutRow({
  data,
  workout,
  onOpen,
}: {
  data: AppData
  workout: Workout
  onOpen: () => void
}) {
  const totals = workoutTotals(data, workout)
  const name = data.templates.find((t) => t.id === workout.templateId)?.name ?? 'Свободная'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-baseline justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 text-left"
    >
      <span>
        <span className="text-title font-medium">{formatDateShort(workout.date)}</span>
        <span className="block text-body text-muted">{name}</span>
      </span>
      <span className="font-num text-body text-muted">
        {totals.sets} × {totals.reps}
      </span>
    </button>
  )
}

function WorkoutDetail({
  data,
  workout,
  onClose,
}: {
  data: AppData
  workout: Workout
  onClose: () => void
}) {
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const name = data.templates.find((t) => t.id === workout.templateId)?.name ?? 'Свободная'

  // движения, которые реально встречаются в подходах, плюс запланированные
  const ids = [...new Set([...workout.movementIds, ...setsOfWorkout(data, workout.id).map((s) => s.movementId)])]

  return (
    <article className="rounded-card border border-border bg-surface p-4">
      <button type="button" onClick={onClose} className="flex w-full items-baseline justify-between gap-2 text-left">
        <span>
          <span className="text-title font-medium">{formatDateShort(workout.date)}</span>
          <span className="block text-body text-muted">{name}</span>
        </span>
        <span className="text-body text-muted">свернуть</span>
      </button>

      <div className="mt-4 flex flex-col gap-4">
        {ids.map((movementId) => {
          const movement = movementById(data, movementId)
          if (!movement) return null
          const sets = setsOfMovement(data, workout.id, movementId).toSorted(
            (a, b) => a.order - b.order,
          )
          if (sets.length === 0) return null

          return (
            <section key={movementId} className="flex flex-col gap-2">
              <h3 className="text-body font-medium">{movement.name}</h3>
              {sets.map((entry) => (
                <EditableSet key={entry.id} data={data} entry={entry} />
              ))}
            </section>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirm('Удалить тренировку вместе с подходами?')) deleteWorkout(workout.id)
        }}
        className="mt-4 min-h-12 w-full rounded-ctl text-body text-danger"
      >
        Удалить тренировку
      </button>
    </article>
  )
}

/** Правка задним числом: ошибся при вводе — исправил, не переигрывая тренировку. */
function EditableSet({ data, entry }: { data: AppData; entry: SetEntry }) {
  const updateSet = useStore((s) => s.updateSet)
  const deleteSet = useStore((s) => s.deleteSet)

  const movement = movementById(data, entry.movementId)
  const step = movement ? findStep(movement, entry.stepId) : undefined
  if (!step) return null

  const label = `${entry.order}${SIDE_LABEL[entry.side] ? ` ${SIDE_LABEL[entry.side]}` : ''}`

  if (!isMeasured(step)) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-6 font-num text-body text-muted">{label}</span>
        <span className="flex-1 text-body">
          {entry.succeeded === true ? 'Получилось' : 'Пробовал'}
        </span>
        <button
          type="button"
          onClick={() => deleteSet(entry.id)}
          className="min-h-12 px-3 text-body text-danger"
          aria-label="Удалить подход"
        >
          ✕
        </button>
      </div>
    )
  }

  const value = (step.unit === 'seconds' ? entry.durationSec : entry.reps) ?? 0
  const amount = stepAmount(step)
  const apply = (next: number) => {
    updateSet(
      entry.id,
      step.unit === 'seconds' ? { durationSec: next } : { reps: next },
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 font-num text-body text-muted">{label}</span>
      <button
        type="button"
        onClick={() => apply(Math.max(0, value - amount))}
        className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2"
        aria-label="Убавить"
      >
        −
      </button>
      <span className="flex-1 text-center font-num text-value">{value}</span>
      <button
        type="button"
        onClick={() => apply(value + amount)}
        className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2"
        aria-label="Прибавить"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => deleteSet(entry.id)}
        className="min-h-12 px-3 text-body text-danger"
        aria-label="Удалить подход"
      >
        ✕
      </button>
    </div>
  )
}

export function historySubtitle(data: AppData): string {
  const count = data.workouts.filter((w) => w.finishedAt !== undefined).length
  return `${count} ${plural(count, 'тренировка', 'тренировки', 'тренировок')}`
}
