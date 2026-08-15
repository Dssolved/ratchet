import { Choice, NumberField, TextField, Toggle } from '../components/Field.tsx'
import { movementHasSets, stepHasSets } from '../domain/selectors.ts'
import {
  isMeasured,
  type AppData,
  type Category,
  type Movement,
  type Step,
} from '../domain/types.ts'
import { useStore } from '../store/useStore.ts'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'pull', label: 'Тяга' },
  { value: 'push', label: 'Жим' },
  { value: 'legs', label: 'Ноги' },
  { value: 'core', label: 'Пресс' },
]

interface Props {
  data: AppData
  movement: Movement
  onBack: () => void
}

export default function ExerciseEditor({ data, movement, onBack }: Props) {
  const updateMovement = useStore((s) => s.updateMovement)
  const deleteMovement = useStore((s) => s.deleteMovement)
  const addStep = useStore((s) => s.addStep)

  const used = movementHasSets(data, movement.id)
  const steps = movement.steps.toSorted((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="min-h-12 text-body text-muted">
          ← справочник
        </button>
      </header>

      <section className="flex flex-col gap-3">
        <TextField
          label="Название"
          value={movement.name}
          onChange={(name) => updateMovement(movement.id, { name })}
        />
        <TextField
          label="Оборудование"
          placeholder="на упорах, широкий хват…"
          value={movement.equipment ?? ''}
          onChange={(equipment) =>
            updateMovement(movement.id, { equipment: equipment.trim() || undefined })
          }
        />
        <p className="text-body text-muted">
          Оборудование — не ступень, а постоянное условие. Держит амплитуду одинаковой,
          чтобы цифры оставались сравнимыми.
        </p>

        <Choice
          label="Категория"
          value={movement.category}
          options={CATEGORIES}
          onChange={(category) => updateMovement(movement.id, { category })}
        />

        <Toggle
          label="Скрыть из списков"
          hint="история сохранится"
          value={movement.archived}
          onChange={(archived) => updateMovement(movement.id, { archived })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-label tracking-wider text-muted uppercase">Лестница ступеней</h2>

        {steps.map((step, index) => (
          <StepEditor
            key={step.id}
            data={data}
            movement={movement}
            step={step}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
          />
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addStep(movement.id, 'measured')}
            className="min-h-12 flex-1 rounded-ctl border border-border text-body"
          >
            + ступень
          </button>
          <button
            type="button"
            onClick={() => addStep(movement.id, 'binary')}
            className="min-h-12 flex-1 rounded-ctl border border-border text-body text-muted"
          >
            + навык
          </button>
        </div>
        <p className="text-body text-muted">
          Навыковая ступень измеряется не повторениями, а фактом «получилось / пробовал» —
          для мышцапа, пистолетика и подобного.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <button
          type="button"
          disabled={used}
          onClick={() => {
            if (confirm(`Удалить «${movement.name}»?`)) {
              deleteMovement(movement.id)
              onBack()
            }
          }}
          className="min-h-12 rounded-ctl border border-border text-body text-danger disabled:opacity-40"
        >
          Удалить упражнение
        </button>
        {used && (
          <p className="text-body text-muted">
            Удалить нельзя: по упражнению есть записанные подходы. Чтобы убрать его из
            списков, не теряя историю, используй «Скрыть из списков».
          </p>
        )}
      </section>
    </div>
  )
}

function StepEditor({
  data,
  movement,
  step,
  isFirst,
  isLast,
}: {
  data: AppData
  movement: Movement
  step: Step
  isFirst: boolean
  isLast: boolean
}) {
  const updateStep = useStore((s) => s.updateStep)
  const deleteStep = useStore((s) => s.deleteStep)
  const moveStep = useStore((s) => s.moveStep)
  const defaultRest = useStore((s) => s.settings.defaultRestSec)
  const defaultWeightStep = useStore((s) => s.settings.defaultWeightStepKg)

  const used = stepHasSets(data, step.id)
  const isCurrent = movement.currentStepId === step.id
  const canDelete = !used && !isCurrent && movement.steps.length > 1

  const patch = (value: Partial<Step>) => updateStep(movement.id, step.id, value)

  return (
    <article
      className={`flex flex-col gap-3 rounded-card border p-3 ${
        isCurrent ? 'border-accent-ink bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-num text-label text-muted">{step.order}</span>
        <span className="flex-1">
          <TextField label="Ступень" value={step.name} onChange={(name) => patch({ name })} />
        </span>
      </div>

      {isCurrent && <p className="text-label text-accent-ink">текущая ступень</p>}

      {isMeasured(step) ? (
        <>
          <div className="flex gap-2">
            <NumberField
              label="От"
              value={step.repMin}
              max={step.repMax}
              onChange={(repMin) => patch({ repMin })}
            />
            <NumberField
              label="До"
              value={step.repMax}
              min={step.repMin}
              onChange={(repMax) => patch({ repMax })}
            />
            <NumberField
              label="Подходов"
              value={step.targetSets}
              min={1}
              max={10}
              onChange={(targetSets) => patch({ targetSets })}
            />
          </div>

          <Choice
            label="Единица"
            value={step.unit}
            disabled={used}
            options={[
              { value: 'reps', label: 'Повторения' },
              { value: 'seconds', label: 'Секунды' },
            ]}
            onChange={(unit) => patch({ unit })}
          />
          {used && (
            <p className="text-label text-muted">
              Единицу нельзя менять: по ступени уже есть подходы, смена обесценила бы их.
            </p>
          )}

          <Choice
            label="Прогрессия"
            value={step.progressBy}
            options={[
              { value: 'variant', label: 'Следующий вариант' },
              { value: 'weight', label: 'Добавлять вес' },
            ]}
            onChange={(progressBy) => patch({ progressBy })}
          />

          {step.progressBy === 'weight' && (
            <div className="flex gap-2">
              <NumberField
                label="Текущий вес"
                value={step.weightKg ?? 0}
                step={0.5}
                suffix="кг"
                onChange={(weightKg) => patch({ weightKg })}
              />
              <NumberField
                label="Шаг"
                value={step.weightStepKg ?? defaultWeightStep}
                min={0.5}
                step={0.5}
                suffix="кг"
                onChange={(weightStepKg) => patch({ weightStepKg })}
              />
            </div>
          )}
        </>
      ) : (
        <p className="text-body text-muted">
          Навыковая ступень: «получилось / пробовал», без диапазона.
        </p>
      )}

      <div className="flex gap-2">
        <NumberField
          label="Отдых"
          value={step.restSec ?? defaultRest}
          min={0}
          max={900}
          step={15}
          suffix="сек"
          onChange={(restSec) => patch({ restSec })}
        />
        <span className="flex-1">
          <Toggle
            label="По сторонам"
            hint="левая и правая отдельно"
            value={step.perSide === true}
            onChange={(perSide) => patch({ perSide })}
          />
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => moveStep(movement.id, step.id, -1)}
          className="min-h-12 flex-1 rounded-ctl border border-border text-body text-muted disabled:opacity-30"
          aria-label="Выше по лестнице"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => moveStep(movement.id, step.id, 1)}
          className="min-h-12 flex-1 rounded-ctl border border-border text-body text-muted disabled:opacity-30"
          aria-label="Ниже по лестнице"
        >
          ↓
        </button>
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => deleteStep(movement.id, step.id)}
          className="min-h-12 flex-1 rounded-ctl border border-border text-body text-danger disabled:opacity-30"
        >
          Удалить
        </button>
      </div>
      {!canDelete && (
        <p className="text-label text-muted">
          {used
            ? 'Нельзя удалить: есть записанные подходы.'
            : isCurrent
              ? 'Нельзя удалить текущую ступень — сначала перейди на другую.'
              : 'В лестнице должна остаться хотя бы одна ступень.'}
        </p>
      )}
    </article>
  )
}
