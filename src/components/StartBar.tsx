import { suggestedTemplateId } from '../domain/selectors.ts'
import type { AppData } from '../domain/types.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Главное действие приложения — над нижним меню, под большой палец.
 *
 * Раньше единственный вход в тренировку был кнопкой вверху экрана, куда с телефоном
 * в одной руке не дотянуться. Полоса, а не круглый FAB: мишень больше, доступна любой
 * рукой, вмещает подпись какого дня и не накрывает собой контент (Д-27).
 *
 * **Отсюда акцент экрана.** Список дней на «Сегодня» из-за этого стал контурным:
 * два лайма на экране — это конкуренция акцентов, которую уже ловили на телефоне.
 */
export default function StartBar({
  data,
  onStarted,
}: {
  data: AppData
  /** экран тренировки поднимется сам из activeWorkout — здесь только закрыть итог */
  onStarted: () => void
}) {
  const startWorkout = useStore((s) => s.startWorkout)
  const suggested = data.templates.find((t) => t.id === suggestedTemplateId(data))

  // имя дня ничего не описывает намеренно (Д-28), поэтому состав показывается здесь:
  // это ровно тот момент, когда он нужен — палец уже над кнопкой
  const plan = suggested?.movementIds
    .map((id) => data.movements.find((m) => m.id === id)?.name ?? id)
    .join(' · ')

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={() => {
          startWorkout(suggested?.id ?? null)
          onStarted()
        }}
        className="min-h-14 w-full rounded-ctl bg-accent px-4 py-2 font-semibold text-on-accent"
      >
        {suggested ? `Начать · ${suggested.name}` : 'Начать тренировку'}
        {plan && <span className="block text-body font-normal text-on-accent/70">{plan}</span>}
      </button>
    </div>
  )
}
