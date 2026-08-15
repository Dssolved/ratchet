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

const REST_CHANNEL_ID = 'rest-timer'

/**
 * Канал уведомлений объявляется явно, а не берётся по умолчанию: только так
 * гарантированы звук и вибрация. Звук здесь важнее визуального уведомления —
 * телефон лежит в кармане, и услышать сигнал проще, чем увидеть.
 *
 * ВНИМАНИЕ: настройки канала в Android неизменяемы после создания. Поменять
 * важность или звук программно уже нельзя — дальше каналом владеет пользователь
 * через системные настройки. Чтобы изменить поведение, нужен НОВЫЙ канал с новым id,
 * а старый останется висеть в списке. Поэтому не менять здесь ничего без нужды.
 */
export async function ensureRestChannel(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: REST_CHANNEL_ID,
      name: 'Отдых между подходами',
      description: 'Сигнал об окончании отдыха',
      // 5 — максимальная: звук, вибрация и всплывающее уведомление
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    // на несуществующей платформе или при отказе системы просто останемся
    // без своего канала: уведомление уйдёт в канал по умолчанию
  }
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
        channelId: REST_CHANNEL_ID,
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

/** Идентификатор уведомления о конце отдыха. Одно на всё приложение: отдых всегда один. */
export const REST_NOTIFICATION_ID = 1
