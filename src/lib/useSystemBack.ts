import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'

import { handleBack } from './backHandler.ts'
import { isNative } from './notifications.ts'

/**
 * Системная кнопка (или жест) «Назад».
 *
 * Порядок разбора: сначала подэкраны через стек обработчиков, потом возврат на «Сегодня»
 * с любой другой вкладки, и только если и это не сработало — выход из приложения.
 *
 * Выход с корня «Сегодня» безопасен даже посреди тренировки: подходы уже в хранилище,
 * а незавершённая тренировка подхватится при следующем открытии.
 */
export function useSystemBack(onFallback: () => boolean): void {
  const fallback = useRef(onFallback)
  fallback.current = onFallback

  useEffect(() => {
    if (isNative()) {
      const listener = App.addListener('backButton', () => {
        if (handleBack()) return
        if (fallback.current()) return
        void App.exitApp()
      })
      return () => {
        void listener.then((handle) => handle.remove())
      }
    }

    // В браузере (и в PWA) кнопки нет, но есть жест «назад». Держим один лишний элемент
    // истории, чтобы было что снимать, и восстанавливаем его после каждого перехвата.
    const pushSentinel = () => window.history.pushState({ ratchet: true }, '')
    if ((window.history.state as { ratchet?: boolean } | null)?.ratchet !== true) {
      pushSentinel()
    }

    const onPopState = () => {
      if (handleBack() || fallback.current()) {
        pushSentinel()
      }
      // иначе не мешаем: пользователь действительно уходит со страницы
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
}
