/**
 * Модель данных. Подробности и обоснование — docs/data-model.md.
 *
 * Принцип: хранятся только факты (SetEntry, Workout) и решения (StepChange).
 * Рекорды, стрики, готовность к усложнению и суммарные повторения — производные,
 * считаются функциями от этих данных и никогда не попадают в состояние.
 */

export type Category = 'pull' | 'push' | 'legs' | 'core' | 'skill'
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
  /**
   * Переопределяет Settings.readyAfterSessions.
   * Навыкам нужен порог строже силовой работы: один случайный мышцап не значит,
   * что ты им владеешь.
   */
  readyAfterSessions?: number
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

/**
 * Навыковая ступень: измеряется попытками, а не повторениями.
 *
 * Реальный прогресс в навыке выглядит как «из шести попыток вышло ноль, потом одна,
 * потом три» — это и есть кривая освоения. Один бит «получилось / нет» её выбрасывает.
 */
export interface BinaryStep extends StepBase {
  kind: 'binary'
  /** сколько удачных попыток за тренировку считать ступенью взятой */
  targetSuccesses: number
}

export type Step = MeasuredStep | BinaryStep

export interface Movement {
  id: string
  /**
   * Название упражнения-семейства: "Подтягивания", а не конкретный вариант.
   * В интерфейсе это называется «упражнение», в коде и данных — Movement:
   * переименовывать поля журнала ради косметики не стали (docs/decisions.md#д-17).
   */
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
  /**
   * План именно этой тренировки: копируется из шаблона при старте и дальше живёт
   * своей жизнью. Без него не работают свободные тренировки и добавление движения
   * на ходу, а «что я собирался сделать» — такой же факт, как «что сделал».
   */
  movementIds: string[]
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
  /** только для BinaryStep: сколько раз пробовал */
  attempts?: number
  /** только для BinaryStep: сколько раз получилось */
  successes?: number
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
  /** не гасить экран во время тренировки */
  keepScreenOn: boolean

  /** напоминать о тренировке, если отдых затянулся */
  remindersOn: boolean
  /** через сколько дней отдыха напоминать */
  restDaysBetweenWorkouts: number
  /** час суток для напоминания, 0–23 */
  reminderHour: number
}

/**
 * Замер тела. Пока единственный вид — вес; обхваты добавятся сменой `kind`,
 * без второй миграции (Д-30).
 *
 * Это первая сущность, не выводимая из журнала подходов, и Д-3 она не нарушает:
 * вес — такой же записанный факт, как подход. Производными из него остаются график
 * и сравнение, и они по-прежнему не хранятся.
 */
export type MeasurementKind = 'weight'

export interface Measurement {
  id: string
  /** 'YYYY-MM-DD' в ЛОКАЛЬНОМ времени, как и у тренировок */
  date: string
  kind: MeasurementKind
  /** для 'weight' — килограммы */
  value: number
}

/** Всё содержимое хранилища. Версия схемы живёт в обёртке, не здесь. */
export interface AppData {
  movements: Movement[]
  templates: Template[]
  workouts: Workout[]
  sets: SetEntry[]
  stepChanges: StepChange[]
  measurements: Measurement[]
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
