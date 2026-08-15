import { useRef, useState } from 'react'

import type { AppData } from '../domain/types.ts'
import { downloadBackup, importBackupFile } from '../lib/backup.ts'
import { pluralize } from '../lib/plural.ts'
import { selectData, useStore } from '../store/useStore.ts'

export default function Settings({ data }: { data: AppData }) {
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)

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
      <section className="flex flex-col gap-2">
        <h2 className="text-label tracking-wider text-muted uppercase">Тренировки</h2>
        <p className="text-body text-muted">
          Цель: <span className="font-num text-text">{data.settings.weeklyTarget}</span> в неделю.
          Отдых по умолчанию:{' '}
          <span className="font-num text-text">{data.settings.defaultRestSec}</span> сек.
        </p>
        <p className="text-body text-muted">
          Правка справочника движений и ступеней появится вместе с храповиком на шаге 4.
        </p>
      </section>

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
