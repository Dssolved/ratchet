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

export const SCHEMA_VERSION = 3

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
