import { useEffect, useState } from 'react'

import RestBar from './components/RestBar.tsx'
import { activeWorkout, workoutById } from './domain/selectors.ts'
import { useBackHandler } from './lib/backHandler.ts'
import { useRestTimer } from './store/useRestTimer.ts'
import { ensureRestChannel } from './lib/notifications.ts'
import { useSystemBack } from './lib/useSystemBack.ts'
import { useWakeLock } from './lib/useWakeLock.ts'
import Profile from './screens/Profile.tsx'
import Progress from './screens/Progress.tsx'
import Settings from './screens/Settings.tsx'
import Summary from './screens/Summary.tsx'
import Today from './screens/Today.tsx'
import WorkoutScreen from './screens/Workout.tsx'
import { useData } from './store/useStore.ts'
import { useHydrated } from './store/useHydrated.ts'

type Tab = 'today' | 'progress' | 'profile' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'profile', label: 'Профиль' },
  { id: 'settings', label: 'Настройки' },
]

export default function App() {
  const hydrated = useHydrated()
  const data = useData()

  const [tab, setTab] = useState<Tab>('today')
  const [finishedId, setFinishedId] = useState<string | null>(null)

  const active = hydrated ? activeWorkout(data) : undefined
  // плашка отдыха липнет к низу и накрывает конец контента — резервируем под неё место,
  // иначе кнопка «Завершить тренировку» выглядит обрезанной, а не «прокрути ниже»
  const resting = useRestTimer((s) => s.endsAt !== null)

  // канал уведомлений создаётся один раз при запуске: планировать в него можно
  // только после создания
  useEffect(() => {
    void ensureRestChannel()
  }, [])

  useWakeLock(active !== undefined && data.settings.keepScreenOn)

  // «Назад» с экрана итога закрывает его, как кнопка «Готово»
  useBackHandler(finishedId !== null, () => setFinishedId(null))

  // корневой уровень: с любой вкладки возвращаемся на «Сегодня»,
  // и только с неё выходим из приложения
  useSystemBack(() => {
    if (tab === 'today') return false
    setTab('today')
    return true
  })

  if (!hydrated) {
    return <div className="p-6 text-body text-muted">Загрузка…</div>
  }

  const finished = finishedId ? workoutById(data, finishedId) : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/* контент прокручивается под статус-баром — закрываем его непрозрачной полосой */}
      <div className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-bg" />
      {/* вертикальные безопасные зоны применяются здесь, а не на body — см. index.css */}
      <main
        className={`flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] ${
          resting ? "pb-28" : "pb-8"
        }`}
      >
        {tab === 'today' &&
          (finished ? (
            <Summary data={data} workout={finished} onDone={() => setFinishedId(null)} />
          ) : active ? (
            <WorkoutScreen data={data} workout={active} onFinished={setFinishedId} />
          ) : (
            <Today data={data} onStarted={() => setFinishedId(null)} />
          ))}

        {tab === 'progress' && <Progress data={data} />}

        {tab === 'profile' && <Profile data={data} />}

        {tab === 'settings' && <Settings data={data} />}
      </main>

      {/* плашка отдыха и меню липнут к низу одним блоком, иначе при скролле
          таймер уезжает вверх, а меню остаётся */}
      <div className="sticky bottom-0 bg-bg pb-[env(safe-area-inset-bottom)]">
        <RestBar />
        <nav className="flex border-t border-border">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-14 flex-1 text-body font-medium ${
                tab === item.id ? 'text-text' : 'text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
