import { useRef, useState } from 'react'

import type { AppData } from '../domain/types.ts'
import { downloadBackup, importBackupFile } from '../lib/backup.ts'
import {
  ensureNotificationPermission,
  isNative,
  scheduleIn,
  TEST_NOTIFICATION_ID,
} from '../lib/notifications.ts'
import { pluralize } from '../lib/plural.ts'
import { selectData, useStore } from '../store/useStore.ts'

/**
 * Проверка того, ради чего приложение вообще собирается в APK: доходит ли
 * уведомление при потушенном экране. На шаге 3 этим же механизмом заработает
 * таймер отдыха.
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

export default function Settings({ data }: { data: AppData }) {
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
        <p className="text-body text-muted">
          Цель: <span className="font-num text-text">{data.settings.weeklyTarget}</span> в неделю.
          Отдых по умолчанию:{' '}
          <span className="font-num text-text">
            {Math.round(data.settings.defaultRestSec / 60)}
          </span>{' '}
          мин.
        </p>

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

        <p className="text-body text-muted">
          Правка справочника упражнений и ступеней появится вместе с храповиком на шаге 4.
        </p>
      </section>

      <NotificationCheck />

      <section className="flex flex-col gap-3">
        <h2 className="text-label tracking-wider text-muted uppercase">Данные</h2>
        <p className="text-body text-muted">
          Бэкенда нет — экспорт в файл это единственный бэкап. Делай его время от времени.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadBackup(selectData(useStore.getState()))}
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
