/**
 * Модель данных. Подробности и обоснование — docs/data-model.md.
 *
 * Принцип: хранятся только факты (SetEntry, Workout) и решения (StepChange).
 * Рекорды, стрики, готовность к усложнению и суммарные повторения — производные,
 * считаются функциями от этих данных и никогда не попадают в состояние.
 */

export type Category = 'pull' | 'push' | 'legs' | 'core'
export type Unit = 'reps' | 'seconds'
export type ProgressBy = 'variant' | 'weight'
export type Side = 'both' | 'left' | 'right'

interface StepBase {
  id: string
  /** 1..N внутри движения, определяет порядок лестницы */
  order: number
  name: string
  /** переопределяет Settings.defaultRestSec */
  restSec?: number
  /** упражнение выполняется на каждую сторону отдельно */
  perSide?: boolean
}

/** Ступень с измеримым результатом: повторения или секунды. */
export interface MeasuredStep extends StepBase {
  kind: 'measured'
  unit: Unit
  progressBy: ProgressBy
  /** для unit:'seconds' — секунды */
  repMin: number
  repMax: number
  targetSets: number
  /** текущий вес на ступени с progressBy:'weight' */
  weightKg?: number
  /** шаг прибавки веса, по умолчанию Settings.defaultWeightStepKg */
  weightStepKg?: number
}

/** Навыковая ступень: измеряется фактом «получилось / пробовал». */
export interface BinaryStep extends StepBase {
  kind: 'binary'
}

export type Step = MeasuredStep | BinaryStep

export interface Movement {
  id: string
  /** семейство движения: "Вертикальная тяга", а не конкретный вариант */
  name: string
  category: Category
  /** постоянное условие выполнения ("на упорах"). Напоминалка, НЕ ступень. */
  equipment?: string
  steps: Step[]
  currentStepId: string
  /** храповик: максимальная взятая ступень, никогда не убывает */
  maxReachedStepOrder: number
  archived: boolean
  sortOrder: number
}

export interface Workout {
  id: string
  /** 'YYYY-MM-DD' в ЛОКАЛЬНОМ времени — см. docs/data-model.md#даты */
  date: string
  startedAt: number
  finishedAt?: number
  templateId?: string
  notes?: string
}

export interface SetEntry {
  id: string
  workoutId: string
  movementId: string
  /** ключ к сравнимости: подход сравним только с подходами на той же ступени */
  stepId: string
  order: number
  reps?: number
  durationSec?: number
  weightKg?: number
  side: Side
  /** разминочные не участвуют в прогрессии и рекордах */
  isWarmup: boolean
  /** только для BinaryStep */
  succeeded?: boolean
}

export interface StepChange {
  id: string
  movementId: string
  date: string
  direction: 'up' | 'down'
  fromStepOrder: number
  toStepOrder: number
  /** для переходов внутри весовой ступени */
  fromWeightKg?: number
  toWeightKg?: number
  note?: string
}

export interface Template {
  id: string
  name: string
  /** порядок значим: ноги стоят вторыми осознанно, см. docs/progressions.md */
  movementIds: string[]
}

export interface Settings {
  weeklyTarget: number
  defaultRestSec: number
  defaultWeightStepKg: number
  /** сколько тренировок подряд надо закрыть диапазон, чтобы ступень считалась взятой */
  readyAfterSessions: number
}

/** Всё содержимое хранилища. Версия схемы живёт в обёртке, не здесь. */
export interface AppData {
  movements: Movement[]
  templates: Template[]
  workouts: Workout[]
  sets: SetEntry[]
  stepChanges: StepChange[]
  settings: Settings
}

export function isMeasured(step: Step): step is MeasuredStep {
  return step.kind === 'measured'
}

export function findStep(movement: Movement, stepId: string): Step | undefined {
  return movement.steps.find((s) => s.id === stepId)
}

export function currentStep(movement: Movement): Step | undefined {
  return findStep(movement, movement.currentStepId)
}
