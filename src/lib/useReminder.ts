import { useEffect, useRef } from 'react'

import { reminderKey, reminderPlan } from '../domain/reminder.ts'
import type { AppData } from '../domain/types.ts'
import {
  cancelScheduled,
  ensureReminderChannel,
  hasNotificationPermission,
  isNative,
  REMINDER_NOTIFICATION_ID,
  scheduleAt,
} from './notifications.ts'

/**
 * Держит запланированное напоминание в согласии с журналом.
 *
 * Перепланирование при каждом изменении расписания покрывает оба случая из Д-29:
 * запуск приложения (эффект отрабатывает на монтировании) и завершение тренировки
 * (журнал изменился — ключ расписания изменился). Отдельных вызовов из экранов не нужно,
 * и это важнее, чем кажется: забытый вызов означал бы напоминание о тренировке,
 * которая уже состоялась.
 *
 * Разрешение НЕ запрашивается здесь по своей инициативе: спрашивать про уведомления
 * на первом запуске, ничего не объяснив, — верный способ получить отказ навсегда.
 * Если разрешения нет, планирование просто молча пропускается, а запросит его тумблер
 * в «Настройках».
 */
export function useReminder(data: AppData): void {
  const plan = reminderPlan(data)
  const key = reminderKey(plan)
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!isNative()) return
    if (applied.current === key) return
    applied.current = key

    void (async () => {
      await ensureReminderChannel()
      await cancelScheduled(REMINDER_NOTIFICATION_ID)
      if (!plan) return

      const allowed = await hasNotificationPermission()
      if (!allowed) return

      await scheduleAt({
        id: REMINDER_NOTIFICATION_ID,
        at: plan.at,
        title: plan.title,
        body: plan.body,
      })
    })()
    // plan пересоздаётся каждый рендер, поэтому зависимость — его ключ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
