import { lazy, Suspense, useState } from 'react'

import { movementById, readiness } from '../domain/selectors.ts'
import { movementChart } from '../domain/stats.ts'
import { currentStep, isMeasured, type AppData, type Movement } from '../domain/types.ts'
import { useBackHandler } from '../lib/backHandler.ts'
import History from './History.tsx'

// recharts тяжёлый, а экран тренировки должен грузиться быстро —
// подтягиваем график только когда его действительно открыли
const ProgressChart = lazy(() => import('../components/ProgressChart.tsx'))

export default function Progress({ data }: { data: AppData }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const movement = openId ? movementById(data, openId) : undefined
  useBackHandler(movement !== undefined, () => setOpenId(null))

  if (movement) {
    return <MovementDetail data={data} movement={movement} onBack={() => setOpenId(null)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-title font-semibold">Прогресс</h1>
        {data.movements
          .filter((m) => !m.archived)
          .map((m) => (
            <MovementRow key={m.id} data={data} movement={m} onOpen={() => setOpenId(m.id)} />
          ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">История</h2>
        <History data={data} />
      </section>
    </div>
  )
}

function MovementRow({
  data,
  movement,
  onOpen,
}: {
  data: AppData
  movement: Movement
  onOpen: () => void
}) {
  const step = currentStep(movement)
  if (!step) return null
  const ready = readiness(data, movement) === 'ready'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-card border border-border bg-surface px-4 py-3 text-left"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-title font-medium">{movement.name}</span>
        <span
          className={`font-num text-label ${ready ? 'text-accent-ink' : 'text-muted'}`}
        >
          {movement.maxReachedStepOrder} / {movement.steps.length}
        </span>
      </div>
      <span className="block text-body text-muted">{step.name}</span>
    </button>
  )
}

function MovementDetail({
  data,
  movement,
  onBack,
}: {
  data: AppData
  movement: Movement
  onBack: () => void
}) {
  const step = currentStep(movement)
  const chart = movementChart(data, movement)
  const changes = data.stepChanges
    .filter((c) => c.movementId === movement.id)
    .toSorted((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <button type="button" onClick={onBack} className="min-h-12 text-body text-muted">
          ← прогресс
        </button>
        <h1 className="text-title font-semibold">{movement.name}</h1>
        {step && <p className="text-body text-muted">{step.name}</p>}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Лестница</h2>
        <ol className="flex flex-col gap-1">
          {movement.steps
            .toSorted((a, b) => a.order - b.order)
            .map((s) => {
              const isCurrent = s.id === movement.currentStepId
              const isRecord = s.order === movement.maxReachedStepOrder
              const passed = s.order < movement.maxReachedStepOrder
              return (
                <li
                  key={s.id}
                  className={`flex items-baseline gap-2 rounded-ctl px-3 py-2 text-body ${
                    isCurrent ? 'bg-accent/10 text-text' : passed ? 'text-muted' : 'text-muted/60'
                  }`}
                >
                  <span className="w-4 font-num text-label">{s.order}</span>
                  <span className={`flex-1 ${isCurrent ? 'font-medium' : ''}`}>
                    {s.name}
                    {isMeasured(s) && (
                      <span className="text-muted">
                        {' · '}
                        <span className="font-num">
                          {s.repMin}–{s.repMax}
                        </span>
                      </span>
                    )}
                  </span>
                  {isCurrent && <span className="text-label text-accent-ink">сейчас</span>}
                  {isRecord && !isCurrent && <span className="text-label text-muted">рекорд</span>}
                </li>
              )
            })}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Повторения во времени</h2>
        <Suspense fallback={<p className="text-body text-muted">Загрузка графика…</p>}>
          <ProgressChart chart={chart} />
        </Suspense>
        <p className="text-body text-muted">
          Линия — минимальный подход тренировки: именно он решает, взята ли ступень.
          Полоса — целевой диапазон; когда ступень меняется, полоса сдвигается, поэтому
          падение цифр здесь означает усложнение, а не откат.
        </p>
      </section>

      {changes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label tracking-wider text-muted uppercase">Переходы</h2>
          {changes.map((change) => {
            const to = movement.steps.find((s) => s.order === change.toStepOrder)
            const weighted = change.toWeightKg !== undefined
            return (
              <div
                key={change.id}
                className="flex items-baseline justify-between gap-2 rounded-ctl border border-border px-3 py-2 text-body"
              >
                <span className={change.direction === 'up' ? 'text-accent-ink' : 'text-muted'}>
                  {change.direction === 'up' ? '↑' : '↓'} {to?.name ?? change.toStepOrder}
                  {weighted && (
                    <>
                      {' '}
                      <span className="font-num">
                        {change.fromWeightKg} → {change.toWeightKg}
                      </span>{' '}
                      кг
                    </>
                  )}
                </span>
                <span className="font-num text-label text-muted">{change.date}</span>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
