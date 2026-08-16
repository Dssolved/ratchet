/**
 * Экспорт и импорт JSON — единственный бэкап приложения.
 *
 * Бэкенда нет, данные живут только на устройстве, поэтому это единственный способ
 * их не потерять. См. docs/decisions.md#д-1.
 */

import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

import type { AppData } from '../domain/types.ts'
import { localDateString } from '../domain/dates.ts'
import { migrateData, SCHEMA_VERSION } from '../store/migrations.ts'
import { readSnapshot, saveSnapshot } from '../store/storage.ts'

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
 * Сохранение бэкапа.
 *
 * На телефоне и в браузере это принципиально разные механизмы, и подменить одно
 * другим нельзя: **внутри Capacitor WebView ссылка с `download` молча не работает** —
 * для неё нужен нативный DownloadListener, которого там нет. Нажатие просто ничего
 * не делает, без ошибки. Для единственного бэкапа приложения это недопустимо.
 *
 * Поэтому на устройстве файл пишется через Filesystem и отдаётся в системный «Поделиться»:
 * так его можно сразу отправить в облако или мессенджер, а не искать в папке загрузок.
 */
export async function downloadBackup(data: AppData): Promise<void> {
  const json = JSON.stringify(buildBackup(data), null, 2)
  const name = backupFileName()

  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({
      title: 'Бэкап Ratchet',
      files: [written.uri],
    })
    return
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
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

  // measurements появились в v7; до проверки данные уже прошли конвейер миграций,
  // поэтому поле обязано существовать даже у старого файла
  for (const field of ['movements', 'templates', 'workouts', 'sets', 'stepChanges', 'measurements']) {
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

/**
 * Разбор снимка. Внутри лежит ровно то, что персист пишет в основной ключ:
 * `{ state, version }` — не файл бэкапа, у него другая обёртка (Д-15).
 */
export function parseSnapshot(raw: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Снимок повреждён: не разбирается как JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Снимок повреждён')
  }

  const box = parsed as Record<string, unknown>
  const version = typeof box.version === 'number' ? box.version : SCHEMA_VERSION
  const migrated = migrateData(box.state, version)
  assertAppData(migrated)
  return migrated
}

/** Содержимое снимка без применения — для списка: что именно в нём лежит. */
export async function loadSnapshot(key: string): Promise<AppData> {
  return parseSnapshot(await readSnapshot(key))
}

/**
 * Восстановление из снимка.
 *
 * Перед заменой делается снимок текущего состояния: восстановиться не в тот снимок —
 * такая же потеря данных, как всё остальное, от чего этот механизм защищает.
 */
export async function restoreSnapshot(key: string): Promise<AppData> {
  const data = await loadSnapshot(key)
  await saveSnapshot('restore')
  return data
}
