import { useState } from 'react'

import {
  formatSets,
  lastSetsOnStep,
  nextStep,
  previousStep,
  readiness,
} from '../domain/selectors.ts'
import { currentStep, isMeasured, type AppData, type Movement } from '../domain/types.ts'
import { ratchetFeedback } from '../lib/haptics.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Карточка упражнения на экране «Сегодня»: где ты на лестнице, что было в прошлый раз
 * и готов ли диапазон. Тап раскрывает лестницу целиком и ручной переход по ступеням —
 * храповик срабатывает сам во время тренировки, но откат после болезни или перерыва
 * человек делает осознанно (Д-9).
 */
export default function MovementCard({ data, movement }: { data: AppData; movement: Movement }) {
  const [open, setOpen] = useState(false)
  const advanceStep = useStore((s) => s.advanceStep)
  const rollbackStep = useStore((s) => s.rollbackStep)

  const step = currentStep(movement)
  if (!step) return null

  const status = readiness(data, movement)
  const previous = lastSetsOnStep(data, movement.id, step.id).filter((s) => !s.isWarmup)
  const canAdvance = nextStep(movement) !== undefined || (isMeasured(step) && step.progressBy === 'weight')
  const canRollback = previousStep(movement) !== undefined || (isMeasured(step) && (step.weightKg ?? 0) > 0)

  return (
    <article className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-title font-medium">{movement.name}</h3>
          {status === 'ready' ? (
            <span className="flex shrink-0 items-center gap-1.5 text-label text-accent-ink">
              <span className="inline-block size-2 rounded-full bg-accent-ink" />
              готов к ступени
            </span>
          ) : (
            <span className="font-num text-label text-muted">
              {movement.maxReachedStepOrder} / {movement.steps.length}
            </span>
          )}
        </div>

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
        </p>

        <p className="mt-1 text-body text-muted">
          {previous.length > 0 ? (
            <>
              прошлый раз <span className="font-num text-text">{formatSets(previous, step)}</span>
            </>
          ) : (
            'ещё не делали на этой ступени'
          )}
        </p>

        {/* храповая рейка: текущая насечка выше пройденных и будущих */}
        <div className="mt-3 flex h-3 items-end gap-1">
          {movement.steps.map((s) => (
            <span
              key={s.id}
              className={`flex-1 rounded-[2px] ${
                s.order < movement.maxReachedStepOrder
                  ? 'h-1.5 bg-accent/40'
                  : s.order === movement.maxReachedStepOrder
                    ? 'h-3 bg-accent'
                    : 'h-1.5 bg-surface-2'
              }`}
            />
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <ol className="flex flex-col gap-1">
            {movement.steps.map((s) => {
              const isCurrent = s.id === step.id
              const passed = s.order < movement.maxReachedStepOrder
              return (
                <li
                  key={s.id}
                  className={`flex items-baseline gap-2 text-body ${
                    isCurrent ? 'text-text' : passed ? 'text-muted' : 'text-muted/60'
                  }`}
                >
                  <span className="w-4 font-num text-label">{s.order}</span>
                  <span className={isCurrent ? 'font-medium' : ''}>{s.name}</span>
                  {isCurrent && <span className="text-accent-ink">←</span>}
                </li>
              )
            })}
          </ol>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!canRollback}
              onClick={() => rollbackStep(movement.id)}
              className="min-h-12 flex-1 rounded-ctl border border-border text-body text-muted disabled:opacity-40"
            >
              ↓ ступень назад
            </button>
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => {
                advanceStep(movement.id)
                void ratchetFeedback()
              }}
              className="min-h-12 flex-1 rounded-ctl border border-border text-body disabled:opacity-40"
            >
              ↑ ступень вперёд
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
