/**
 * Экспорт и импорт JSON — единственный бэкап приложения.
 *
 * Бэкенда нет, данные живут только на устройстве, поэтому это единственный способ
 * их не потерять. См. docs/decisions.md#д-1.
 */

import type { AppData } from '../domain/types.ts'
import { localDateString } from '../domain/dates.ts'
import { migrateData, SCHEMA_VERSION } from '../store/migrations.ts'
import { saveSnapshot } from '../store/storage.ts'

const FORMAT = 'ratchet-backup'

interface BackupFile {
  format: typeof FORMAT
  schemaVersion: number
  exportedAt: string
  data: AppData
}

export function buildBackup(data: AppData): BackupFile {
  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function backupFileName(): string {
  return `${localDateString()}.ratchet.json`
}

/**
 * Скачивание файла в браузере.
 *
 * ВНИМАНИЕ: внутри Capacitor WebView ссылка с download работает ненадёжно. Если
 * экспорт на телефоне начнёт молча не срабатывать — добавить ветку через
 * @capacitor/filesystem. Пока не понадобилось.
 */
export function downloadBackup(data: AppData): void {
  const json = JSON.stringify(buildBackup(data), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName()
  link.click()

  URL.revokeObjectURL(url)
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** Проверка, что в файле действительно наши данные, а не произвольный JSON. */
function assertAppData(value: unknown): asserts value is AppData {
  if (typeof value !== 'object' || value === null) {
    throw new Error('В файле нет объекта с данными')
  }
  const data = value as Record<string, unknown>

  for (const field of ['movements', 'templates', 'workouts', 'sets', 'stepChanges']) {
    if (!isArray(data[field])) {
      throw new Error(`В файле повреждено поле «${field}»: ожидался массив`)
    }
  }
  if (typeof data.settings !== 'object' || data.settings === null) {
    throw new Error('В файле повреждены настройки')
  }
  if (!isArray(data.movements) || data.movements.length === 0) {
    throw new Error('В файле нет ни одного упражнения — похоже, это не бэкап Ratchet')
  }
}

/**
 * Разбор файла бэкапа. Проходит через тот же конвейер миграций, что и загрузка
 * из хранилища, поэтому старый файл откроется в новой версии приложения.
 */
export function parseBackup(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Файл не является корректным JSON')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Файл не похож на бэкап Ratchet')
  }
  const file = parsed as Record<string, unknown>

  if (file.format !== FORMAT) {
    throw new Error('Файл не похож на бэкап Ratchet: нет отметки формата')
  }
  const version = file.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('В файле некорректная версия схемы')
  }

  const migrated = migrateData(file.data, version)
  assertAppData(migrated)
  return migrated
}

/** Чтение файла из <input type="file"> со снимком текущих данных перед заменой. */
export async function importBackupFile(file: File): Promise<AppData> {
  const text = await file.text()
  const data = parseBackup(text)
  // снимок делаем только после успешного разбора: незачем плодить копии на битых файлах
  await saveSnapshot('import')
  return data
}
