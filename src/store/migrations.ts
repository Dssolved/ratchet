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

export const SCHEMA_VERSION = 1

/** Ключ N — миграция из версии N-1 в версию N. */
const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // 2: (data) => { ... },
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

  let result = data as Record<string, unknown>
  for (let version = fromVersion + 1; version <= SCHEMA_VERSION; version++) {
    const migration = migrations[version]
    if (migration) result = migration(result)
  }
  return result as unknown as AppData
}
