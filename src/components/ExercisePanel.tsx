import { useState } from 'react'

import { prefillValue, setsOfMovement } from '../domain/selectors.ts'
import {
  currentStep,
  isMeasured,
  type AppData,
  type MeasuredStep,
  type Movement,
  type Side,
} from '../domain/types.ts'
import { useStore } from '../store/useStore.ts'
import SetRow from './SetRow.tsx'

interface PlannedRow {
  order: number
  side: Side
}

/** Плановые строки не хранятся: они выводятся из ступени и целевого числа подходов. */
function planRows(targetSets: number, perSide: boolean): PlannedRow[] {
  const rows: PlannedRow[] = []
  for (let order = 1; order <= targetSets; order++) {
    if (perSide) {
      rows.push({ order, side: 'left' }, { order, side: 'right' })
    } else {
      rows.push({ order, side: 'both' })
    }
  }
  return rows
}

interface Props {
  data: AppData
  workoutId: string
  movement: Movement
  open: boolean
  onOpen: () => void
  onComplete: () => void
}

export default function ExercisePanel({
  data,
  workoutId,
  movement,
  open,
  onOpen,
  onComplete,
}: Props) {
  const step = currentStep(movement)
  const logSet = useStore((s) => s.logSet)
  const deleteSet = useStore((s) => s.deleteSet)

  const done = setsOfMovement(data, workoutId, movement.id)
  const rows = step && isMeasured(step) ? planRows(step.targetSets, step.perSide === true) : []
  // приглушаем всё, что после текущей строки: работаем с одним подходом за раз
  const firstPending = rows.findIndex(
    (r) => !done.some((s) => s.order === r.order && s.side === r.side),
  )
  const complete = step
    ? isMeasured(step)
      ? done.length >= rows.length
      : done.length > 0
    : true

  if (!step) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 text-left"
      >
        <span>
          <span className="text-title font-medium">{movement.name}</span>
          <span className="block text-body text-muted">{step.name}</span>
        </span>
        <span className={`text-body ${complete ? 'text-accent-ink' : 'text-muted'}`}>
          {complete ? '✓ готово' : `${done.length} из ${isMeasured(step) ? rows.length : 1}`}
        </span>
      </button>
    )
  }

  return (
    <article className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-title font-medium">{movement.name}</h2>
      <p className="text-body text-muted">
        {step.name}
        {isMeasured(step) && (
          <>
            {' · '}
            <span className="font-num">
              {step.repMin}–{step.repMax}
            </span>
            {step.unit === 'seconds' ? ' сек' : ''}
            {step.progressBy === 'weight' && step.weightKg !== undefined && (
              <>
                {' · '}
                <span className="font-num">+{step.weightKg}</span> кг
              </>
            )}
          </>
        )}
        {movement.equipment ? ` · ${movement.equipment}` : ''}
      </p>

      {isMeasured(step) ? (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((row, index) => {
            const entry = done.find((s) => s.order === row.order && s.side === row.side)
            return (
              <MeasuredRow
                key={`${row.order}-${row.side}`}
                data={data}
                workoutId={workoutId}
                movementId={movement.id}
                step={step}
                row={row}
                entryId={entry?.id}
                entryValue={step.unit === 'seconds' ? entry?.durationSec : entry?.reps}
                dimmed={index > firstPending}
                onLog={(value) => {
                  logSet({
                    workoutId,
                    movementId: movement.id,
                    stepId: step.id,
                    order: row.order,
                    side: row.side,
                    reps: step.unit === 'reps' ? value : undefined,
                    durationSec: step.unit === 'seconds' ? value : undefined,
                    weightKg: step.weightKg,
                  })
                  if (done.length + 1 >= rows.length) onComplete()
                }}
                onUndo={(id) => deleteSet(id)}
              />
            )
          })}
        </div>
      ) : (
        <div className="mt-4">
          {done.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const entry = done[0]
                if (entry) deleteSet(entry.id)
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-ctl bg-accent/15 px-4"
            >
              <span className="text-accent-ink">✓</span>
              <span>{done[0]?.succeeded === true ? 'Получилось' : 'Пробовал'}</span>
            </button>
          ) : (
            <div className="flex gap-2">
              {(
                [
                  { label: 'Получилось', ok: true },
                  { label: 'Пробовал', ok: false },
                ] as const
              ).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    logSet({
                      workoutId,
                      movementId: movement.id,
                      stepId: step.id,
                      order: 1,
                      side: step.perSide === true ? 'left' : 'both',
                      succeeded: option.ok,
                    })
                    onComplete()
                  }}
                  className={`min-h-14 flex-1 rounded-ctl font-semibold ${
                    option.ok
                      ? 'bg-accent text-on-accent'
                      : 'border border-border text-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

interface RowProps {
  data: AppData
  workoutId: string
  movementId: string
  step: MeasuredStep
  row: PlannedRow
  entryId: string | undefined
  entryValue: number | undefined
  dimmed: boolean
  onLog: (value: number) => void
  onUndo: (id: string) => void
}

function MeasuredRow({
  data,
  workoutId,
  movementId,
  step,
  row,
  entryId,
  entryValue,
  dimmed,
  onLog,
  onUndo,
}: RowProps) {
  const [value, setValue] = useState(() =>
    prefillValue(data, movementId, step, row.order, row.side, workoutId),
  )

  return (
    <SetRow
      order={row.order}
      side={row.side}
      step={step}
      value={entryValue ?? value}
      done={entryId !== undefined}
      dimmed={dimmed}
      onChange={setValue}
      onConfirm={() => onLog(value)}
      onUndo={() => {
        if (entryId) onUndo(entryId)
      }}
    />
  )
}
