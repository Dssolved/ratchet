import { useEffect, useRef } from 'react'

/**
 * Обработка системной кнопки «Назад».
 *
 * Навигация в приложении живёт в состоянии экранов, а не в URL, поэтому у WebView нет
 * истории, которую можно было бы отмотать. Вместо того чтобы поднимать всё состояние
 * в корень ради этого, экраны сами регистрируют обработчик, пока у них открыт подэкран.
 *
 * Стек, а не одиночный обработчик: подэкраны вкладываются (список → карточка упражнения →
 * раскрытая тренировка), и «назад» должен снимать последний, а не самый первый.
 */

interface Registration {
  id: symbol
  handler: () => void
}

const stack: Registration[] = []

/**
 * Снимает верхний обработчик. Возвращает false, если снимать нечего —
 * тогда решение принимает корневой уровень: уйти на «Сегодня» или выйти из приложения.
 */
export function handleBack(): boolean {
  const top = stack.at(-1)
  if (!top) return false
  top.handler()
  return true
}

/**
 * Регистрирует обработчик, пока `active`.
 *
 * Сам обработчик держим в ref: иначе каждая перерисовка родителя пересоздавала бы
 * функцию, эффект перезапускался и порядок в стеке ломался.
 */
export function useBackHandler(active: boolean, handler: () => void): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    if (!active) return

    const registration: Registration = { id: Symbol('back'), handler: () => ref.current() }
    stack.push(registration)

    return () => {
      const index = stack.findIndex((r) => r.id === registration.id)
      if (index !== -1) stack.splice(index, 1)
    }
  }, [active])
}
