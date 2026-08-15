/**
 * Производные величины: чистые функции от AppData, без побочных эффектов.
 *
 * Здесь НЕ хранится ничего — всё считается из журнала при обращении.
 * См. docs/data-model.md#производные-величины и docs/decisions.md#д-3.
 */

import { currentWeekKey, isoWeekKey } from './dates.ts'
import type { AppData, MeasuredStep, Movement, SetEntry, Step, Workout } from './types.ts'
import { currentStep, isMeasured } from './types.ts'

/** Незавершённая тренировка. Одновременно может быть только одна. */
export function activeWorkout(data: AppData): Workout | undefined {
  return data.workouts.find((w) => w.finishedAt === undefined)
}

export function workoutById(data: AppData, id: string): Workout | undefined {
  return data.workouts.find((w) => w.id === id)
}

export function movementById(data: AppData, id: string): Movement | undefined {
  return data.movements.find((m) => m.id === id)
}

/** Тренировки от новых к старым. */
export function workoutsNewestFirst(data: AppData): Workout[] {
  return data.workouts.toSorted((a, b) => b.startedAt - a.startedAt)
}

export function setsOfWorkout(data: AppData, workoutId: string): SetEntry[] {
  return data.sets.filter((s) => s.workoutId === workoutId)
}

export function setsOfMovement(data: AppData, workoutId: string, movementId: string): SetEntry[] {
  return data.sets.filter((s) => s.workoutId === workoutId && s.movementId === movementId)
}

/**
 * Подходы последней тренировки, где это движение делалось на этой же ступени.
 *
 * Ступень в условии обязательна: подходы на разных ступенях несравнимы, и именно
 * из-за их смешивания прогресс был невидимым (docs/spec.md#проблема).
 */
export function lastSetsOnStep(
  data: AppData,
  movementId: string,
  stepId: string,
  excludeWorkoutId?: string,
): SetEntry[] {
  const candidates = data.sets.filter(
    (s) => s.movementId === movementId && s.stepId === stepId && s.workoutId !== excludeWorkoutId,
  )
  if (candidates.length === 0) return []

  let latest: Workout | undefined
  for (const set of candidates) {
    const workout = workoutById(data, set.workoutId)
    if (!workout) continue
    if (!latest || workout.startedAt > latest.startedAt) latest = workout
  }
  if (!latest) return []

  const workoutId = latest.id
  return candidates.filter((s) => s.workoutId === workoutId).toSorted((a, b) => a.order - b.order)
}

/**
 * Значение, которым предзаполняется поле подхода.
 *
 * Берём результат подхода с тем же номером в прошлый раз; если такого не было —
 * последний сделанный тогда подход; если истории нет вовсе — низ диапазона.
 * Это главная механика экономии тапов: обычное действие — один тап по галочке.
 */
export function prefillValue(
  data: AppData,
  movementId: string,
  step: MeasuredStep,
  order: number,
  side: SetEntry['side'],
  excludeWorkoutId?: string,
): number {
  const previous = lastSetsOnStep(data, movementId, step.id, excludeWorkoutId).filter(
    (s) => s.side === side && !s.isWarmup,
  )
  const sameOrder = previous.find((s) => s.order === order)
  const source = sameOrder ?? previous.at(-1)
  const value = step.unit === 'seconds' ? source?.durationSec : source?.reps
  return value ?? step.repMin
}

/** Числовой результат подхода — повторения или секунды, смотря какая ступень. */
export function setValue(set: SetEntry, step: Step): number | undefined {
  if (!isMeasured(step)) return undefined
  return step.unit === 'seconds' ? set.durationSec : set.reps
}

/** Компактная запись результата: «12 · 12 · 11». */
export function formatSets(sets: SetEntry[], step: Step): string {
  return sets
    .toSorted((a, b) => a.order - b.order)
    .map((s) => setValue(s, step) ?? '—')
    .join(' · ')
}

/** Сколько рабочих подходов нужно на ступени: односторонние удваивают. */
export function requiredSets(step: MeasuredStep): number {
  return step.targetSets * (step.perSide === true ? 2 : 1)
}

export function nextStep(movement: Movement): Step | undefined {
  const step = currentStep(movement)
  return step ? movement.steps.find((s) => s.order === step.order + 1) : undefined
}

export function previousStep(movement: Movement): Step | undefined {
  const step = currentStep(movement)
  return step ? movement.steps.find((s) => s.order === step.order - 1) : undefined
}

/** Закрыт ли диапазон этой ступени в конкретной тренировке. */
function rangeClosedIn(data: AppData, workoutId: string, movement: Movement, step: Step): boolean {
  const sets = data.sets.filter(
    (s) =>
      s.workoutId === workoutId &&
      s.movementId === movement.id &&
      s.stepId === step.id &&
      !s.isWarmup,
  )

  if (!isMeasured(step)) return sets.some((s) => s.succeeded === true)
  if (sets.length < requiredSets(step)) return false
  return sets.every((s) => (setValue(s, step) ?? 0) >= step.repMax)
}

export type Readiness = 'ready' | 'in_progress' | 'no_data'

/**
 * Готовность к усложнению — ядро продукта.
 *
 * Ступень взята, когда в последних `readyAfterSessions` тренировках с этим упражнением
 * ВСЕ рабочие подходы дошли до верха диапазона. Разминочные не считаются.
 *
 * Незавершённая тренировка тоже учитывается: карточка «Ступень взята» должна появиться
 * сразу после последнего подхода, а не в следующий раз.
 */
export function readiness(data: AppData, movement: Movement): Readiness {
  const step = currentStep(movement)
  if (!step) return 'no_data'

  const withStep = data.workouts
    .filter((w) =>
      data.sets.some(
        (s) => s.workoutId === w.id && s.movementId === movement.id && s.stepId === step.id,
      ),
    )
    .toSorted((a, b) => b.startedAt - a.startedAt)

  if (withStep.length === 0) return 'no_data'

  const need = Math.max(1, data.settings.readyAfterSessions)
  if (withStep.length < need) return 'in_progress'

  const recent = withStep.slice(0, need)
  return recent.every((w) => rangeClosedIn(data, w.id, movement, step))
    ? 'ready'
    : 'in_progress'
}

/**
 * Максимальный вес, когда-либо поднятый на этой ступени.
 *
 * Не хранится отдельным полем: выводится из журнала, как и всё остальное (Д-3).
 * Это храповик для весовых ступеней — откат по весу рекорд не стирает.
 */
export function maxWeightOnStep(data: AppData, movementId: string, stepId: string): number {
  return data.sets
    .filter((s) => s.movementId === movementId && s.stepId === stepId)
    .reduce((max, s) => Math.max(max, s.weightKg ?? 0), 0)
}

/**
 * Есть ли записанные подходы по ступени.
 *
 * Правило редактора: пока истории нет — менять можно всё; как только появились
 * подходы, запрещены изменения, обесценивающие уже записанное (единица измерения
 * и тип ступени), а также удаление. Остальное — диапазоны, название, отдых —
 * правится свободно: оно влияет только на будущее.
 */
export function stepHasSets(data: AppData, stepId: string): boolean {
  return data.sets.some((s) => s.stepId === stepId)
}

export function movementHasSets(data: AppData, movementId: string): boolean {
  return data.sets.some((s) => s.movementId === movementId)
}

export interface WeekProgress {
  done: number
  target: number
}

/** Сколько завершённых тренировок на текущей ISO-неделе. */
export function weekProgress(data: AppData): WeekProgress {
  const week = currentWeekKey()
  const done = data.workouts.filter(
    (w) => w.finishedAt !== undefined && isoWeekKey(w.date) === week,
  ).length
  return { done, target: data.settings.weeklyTarget }
}

/**
 * Шаблон, который логично предложить: не тот, что был в прошлый раз.
 * Дни A и B чередуются, свободная в предложение не попадает.
 */
export function suggestedTemplateId(data: AppData): string | undefined {
  const rotating = data.templates.filter((t) => t.movementIds.length > 0)
  const first = rotating[0]
  if (!first) return undefined

  const previous = workoutsNewestFirst(data).find((w) => w.finishedAt !== undefined)
  if (!previous?.templateId) return first.id

  const index = rotating.findIndex((t) => t.id === previous.templateId)
  if (index === -1) return first.id
  return rotating[(index + 1) % rotating.length]?.id
}

/** Сумма повторений в наборе подходов. Секунды сюда не входят. */
export function totalReps(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)
}

export interface WorkoutTotals {
  sets: number
  reps: number
  durationMin: number
}

export function workoutTotals(data: AppData, workout: Workout): WorkoutTotals {
  const sets = setsOfWorkout(data, workout.id)
  const end = workout.finishedAt ?? Date.now()
  return {
    sets: sets.length,
    reps: totalReps(sets),
    durationMin: Math.max(1, Math.round((end - workout.startedAt) / 60_000)),
  }
}
