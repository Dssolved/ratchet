import { useRef, useState } from 'react'

import type { AppData } from '../domain/types.ts'
import { downloadBackup, importBackupFile } from '../lib/backup.ts'
import {
  ensureNotificationPermission,
  isNative,
  scheduleIn,
  TEST_NOTIFICATION_ID,
} from '../lib/notifications.ts'
import { useBackHandler } from '../lib/backHandler.ts'
import { pluralize } from '../lib/plural.ts'
import { selectData, useStore } from '../store/useStore.ts'
import ExerciseEditor from './ExerciseEditor.tsx'
import TemplateEditor from './TemplateEditor.tsx'

/**
 * Проверка того, ради чего приложение вообще собирается в APK: доходит ли
 * уведомление при потушенном экране. На этом же механизме работает таймер отдыха.
 */
function NotificationCheck() {
  const [status, setStatus] = useState<string | null>(null)
  const native = isNative()

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label tracking-wider text-muted uppercase">Уведомления</h2>
      {native ? (
        <>
          <p className="text-body text-muted">
            Нажми, заблокируй экран и убери телефон в карман. Уведомление должно прийти
            через <span className="font-num text-text">15</span> секунд — на этом держится
            таймер отдыха.
          </p>
          <button
            type="button"
            onClick={async () => {
              const allowed = await ensureNotificationPermission()
              if (!allowed) {
                setStatus('Разрешение на уведомления не выдано')
                return
              }
              await scheduleIn({
                id: TEST_NOTIFICATION_ID,
                seconds: 15,
                title: 'Отдых окончен',
                body: 'Так будет выглядеть конец отдыха между подходами.',
              })
              setStatus('Запланировано на 15 секунд — блокируй экран')
            }}
            className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
          >
            Проверить уведомление
          </button>
          {status && <p className="text-body text-accent-ink">{status}</p>}
        </>
      ) : (
        <p className="text-body text-muted">
          Доступно только в приложении на телефоне: в браузере уведомления при потушенном
          экране ненадёжны, из-за чего приложение и собирается в APK.
        </p>
      )}
    </section>
  )
}

function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest}с`
  return rest === 0 ? `${minutes}:00` : `${minutes}:${String(rest).padStart(2, '0')}`
}

type View = { kind: 'root' } | { kind: 'exercise'; id: string } | { kind: 'template'; id: string }

export default function Settings({ data }: { data: AppData }) {
  const [view, setView] = useState<View>({ kind: 'root' })

  useBackHandler(view.kind !== 'root', () => setView({ kind: 'root' }))

  if (view.kind === 'exercise') {
    const movement = data.movements.find((m) => m.id === view.id)
    if (movement) {
      return (
        <ExerciseEditor
          data={data}
          movement={movement}
          onBack={() => setView({ kind: 'root' })}
        />
      )
    }
  }

  if (view.kind === 'template') {
    const template = data.templates.find((t) => t.id === view.id)
    if (template) {
      return (
        <TemplateEditor data={data} template={template} onBack={() => setView({ kind: 'root' })} />
      )
    }
  }

  return <SettingsRoot data={data} onOpen={setView} />
}

function Catalog({ data, onOpen }: { data: AppData; onOpen: (view: View) => void }) {
  const addMovement = useStore((s) => s.addMovement)
  const addTemplate = useStore((s) => s.addTemplate)

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Упражнения</h2>
        {data.movements.map((movement) => (
          <button
            key={movement.id}
            type="button"
            onClick={() => onOpen({ kind: 'exercise', id: movement.id })}
            className="flex min-h-12 items-baseline justify-between gap-2 rounded-ctl border border-border bg-surface px-3 py-2 text-left"
          >
            <span>
              <span className={movement.archived ? 'text-muted line-through' : ''}>
                {movement.name}
              </span>
              <span className="block text-body text-muted">
                {movement.steps.find((s) => s.id === movement.currentStepId)?.name}
              </span>
            </span>
            <span className="font-num text-label text-muted">
              {movement.maxReachedStepOrder} / {movement.steps.length}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpen({ kind: 'exercise', id: addMovement() })}
          className="min-h-12 rounded-ctl border border-border text-body text-muted"
        >
          + упражнение
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Дни</h2>
        {data.templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onOpen({ kind: 'template', id: template.id })}
            className="rounded-ctl border border-border bg-surface px-3 py-2 text-left"
          >
            <span className="block">{template.name}</span>
            <span className="block text-body text-muted">
              {template.movementIds.length > 0
                ? template.movementIds
                    .map((id) => data.movements.find((m) => m.id === id)?.name ?? id)
                    .join(' · ')
                : 'пусто'}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpen({ kind: 'template', id: addTemplate() })}
          className="min-h-12 rounded-ctl border border-border text-body text-muted"
        >
          + день
        </button>
      </section>
    </>
  )
}

function SettingsRoot({ data, onOpen }: { data: AppData; onOpen: (view: View) => void }) {
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const updateSettings = useStore((s) => s.updateSettings)

  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = await importBackupFile(file)
      replaceAll(imported)
      const count = pluralize(imported.workouts.length, 'тренировка', 'тренировки', 'тренировок')
      setMessage({ text: `Импортировано: ${count}`, error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-label tracking-wider text-muted uppercase">Тренировки</h2>
        <div className="flex items-center gap-3 rounded-ctl border border-border bg-surface px-4 py-3">
          <span className="flex-1">Тренировок в неделю</span>
          <button
            type="button"
            onClick={() =>
              updateSettings({ weeklyTarget: Math.max(1, data.settings.weeklyTarget - 1) })
            }
            className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
            aria-label="Убавить цель"
          >
            −
          </button>
          <span className="w-16 text-center font-num text-value">{data.settings.weeklyTarget}</span>
          <button
            type="button"
            onClick={() =>
              updateSettings({ weeklyTarget: Math.min(7, data.settings.weeklyTarget + 1) })
            }
            className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
            aria-label="Прибавить цель"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-ctl border border-border bg-surface px-4 py-3">
          <span className="flex-1">
            <span className="block">Отдых по умолчанию</span>
            <span className="block text-body text-muted">
              у ступени может быть свой
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              updateSettings({
                defaultRestSec: Math.max(30, data.settings.defaultRestSec - 30),
              })
            }
            className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
            aria-label="Убавить отдых"
          >
            −
          </button>
          <span className="w-16 text-center font-num text-value">
            {formatRest(data.settings.defaultRestSec)}
          </span>
          <button
            type="button"
            onClick={() =>
              updateSettings({ defaultRestSec: Math.min(900, data.settings.defaultRestSec + 30) })
            }
            className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
            aria-label="Прибавить отдых"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => updateSettings({ keepScreenOn: !data.settings.keepScreenOn })}
          aria-pressed={data.settings.keepScreenOn}
          className="flex min-h-14 items-center justify-between gap-3 rounded-ctl border border-border bg-surface px-4 text-left"
        >
          <span>
            <span className="block">Не гасить экран</span>
            <span className="block text-body text-muted">во время тренировки</span>
          </span>
          <span
            className={`h-7 w-12 shrink-0 rounded-full p-1 ${
              data.settings.keepScreenOn ? 'bg-accent' : 'bg-surface-2'
            }`}
          >
            <span
              className={`block size-5 rounded-full transition-transform ${
                data.settings.keepScreenOn
                  ? 'translate-x-5 bg-on-accent'
                  : 'translate-x-0 bg-muted'
              }`}
            />
          </span>
        </button>
        <p className="text-body text-muted">
          Удобно: видно таймер, не разблокируя телефон. Но экран в кармане ловит случайные
          нажатия, а батарея садится быстрее.
        </p>

      </section>

      <Catalog data={data} onOpen={onOpen} />

      <NotificationCheck />

      <section className="flex flex-col gap-3">
        <h2 className="text-label tracking-wider text-muted uppercase">Данные</h2>
        <p className="text-body text-muted">
          Бэкенда нет — экспорт в файл это единственный бэкап. Делай его время от времени.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await downloadBackup(selectData(useStore.getState()))
              } catch (error) {
                // отмена системного «Поделиться» тоже приходит сюда — это не ошибка
                const text = error instanceof Error ? error.message : String(error)
                if (!/cancel/i.test(text)) setMessage({ text, error: true })
              }
            }}
            className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
          >
            Экспорт JSON
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
          >
            Импорт JSON
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Сбросить справочник и удалить все тренировки?')) return
              await resetToSeed()
              setMessage({ text: 'Справочник сброшен к стартовому', error: false })
            }}
            className="min-h-12 rounded-ctl border border-border px-4 font-medium text-danger"
          >
            Сбросить
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />

        {message && (
          <p className={`text-body ${message.error ? 'text-danger' : 'text-accent-ink'}`}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  )
}
