import { useState } from 'react'

import { prefillValue, setsOfMovement, setsOfWorkout } from '../domain/selectors.ts'
import {
  currentStep,
  isMeasured,
  type AppData,
  type BinaryStep,
  type MeasuredStep,
  type Movement,
  type SetEntry,
  type Side,
  type Step,
} from '../domain/types.ts'
import { tapFeedback } from '../lib/haptics.ts'
import { unlockAudio } from '../lib/sound.ts'
import { useRestTimer } from '../store/useRestTimer.ts'
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

/** Отдых после подхода: у ступени может быть свой, иначе общий из настроек. */
function restSecondsFor(step: Step, data: AppData): number {
  return step.restSec ?? data.settings.defaultRestSec
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
  const startRest = useRestTimer((s) => s.start)
  const dismissRest = useRestTimer((s) => s.dismiss)

  /**
   * Отмена подхода снимает отдых — но только если отменяют ПОСЛЕДНИЙ записанный
   * подход тренировки, то есть исправляют мисклик. Если отдыхаешь после третьего
   * подхода и правишь ошибку во втором, текущий отдых трогать нельзя.
   */
  const undoSet = (setId: string) => {
    const latest = setsOfWorkout(data, workoutId).at(-1)
    if (latest?.id === setId) dismissRest()
    deleteSet(setId)
  }

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
                  void tapFeedback()
                  // раскрываем аудиоконтекст на жесте: конец отдыха жестом не является,
                  // а без жеста браузер звук не выпустит
                  unlockAudio()
                  // отдых стартует после КАЖДОГО подхода, включая последний:
                  // между упражнениями пауза тоже нужна, а предсказуемость важнее
                  // догадливости — лишний отдых убирается одной кнопкой
                  startRest(restSecondsFor(step, data))
                  if (done.length + 1 >= rows.length) onComplete()
                }}
                onUndo={undoSet}
              />
            )
          })}
        </div>
      ) : (
        <SkillAttempts
          step={step}
          entry={done[0]}
          onLog={(attempts, successes) => {
            logSet({
              workoutId,
              movementId: movement.id,
              stepId: step.id,
              order: 1,
              side: step.perSide === true ? 'left' : 'both',
              attempts,
              successes,
            })
            void tapFeedback()
            onComplete()
          }}
          onUndo={undoSet}
        />
      )}
    </article>
  )
}

function CountRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-body text-muted">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
        aria-label={`${label}: убавить`}
      >
        −
      </button>
      <span className="w-12 text-center font-num text-value font-semibold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
        aria-label={`${label}: прибавить`}
      >
        +
      </button>
    </div>
  )
}

/**
 * Ввод навыковой попытки: сколько раз пробовал и сколько получилось.
 *
 * Именно дробь и есть кривая освоения навыка — «0 из 6, потом 1 из 6, потом 3 из 6».
 * Прежнее «получилось / пробовал» эту динамику выбрасывало.
 */
function SkillAttempts({
  step,
  entry,
  onLog,
  onUndo,
}: {
  step: BinaryStep
  entry: SetEntry | undefined
  onLog: (attempts: number, successes: number) => void
  onUndo: (setId: string) => void
}) {
  const [attempts, setAttempts] = useState(5)
  const [successes, setSuccesses] = useState(0)

  if (entry) {
    return (
      <button
        type="button"
        onClick={() => onUndo(entry.id)}
        className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-ctl bg-accent/15 px-4"
      >
        <span className="text-accent-ink">✓</span>
        <span className="font-num text-value">
          {entry.successes ?? 0} из {entry.attempts ?? 0}
        </span>
        <span className="text-body text-muted">получилось</span>
      </button>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <CountRow
        label="попыток"
        value={attempts}
        min={1}
        max={30}
        onChange={(v) => {
          setAttempts(v)
          if (successes > v) setSuccesses(v)
        }}
      />
      <CountRow
        label="получилось"
        value={successes}
        min={0}
        max={attempts}
        onChange={setSuccesses}
      />

      <p className="text-label text-muted">
        ступень берётся при <span className="font-num">{step.targetSuccesses}</span> удачных
        {step.readyAfterSessions !== undefined && (
          <>
            {' '}
            на <span className="font-num">{step.readyAfterSessions}</span> тренировках подряд
          </>
        )}
      </p>

      <button
        type="button"
        onClick={() => onLog(attempts, successes)}
        className="min-h-14 rounded-ctl bg-accent font-semibold text-on-accent"
      >
        Записать
      </button>
    </div>
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
