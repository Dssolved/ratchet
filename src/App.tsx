import { useState } from 'react'

import { activeWorkout, workoutById } from './domain/selectors.ts'
import History from './screens/History.tsx'
import Settings from './screens/Settings.tsx'
import Summary from './screens/Summary.tsx'
import Today from './screens/Today.tsx'
import WorkoutScreen from './screens/Workout.tsx'
import { useData } from './store/useStore.ts'
import { useHydrated } from './store/useHydrated.ts'

type Tab = 'today' | 'progress' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'settings', label: 'Настройки' },
]

export default function App() {
  const hydrated = useHydrated()
  const data = useData()

  const [tab, setTab] = useState<Tab>('today')
  const [finishedId, setFinishedId] = useState<string | null>(null)

  if (!hydrated) {
    return <div className="p-6 text-body text-muted">Загрузка…</div>
  }

  const active = activeWorkout(data)
  const finished = finishedId ? workoutById(data, finishedId) : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/* вертикальные безопасные зоны применяются здесь, а не на body — см. index.css */}
      <main className="flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        {tab === 'today' &&
          (finished ? (
            <Summary data={data} workout={finished} onDone={() => setFinishedId(null)} />
          ) : active ? (
            <WorkoutScreen data={data} workout={active} onFinished={setFinishedId} />
          ) : (
            <Today data={data} onStarted={() => setFinishedId(null)} />
          ))}

        {tab === 'progress' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-title font-semibold">История</h1>
            <p className="text-body text-muted">Графики и лестницы ступеней придут на шаге 5.</p>
            <History data={data} />
          </div>
        )}

        {tab === 'settings' && <Settings data={data} />}
      </main>

      <nav className="sticky bottom-0 flex border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
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
  )
}
