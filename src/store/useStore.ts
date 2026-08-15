import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import type { AppData, SetEntry, Side } from '../domain/types.ts'
import { localDateString } from '../domain/dates.ts'
import { createSeedData } from '../data/seed.ts'
import { migrateData, SCHEMA_VERSION } from './migrations.ts'
import { idbStorage, saveSnapshot, STORAGE_KEY } from './storage.ts'

export interface LogSetInput {
  workoutId: string
  movementId: string
  stepId: string
  order: number
  side: Side
  reps?: number
  durationSec?: number
  weightKg?: number
  succeeded?: boolean
  isWarmup?: boolean
}

interface Actions {
  /** Начинает тренировку и возвращает её id. План копируется из шаблона. */
  startWorkout: (templateId: string | null) => string
  addMovementToWorkout: (workoutId: string, movementId: string) => void
  removeMovementFromWorkout: (workoutId: string, movementId: string) => void

  logSet: (input: LogSetInput) => void
  updateSet: (setId: string, patch: Partial<Omit<SetEntry, 'id' | 'workoutId'>>) => void
  deleteSet: (setId: string) => void

  finishWorkout: (workoutId: string) => void
  /** Удаляет тренировку вместе с её подходами. */
  deleteWorkout: (workoutId: string) => void

  /** Полная замена данных — используется импортом JSON. */
  replaceAll: (data: AppData) => void
  /** Сброс к стартовому справочнику. Журнал тренировок при этом теряется. */
  resetToSeed: () => Promise<void>
}

export type Store = AppData & Actions

function newId(): string {
  return crypto.randomUUID()
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createSeedData(),

      startWorkout: (templateId) => {
        const template = templateId
          ? get().templates.find((t) => t.id === templateId)
          : undefined
        const id = newId()

        set((state) => ({
          workouts: [
            ...state.workouts,
            {
              id,
              date: localDateString(),
              startedAt: Date.now(),
              templateId: template?.id,
              movementIds: template ? [...template.movementIds] : [],
            },
          ],
        }))
        return id
      },

      addMovementToWorkout: (workoutId, movementId) => {
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === workoutId && !w.movementIds.includes(movementId)
              ? { ...w, movementIds: [...w.movementIds, movementId] }
              : w,
          ),
        }))
      },

      removeMovementFromWorkout: (workoutId, movementId) => {
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === workoutId
              ? { ...w, movementIds: w.movementIds.filter((id) => id !== movementId) }
              : w,
          ),
          // подходы, если они уже записаны, не трогаем: журнал не переписывается
        }))
      },

      logSet: (input) => {
        set((state) => ({
          sets: [
            ...state.sets,
            {
              id: newId(),
              workoutId: input.workoutId,
              movementId: input.movementId,
              stepId: input.stepId,
              order: input.order,
              side: input.side,
              reps: input.reps,
              durationSec: input.durationSec,
              weightKg: input.weightKg,
              succeeded: input.succeeded,
              isWarmup: input.isWarmup ?? false,
            },
          ],
        }))
      },

      updateSet: (setId, patch) => {
        set((state) => ({
          sets: state.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        }))
      },

      deleteSet: (setId) => {
        set((state) => ({ sets: state.sets.filter((s) => s.id !== setId) }))
      },

      finishWorkout: (workoutId) => {
        set((state) => ({
          workouts: state.workouts.map((w) =>
            w.id === workoutId ? { ...w, finishedAt: Date.now() } : w,
          ),
        }))
      },

      deleteWorkout: (workoutId) => {
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== workoutId),
          sets: state.sets.filter((s) => s.workoutId !== workoutId),
        }))
      },

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

/**
 * Данные без экшенов — для селекторов.
 *
 * Обязательно через useShallow: selectData создаёт новый объект на каждый вызов,
 * а zustand сравнивает результат селектора через Object.is. Без поверхностного
 * сравнения это бесконечный цикл рендеров.
 */
export function useData(): AppData {
  return useStore(useShallow(selectData))
}
