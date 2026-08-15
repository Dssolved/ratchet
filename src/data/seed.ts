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
    buildMovement('vertical-pull', 'Вертикальная тяга', 'pull', 1, 2, [
      { name: 'Негативы с прыжка (5 сек опускание)', min: 5, max: 8 },
      { name: 'Подтягивания', min: 6, max: 10 },
      { name: 'Подтягивания с весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
      { name: 'Лучник', min: 5, max: 8, perSide: true },
      { name: 'На одной руке с поддержкой', min: 4, max: 6, perSide: true },
      { name: 'Подтягивание на одной руке', binary: true, perSide: true },
    ]),

    buildMovement('horizontal-pull', 'Горизонтальная тяга', 'pull', 2, 3, [
      { name: 'Ноги согнуты, перекладина высоко', min: 8, max: 12 },
      { name: 'Ноги прямые', min: 8, max: 12 },
      { name: 'Стопы на возвышении', min: 8, max: 12 },
      { name: 'Стопы на возвышении + вес', min: 8, max: 12, progressBy: 'weight', weightKg: 2.5 },
      { name: 'На одной руке с поддержкой', min: 6, max: 10, perSide: true },
      { name: 'На одной руке', binary: true, perSide: true },
    ]),

    buildMovement(
      'horizontal-push',
      'Горизонтальный жим',
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

    buildMovement('dip', 'Жим вниз (брусья)', 'push', 4, 5, [
      { name: 'Трицепсовые от лавочки', min: 8, max: 12 },
      { name: 'Брусья с поддержкой ног', min: 6, max: 10 },
      { name: 'Отжимания от брусьев', min: 6, max: 10 },
      { name: 'Брусья с паузой внизу 2 сек', min: 6, max: 10 },
      { name: 'Брусья с весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
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

    buildMovement('core', 'Кор', 'core', 6, 1, [
      { name: 'Планка', min: 30, max: 60, unit: 'seconds', restSec: 60 },
      { name: 'Подъём коленей в висе', min: 8, max: 12 },
      { name: 'Подъём прямых ног в висе', min: 8, max: 12 },
      { name: 'Ноги к перекладине', binary: true },
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
      defaultRestSec: 120,
      defaultWeightStepKg: 2.5,
      readyAfterSessions: 1,
    },
  }
}
