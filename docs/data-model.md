# Модель данных

## Принцип

**Хранятся только факты и решения. Всё остальное вычисляется.**

- **Факты** — `SetEntry` (что сделал) и `Workout` (когда).
- **Решения** — `StepChange` (когда и куда переключил ступень).

Рекорды, стрики, готовность к усложнению, суммарные повторения, ачивки — **производные**.
Они считаются функциями от журнала при рендере и **никогда не попадают в состояние**.

Причина: новая метрика, добавленная через полгода, сразу считается по всей накопленной
истории. Если бы производные хранились, каждая новая идея требовала бы миграции, а половина
истории осталась бы неполной. Объём данных микроскопический (год тренировок ≈ 200 КБ),
пересчёт мгновенный — платить за это нечем.

## Хранилище

Единый JSON-документ `AppState` в IndexedDB (`idb-keyval`), в памяти — Zustand store.
Не SQLite: объём мал, миграции проще, экспорт тривиален, никакого wasm и воркеров.
Порог пересмотра — см. [decisions.md](decisions.md#д-4-json-документ-вместо-sqlite).

## Схема

```ts
type Category   = 'pull' | 'push' | 'legs' | 'core'
type Unit       = 'reps' | 'seconds'
type StepKind   = 'measured' | 'binary'
type ProgressBy = 'variant' | 'weight'
type Side       = 'both' | 'left' | 'right'

interface AppState {
  schemaVersion: number
  movements:   Movement[]
  templates:   Template[]
  workouts:    Workout[]
  sets:        SetEntry[]
  stepChanges: StepChange[]
  settings:    Settings
}

interface Movement {
  id: string
  name: string                 // "Вертикальная тяга"
  category: Category
  unit: Unit
  equipment?: string           // "на упорах" — напоминалка, НЕ ступень
  steps: Step[]                // упорядоченные по order
  currentStepId: string
  maxReachedStepOrder: number  // храповик: никогда не убывает
  archived: boolean
  sortOrder: number
}

interface Step {
  id: string
  order: number                // 1..N внутри движения
  name: string                 // "Подтягивания с весом"
  kind: StepKind
  progressBy: ProgressBy
  repMin: number               // для unit:'seconds' — секунды
  repMax: number
  targetSets: number
  weightKg?: number            // текущий вес на весовой ступени
  weightStepKg?: number        // шаг прибавки, по умолчанию 2.5
  restSec?: number             // переопределяет settings.defaultRestSec
  perSide?: boolean            // упражнение выполняется на каждую сторону отдельно
}

interface Workout {
  id: string
  date: string                 // 'YYYY-MM-DD', ЛОКАЛЬНАЯ дата, не UTC
  startedAt: number            // epoch ms
  finishedAt?: number
  templateId?: string
  notes?: string
}

interface SetEntry {
  id: string
  workoutId: string
  movementId: string
  stepId: string               // на какой ступени сделан — ключ к сравнимости
  order: number                // номер подхода внутри упражнения
  reps?: number                // для unit:'reps'
  durationSec?: number         // для unit:'seconds'
  weightKg?: number            // фактический вес в этом подходе
  side: Side
  isWarmup: boolean            // разминочные НЕ участвуют в прогрессии и рекордах
  succeeded?: boolean          // только для kind:'binary'
}

interface StepChange {
  id: string
  movementId: string
  date: string                 // 'YYYY-MM-DD'
  direction: 'up' | 'down'
  fromStepOrder: number
  toStepOrder: number
  fromWeightKg?: number        // для переходов внутри весовой ступени
  toWeightKg?: number
  note?: string
}

interface Template {
  id: string
  name: string                 // "День A"
  movementIds: string[]        // порядок в тренировке важен
}

interface Settings {
  weeklyTarget: number         // 3
  defaultRestSec: number       // 120
  defaultWeightStepKg: number  // 2.5
  readyAfterSessions: number   // 1 — сколько тренировок подряд надо закрыть диапазон
}
```

### Почему `SetEntry` ссылается на `stepId`, а не только на `movementId`

Это ядро всей идеи. Подход, привязанный к конкретной ступени, сравним только с подходами
на той же ступени. Без этого график снова смешает несравнимые числа — ровно ту проблему,
ради которой приложение и пишется.

### Почему у `Step` три числовых поля вместо одного

`unit` определяет, какое поле заполняется в `SetEntry` (`reps` либо `durationSec`).
Отдельные нулевые поля вместо одного полиморфного `value` — чтобы типы и графики
не догадывались о смысле числа по соседнему полю.

## Даты

Дата тренировки хранится строкой `'YYYY-MM-DD'` в **локальном** времени, не как UTC-таймстемп
и не как ISO-строка с зоной. Иначе вечерняя тренировка уезжает на следующий день и стрики
врут. `startedAt`/`finishedAt` — epoch ms, они про длительность, а не про календарь.

Неделя — ISO, понедельник–воскресенье, тоже локально.

## Производные величины

Все живут в `src/domain/`, чистые функции от `AppState`, без побочных эффектов.

### Готовность к усложнению

```
готово(movement) =
  берём последние readyAfterSessions тренировок, где есть это движение
  и все подходы сделаны на текущей ступени;
  во всех них: рабочих (не warmup) подходов >= targetSets
               И каждый из них >= repMax
```

Статус для UI: `ready` (зелёный) | `in_progress` (нейтральный) | `no_data`.

Для `kind: 'binary'` готовность = последняя попытка с `succeeded: true`.

### Рекорд (PR)

Максимум повторений в одном рабочем подходе **в пределах конкретной ступени**
(для весовой — в пределах пары ступень+вес). Межступенчатых рекордов не бывает: они
бессмысленны, потому что варианты несравнимы.

### Стрик

Недельный. Неделя закрыта, если в ней `>= settings.weeklyTarget` завершённых тренировок.
Текущая (незавершённая) неделя стрик не ломает — она ещё в процессе.

### Суммарные повторения

Простая сумма `reps` по фильтру (движение / период), включая разминочные — это счётчик
«сколько раз я вообще оттолкнулся», а не метрика. Помечается в UI соответствующе.

## Миграции

`AppState.schemaVersion` + массив функций `(state: any) => any`, применяемых по порядку
при загрузке из IndexedDB и при импорте JSON.

Правила:

- Миграция **никогда не удаляет данные журнала.** Поля можно добавлять и переименовывать,
  подходы и тренировки — нет.
- Импорт JSON проходит через тот же конвейер миграций, что и загрузка из хранилища.
  Файл, экспортированный полгода назад, обязан импортироваться в текущую версию.
- Перед применением миграций при импорте — снимок текущего состояния в отдельный ключ
  IndexedDB, чтобы неудачный импорт не стирал существующие данные.
