import { TextField } from '../components/Field.tsx'
import { movementById } from '../domain/selectors.ts'
import type { AppData, Template } from '../domain/types.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  data: AppData
  template: Template
  onBack: () => void
}

export default function TemplateEditor({ data, template, onBack }: Props) {
  const updateTemplate = useStore((s) => s.updateTemplate)
  const deleteTemplate = useStore((s) => s.deleteTemplate)

  const inTemplate = template.movementIds
  const available = data.movements.filter((m) => !m.archived && !inTemplate.includes(m.id))

  const move = (index: number, delta: -1 | 1) => {
    const next = [...inTemplate]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [taken] = next.splice(index, 1)
    if (!taken) return
    next.splice(target, 0, taken)
    updateTemplate(template.id, { movementIds: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <button type="button" onClick={onBack} className="min-h-12 text-body text-muted">
          ← справочник
        </button>
      </header>

      <TextField
        label="Название дня"
        value={template.name}
        onChange={(name) => updateTemplate(template.id, { name })}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Состав</h2>
        <p className="text-body text-muted">
          Порядок значим: тяжёлое и то, что вечно откладываешь, ставь ближе к началу, пока
          есть силы.
        </p>

        {inTemplate.length === 0 && (
          <p className="text-body text-muted">Пусто — упражнения добавляются на ходу.</p>
        )}

        {inTemplate.map((movementId, index) => {
          const movement = movementById(data, movementId)
          return (
            <div
              key={movementId}
              className="flex items-center gap-2 rounded-ctl border border-border bg-surface px-3 py-2"
            >
              <span className="flex-1 text-body">{movement?.name ?? movementId}</span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="size-12 rounded-ctl border border-border text-muted disabled:opacity-30"
                aria-label="Выше"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === inTemplate.length - 1}
                onClick={() => move(index, 1)}
                className="size-12 rounded-ctl border border-border text-muted disabled:opacity-30"
                aria-label="Ниже"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  updateTemplate(template.id, {
                    movementIds: inTemplate.filter((id) => id !== movementId),
                  })
                }
                className="size-12 rounded-ctl text-danger"
                aria-label="Убрать"
              >
                ✕
              </button>
            </div>
          )
        })}
      </section>

      {available.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label tracking-wider text-muted uppercase">Добавить</h2>
          {available.map((movement) => (
            <button
              key={movement.id}
              type="button"
              onClick={() =>
                updateTemplate(template.id, { movementIds: [...inTemplate, movement.id] })
              }
              className="min-h-12 rounded-ctl border border-border px-3 text-left text-body text-muted"
            >
              + {movement.name}
            </button>
          ))}
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          if (confirm(`Удалить день «${template.name}»?`)) {
            deleteTemplate(template.id)
            onBack()
          }
        }}
        className="min-h-12 rounded-ctl border border-border text-body text-danger"
      >
        Удалить день
      </button>
      <p className="text-body text-muted">
        Записанные тренировки останутся: план копируется в тренировку при старте и живёт
        отдельно от шаблона.
      </p>
    </div>
  )
}
