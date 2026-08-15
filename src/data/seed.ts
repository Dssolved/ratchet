/**
 * Стартовые данные. Источник — docs/progressions.md.
 *
 * Стартовые ступени выставлены ВЫШЕ привычных вариантов пользователя, а диапазоны
 * опущены в силовые: 3×15 — это выносливость, а не сила. Ожидаемое падение цифр
 * (с 15 до 8) заложено сознательно.
 *
 * Всё, что ниже стартовой ступени, считается пройденным: maxReachedStepOrder равен
 * номеру стартовой ступени, чтобы сразу была видна история, а не пустой старт.
 *
 * Пользователь правит всё это из вкладки «Настройки» — числа здесь гипотеза,
 * которая проверяется первыми тренировками.
 */

import type { AppData, Category, Movement, ProgressBy, Step, Unit } from '../domain/types.ts'

interface SpecBase {
  name: string
  perSide?: boolean
  restSec?: number
}

interface MeasuredSpec extends SpecBase {
  min: number
  max: number
  sets?: number
  unit?: Unit
  progressBy?: ProgressBy
  weightKg?: number
}

interface BinarySpec extends SpecBase {
  binary: true
  /** сколько удачных попыток за тренировку считать ступенью взятой */
  successes?: number
  readyAfterSessions?: number
}

type StepSpec = MeasuredSpec | BinarySpec

function buildSteps(movementId: string, specs: StepSpec[]): Step[] {
  return specs.map((spec, index) => {
    const order = index + 1
    const id = `${movementId}/${order}`
    if ('binary' in spec) {
      return {
        id,
        order,
        name: spec.name,
        kind: 'binary',
        targetSuccesses: spec.successes ?? 1,
        readyAfterSessions: spec.readyAfterSessions,
        perSide: spec.perSide,
        restSec: spec.restSec,
      }
    }
    return {
      id,
      order,
      name: spec.name,
      kind: 'measured',
      unit: spec.unit ?? 'reps',
      progressBy: spec.progressBy ?? 'variant',
      repMin: spec.min,
      repMax: spec.max,
      targetSets: spec.sets ?? 3,
      weightKg: spec.weightKg,
      perSide: spec.perSide,
      restSec: spec.restSec,
    }
  })
}

function buildMovement(
  id: string,
  name: string,
  category: Category,
  sortOrder: number,
  startOrder: number,
  specs: StepSpec[],
  equipment?: string,
): Movement {
  const steps = buildSteps(id, specs)
  const start = steps[startOrder - 1]
  if (!start) throw new Error(`Нет ступени ${startOrder} у движения ${id}`)
  return {
    id,
    name,
    category,
    equipment,
    steps,
    currentStepId: start.id,
    maxReachedStepOrder: startOrder,
    archived: false,
    sortOrder,
  }
}

export function createSeedData(): AppData {
  const movements: Movement[] = [
    buildMovement('vertical-pull', 'Подтягивания', 'pull', 1, 2, [
      { name: 'Негативы с прыжка', min: 5, max: 8 },
      { name: 'Обычные', min: 6, max: 10 },
      { name: 'С весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
      { name: 'Лучник', min: 5, max: 8, perSide: true },
      { name: 'На одной руке с поддержкой', min: 4, max: 6, perSide: true },
      { name: 'На одной руке', binary: true, perSide: true },
    ]),

    buildMovement('horizontal-pull', 'Австралийские', 'pull', 2, 3, [
      { name: 'Ноги согнуты', min: 8, max: 12 },
      { name: 'Ноги прямые', min: 8, max: 12 },
      { name: 'Стопы на возвышении', min: 8, max: 12 },
      { name: 'Стопы на возвышении + вес', min: 8, max: 12, progressBy: 'weight', weightKg: 2.5 },
      { name: 'На одной руке с поддержкой', min: 6, max: 10, perSide: true },
      { name: 'На одной руке', binary: true, perSide: true },
    ]),

    buildMovement(
      'horizontal-push',
      'Отжимания',
      'push',
      3,
      4,
      [
        { name: 'С колен', min: 8, max: 12 },
        { name: 'Обычные', min: 8, max: 12 },
        { name: 'Ноги на возвышении ~30 см', min: 8, max: 12 },
        { name: 'Ноги на возвышении ~60 см', min: 8, max: 12 },
        { name: 'С весом (рюкзак)', min: 8, max: 12, progressBy: 'weight', weightKg: 2.5 },
        { name: 'Лучник', min: 6, max: 10, perSide: true },
        { name: 'Псевдо-планш', min: 6, max: 10 },
        { name: 'На одной руке', binary: true, perSide: true },
      ],
      'на упорах',
    ),

    buildMovement('dip', 'Брусья', 'push', 4, 5, [
      { name: 'Отжимания от лавочки', min: 8, max: 12 },
      { name: 'С поддержкой ног', min: 6, max: 10 },
      { name: 'Обычные', min: 6, max: 10 },
      { name: 'С паузой внизу 2 сек', min: 6, max: 10 },
      { name: 'С весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
    ]),

    buildMovement('legs', 'Ноги', 'legs', 5, 2, [
      { name: 'Приседания', min: 12, max: 15 },
      { name: 'Болгарский сплит-присед', min: 8, max: 12, perSide: true },
      {
        name: 'Болгарский с рюкзаком',
        min: 8,
        max: 12,
        progressBy: 'weight',
        weightKg: 2.5,
        perSide: true,
      },
      { name: 'Пистолетик с поддержкой', min: 6, max: 10, perSide: true },
      { name: 'Пистолетик', binary: true, perSide: true },
    ]),

    buildMovement('core', 'Пресс', 'core', 6, 1, [
      { name: 'Планка', min: 30, max: 60, unit: 'seconds', restSec: 60 },
      { name: 'Подъём коленей в висе', min: 8, max: 12 },
      { name: 'Подъём прямых ног в висе', min: 8, max: 12 },
      { name: 'Ноги к перекладине', binary: true },
    ]),

    // Навык. Первые три ступени — обычные подтягивания всё выше, дальше попытки.
    // Порог строже силовой работы: один случайный выход не означает владения.
    buildMovement('muscle-up', 'Мышцап', 'skill', 7, 1, [
      { name: 'Подтягивания до груди', min: 4, max: 8 },
      { name: 'До низа груди', min: 4, max: 8 },
      { name: 'До пояса', min: 4, max: 8 },
      { name: 'Взрывные с отрывом рук', binary: true, successes: 3, readyAfterSessions: 2 },
      { name: 'Мышцап с киппингом', binary: true, successes: 3, readyAfterSessions: 2 },
      { name: 'Строгий мышцап', binary: true, successes: 3, readyAfterSessions: 2 },
    ]),
  ]

  return {
    movements,
    templates: [
      {
        id: 'day-a',
        name: 'День A',
        // ноги вторыми, а не последними — иначе они снова не внедрятся
        movementIds: ['vertical-pull', 'legs', 'horizontal-push', 'core'],
      },
      {
        id: 'day-b',
        name: 'День B',
        movementIds: ['horizontal-pull', 'legs', 'dip', 'core'],
      },
      { id: 'free', name: 'Свободная', movementIds: [] },
    ],
    workouts: [],
    sets: [],
    stepChanges: [],
    settings: {
      weeklyTarget: 3,
      defaultRestSec: 180,
      defaultWeightStepKg: 2.5,
      readyAfterSessions: 1,
      keepScreenOn: true,
    },
  }
}
