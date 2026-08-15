import { useEffect, useState } from 'react'
import { useStore } from './useStore.ts'

/**
 * IndexedDB асинхронна, поэтому persist восстанавливает состояние не сразу.
 * До окончания гидратации на экране лежат seed-данные, а не данные пользователя —
 * показывать их нельзя, иначе на долю секунды мелькнёт «пустая история».
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())

  useEffect(() => {
    const unsubFinish = useStore.persist.onFinishHydration(() => setHydrated(true))
    // на случай, если гидратация успела завершиться между useState и useEffect
    if (useStore.persist.hasHydrated()) setHydrated(true)
    return unsubFinish
  }, [])

  return hydrated
}
