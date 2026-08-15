import { useState } from 'react'

import { achievements, weeklyStreak, type AchievementKind } from '../domain/achievements.ts'
import { weekProgress } from '../domain/selectors.ts'
import {
  HOLD_MILESTONES,
  nextMilestone,
  PERIODS,
  REP_MILESTONES,
  thenAndNow,
  totalsByMovement,
  type Period,
} from '../domain/stats.ts'
import type { AppData } from '../domain/types.ts'
import { plural, pluralize } from '../lib/plural.ts'

/**
 * «Профиль» отвечает на вопрос «сколько я всего наделал», в отличие от «Прогресса»,
 * который отвечает «расту ли я». Разные настроения, поэтому разные вкладки —
 * см. docs/ux.md#навигация-четыре-вкладки.
 */
export default function Profile({ data }: { data: AppData }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title font-semibold">Профиль</h1>
      <Streaks data={data} />
      <Skills data={data} />
      <ThenAndNow data={data} />
      <Counters data={data} />
      <AchievementFeed data={data} />
    </div>
  )
}

function Streaks({ data }: { data: AppData }) {
  const streak = weeklyStreak(data)
  const week = weekProgress(data)

  return (
    <section className="flex gap-2">
      <div className="flex-1 rounded-card border border-border bg-surface px-3 py-3">
        <p className="font-num text-set font-semibold text-accent-ink">{streak.current}</p>
        <p className="text-label text-muted">
          {plural(streak.current, 'неделя', 'недели', 'недель')} подряд
        </p>
      </div>
      <div className="flex-1 rounded-card border border-border bg-surface px-3 py-3">
        <p className="font-num text-set font-semibold">
          {week.done}
          <span className="text-muted">/{week.target}</span>
        </p>
        <p className="text-label text-muted">на этой неделе</p>
      </div>
      <div className="flex-1 rounded-card border border-border bg-surface px-3 py-3">
        <p className="font-num text-set font-semibold">{streak.longest}</p>
        <p className="text-label text-muted">рекорд стрика</p>
      </div>
    </section>
  )
}

/**
 * Витрина навыков. Трюк — достижение другого порядка, чем «брусья теперь с 5 кг»:
 * второе видишь только ты в журнале, первое называешь вслух. Модель у них общая (Д-5),
 * а подача — нет.
 */
function Skills({ data }: { data: AppData }) {
  const skills = data.movements.filter((m) => m.category === 'skill' && !m.archived)
  if (skills.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label tracking-wider text-muted uppercase">Навыки</h2>
      {skills.map((movement) => {
        const current = movement.steps.find((s) => s.id === movement.currentStepId)
        const owned = movement.steps.filter((s) => s.order < movement.maxReachedStepOrder)
        return (
          <article
            key={movement.id}
            className="rounded-card border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-title font-medium">{movement.name}</span>
              <span className="font-num text-label text-muted">
                {movement.maxReachedStepOrder} / {movement.steps.length}
              </span>
            </div>
            <p className="text-body text-muted">
              сейчас: {current?.name ?? '—'}
            </p>
            {owned.length > 0 && (
              <p className="mt-1 text-label text-accent-ink">
                освоено: {owned.map((s) => s.name.toLowerCase()).join(' · ')}
              </p>
            )}
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
      })}
    </section>
  )
}

/**
 * «Тогда и сейчас» — прямой ответ на исходную жалобу «прогресс невидимый,
 * непонятно, растёшь ты или топчешься». Ачивка говорит про количество,
 * а это сравнение отвечает буквально на заданный вопрос.
 */
function ThenAndNow({ data }: { data: AppData }) {
  const comparisons = thenAndNow(data)
  if (comparisons.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label tracking-wider text-muted uppercase">Тогда и сейчас</h2>
      {comparisons.map((item) => (
        <article
          key={item.movementId}
          className="rounded-card border border-border bg-surface px-4 py-3"
        >
          <p className="text-body font-medium">{item.movementName}</p>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-body">
            <span className="text-muted">
              {item.agoLabel}: {item.thenStep} —{' '}
              <span className="font-num">{item.thenValue}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-body">
            <span>
              сегодня: {item.nowStep} —{' '}
              <span className="font-num text-accent-ink">{item.nowValue}</span>
            </span>
          </div>
        </article>
      ))}
    </section>
  )
}

function Counters({ data }: { data: AppData }) {
  const [period, setPeriod] = useState<Period>('all')
  const totals = totalsByMovement(data, period)
  const allTime = totalsByMovement(data, 'all')

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label tracking-wider text-muted uppercase">Счётчики</h2>

      <div className="flex gap-2">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={`min-h-12 flex-1 rounded-ctl border text-body ${
              option.value === period
                ? 'border-accent-ink bg-accent/15 text-text'
                : 'border-border text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {totals.length === 0 && (
        <p className="text-body text-muted">За этот период ничего не записано.</p>
      )}

      {totals.map((total) => {
        // прогресс до следующей вехи считаем всегда от общего счёта, а не от периода:
        // веха «10 000 отжиманий» — про всю жизнь, а не про этот месяц
        const lifetime = allTime.find((t) => t.movementId === total.movementId)
        const isHold = total.reps === 0 && total.seconds > 0
        const value = isHold ? (lifetime?.seconds ?? 0) : (lifetime?.reps ?? 0)
        const target = nextMilestone(value, isHold ? HOLD_MILESTONES : REP_MILESTONES)
        const shown = isHold ? Math.round(total.seconds / 60) : total.reps

        return (
          <article
            key={total.movementId}
            className="rounded-card border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-body">{total.name}</span>
              <span className="font-num text-value font-semibold">
                {shown.toLocaleString('ru')}
                {isHold && <span className="text-body font-normal text-muted"> мин</span>}
              </span>
            </div>

            <p className="text-label text-muted">
              {pluralize(total.sets, 'подход', 'подхода', 'подходов')}
              {period !== 'all' && (
                <> · за всё время {(isHold ? Math.round(value / 60) : value).toLocaleString('ru')}</>
              )}
            </p>

            {target !== undefined && (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent/60"
                    style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-label text-muted">
                  до{' '}
                  <span className="font-num">
                    {(isHold ? Math.round(target / 60) : target).toLocaleString('ru')}
                  </span>
                  {isHold ? ' мин' : ''} осталось{' '}
                  <span className="font-num">
                    {(isHold
                      ? Math.round((target - value) / 60)
                      : target - value
                    ).toLocaleString('ru')}
                  </span>
                  {isHold ? ' мин' : ''}
                </p>
              </>
            )}
          </article>
        )
      })}

      <p className="text-body text-muted">
        Счётчики — любопытная информация, а не мера прогресса: повторения на разных
        ступенях несравнимы между собой. Прогресс меряется ступенями.
      </p>
    </section>
  )
}

const KIND_MARK: Record<AchievementKind, string> = {
  step: '⚙',
  skill: '⚙',
  record: '★',
  volume: '∑',
  streak: '▲',
  first: '◆',
  return: '↺',
  milestone: '◈',
}

function AchievementFeed({ data }: { data: AppData }) {
  const [expanded, setExpanded] = useState(false)
  const all = achievements(data)

  if (all.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Достижения</h2>
        <p className="text-body text-muted">
          Пока пусто. Первое появится, когда возьмёшь ступень или побьёшь свой результат.
        </p>
      </section>
    )
  }

  const shown = expanded ? all : all.slice(0, 8)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label tracking-wider text-muted uppercase">Достижения</h2>

      {shown.map((item) => (
        <div
          key={item.id}
          className={`flex items-baseline gap-3 rounded-ctl border px-3 py-2 ${
            item.kind === 'skill'
              ? 'border-2 border-accent-ink bg-accent/20'
              : item.kind === 'step'
                ? 'border-accent-ink/40 bg-accent/10'
                : 'border-border bg-surface'
          }`}
        >
          <span
            className={`w-4 shrink-0 text-center ${
              item.kind === 'step' || item.kind === 'skill' ? 'text-accent-ink' : 'text-muted'
            }`}
            aria-hidden="true"
          >
            {KIND_MARK[item.kind]}
          </span>
          <span className="flex-1">
            <span className="block text-body">{item.title}</span>
            <span className="block text-label text-muted">{item.detail}</span>
          </span>
          {item.date && (
            <span className="font-num text-label text-muted">{item.date.slice(5)}</span>
          )}
        </div>
      ))}

      {all.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-h-12 rounded-ctl border border-border text-body text-muted"
        >
          {expanded ? 'свернуть' : `показать все (${all.length})`}
        </button>
      )}
    </section>
  )
}
