import { lazy, Suspense, useState } from 'react'

import { achievements, weeklyStreak, type AchievementKind } from '../domain/achievements.ts'
import { addDays, formatDateShort, localDateString } from '../domain/dates.ts'
import { measurementsOf, weekDays, weekProgress } from '../domain/selectors.ts'
import {
  HOLD_MILESTONES,
  nextMilestone,
  PERIODS,
  REP_MILESTONES,
  thenAndNow,
  totalsByMovement,
  weightThenAndNow,
  type Period,
} from '../domain/stats.ts'
import type { AppData, Measurement } from '../domain/types.ts'
import { plural, pluralize } from '../lib/plural.ts'
import { useStore } from '../store/useStore.ts'

// recharts тяжёлый: график веса тянется только когда «Профиль» открыт
const WeightChart = lazy(() => import('../components/WeightChart.tsx'))

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
      <Rhythm data={data} />
      <Weight data={data} />
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

const RHYTHM_WEEKS = 10
/** Сколько недель видно сразу: четырёх хватает, чтобы рисунок ритма читался. */
const RHYTHM_WEEKS_SHORT = 4

/**
 * Ритм: десять недель подряд, той же полоской, что на «Сегодня».
 *
 * Одна неделя отвечает «пора ли сегодня», десять — «как я вообще хожу»: видно сползание
 * графика и провалы, которые в счётчиках не читаются. Здесь тоже только факт, без
 * штрафа за дырки (Д-27).
 */
function Rhythm({ data }: { data: AppData }) {
  const [full, setFull] = useState(false)
  // аккордеон здесь не годится: смысл блока и есть картинка, а свёрнутая строка про него
  // повторяла бы плитки стрика выше. Прячем глубину истории, а не сам рисунок (Д-27)
  const shown = full ? RHYTHM_WEEKS : RHYTHM_WEEKS_SHORT
  const weeks = Array.from({ length: shown }, (_, index) =>
    addDays(new Date(), -7 * (shown - 1 - index)),
  )

  const finished = data.workouts.filter((w) => w.finishedAt !== undefined)
  // число без даты первой тренировки висит без масштаба: «47» — это много или мало?
  const firstDate = finished.reduce<string | undefined>(
    (earliest, w) => (earliest === undefined || w.date < earliest ? w.date : earliest),
    undefined,
  )

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label tracking-wider text-muted uppercase">Ритм</h2>
      <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3">
        {weeks.map((anchor) => {
          const days = weekDays(data, anchor)
          const first = days[0]
          if (!first) return null
          return (
            <div key={first.date} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-label text-muted">
                {formatDateShort(first.date)}
              </span>
              <span className="flex flex-1 gap-1">
                {days.map((day) => (
                  <span
                    key={day.date}
                    className={`h-5 flex-1 rounded-ctl ${
                      day.done > 0
                        ? 'bg-text'
                        : day.future
                          ? 'border border-border'
                          : 'bg-surface-2'
                    } ${day.today ? 'outline-2 outline-offset-1 outline-text' : ''}`}
                  />
                ))}
              </span>
            </div>
          )
        })}

        {finished.length > 0 && (
          <p className="mt-2 border-t border-border pt-3 text-body text-muted">
            Всего{' '}
            <span className="font-num text-text">{finished.length}</span>{' '}
            {plural(finished.length, 'тренировка', 'тренировки', 'тренировок')}
            {firstDate && `, первая ${formatDateShort(firstDate)}`}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setFull((v) => !v)}
        aria-expanded={full}
        className="min-h-12 rounded-ctl border border-border text-body text-muted"
      >
        {full ? 'Свернуть' : `Показать ${RHYTHM_WEEKS} недель`}
      </button>
    </section>
  )
}

/**
 * «Показать все» под усечённым списком.
 *
 * Блоки «Профиля» растут вместе с историей, и через год каждый из них длиннее экрана.
 * Приём выбран не аккордеон: у ленты и счётчиков ценность в том, что свежее видно
 * сразу, а тап за каждым взглядом эту ценность и убивает. Прячется хвост, а не смысл.
 */
function ShowAll({
  open,
  hidden,
  onToggle,
}: {
  open: boolean
  hidden: number
  onToggle: () => void
}) {
  if (hidden <= 0 && !open) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="min-h-12 rounded-ctl border border-border text-body text-muted"
    >
      {open ? 'Свернуть' : `Показать все (${hidden} ещё)`}
    </button>
  )
}

/** Вес, с которого начинает поле, если замеров ещё не было. */
const DEFAULT_WEIGHT_KG = 70

/** Разумные границы человеческого веса плюс округление до десятых. */
function clampWeight(kg: number): number {
  return Math.min(300, Math.max(20, Math.round(kg * 10) / 10))
}

/**
 * Разбор набранного вручную. Запятая на русской раскладке под большим пальцем ближе
 * точки, поэтому принимаются обе. Мусор и значения вне границ дают undefined —
 * вызывающий оставляет прежнее число.
 */
function parseWeight(text: string): number | undefined {
  const parsed = Number(text.replace(',', '.').trim())
  if (!Number.isFinite(parsed) || parsed < 20 || parsed > 300) return undefined
  return clampWeight(parsed)
}

/** Ближайший замер, который старше указанного числа дней. */
function measurementBefore(points: Measurement[], days: number): Measurement | undefined {
  const border = localDateString(addDays(new Date(), -days))
  // points идут от старых к новым, значит нужен ПОСЛЕДНИЙ подходящий, а не первый
  return points.findLast((m) => m.date <= border)
}

/**
 * Вес.
 *
 * **Ни целевого веса, ни ИМТ, ни «норм», ни ачивок за вес.** Это ровно тот класс метрик,
 * который можно накрутить в ущерб себе, а награждать такое запрещено принципом отбора
 * достижений. Вес показывается как факт, в духе Д-11: любопытная информация, не оценка.
 *
 * Степперы — для ежедневных десятых, **число вводится и напрямую**: от дефолта
 * до своего веса степпером ехать тридцать нажатий, а любой дефолт мимо половины людей.
 * Запрет на текстовый ввод касается экрана тренировки, где телефон в одной руке
 * под турником; «Профиль» смотрят с дивана, и в редакторе упражнений поля уже есть.
 *
 * Предзаполняется прошлым замером — между взвешиваниями вес меняется на десятые,
 * и набирать число заново незачем.
 *
 * Блок свёрнут по умолчанию: это инструмент ввода, нужный десять секунд в день,
 * а места занимал пол-экрана. В свёрнутом виде остаётся то, на что смотрят.
 */
function Weight({ data }: { data: AppData }) {
  const setMeasurement = useStore((s) => s.setMeasurement)
  const deleteMeasurement = useStore((s) => s.deleteMeasurement)

  const points = measurementsOf(data, 'weight')
  const last = points.at(-1)
  const today = localDateString()
  const recordedToday = last?.date === today

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const value = draft ?? last?.value ?? DEFAULT_WEIGHT_KG

  const monthAgo = measurementBefore(points, 25)
  const delta = last && monthAgo && monthAgo.id !== last.id ? last.value - monthAgo.value : undefined

  /**
   * Значение, которое будет записано прямо сейчас. Набранное в поле учитывается **до**
   * потери фокуса: иначе тап по «Записать» с открытой клавиатурой зависел бы от того,
   * успел ли blur опередить click, а это ровно тот класс гонок, который ловится
   * не в браузере, а потом на площадке.
   */
  const effective = (typed !== null ? parseWeight(typed) : undefined) ?? value

  const step = (by: number) => {
    setTyped(null)
    setDraft(clampWeight(effective + by))
  }

  const commitTyped = () => {
    setDraft(effective)
    setTyped(null)
  }

  const deltaLabel =
    delta === undefined ? null : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} за месяц`

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 items-baseline justify-between gap-3 text-left"
      >
        <h2 className="text-label tracking-wider text-muted uppercase">Вес</h2>
        <span className="flex items-baseline gap-3 text-body">
          {last ? (
            <span className="font-num text-value">
              {last.value.toFixed(1)}
              <span className="text-body text-muted"> кг</span>
            </span>
          ) : (
            <span className="text-muted">не отмечен</span>
          )}
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
          <span className="text-muted">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          {typed === null ? (
            <button
              type="button"
              onClick={() => setTyped(value.toFixed(1))}
              className="text-left font-num text-set font-semibold"
              aria-label="Ввести вес числом"
            >
              {value.toFixed(1)}
              <span className="text-body font-normal text-muted"> кг</span>
            </button>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={commitTyped}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="w-32 rounded-ctl border border-border bg-surface-2 px-3 py-1 font-num text-set font-semibold"
            />
          )}
          {delta !== undefined && (
            <p className="text-body text-muted">
              <span className="font-num text-text">
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)}
              </span>{' '}
              за месяц
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {[-0.5, -0.1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => step(d)}
              className="min-h-12 flex-1 rounded-ctl border border-border bg-surface-2 font-num text-body"
            >
              {d}
            </button>
          ))}
          {[0.1, 0.5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => step(d)}
              className="min-h-12 flex-1 rounded-ctl border border-border bg-surface-2 font-num text-body"
            >
              +{d}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setMeasurement('weight', today, effective)
            setDraft(null)
            setTyped(null)
          }}
          className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
        >
          {recordedToday ? 'Обновить за сегодня' : 'Записать за сегодня'}
        </button>

        {points.length >= 2 && (
          <Suspense fallback={<p className="text-body text-muted">Загрузка графика…</p>}>
            <WeightChart points={points} />
          </Suspense>
        )}

        {points.length > 0 && (
          <ul className="flex flex-col gap-1">
            {points
              .toReversed()
              .slice(0, 3)
              .map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 text-body">
                  <span className="text-muted">{formatDateShort(m.date)}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-num">{m.value.toFixed(1)}</span>
                    <button
                      type="button"
                      onClick={() => deleteMeasurement(m.id)}
                      className="text-muted"
                      aria-label={`Удалить замер за ${formatDateShort(m.date)}`}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        )}

        {points.length === 0 && (
          <p className="text-body text-muted">
            Замеров ещё нет. Вес здесь — просто факт: ни целей, ни норм, ни достижений
            за него.
          </p>
        )}
      </div>
      )}
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
  const weight = weightThenAndNow(data)
  if (comparisons.length === 0 && !weight) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label tracking-wider text-muted uppercase">Тогда и сейчас</h2>

      {weight && (
        <article className="rounded-card border border-border bg-surface px-4 py-3">
          <p className="text-body font-medium">Вес</p>
          <p className="mt-1 text-body text-muted">
            {weight.agoLabel}: <span className="font-num">{weight.thenValue.toFixed(1)}</span> кг
          </p>
          <p className="text-body">
            сегодня:{' '}
            <span className="font-num text-accent-ink">{weight.nowValue.toFixed(1)}</span> кг
          </p>
        </article>
      )}
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

/** Сколько упражнений в счётчиках видно сразу: сверху те, где цифры и правда любопытны. */
const COUNTERS_SHORT = 3

function Counters({ data }: { data: AppData }) {
  const [period, setPeriod] = useState<Period>('all')
  const [expanded, setExpanded] = useState(false)
  const totals = totalsByMovement(data, period)
  const allTime = totalsByMovement(data, 'all')
  const shownTotals = expanded ? totals : totals.slice(0, COUNTERS_SHORT)

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

      {shownTotals.map((total) => {
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

      <ShowAll
        open={expanded}
        hidden={totals.length - shownTotals.length}
        onToggle={() => setExpanded((v) => !v)}
      />

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

  // было восемь: на длинной истории лента всё равно уходила на три экрана,
  // а смысл её в том, что свежее видно сразу
  const shown = expanded ? all : all.slice(0, 3)

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

      <ShowAll
        open={expanded}
        hidden={all.length - shown.length}
        onToggle={() => setExpanded((v) => !v)}
      />
    </section>
  )
}
