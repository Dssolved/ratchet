import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import type {
  AppData,
  MeasurementKind,
  Movement,
  SetEntry,
  Settings,
  Side,
  Step,
  Template,
} from '../domain/types.ts'
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
  attempts?: number
  successes?: number
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

  /** Щелчок храповика: следующая ступень либо прибавка веса на текущей. */
  advanceStep: (movementId: string) => void
  /** Откат вниз. Записывается в лог, но maxReachedStepOrder не убывает. */
  rollbackStep: (movementId: string) => void

  // --- справочник ---
  addMovement: () => string
  updateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'steps'>>) => void
  /** Удаляет упражнение. Вызывать только если по нему нет подходов. */
  deleteMovement: (id: string) => void

  addStep: (movementId: string, kind: Step['kind']) => void
  updateStep: (movementId: string, stepId: string, patch: Partial<Step>) => void
  deleteStep: (movementId: string, stepId: string) => void
  /** Переставляет ступень на позицию выше или ниже. */
  moveStep: (movementId: string, stepId: string, delta: -1 | 1) => void

  addTemplate: () => string
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void
  deleteTemplate: (id: string) => void

  /**
   * Записывает замер за дату. За один день значение одно: взвешиваются раз в день,
   * а две записи за то же число превратили бы график в частокол.
   */
  setMeasurement: (kind: MeasurementKind, date: string, value: number) => void
  deleteMeasurement: (id: string) => void

  updateSettings: (patch: Partial<Settings>) => void

  /** Полная замена данных — используется импортом JSON. */
  replaceAll: (data: AppData) => void
  /** Сброс к стартовому справочнику. Журнал тренировок при этом теряется. */
  resetToSeed: () => Promise<void>
}

export type Store = AppData & Actions

function newId(): string {
  return crypto.randomUUID()
}

/**
 * После перестановки или удаления ступеней рекорд должен остаться привязанным
 * к той же ступени, а не к номеру позиции. Если ступень-рекорд удалили —
 * прижимаем к границе лестницы.
 */
function resolveRecordOrder(
  steps: Step[],
  recordStepId: string | undefined,
  fallback: number,
): number {
  const found = steps.find((s) => s.id === recordStepId)
  if (found) return found.order
  return Math.min(fallback, steps.length)
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
              attempts: input.attempts,
              successes: input.successes,
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

      advanceStep: (movementId) => {
        set((state) => {
          const movement = state.movements.find((m) => m.id === movementId)
          const step = movement?.steps.find((s) => s.id === movement.currentStepId)
          if (!movement || !step) return {}

          const date = localDateString()

          // весовая ступень: остаёмся на месте, добавляем вес.
          // Отдельная ступень на каждые +2.5 кг превратила бы лестницу в мусор (Д-8).
          if (step.kind === 'measured' && step.progressBy === 'weight') {
            const increment = step.weightStepKg ?? state.settings.defaultWeightStepKg
            const from = step.weightKg ?? 0
            const to = from + increment

            return {
              movements: state.movements.map((m) =>
                m.id === movementId
                  ? {
                      ...m,
                      steps: m.steps.map((s) => (s.id === step.id ? { ...s, weightKg: to } : s)),
                    }
                  : m,
              ),
              stepChanges: [
                ...state.stepChanges,
                {
                  id: newId(),
                  movementId,
                  date,
                  direction: 'up' as const,
                  fromStepOrder: step.order,
                  toStepOrder: step.order,
                  fromWeightKg: from,
                  toWeightKg: to,
                },
              ],
            }
          }

          const next = movement.steps.find((s) => s.order === step.order + 1)
          if (!next) return {} // вершина лестницы

          return {
            movements: state.movements.map((m) =>
              m.id === movementId
                ? {
                    ...m,
                    currentStepId: next.id,
                    maxReachedStepOrder: Math.max(m.maxReachedStepOrder, next.order),
                  }
                : m,
            ),
            stepChanges: [
              ...state.stepChanges,
              {
                id: newId(),
                movementId,
                date,
                direction: 'up' as const,
                fromStepOrder: step.order,
                toStepOrder: next.order,
              },
            ],
          }
        })
      },

      rollbackStep: (movementId) => {
        set((state) => {
          const movement = state.movements.find((m) => m.id === movementId)
          const step = movement?.steps.find((s) => s.id === movement.currentStepId)
          if (!movement || !step) return {}

          const date = localDateString()

          // с весовой ступени сначала снимаем вес и только потом уходим на вариант ниже
          if (step.kind === 'measured' && step.progressBy === 'weight') {
            const increment = step.weightStepKg ?? state.settings.defaultWeightStepKg
            const from = step.weightKg ?? 0
            if (from > increment) {
              const to = from - increment
              return {
                movements: state.movements.map((m) =>
                  m.id === movementId
                    ? {
                        ...m,
                        steps: m.steps.map((s) => (s.id === step.id ? { ...s, weightKg: to } : s)),
                      }
                    : m,
                ),
                stepChanges: [
                  ...state.stepChanges,
                  {
                    id: newId(),
                    movementId,
                    date,
                    direction: 'down' as const,
                    fromStepOrder: step.order,
                    toStepOrder: step.order,
                    fromWeightKg: from,
                    toWeightKg: to,
                  },
                ],
              }
            }
          }

          const previous = movement.steps.find((s) => s.order === step.order - 1)
          if (!previous) return {} // низ лестницы

          return {
            // maxReachedStepOrder НЕ трогаем: храповик держит рекорд,
            // даже когда текущее состояние просело (Д-9)
            movements: state.movements.map((m) =>
              m.id === movementId ? { ...m, currentStepId: previous.id } : m,
            ),
            stepChanges: [
              ...state.stepChanges,
              {
                id: newId(),
                movementId,
                date,
                direction: 'down' as const,
                fromStepOrder: step.order,
                toStepOrder: previous.order,
              },
            ],
          }
        })
      },

      addMovement: () => {
        const id = newId()
        const stepId = newId()
        set((state) => ({
          movements: [
            ...state.movements,
            {
              id,
              name: 'Новое упражнение',
              category: 'pull',
              steps: [
                {
                  id: stepId,
                  order: 1,
                  name: 'Первая ступень',
                  kind: 'measured',
                  unit: 'reps',
                  progressBy: 'variant',
                  repMin: 6,
                  repMax: 10,
                  targetSets: 3,
                },
              ],
              currentStepId: stepId,
              maxReachedStepOrder: 1,
              archived: false,
              sortOrder: state.movements.length + 1,
            },
          ],
        }))
        return id
      },

      updateMovement: (id, patch) => {
        set((state) => ({
          movements: state.movements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }))
      },

      deleteMovement: (id) => {
        set((state) => ({
          movements: state.movements.filter((m) => m.id !== id),
          // упражнение исчезает и из планов тренировок, и из шаблонов
          templates: state.templates.map((t) => ({
            ...t,
            movementIds: t.movementIds.filter((mid) => mid !== id),
          })),
          workouts: state.workouts.map((w) => ({
            ...w,
            movementIds: w.movementIds.filter((mid) => mid !== id),
          })),
        }))
      },

      addStep: (movementId, kind) => {
        set((state) => ({
          movements: state.movements.map((m) => {
            if (m.id !== movementId) return m
            const order = m.steps.reduce((max, s) => Math.max(max, s.order), 0) + 1
            const base = { id: newId(), order, name: `Ступень ${order}` }
            const step: Step =
              kind === 'binary'
                ? { ...base, kind: 'binary', targetSuccesses: 1 }
                : {
                    ...base,
                    kind: 'measured',
                    unit: 'reps',
                    progressBy: 'variant',
                    repMin: 6,
                    repMax: 10,
                    targetSets: 3,
                  }
            return { ...m, steps: [...m.steps, step] }
          }),
        }))
      },

      updateStep: (movementId, stepId, patch) => {
        set((state) => ({
          movements: state.movements.map((m) =>
            m.id === movementId
              ? {
                  ...m,
                  steps: m.steps.map((s) => (s.id === stepId ? ({ ...s, ...patch } as Step) : s)),
                }
              : m,
          ),
        }))
      },

      deleteStep: (movementId, stepId) => {
        set((state) => ({
          movements: state.movements.map((m) => {
            if (m.id !== movementId) return m
            if (m.steps.length <= 1 || m.currentStepId === stepId) return m

            const recordStepId = m.steps.find((s) => s.order === m.maxReachedStepOrder)?.id
            const kept = m.steps
              .filter((s) => s.id !== stepId)
              .toSorted((a, b) => a.order - b.order)
              // Мутировать нельзя: zustand сравнивает по ссылке, и без новых
              // объектов React не перерисует список ступеней.
              // oxlint-disable-next-line no-map-spread
              .map((s, index) => ({ ...s, order: index + 1 }))

            return {
              ...m,
              steps: kept,
              maxReachedStepOrder: resolveRecordOrder(kept, recordStepId, m.maxReachedStepOrder),
            }
          }),
        }))
      },

      moveStep: (movementId, stepId, delta) => {
        set((state) => ({
          movements: state.movements.map((m) => {
            if (m.id !== movementId) return m

            const ordered = m.steps.toSorted((a, b) => a.order - b.order)
            const from = ordered.findIndex((s) => s.id === stepId)
            const to = from + delta
            if (from === -1 || to < 0 || to >= ordered.length) return m

            const recordStepId = ordered.find((s) => s.order === m.maxReachedStepOrder)?.id

            const moved = [...ordered]
            const [taken] = moved.splice(from, 1)
            if (!taken) return m
            moved.splice(to, 0, taken)

            // oxlint-disable-next-line no-map-spread -- см. комментарий в deleteStep
            const renumbered = moved.map((s, index) => ({ ...s, order: index + 1 }))

            return {
              ...m,
              steps: renumbered,
              // рекорд привязан к конкретной ступени, а не к номеру: после
              // перестановки он должен следовать за той же ступенью
              maxReachedStepOrder: resolveRecordOrder(
                renumbered,
                recordStepId,
                m.maxReachedStepOrder,
              ),
            }
          }),
        }))
      },

      addTemplate: () => {
        const id = newId()
        set((state) => ({
          templates: [...state.templates, { id, name: 'Новый день', movementIds: [] }],
        }))
        return id
      },

      updateTemplate: (id, patch) => {
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
      },

      setMeasurement: (kind, date, value) => {
        set((state) => {
          const existing = state.measurements.find((m) => m.kind === kind && m.date === date)
          if (existing) {
            return {
              measurements: state.measurements.map((m) =>
                m.id === existing.id ? { ...m, value } : m,
              ),
            }
          }
          return {
            measurements: [...state.measurements, { id: newId(), date, kind, value }],
          }
        })
      },

      deleteMeasurement: (id) => {
        set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) }))
      },

      updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }))
      },

      replaceAll: (data) => {
        set({
          movements: data.movements,
          templates: data.templates,
          workouts: data.workouts,
          sets: data.sets,
          stepChanges: data.stepChanges,
          measurements: data.measurements,
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
        measurements: state.measurements,
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
    measurements: state.measurements,
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
