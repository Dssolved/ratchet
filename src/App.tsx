import { useRef, useState } from 'react'

import { currentStep, isMeasured, type Movement } from './domain/types.ts'
import { downloadBackup, importBackupFile } from './lib/backup.ts'
import { pluralize } from './lib/plural.ts'
import { selectData, useStore } from './store/useStore.ts'
import { useHydrated } from './store/useHydrated.ts'

/**
 * Шаг 0: экран-заглушка, подтверждающий, что каркас собран — seed загружен,
 * состояние переживает перезагрузку, экспорт и импорт работают.
 * Настоящий интерфейс тренировки приходит на шаге 1 (docs/ux.md, docs/design.md).
 */
export default function App() {
  const hydrated = useHydrated()
  const movements = useStore((s) => s.movements)
  const templates = useStore((s) => s.templates)
  const settings = useStore((s) => s.settings)
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)

  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  if (!hydrated) {
    return <div className="p-6 text-body text-muted">Загрузка…</div>
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const data = await importBackupFile(file)
      replaceAll(data)
      const count = pluralize(data.workouts.length, 'тренировка', 'тренировки', 'тренировок')
      setMessage({ text: `Импортировано: ${count}`, error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-16">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Ratchet</h1>
        <p className="text-body text-muted">
          Шаг 0 — каркас. Цель:{' '}
          <span className="font-num text-text">{settings.weeklyTarget}</span> тренировки в неделю.
        </p>
      </header>

      <section className="mb-8 flex flex-col gap-3">
        {movements.map((movement) => (
          <MovementCard key={movement.id} movement={movement} />
        ))}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-label tracking-wider text-muted uppercase">Шаблоны</h2>
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-ctl border border-border bg-surface px-3 py-2 text-body"
            >
              <span className="font-medium">{template.name}</span>{' '}
              <span className="text-muted">
                {template.movementIds.length > 0
                  ? template.movementIds
                      .map((id) => movements.find((m) => m.id === id)?.name ?? id)
                      .join(' · ')
                  : 'движения добавляются на ходу'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-label tracking-wider text-muted uppercase">Данные</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadBackup(selectData(useStore.getState()))}
            className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
          >
            Экспорт JSON
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
          >
            Импорт JSON
          </button>
          <button
            type="button"
            onClick={async () => {
              await resetToSeed()
              setMessage({ text: 'Справочник сброшен к стартовому', error: false })
            }}
            className="min-h-12 rounded-ctl border border-border px-4 font-medium text-danger"
          >
            Сбросить
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />

        {message && (
          <p className={`text-body ${message.error ? 'text-danger' : 'text-accent-ink'}`}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  )
}

function MovementCard({ movement }: { movement: Movement }) {
  const step = currentStep(movement)
  const total = movement.steps.length

  return (
    <article className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-title font-medium">{movement.name}</h3>
        <span className="font-num text-label text-muted">
          {movement.maxReachedStepOrder} / {total}
        </span>
      </div>

      {step && (
        <p className="mt-1 text-body text-muted">
          {step.name}
          {isMeasured(step) && (
            <>
              {' · '}
              <span className="font-num">
                {step.repMin}–{step.repMax}
              </span>
              {step.unit === 'seconds' ? ' сек' : ''}
              {' × '}
              <span className="font-num">{step.targetSets}</span>
              {step.progressBy === 'weight' && step.weightKg !== undefined ? (
                <>
                  {' · '}
                  <span className="font-num">+{step.weightKg}</span> кг
                </>
              ) : null}
            </>
          )}
          {step.kind === 'binary' && ' · навык'}
          {movement.equipment ? ` · ${movement.equipment}` : ''}
        </p>
      )}

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
    </article>
  )
}
