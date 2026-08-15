/**
 * Тактильный отклик. Во время тренировки телефон часто не в фокусе внимания:
 * отметил подход — и смотришь на турник, а не на экран. Вибрация подтверждает,
 * что нажатие засчиталось, без необходимости вглядываться.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

import { isNative } from './notifications.ts'

/** Короткий отклик на отметку подхода. */
export async function tapFeedback(): Promise<void> {
  if (!isNative()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // вибромотор может быть недоступен или выключен в системе — это не ошибка
  }
}

/** Более заметный отклик на конец отдыха. */
export async function restDoneFeedback(): Promise<void> {
  if (!isNative()) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // см. выше
  }
}

/** Щелчок храповика — самое сильное событие в приложении, отклик соответствующий. */
export async function ratchetFeedback(): Promise<void> {
  if (!isNative()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy })
  } catch {
    // см. выше
  }
}
