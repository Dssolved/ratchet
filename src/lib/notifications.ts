/**
 * Локальные уведомления — единственная причина, по которой приложение заворачивается
 * в APK, а не остаётся PWA (docs/decisions.md#д-2).
 *
 * В браузере таймеры service worker'а режутся, и отдых с потушенным экраном
 * не отсчитывается. Здесь используется нативное планирование через AlarmManager.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

/** В браузере уведомления не планируем: там они всё равно ненадёжны. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false

  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export interface ScheduleOptions {
  id: number
  seconds: number
  title: string
  body: string
}

/**
 * allowWhileIdle обязателен: без него Android в Doze откладывает срабатывание,
 * и уведомление придёт не через две минуты, а когда система сочтёт нужным.
 */
export async function scheduleIn({ id, seconds, title, body }: ScheduleOptions): Promise<void> {
  if (!isNative()) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
      },
    ],
  })
}

export async function cancelScheduled(id: number): Promise<void> {
  if (!isNative()) return
  await LocalNotifications.cancel({ notifications: [{ id }] })
}

/** Идентификатор проверочного уведомления из настроек. */
export const TEST_NOTIFICATION_ID = 9001
