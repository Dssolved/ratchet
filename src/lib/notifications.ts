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

const REMINDER_CHANNEL_ID = 'workout-reminder'

/**
 * Канал напоминаний о тренировке — **отдельный от канала отдыха и намеренно тише**.
 *
 * Пихать напоминание в канал таймера нельзя дважды: во-первых, у того важность 5
 * со звуком и вибрацией, и для «сходи потренируйся» это агрессия; во-вторых, настройки
 * канала в Android неизменяемы после создания (Д-18), так что смешав их однажды,
 * разделить обратно уже не выйдет.
 *
 * Важность 3 — звук есть, всплывающего окна поверх экрана нет. Совсем беззвучное
 * напоминание (важность 2) пропускается вместе с остальной пачкой уведомлений и потому
 * бесполезно.
 */
export async function ensureReminderChannel(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Напоминания о тренировке',
      description: 'Мягкое напоминание, если отдых затянулся',
      importance: 3,
      visibility: 1,
      vibration: false,
    })
  } catch {
    // канал не создался — уведомление уйдёт в канал по умолчанию
  }
}

/**
 * Проверка разрешения БЕЗ запроса. Нужна фоновому планированию: системный диалог
 * должен появляться в ответ на действие человека, а не сам по себе при запуске.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false
  const current = await LocalNotifications.checkPermissions()
  return current.display === 'granted'
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

export interface ScheduleAtOptions {
  id: number
  at: Date
  title: string
  body: string
}

/**
 * Планирование на конкретный момент — для напоминаний о тренировке.
 *
 * `allowWhileIdle` здесь тоже нужен, но по другой причине, чем у отдыха: напоминание
 * приходит вечером, когда телефон часто лежит без движения и система уже в Doze.
 */
export async function scheduleAt({ id, at, title, body }: ScheduleAtOptions): Promise<void> {
  if (!isNative()) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        channelId: REMINDER_CHANNEL_ID,
        schedule: { at, allowWhileIdle: true },
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

/** Напоминание о тренировке. Тоже одно: их не копят, а перепланируют. */
export const REMINDER_NOTIFICATION_ID = 2
