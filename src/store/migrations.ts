/**
 * Конвейер миграций схемы.
 *
 * Через него проходят оба входа данных: загрузка из IndexedDB и импорт JSON-файла.
 * Файл, экспортированный полгода назад, обязан открыться в текущей версии.
 *
 * Правило: миграция НИКОГДА не удаляет данные журнала. Поля можно добавлять
 * и переименовывать, подходы и тренировки — нет. См. docs/data-model.md#миграции.
 */

import type { AppData } from '../domain/types.ts'

export const SCHEMA_VERSION = 8

/**
 * Переименование v3: абстрактные названия («Вертикальная тяга», «Горизонтальный жим»)
 * заменены на обиходные. Причина — «Горизонтальная тяга» и «Горизонтальный жим»
 * различались одним словом в середине и не читались боковым зрением под турником.
 * Паттерн движения при этом никуда не делся: он записан в поле `category`.
 */
const RENAMED_MOVEMENTS: Record<string, string> = {
  'vertical-pull': 'Подтягивания',
  'horizontal-pull': 'Австралийские',
  'horizontal-push': 'Отжимания',
  dip: 'Брусья',
  core: 'Пресс',
}

/** Ступени стали уточнениями, иначе выходило «Подтягивания → Подтягивания». */
const RENAMED_STEPS: Record<string, string> = {
  'vertical-pull/1': 'Негативы с прыжка',
  'vertical-pull/2': 'Обычные',
  'vertical-pull/3': 'С весом',
  'vertical-pull/6': 'На одной руке',
  'horizontal-pull/1': 'Ноги согнуты',
  'horizontal-push/5': 'С весом (рюкзак)',
  'dip/1': 'Отжимания от лавочки',
  'dip/2': 'С поддержкой ног',
  'dip/3': 'Обычные',
  'dip/4': 'С паузой внизу 2 сек',
  'dip/5': 'С весом',
}

type Loose = Record<string, unknown>

function asArray(value: unknown): Loose[] {
  return Array.isArray(value) ? (value as Loose[]) : []
}

/** Ключ N — миграция из версии N-1 в версию N. */
const migrations: Record<number, (data: Loose) => Loose> = {
  /**
   * v2: у Workout появился movementIds — план конкретной тренировки.
   * Для уже записанных тренировок восстанавливаем его из движений, которые в них
   * реально встречаются, сохраняя порядок появления; если подходов не было —
   * из шаблона, на который тренировка ссылалась.
   */
  2: (data) => {
    const sets = asArray(data.sets)
    const templates = asArray(data.templates)

    // data — свежий результат JSON.parse, копия принадлежит нам, правим на месте
    for (const workout of asArray(data.workouts)) {
      if (Array.isArray(workout.movementIds)) continue

      const seen: string[] = []
      for (const set of sets) {
        if (set.workoutId !== workout.id) continue
        const movementId = set.movementId
        if (typeof movementId === 'string' && !seen.includes(movementId)) {
          seen.push(movementId)
        }
      }

      if (seen.length === 0) {
        const template = templates.find((t) => t.id === workout.templateId)
        const fromTemplate = template?.movementIds
        if (Array.isArray(fromTemplate)) seen.push(...(fromTemplate as string[]))
      }

      workout.movementIds = seen
    }

    return data
  },

  /**
   * v3: обиходные названия, отдых по умолчанию 180 секунд, флаг keepScreenOn.
   *
   * Переименование идёт по стабильным id движений и ступеней, поэтому журнал
   * не переписывается вообще: подходы ссылаются на те же id, что и раньше.
   * Движения, заведённые пользователем, в словарях отсутствуют и не трогаются.
   */
  3: (data) => {
    for (const movement of asArray(data.movements)) {
      const name = typeof movement.id === 'string' ? RENAMED_MOVEMENTS[movement.id] : undefined
      if (name) movement.name = name

      for (const step of asArray(movement.steps)) {
        const stepName = typeof step.id === 'string' ? RENAMED_STEPS[step.id] : undefined
        if (stepName) step.name = stepName
      }
    }

    const settings = data.settings
    if (typeof settings === 'object' && settings !== null) {
      const s = settings as Loose
      // поднимаем только прежнее умолчание: своё значение пользователя не трогаем
      if (s.defaultRestSec === 120) s.defaultRestSec = 180
      if (s.keepScreenOn === undefined) s.keepScreenOn = true
    }

    return data
  },

  /**
   * v4: навыки получили счётчик попыток вместо одного бита «получилось».
   *
   * Старые записи переносим один к одному: «получилось» → 1 из 1, «пробовал» → 0 из 1.
   * Журнал при этом не теряется, просто становится беднее ретроспективно — новых данных
   * из старых взять неоткуда.
   *
   * Заодно добавляем готовую лестницу мышцапа, если у пользователя ещё нет ни одного
   * навыкового упражнения. Добавление аддитивное: журнала не касается, а ненужное
   * упражнение без истории удаляется одной кнопкой.
   */
  4: (data) => {
    for (const set of asArray(data.sets)) {
      if (set.succeeded === undefined) continue
      set.attempts = 1
      set.successes = set.succeeded === true ? 1 : 0
      delete set.succeeded
    }

    for (const movement of asArray(data.movements)) {
      for (const step of asArray(movement.steps)) {
        if (step.kind === 'binary' && step.targetSuccesses === undefined) {
          step.targetSuccesses = 1
        }
      }
    }

    const movements = asArray(data.movements)
    const hasSkill = movements.some((m) => m.category === 'skill')
    if (!hasSkill) {
      const id = 'muscle-up'
      const steps = [
        { name: 'Подтягивания до груди', kind: 'measured' as const },
        { name: 'До низа груди', kind: 'measured' as const },
        { name: 'До пояса', kind: 'measured' as const },
        { name: 'Взрывные с отрывом рук', kind: 'binary' as const },
        { name: 'Мышцап с киппингом', kind: 'binary' as const },
        { name: 'Строгий мышцап', kind: 'binary' as const },
      ].map((spec, index) =>
        spec.kind === 'measured'
          ? {
              id: `${id}/${index + 1}`,
              order: index + 1,
              name: spec.name,
              kind: 'measured',
              unit: 'reps',
              progressBy: 'variant',
              repMin: 4,
              repMax: 8,
              targetSets: 3,
            }
          : {
              id: `${id}/${index + 1}`,
              order: index + 1,
              name: spec.name,
              kind: 'binary',
              targetSuccesses: 3,
              // навыку нужен порог строже: одна удачная попытка не означает владения
              readyAfterSessions: 2,
            },
      )

      movements.push({
        id,
        name: 'Мышцап',
        category: 'skill',
        steps,
        currentStepId: `${id}/1`,
        maxReachedStepOrder: 1,
        archived: false,
        sortOrder: movements.length + 1,
      })
      data.movements = movements
    }

    return data
  },

  /**
   * v5: снимаем ступени и рекорды, выданные авансом старым seed (Д-24).
   *
   * Прежний seed ставил движение сразу на 4–5 ступень и приравнивал к ней
   * maxReachedStepOrder, объявляя пройденным то, чего человек не делал. Новый seed так
   * не делает, но у тех, кто уже пользуется приложением, эти значения лежат в хранилище,
   * и правка seed их не касается — журнал сбрасывать ради этого нельзя.
   *
   * Честная ступень — максимальная из тех, где человек **наследил**:
   * есть хотя бы один записанный подход, либо записан переход по ступеням (в любую
   * сторону — с ступени, с которой откатились, тоже сходили). Если следов нет вообще,
   * движение уходит на первую ступень: значит его просто не делали.
   *
   * Текущая ступень опускается только если она ВЫШЕ честной, то есть была назначена,
   * а не взята. Движение, на котором человек реально тренируется, не двигается никуда:
   * подходы на нём есть, честная ступень равна текущей.
   *
   * Журнала не касается — только два поля движения. Правило миграций соблюдено.
   */
  5: (data) => {
    const sets = asArray(data.sets)

    for (const movement of asArray(data.movements)) {
      const steps = asArray(movement.steps)
      const orderOf = new Map<string, number>()
      for (const step of steps) {
        if (typeof step.id === 'string' && typeof step.order === 'number') {
          orderOf.set(step.id, step.order)
        }
      }

      let reached = 1
      const mark = (order: unknown) => {
        if (typeof order === 'number' && order > reached) reached = order
      }

      for (const set of sets) {
        if (set.movementId !== movement.id) continue
        if (typeof set.stepId === 'string') mark(orderOf.get(set.stepId))
      }

      for (const change of asArray(data.stepChanges)) {
        if (change.movementId !== movement.id) continue
        mark(change.fromStepOrder)
        mark(change.toStepOrder)
      }

      if (typeof movement.maxReachedStepOrder === 'number') {
        movement.maxReachedStepOrder = Math.min(movement.maxReachedStepOrder, reached)
      } else {
        movement.maxReachedStepOrder = reached
      }

      const currentOrder = typeof movement.currentStepId === 'string'
        ? orderOf.get(movement.currentStepId)
        : undefined
      if (currentOrder !== undefined && currentOrder > reached) {
        const honest = steps.find((s) => s.order === reached)
        if (honest && typeof honest.id === 'string') movement.currentStepId = honest.id
      }
    }

    return data
  },

  /**
   * v6: «День A» и «День B» → «Первый день» и «Второй день» (Д-28).
   *
   * Старые различались одной буквой **в конце** — та же ошибка, которую v3 чинила
   * у упражнений: боковым зрением такое не читается, а именно так на них смотрят
   * под турником. Новые различаются с первого символа.
   *
   * Имя при этом ничего не описывает намеренно: оба дня full-body, и назвать день
   * по упражнению значило бы соврать, что он про это упражнение. Состав показывается
   * под кнопкой «Начать».
   *
   * Переименование по стабильным id и **только если имя не менялось руками**: иначе
   * миграция затрёт выбор пользователя. Свой день с этими id завестись не мог —
   * новые создаются со случайными.
   */
  6: (data) => {
    for (const template of asArray(data.templates)) {
      if (template.id === 'day-a' && template.name === 'День A') {
        template.name = 'Первый день'
      }
      if (template.id === 'day-b' && template.name === 'День B') {
        template.name = 'Второй день'
      }
    }
    return data
  },

  /**
   * v7: появились замеры тела (Д-30). Пустой массив, если его ещё нет.
   *
   * Чисто аддитивно: журнала не касается, старый бэкап открывается как есть.
   */
  7: (data) => {
    if (!Array.isArray(data.measurements)) data.measurements = []
    return data
  },

  /**
   * v8: настройки напоминаний о тренировке (Д-29). Только недостающие поля —
   * уже выставленное пользователем не трогаем.
   */
  8: (data) => {
    const settings = data.settings
    if (typeof settings === 'object' && settings !== null) {
      const s = settings as Loose
      if (s.remindersOn === undefined) s.remindersOn = true
      if (s.restDaysBetweenWorkouts === undefined) s.restDaysBetweenWorkouts = 2
      if (s.reminderHour === undefined) s.reminderHour = 18
    }
    return data
  },
}

export function migrateData(data: unknown, fromVersion: number): AppData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Данные повреждены: ожидался объект')
  }
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `Данные из более новой версии приложения (${fromVersion} > ${SCHEMA_VERSION}). ` +
        'Обновите приложение, иначе импорт потеряет поля.',
    )
  }

  let result = data as Loose
  for (let version = fromVersion + 1; version <= SCHEMA_VERSION; version++) {
    const migration = migrations[version]
    if (migration) result = migration(result)
  }
  return result as unknown as AppData
}
