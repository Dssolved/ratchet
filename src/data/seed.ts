/**
 * Стартовые данные. Источник — docs/progressions.md.
 *
 * Каждое движение начинается с ПЕРВОЙ ступени, maxReachedStepOrder = 1 (см. Д-24).
 * Ни ступень, ни рекорд не выдаются авансом: приложение существует ради того, чтобы
 * честно показывать достигнутое, а назначенная ступень — это не достигнутое.
 * До реального уровня храповик поднимает за 2–3 тренировки, и каждая ступень
 * при этом будет заработана.
 *
 * Ожидаемые ступени из docs/progressions.md остались там гипотезой о том, где человек
 * окажется, — но выставляет их тренировка, а не seed.
 *
 * Диапазоны опущены в силовые: 3×15 — это выносливость, а не сила. Ожидаемое падение
 * цифр (с 15 до 8) заложено сознательно.
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
  specs: StepSpec[],
  equipment?: string,
): Movement {
  const steps = buildSteps(id, specs)
  const first = steps[0]
  if (!first) throw new Error(`У движения ${id} нет ни одной ступени`)
  return {
    id,
    name,
    category,
    equipment,
    steps,
    currentStepId: first.id,
    maxReachedStepOrder: 1,
    archived: false,
    sortOrder,
  }
}

export function createSeedData(): AppData {
  const movements: Movement[] = [
    buildMovement('vertical-pull', 'Подтягивания', 'pull', 1, [
      { name: 'Негативы с прыжка', min: 5, max: 8 },
      { name: 'Обычные', min: 6, max: 10 },
      { name: 'С весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
      { name: 'Лучник', min: 5, max: 8, perSide: true },
      { name: 'На одной руке с поддержкой', min: 4, max: 6, perSide: true },
      { name: 'На одной руке', binary: true, perSide: true },
    ]),

    buildMovement('horizontal-pull', 'Австралийские', 'pull', 2, [
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

    buildMovement('dip', 'Брусья', 'push', 4, [
      { name: 'Отжимания от лавочки', min: 8, max: 12 },
      { name: 'С поддержкой ног', min: 6, max: 10 },
      { name: 'Обычные', min: 6, max: 10 },
      { name: 'С паузой внизу 2 сек', min: 6, max: 10 },
      { name: 'С весом', min: 6, max: 10, progressBy: 'weight', weightKg: 2.5 },
    ]),

    buildMovement('legs', 'Ноги', 'legs', 5, [
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

    buildMovement('core', 'Пресс', 'core', 6, [
      { name: 'Планка', min: 30, max: 60, unit: 'seconds', restSec: 60 },
      { name: 'Подъём коленей в висе', min: 8, max: 12 },
      { name: 'Подъём прямых ног в висе', min: 8, max: 12 },
      { name: 'Ноги к перекладине', binary: true },
    ]),

    // Навык. Первые три ступени — обычные подтягивания всё выше, дальше попытки.
    // Порог строже силовой работы: один случайный выход не означает владения.
    buildMovement('muscle-up', 'Мышцап', 'skill', 7, [
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
      // имя дня сознательно ничего не описывает: оба дня full-body, и одним словом
      // их не различить без вранья. Состав показан под кнопкой «Начать» (Д-28)
      {
        id: 'day-a',
        name: 'Первый день',
        // ноги вторыми, а не последними — иначе они снова не внедрятся
        movementIds: ['vertical-pull', 'legs', 'horizontal-push', 'core'],
      },
      {
        id: 'day-b',
        name: 'Второй день',
        movementIds: ['horizontal-pull', 'legs', 'dip', 'core'],
      },
      { id: 'free', name: 'Свободная', movementIds: [] },
    ],
    workouts: [],
    sets: [],
    stepChanges: [],
    measurements: [],
    settings: {
      weeklyTarget: 3,
      defaultRestSec: 180,
      defaultWeightStepKg: 2.5,
      readyAfterSessions: 1,
      keepScreenOn: true,
      remindersOn: true,
      // три тренировки в неделю — это примерно день через два
      restDaysBetweenWorkouts: 2,
      // тренировки в основном вечером
      reminderHour: 18,
    },
  }
}
