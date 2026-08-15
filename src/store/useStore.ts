import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { AppData } from '../domain/types.ts'
import { createSeedData } from '../data/seed.ts'
import { migrateData, SCHEMA_VERSION } from './migrations.ts'
import { idbStorage, saveSnapshot, STORAGE_KEY } from './storage.ts'

interface Actions {
  /** Полная замена данных — используется импортом JSON. */
  replaceAll: (data: AppData) => void
  /** Сброс к стартовому справочнику. Журнал тренировок при этом теряется. */
  resetToSeed: () => Promise<void>
}

export type Store = AppData & Actions

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...createSeedData(),

      replaceAll: (data) => {
        set({
          movements: data.movements,
          templates: data.templates,
          workouts: data.workouts,
          sets: data.sets,
          stepChanges: data.stepChanges,
          settings: data.settings,
        })
      },

      resetToSeed: async () => {
        await saveSnapshot('reset')
        set({ ...createSeedData() })
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      // в хранилище идут только данные, не функции
      partialize: (state): AppData => ({
        movements: state.movements,
        templates: state.templates,
        workouts: state.workouts,
        sets: state.sets,
        stepChanges: state.stepChanges,
        settings: state.settings,
      }),
      migrate: (persisted, version) => migrateData(persisted, version),
    },
  ),
)

/**
 * persist пишет в хранилище только при изменении состояния, поэтому после чистой
 * установки там пусто до первого действия пользователя. Пустое хранилище означает,
 * что стартовый справочник ничем не зафиксирован: обновление приложения с изменённым
 * seed молча переставило бы человеку текущие ступени. Поэтому сразу после гидратации
 * записываем состояние как есть.
 */
useStore.persist.onFinishHydration(() => {
  useStore.setState({})
})

/** Снимок данных без экшенов — для экспорта. */
export function selectData(state: Store): AppData {
  return {
    movements: state.movements,
    templates: state.templates,
    workouts: state.workouts,
    sets: state.sets,
    stepChanges: state.stepChanges,
    settings: state.settings,
  }
}
