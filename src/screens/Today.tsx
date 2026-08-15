import {
  formatSets,
  lastSetsOnStep,
  suggestedTemplateId,
  weekProgress,
} from '../domain/selectors.ts'
import { currentStep, isMeasured, type AppData, type Movement } from '../domain/types.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  data: AppData
  onStarted: (workoutId: string) => void
}

/** Экран до тренировки: с чего начать и что было в прошлый раз. */
export default function Today({ data, onStarted }: Props) {
  const startWorkout = useStore((s) => s.startWorkout)
  const suggested = suggestedTemplateId(data)
  const week = weekProgress(data)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        {data.templates.map((template) => {
          const primary = template.id === suggested
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onStarted(startWorkout(template.movementIds.length > 0 ? template.id : null))}
              className={`min-h-14 rounded-ctl px-4 text-left font-semibold ${
                primary
                  ? 'bg-accent text-on-accent'
                  : 'border border-border bg-surface text-text'
              }`}
            >
              {template.name}
              {template.movementIds.length > 0 && (
                <span
                  className={`block text-body font-normal ${
                    primary ? 'text-on-accent/70' : 'text-muted'
                  }`}
                >
                  {template.movementIds
                    .map((id) => data.movements.find((m) => m.id === id)?.name ?? id)
                    .join(' · ')}
                </span>
              )}
            </button>
          )
        })}
      </section>

      <p className="text-body text-muted">
        <span className="font-num text-text">{week.done}</span> из{' '}
        <span className="font-num text-text">{week.target}</span> на этой неделе
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Движения</h2>
        {data.movements
          .filter((m) => !m.archived)
          .map((movement) => (
            <MovementSummary key={movement.id} data={data} movement={movement} />
          ))}
      </section>
    </div>
  )
}

function MovementSummary({ data, movement }: { data: AppData; movement: Movement }) {
  const step = currentStep(movement)
  if (!step) return null

  const previous = lastSetsOnStep(data, movement.id, step.id).filter((s) => !s.isWarmup)

  return (
    <article className="rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-title font-medium">{movement.name}</h3>
        <span className="font-num text-label text-muted">
          {movement.maxReachedStepOrder} / {movement.steps.length}
        </span>
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
    </article>
  )
}
