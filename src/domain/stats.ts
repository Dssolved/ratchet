/**
 * Статистика и рекорды. Как и всё производное — чистые функции от журнала (Д-3).
 */

import { isoWeekKey, parseLocalDate } from './dates.ts'
import { setValue, workoutById } from './selectors.ts'
import { isMeasured, type AppData, type Movement, type SetEntry, type Step } from './types.ts'

export type Period = 'week' | 'month' | 'year' | 'all'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
  { value: 'all', label: 'Всё время' },
]

function inPeriod(date: string, period: Period): boolean {
  if (period === 'all') return true
  if (period === 'week') return isoWeekKey(date) === isoWeekKey(new Date())

  const d = parseLocalDate(date)
  const now = new Date()
  if (period === 'year') return d.getFullYear() === now.getFullYear()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export interface MovementTotal {
  movementId: string
  name: string
  reps: number
  seconds: number
  sets: number
}

/**
 * Суммарные повторения за период.
 *
 * ВАЖНО: это статистика ради интереса, а не метрика прогресса. Складывать повторения
 * через разные ступени некорректно — 100 отжиманий с колен и 100 с рюкзаком разные
 * вещи (Д-11). Поэтому никаких коэффициентов сложности, только сырой счётчик.
 */
export function totalsByMovement(data: AppData, period: Period): MovementTotal[] {
  const dates = new Map(data.workouts.map((w) => [w.id, w.date]))

  const totals = new Map<string, MovementTotal>()
  for (const set of data.sets) {
    const date = dates.get(set.workoutId)
    if (!date || !inPeriod(date, period)) continue

    const movement = data.movements.find((m) => m.id === set.movementId)
    const current = totals.get(set.movementId) ?? {
      movementId: set.movementId,
      name: movement?.name ?? set.movementId,
      reps: 0,
      seconds: 0,
      sets: 0,
    }
    current.reps += set.reps ?? 0
    current.seconds += set.durationSec ?? 0
    current.sets += 1
    totals.set(set.movementId, current)
  }

  return [...totals.values()].toSorted((a, b) => b.reps - a.reps)
}

/**
 * Вехи по объёму — ПО КАЖДОМУ УПРАЖНЕНИЮ, а не по общей сумме.
 *
 * «10 000 отжиманий» — факт, который можно произнести вслух. «10 000 повторений всего» —
 * каша из подтягиваний, приседаний и планки, которая не значит ничего.
 */
export const REP_MILESTONES = [500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000]

/** Для секундных упражнений вехи во времени удержания: 30 мин, 1 ч, 5 ч, 10 ч, сутки. */
export const HOLD_MILESTONES = [1800, 3600, 18_000, 36_000, 86_400]

export function nextMilestone(value: number, milestones: number[]): number | undefined {
  return milestones.find((m) => m > value)
}

export function lastMilestone(value: number, milestones: number[]): number | undefined {
  return milestones.findLast((m) => m <= value)
}

export interface PersonalRecord {
  movementId: string
  movementName: string
  stepName: string
  value: number
  previous: number
  unit: 'reps' | 'seconds'
}

/**
 * Рекорды, поставленные в этой тренировке.
 *
 * Рекорд — максимум в одном рабочем подходе В ПРЕДЕЛАХ КОНКРЕТНОЙ СТУПЕНИ.
 * Межступенчатых рекордов не бывает: варианты несравнимы между собой.
 */
export function recordsInWorkout(data: AppData, workoutId: string): PersonalRecord[] {
  const workout = workoutById(data, workoutId)
  if (!workout) return []

  const records: PersonalRecord[] = []

  const inThisWorkout = data.sets.filter((s) => s.workoutId === workoutId && !s.isWarmup)
  const byStep = new Map<string, SetEntry[]>()
  for (const set of inThisWorkout) {
    byStep.set(set.stepId, [...(byStep.get(set.stepId) ?? []), set])
  }

  for (const [stepId, sets] of byStep) {
    const movement = data.movements.find((m) => m.steps.some((s) => s.id === stepId))
    const step = movement?.steps.find((s) => s.id === stepId)
    if (!movement || !step || !isMeasured(step)) continue

    const best = sets.reduce((max, s) => Math.max(max, setValue(s, step) ?? 0), 0)
    if (best === 0) continue

    // предыдущий максимум на этой ступени, из всех тренировок кроме текущей
    const previous = data.sets
      .filter((s) => s.stepId === stepId && s.workoutId !== workoutId && !s.isWarmup)
      .reduce((max, s) => Math.max(max, setValue(s, step) ?? 0), 0)

    if (best > previous) {
      records.push({
        movementId: movement.id,
        movementName: movement.name,
        stepName: step.name,
        value: best,
        previous,
        unit: step.unit,
      })
    }
  }

  return records
}

export interface Comparison {
  movementId: string
  movementName: string
  agoLabel: string
  thenStep: string
  thenValue: string
  nowStep: string
  nowValue: string
}

export interface WeightComparison {
  agoLabel: string
  /** поле не `then`: объект с таким ключом становится thenable и ломается в await */
  thenValue: number
  nowValue: number
}

/**
 * Вес тогда и сейчас — тем же горизонтом, что и упражнения.
 *
 * Показывается рядом с ними не ради самого веса, а ради контекста: «год назад 78 кг
 * и обычные 3×8, сегодня 82 кг и с весом +7.5 кг 3×9» — совсем другое высказывание,
 * чем каждая половина по отдельности (Д-30). Оценки по-прежнему никакой: два числа,
 * выводы за человеком.
 */
export function weightThenAndNow(data: AppData): WeightComparison | undefined {
  const points = data.measurements
    .filter((m) => m.kind === 'weight')
    .toSorted((a, b) => a.date.localeCompare(b.date))

  const now = points.at(-1)
  const oldest = points[0]
  if (!now || !oldest || now.id === oldest.id) return undefined

  const today = new Date()
  const ageOf = (date: string) =>
    Math.round((today.getTime() - parseLocalDate(date).getTime()) / 86_400_000)

  const horizon = HORIZONS.find((h) => ageOf(oldest.date) >= h.days)
  if (!horizon) return undefined

  const targetTime = today.getTime() - horizon.days * 86_400_000
  const past = points.toSorted(
    (a, b) =>
      Math.abs(parseLocalDate(a.date).getTime() - targetTime) -
      Math.abs(parseLocalDate(b.date).getTime() - targetTime),
  )[0]
  if (!past || past.id === now.id) return undefined

  return { agoLabel: horizon.label, thenValue: past.value, nowValue: now.value }
}

const HORIZONS: { days: number; label: string }[] = [
  { days: 365, label: 'год назад' },
  { days: 180, label: 'полгода назад' },
  { days: 90, label: 'три месяца назад' },
  { days: 30, label: 'месяц назад' },
]

function describeSets(sets: SetEntry[], step: Step): string {
  if (!isMeasured(step)) {
    const successes = sets.reduce((sum, s) => sum + (s.successes ?? 0), 0)
    const attempts = sets.reduce((sum, s) => sum + (s.attempts ?? 0), 0)
    return `${successes} из ${attempts}`
  }
  const values = sets
    .toSorted((a, b) => a.order - b.order)
    .map((s) => setValue(s, step) ?? 0)
  const weight = sets.find((s) => (s.weightKg ?? 0) > 0)?.weightKg
  const suffix = step.unit === 'seconds' ? ' сек' : ''
  const body = `${values.join(' · ')}${suffix}`
  return weight ? `+${weight} кг · ${body}` : body
}

/**
 * Сравнение «тогда и сейчас» по каждому упражнению.
 *
 * Берётся самый дальний горизонт, для которого есть данные: если истории год —
 * сравниваем с годом, если только месяц — с месяцем. Показываем не только числа,
 * но и ступени: рост со «стопы на возвышении 8» до «с весом 10» — совсем не то же
 * самое, что 8 → 10 на месте.
 */
export function thenAndNow(data: AppData): Comparison[] {
  const result: Comparison[] = []
  const today = new Date()

  for (const movement of data.movements) {
    if (movement.archived) continue

    const withSets = data.workouts
      .filter((w) => data.sets.some((s) => s.workoutId === w.id && s.movementId === movement.id))
      .toSorted((a, b) => b.startedAt - a.startedAt)

    const latest = withSets[0]
    if (!latest || withSets.length < 2) continue

    const horizon = HORIZONS.find((h) => {
      const oldest = withSets.at(-1)
      if (!oldest) return false
      const age = Math.round((today.getTime() - parseLocalDate(oldest.date).getTime()) / 86_400_000)
      return age >= h.days
    })
    if (!horizon) continue

    // ближайшая тренировка к нужной давности
    const targetTime = today.getTime() - horizon.days * 86_400_000
    const past = withSets.toSorted(
      (a, b) =>
        Math.abs(parseLocalDate(a.date).getTime() - targetTime) -
        Math.abs(parseLocalDate(b.date).getTime() - targetTime),
    )[0]
    if (!past || past.id === latest.id) continue

    const setsOf = (workoutId: string) =>
      data.sets.filter(
        (s) => s.workoutId === workoutId && s.movementId === movement.id && !s.isWarmup,
      )

    const thenSets = setsOf(past.id)
    const nowSets = setsOf(latest.id)
    const thenStep = movement.steps.find((s) => s.id === thenSets[0]?.stepId)
    const nowStep = movement.steps.find((s) => s.id === nowSets[0]?.stepId)
    if (!thenStep || !nowStep || thenSets.length === 0 || nowSets.length === 0) continue

    result.push({
      movementId: movement.id,
      movementName: movement.name,
      agoLabel: horizon.label,
      thenStep: thenStep.name.toLowerCase(),
      thenValue: describeSets(thenSets, thenStep),
      nowStep: nowStep.name.toLowerCase(),
      nowValue: describeSets(nowSets, nowStep),
    })
  }

  return result
}

export interface ChartPoint {
  date: string
  label: string
  min: number
  max: number
  stepId: string
}

export interface StepBand {
  stepId: string
  stepName: string
  from: string
  to: string
  repMin: number
  repMax: number
}

export interface MovementChart {
  points: ChartPoint[]
  bands: StepBand[]
  unit: 'reps' | 'seconds'
}

/**
 * Данные графика.
 *
 * По каждой тренировке берём минимальный и максимальный рабочий подход. Минимум важнее:
 * именно он связывающее ограничение двойной прогрессии — ступень взята, когда ДО верха
 * диапазона дошли все подходы, а не лучший.
 *
 * Полосы — целевой диапазон ступени, действовавшей в это время. Когда ступень меняется,
 * полоса сдвигается, и падение повторений читается как повышение сложности, а не как
 * деградация.
 */
export function movementChart(data: AppData, movement: Movement): MovementChart {
  const stepById = new Map<string, Step>(movement.steps.map((s) => [s.id, s]))

  const byWorkout = new Map<string, SetEntry[]>()
  for (const set of data.sets) {
    if (set.movementId !== movement.id || set.isWarmup) continue
    byWorkout.set(set.workoutId, [...(byWorkout.get(set.workoutId) ?? []), set])
  }

  const points: ChartPoint[] = []
  for (const [workoutId, sets] of byWorkout) {
    const workout = workoutById(data, workoutId)
    const step = stepById.get(sets[0]?.stepId ?? '')
    if (!workout || !step || !isMeasured(step)) continue

    const values = sets
      .map((s) => setValue(s, step))
      .filter((v): v is number => typeof v === 'number')
    if (values.length === 0) continue

    points.push({
      date: workout.date,
      label: workout.date.slice(5).replace('-', '.'),
      min: Math.min(...values),
      max: Math.max(...values),
      stepId: step.id,
    })
  }

  points.sort((a, b) => a.date.localeCompare(b.date))

  // непрерывные отрезки времени, пока держалась одна и та же ступень
  const bands: StepBand[] = []
  for (const point of points) {
    const step = stepById.get(point.stepId)
    if (!step || !isMeasured(step)) continue

    const last = bands.at(-1)
    if (last && last.stepId === point.stepId) {
      last.to = point.label
    } else {
      bands.push({
        stepId: step.id,
        stepName: step.name,
        from: point.label,
        to: point.label,
        repMin: step.repMin,
        repMax: step.repMax,
      })
    }
  }

  const currentStep = stepById.get(movement.currentStepId)
  return {
    points,
    bands,
    unit: currentStep && isMeasured(currentStep) ? currentStep.unit : 'reps',
  }
}
