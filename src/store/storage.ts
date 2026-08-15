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

/** Снимки от новых к старым. */
export async function listSnapshots(): Promise<string[]> {
  return (await snapshotKeys()).toReversed()
}
