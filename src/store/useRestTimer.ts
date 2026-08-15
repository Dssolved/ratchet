import { create } from 'zustand'

import {
  cancelScheduled,
  ensureNotificationPermission,
  REST_NOTIFICATION_ID,
  scheduleIn,
} from '../lib/notifications.ts'

/**
 * Таймер отдыха.
 *
 * Хранится МОМЕНТ ОКОНЧАНИЯ, а не «сколько осталось». Причина: JS-таймеры в фоне
 * душатся системой, и счётчик, уменьшаемый по тику, отстанет на всё время, пока
 * экран был потушен. Разница `endsAt - Date.now()` от этого не зависит.
 *
 * Параллельно планируется нативное уведомление — оно и есть настоящий будильник,
 * отсчёт на экране лишь показывает прогресс, пока на него смотрят.
 *
 * В журнал это не попадает: отдых — не факт тренировки. См. docs/decisions.md#д-3.
 */

const STORAGE_KEY = 'ratchet-rest'

interface Persisted {
  endsAt: number
  totalSec: number
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Persisted>
    if (typeof parsed.endsAt !== 'number' || typeof parsed.totalSec !== 'number') return null
    // просроченный отдых восстанавливать незачем
    return parsed.endsAt > Date.now() ? { endsAt: parsed.endsAt, totalSec: parsed.totalSec } : null
  } catch {
    return null
  }
}

function save(value: Persisted | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // приватный режим или переполненное хранилище — таймер просто не переживёт перезапуск
  }
}

interface RestTimerState {
  /** epoch ms окончания отдыха, null — отдыха нет */
  endsAt: number | null
  /** исходная длительность, нужна для полосы прогресса */
  totalSec: number
  /** отдых доотсчитал, но пользователь его ещё не закрыл */
  finished: boolean

  start: (seconds: number) => void
  addTime: (seconds: number) => void
  /** пропустить отдых или закрыть отработавшую плашку */
  dismiss: () => void
  /** вызывается тикером, когда время вышло */
  markFinished: () => void
}

const restored = load()

export const useRestTimer = create<RestTimerState>()((set, get) => ({
  endsAt: restored?.endsAt ?? null,
  totalSec: restored?.totalSec ?? 0,
  finished: false,

  start: (seconds) => {
    const endsAt = Date.now() + seconds * 1000
    set({ endsAt, totalSec: seconds, finished: false })
    save({ endsAt, totalSec: seconds })

    void (async () => {
      await ensureNotificationPermission()
      await cancelScheduled(REST_NOTIFICATION_ID)
      await scheduleIn({
        id: REST_NOTIFICATION_ID,
        seconds,
        title: 'Отдых окончен',
        body: 'Следующий подход.',
      })
    })()
  },

  addTime: (seconds) => {
    const current = get().endsAt
    if (current === null) return

    // от «сейчас», а не от истёкшего конца: +30 к доотсчитавшему отдыху должно
    // давать полные 30 секунд, а не отрицательное время
    const base = Math.max(current, Date.now())
    const endsAt = base + seconds * 1000
    const totalSec = get().totalSec + seconds
    set({ endsAt, totalSec, finished: false })
    save({ endsAt, totalSec })

    void (async () => {
      await cancelScheduled(REST_NOTIFICATION_ID)
      await scheduleIn({
        id: REST_NOTIFICATION_ID,
        seconds: Math.max(1, Math.round((endsAt - Date.now()) / 1000)),
        title: 'Отдых окончен',
        body: 'Следующий подход.',
      })
    })()
  },

  dismiss: () => {
    set({ endsAt: null, totalSec: 0, finished: false })
    save(null)
    void cancelScheduled(REST_NOTIFICATION_ID)
  },

  markFinished: () => {
    if (get().finished) return
    set({ finished: true })
  },
}))
