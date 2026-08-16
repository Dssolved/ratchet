/**
 * Хранилище: единый JSON-документ в IndexedDB через idb-keyval.
 *
 * Не SQLite: год тренировок ≈ 200 КБ и ~2500 подходов, фильтрация в JS мгновенна,
 * экспорт тривиален. См. docs/decisions.md#д-4.
 */

import { del, get, keys, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

export const STORAGE_KEY = 'ratchet-state'
const SNAPSHOT_PREFIX = 'ratchet-snapshot-'
const MAX_SNAPSHOTS = 5

export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => {
    await set(name, value)
  },
  removeItem: async (name) => {
    await del(name)
  },
}

/**
 * Снимок текущего состояния перед рискованной операцией (импорт, сброс).
 * Неудачный импорт не должен стирать то, что уже накоплено.
 */
export async function saveSnapshot(reason: string): Promise<void> {
  const current = await get<string>(STORAGE_KEY)
  if (!current) return

  const key = `${SNAPSHOT_PREFIX}${Date.now()}-${reason}`
  await set(key, current)
  await pruneSnapshots()
}

async function snapshotKeys(): Promise<string[]> {
  const all = await keys()
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(SNAPSHOT_PREFIX))
    .toSorted()
}

async function pruneSnapshots(): Promise<void> {
  const snapshots = await snapshotKeys()
  const excess = snapshots.slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS))
  await Promise.all(excess.map((key) => del(key)))
}

export interface SnapshotInfo {
  key: string
  /** момент создания, из ключа */
  at: number
  /** причина: 'reset' | 'import' | 'restore' */
  reason: string
}

/**
 * Снимки от новых к старым.
 *
 * Ключ разбирается обратно: `ratchet-snapshot-<timestamp>-<reason>`. Причина может
 * содержать дефисы, поэтому режем только по первому после времени.
 */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const parsed: SnapshotInfo[] = []
  for (const key of await snapshotKeys()) {
    const tail = key.slice(SNAPSHOT_PREFIX.length)
    const dash = tail.indexOf('-')
    if (dash < 0) continue
    const at = Number(tail.slice(0, dash))
    if (!Number.isFinite(at)) continue
    parsed.push({ key, at, reason: tail.slice(dash + 1) })
  }
  return parsed.toReversed()
}

/** Содержимое снимка — та же строка, что персист пишет в основной ключ. */
export async function readSnapshot(key: string): Promise<string> {
  const raw = await get<string>(key)
  if (raw === undefined) throw new Error('Снимок не найден — возможно, его вытеснили новые')
  return raw
}
