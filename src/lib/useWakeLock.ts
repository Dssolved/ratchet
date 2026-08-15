import { useEffect } from 'react'

/**
 * Не гасить экран, пока идёт тренировка.
 *
 * Используется Screen Wake Lock API — он есть в WebView, поэтому плагин не нужен.
 *
 * Главная тонкость: система САМА отбирает лок, когда страница уходит в фон
 * (блокировка телефона, переключение приложений), и обратно он не возвращается.
 * Без перезапроса на возврате видимости фича работала бы ровно до первой
 * блокировки экрана и дальше молча умирала.
 *
 * Запрос может быть отклонён (например, включён режим энергосбережения) — тогда
 * экран просто гаснет как обычно, приложение от этого не ломается.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const request = async () => {
      if (released || document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // отказ системы — не ошибка приложения
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
