import { useState } from 'react'

import { DIRECTIONS, type Direction, paletteVars } from './palettes.ts'

/**
 * Песочница дизайна: одни и те же реальные компоненты во всех направлениях.
 * Смотреть на телефоне, желательно на улице — от этого зависит выбор темы.
 * Удаляется вместе с папкой src/design после выбора.
 */
export default function Sandbox() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  return (
    <div className="min-h-dvh bg-neutral-900 pb-16">
      <div className="sticky top-0 z-10 flex gap-2 bg-neutral-900/95 px-4 py-3 backdrop-blur">
        {(['dark', 'light'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
              theme === value ? 'bg-white text-neutral-900' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {value === 'dark' ? 'Тёмная' : 'Светлая'}
          </button>
        ))}
      </div>

      <div className="space-y-8 px-3 pt-4">
        {DIRECTIONS.map((direction) => (
          <Showcase key={direction.id} direction={direction} theme={theme} />
        ))}
      </div>
    </div>
  )
}

function Showcase({ direction, theme }: { direction: Direction; theme: 'dark' | 'light' }) {
  const palette = direction[theme]

  return (
    <section>
      <h2 className="mb-1 px-1 text-sm font-semibold text-white">{direction.name}</h2>
      <p className="mb-3 px-1 text-xs leading-snug text-neutral-400">{direction.idea}</p>

      <div
        style={paletteVars(palette, direction)}
        className="space-y-3 p-4 text-[var(--c-text)]"
      >
        <div className="-m-4 mb-0 space-y-3 bg-[var(--c-bg)] p-4">
          <WeekStatus />
          <MovementCard />
          <ActiveExercise />
          <RestTimer />
          <RatchetCard />
        </div>
      </div>
    </section>
  )
}

function WeekStatus() {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-[var(--c-muted)]">
        <span className="font-semibold text-[var(--c-text)]">2</span> из 3 на этой неделе
      </span>
      <span className="text-[var(--c-muted)]">стрик 5 недель</span>
    </div>
  )
}

function MovementCard() {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8]
  const reached = 4

  return (
    <article
      className="border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">Горизонтальный жим</h3>
        <span className="flex items-center gap-1.5 text-xs text-[var(--c-accent)]">
          <span className="inline-block size-2 rounded-full bg-[var(--c-accent)]" />
          готов к ступени
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--c-muted)]">
        Ноги на возвышении ~60 см · 8–12 × 3 · на упорах
      </p>
      <p className="mt-2 text-sm text-[var(--c-muted)]">
        прошлый раз{' '}
        <span className="font-[family-name:var(--num-font)] text-[var(--c-text)]">12 · 12 · 11</span>
      </p>
      <div className="mt-3 flex gap-1">
        {steps.map((order) => (
          <span
            key={order}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background:
                order < reached
                  ? 'color-mix(in oklab, var(--c-accent) 35%, transparent)'
                  : order === reached
                    ? 'var(--c-accent)'
                    : 'var(--c-surface-2)',
            }}
          />
        ))}
      </div>
    </article>
  )
}

function ActiveExercise() {
  return (
    <article
      className="border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <h3 className="font-medium">Горизонтальный жим</h3>
      <p className="mb-4 text-sm text-[var(--c-muted)]">Ноги на возвышении ~60 см · 8–12</p>

      <div className="space-y-2">
        <SetRow index={1} value={12} state="done" />
        <SetRow index={2} value={12} state="current" />
        <SetRow index={3} value={12} state="pending" />
      </div>
    </article>
  )
}

function SetRow({
  index,
  value,
  state,
}: {
  index: number
  value: number
  state: 'done' | 'current' | 'pending'
}) {
  const done = state === 'done'

  return (
    <div className={`flex items-center gap-2 ${state === 'pending' ? 'opacity-45' : ''}`}>
      <span className="w-4 text-sm text-[var(--c-muted)]">{index}</span>

      {done ? (
        <div
          className="flex h-14 flex-1 items-center gap-3 px-4"
          style={{
            borderRadius: 'var(--radius)',
            background: 'color-mix(in oklab, var(--c-accent) 12%, transparent)',
          }}
        >
          <span className="text-[var(--c-accent)]">✓</span>
          <span className="font-[family-name:var(--num-font)] text-2xl">{value}</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="size-14 border border-[var(--c-border)] bg-[var(--c-surface-2)] text-xl"
            style={{ borderRadius: 'var(--radius)' }}
          >
            −
          </button>
          <span className="flex-1 text-center font-[family-name:var(--num-font)] text-4xl font-semibold">
            {value}
          </span>
          <button
            type="button"
            className="size-14 border border-[var(--c-border)] bg-[var(--c-surface-2)] text-xl"
            style={{ borderRadius: 'var(--radius)' }}
          >
            +
          </button>
          <button
            type="button"
            className="size-14 text-xl font-semibold"
            style={{
              borderRadius: 'var(--radius)',
              background: 'var(--c-accent)',
              color: 'var(--c-on-accent)',
            }}
          >
            ✓
          </button>
        </>
      )}
    </div>
  )
}

function RestTimer() {
  return (
    <div
      className="flex items-center justify-between border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <span className="text-sm text-[var(--c-muted)]">отдых</span>
      <span className="font-[family-name:var(--num-font)] text-3xl font-semibold tabular-nums">
        1:23
      </span>
      <span className="text-sm text-[var(--c-muted)]">+30 сек</span>
    </div>
  )
}

function RatchetCard() {
  return (
    <article
      className="border-2 p-4"
      style={{
        borderRadius: 'var(--radius)',
        borderColor: 'var(--c-accent)',
        background: 'color-mix(in oklab, var(--c-accent) 10%, var(--c-surface))',
      }}
    >
      <p className="text-sm font-semibold tracking-wide text-[var(--c-accent)] uppercase">
        Ступень взята
      </p>
      <p className="mt-1 text-lg font-medium">Отжимания с весом</p>
      <p className="text-sm text-[var(--c-muted)]">рюкзак +2.5 кг · 8–12 × 3</p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="min-h-14 flex-1 font-semibold"
          style={{
            borderRadius: 'var(--radius)',
            background: 'var(--c-accent)',
            color: 'var(--c-on-accent)',
          }}
        >
          Перейти
        </button>
        <button
          type="button"
          className="min-h-14 flex-1 border border-[var(--c-border)] font-medium text-[var(--c-muted)]"
          style={{ borderRadius: 'var(--radius)' }}
        >
          Ещё поработаю
        </button>
      </div>
    </article>
  )
}
