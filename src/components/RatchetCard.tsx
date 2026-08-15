import { nextStep } from '../domain/selectors.ts'
import { currentStep, isMeasured, type Movement } from '../domain/types.ts'
import { ratchetFeedback } from '../lib/haptics.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  movement: Movement
  onDone: () => void
}

/**
 * «Ступень взята» — главное событие продукта, поэтому единственное место,
 * где допущена выразительная анимация (docs/design.md#анимации).
 *
 * Переход никогда не происходит сам: приложение показывает, что диапазон закрыт,
 * а решает человек.
 */
export default function RatchetCard({ movement, onDone }: Props) {
  const advanceStep = useStore((s) => s.advanceStep)
  const defaultWeightStep = useStore((s) => s.settings.defaultWeightStepKg)

  const step = currentStep(movement)
  if (!step) return null

  const weighted = isMeasured(step) && step.progressBy === 'weight'
  const increment = isMeasured(step) ? (step.weightStepKg ?? defaultWeightStep) : defaultWeightStep
  const next = weighted ? step : nextStep(movement)

  // вершина лестницы: дальше идти некуда, поздравлять не с чем
  if (!next) return null

  // вес показываем в двух случаях: остаёмся на весовой ступени и прибавляем,
  // либо впервые приходим на весовую ступень — тогда её собственный вес
  const nextWeight =
    isMeasured(next) && next.progressBy === 'weight'
      ? weighted
        ? (next.weightKg ?? 0) + increment
        : next.weightKg
      : undefined

  return (
    <article className="animate-[ratchet_320ms_ease-out] rounded-card border-2 border-accent-ink bg-accent/10 p-4">
      <p className="text-body font-semibold tracking-wider text-accent-ink uppercase">
        Ступень взята
      </p>

      <p className="mt-1 text-title font-medium">
        {movement.name} · {next.name}
      </p>
      <p className="text-body text-muted">
        {nextWeight !== undefined ? (
          <>
            <span className="font-num">+{nextWeight}</span> кг ·{' '}
          </>
        ) : null}
        {isMeasured(next) && (
          <>
            <span className="font-num">
              {next.repMin}–{next.repMax}
            </span>
            {next.unit === 'seconds' ? ' сек' : ''} ×{' '}
            <span className="font-num">{next.targetSets}</span>
          </>
        )}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            advanceStep(movement.id)
            void ratchetFeedback()
            onDone()
          }}
          className="min-h-14 flex-1 rounded-ctl bg-accent font-semibold text-on-accent"
        >
          Перейти
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-14 flex-1 rounded-ctl border border-border font-medium text-muted"
        >
          Ещё поработаю
        </button>
      </div>
    </article>
  )
}
