import { suggestedTemplateId, weekProgress } from '../domain/selectors.ts'
import type { AppData } from '../domain/types.ts'
import MovementCard from '../components/MovementCard.tsx'
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
        <h2 className="text-label tracking-wider text-muted uppercase">Упражнения</h2>
        {data.movements
          .filter((m) => !m.archived)
          .map((movement) => (
            <MovementCard key={movement.id} data={data} movement={movement} />
          ))}
      </section>
    </div>
  )
}
