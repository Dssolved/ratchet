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
