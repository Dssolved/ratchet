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

export const SCHEMA_VERSION = 2

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
