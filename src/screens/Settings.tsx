import { useEffect, useRef, useState } from 'react'

import type { AppData } from '../domain/types.ts'
import { formatDateShort, localDateString } from '../domain/dates.ts'
import { reminderPlan } from '../domain/reminder.ts'
import { downloadBackup, importBackupFile, loadSnapshot, restoreSnapshot } from '../lib/backup.ts'
import { listSnapshots, type SnapshotInfo } from '../store/storage.ts'
import {
  ensureNotificationPermission,
  isNative,
  scheduleIn,
  TEST_NOTIFICATION_ID,
} from '../lib/notifications.ts'
import { CURRENT_TONE, playTone, TONE_VARIANTS, unlockAudio } from '../lib/sound.ts'
import { useBackHandler } from '../lib/backHandler.ts'
import { plural, pluralize } from '../lib/plural.ts'
import { selectData, useStore } from '../store/useStore.ts'
import ExerciseEditor from './ExerciseEditor.tsx'
import TemplateEditor from './TemplateEditor.tsx'

/**
 * Напоминание о тренировке (Д-29).
 *
 * Тумблер — единственное место, где спрашивается разрешение на уведомления: системный
 * диалог должен приходить в ответ на осознанное действие, иначе на первом же запуске
 * получишь «запретить» навсегда.
 */
function Reminders({ data }: { data: AppData }) {
  const updateSettings = useStore((s) => s.updateSettings)
  const { remindersOn, restDaysBetweenWorkouts, reminderHour } = data.settings
  const [denied, setDenied] = useState(false)

  const plan = reminderPlan(data)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label tracking-wider text-muted uppercase">Напоминания</h2>

      <button
        type="button"
        onClick={async () => {
          if (!remindersOn) {
            const allowed = await ensureNotificationPermission()
            setDenied(isNative() && !allowed)
            if (isNative() && !allowed) return
          }
          updateSettings({ remindersOn: !remindersOn })
        }}
        aria-pressed={remindersOn}
        className="flex min-h-14 items-center justify-between gap-3 rounded-ctl border border-border bg-surface px-4 text-left"
      >
        <span>
          <span className="block">Напоминать о тренировке</span>
          <span className="block text-body text-muted">если отдых затянулся</span>
        </span>
        <span
          className={`h-7 w-12 shrink-0 rounded-full p-1 ${
            remindersOn ? 'bg-accent' : 'bg-surface-2'
          }`}
        >
          <span
            className={`block size-5 rounded-full transition-transform ${
              remindersOn ? 'translate-x-5 bg-on-accent' : 'translate-x-0 bg-muted'
            }`}
          />
        </span>
      </button>

      {denied && (
        <p className="text-body text-danger">
          Система не дала разрешение на уведомления. Включить его можно в настройках
          Android для этого приложения.
        </p>
      )}

      {remindersOn && (
        <>
          <div className="flex items-center gap-3 rounded-ctl border border-border bg-surface px-4 py-3">
            <span className="flex-1">
              <span className="block">Дней отдыха</span>
              <span className="block text-body text-muted">перед напоминанием</span>
            </span>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  restDaysBetweenWorkouts: Math.max(1, restDaysBetweenWorkouts - 1),
                })
              }
              className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
              aria-label="Убавить дни отдыха"
            >
              −
            </button>
            <span className="w-16 text-center font-num text-value">
              {restDaysBetweenWorkouts}
            </span>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  restDaysBetweenWorkouts: Math.min(7, restDaysBetweenWorkouts + 1),
                })
              }
              className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
              aria-label="Прибавить дни отдыха"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-ctl border border-border bg-surface px-4 py-3">
            <span className="flex-1">Во сколько</span>
            <button
              type="button"
              onClick={() => updateSettings({ reminderHour: Math.max(6, reminderHour - 1) })}
              className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
              aria-label="Раньше"
            >
              −
            </button>
            <span className="w-16 text-center font-num text-value">
              {String(reminderHour).padStart(2, '0')}:00
            </span>
            <button
              type="button"
              onClick={() => updateSettings({ reminderHour: Math.min(23, reminderHour + 1) })}
              className="size-12 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
              aria-label="Позже"
            >
              +
            </button>
          </div>

          <p className="text-body text-muted">
            {plan ? (
              <>
                Ближайшее: {formatDateShort(localDateString(plan.at))} в{' '}
                <span className="font-num">{String(plan.at.getHours()).padStart(2, '0')}:00</span>.
                «{plan.body}»
              </>
            ) : (
              'Сейчас напоминать не о чем: норма недели закрыта или тренировок ещё не было.'
            )}
          </p>
        </>
      )}
    </section>
  )
}

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

/**
 * Выбор сигнала конца отдыха — ВРЕМЕННЫЙ блок (Д-33).
 *
 * Слушать варианты в комнате бессмысленно: судить надо на площадке, на ветру,
 * с телефоном на земле. Поэтому они собираются в APK кнопками, а после выбора
 * блок убирается и остаётся один тон.
 */
function ToneCheck() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label tracking-wider text-muted uppercase">Сигнал конца отдыха</h2>
      <p className="text-body text-muted">
        Послушай на площадке и скажи, какой заметнее. Потом останется один.
      </p>
      <div className="flex flex-col gap-2">
        {TONE_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => {
              unlockAudio()
              playTone(variant.id)
            }}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-ctl border px-4 text-left ${
              variant.id === CURRENT_TONE ? 'border-accent' : 'border-border'
            }`}
          >
            <span className="font-medium">{variant.name}</span>
            <span className="text-body text-muted">
              {variant.id === CURRENT_TONE ? 'сейчас звучит этот' : variant.hint}
            </span>
          </button>
        ))}
      </div>
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

/** '16 авг, 14:32' — снимков за день бывает несколько, время обязательно. */
function formatMoment(at: number): string {
  const d = new Date(at)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${formatDateShort(localDateString(d))}, ${time}`
}

const SNAPSHOT_REASONS: Record<string, string> = {
  reset: 'перед сбросом',
  import: 'перед импортом',
  restore: 'перед восстановлением',
}

interface SnapshotRow {
  info: SnapshotInfo
  workouts?: number
  sets?: number
  error?: string
}

/**
 * Список снимков с восстановлением.
 *
 * Снимки писались с самого начала, но `listSnapshots()` не вызывался ни одним экраном:
 * страховка была, дверцы к ней не было. Достать копию можно было только через devtools
 * на компьютере — то есть на телефоне никак. См. Д-25.
 *
 * В строке показывается, ЧТО внутри: без числа тренировок выбор между пятью датами —
 * гадание.
 */
function Snapshots({
  refresh,
  onRestore,
}: {
  refresh: number
  onRestore: (key: string) => void | Promise<void>
}) {
  const [rows, setRows] = useState<SnapshotRow[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const infos = await listSnapshots()
      const loaded = await Promise.all(
        infos.map(async (info): Promise<SnapshotRow> => {
          try {
            const data = await loadSnapshot(info.key)
            return { info, workouts: data.workouts.length, sets: data.sets.length }
          } catch (error) {
            return { info, error: error instanceof Error ? error.message : String(error) }
          }
        }),
      )
      if (alive) setRows(loaded)
    })()
    return () => {
      alive = false
    }
  }, [refresh])

  if (!rows || rows.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label tracking-wider text-muted uppercase">Снимки</h2>
      <p className="text-body text-muted">
        Перед сбросом, импортом и восстановлением приложение само откладывает копию данных.
        Хранятся последние пять — это не замена экспорту, а страховка от промаха.
      </p>

      {rows.map((row) => (
        <div key={row.info.key} className="flex flex-col gap-3 rounded-ctl border border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setSelected(selected === row.info.key ? null : row.info.key)}
            aria-expanded={selected === row.info.key}
            className="flex min-h-12 items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block">{formatMoment(row.info.at)}</span>
              <span className="block text-body text-muted">
                {SNAPSHOT_REASONS[row.info.reason] ?? row.info.reason}
              </span>
            </span>
            <span className="shrink-0 text-right text-body">
              {row.error ? (
                <span className="text-danger">повреждён</span>
              ) : (
                <>
                  <span className="block">
                    <span className="font-num text-text">{row.workouts}</span>{' '}
                    {plural(row.workouts ?? 0, 'тренировка', 'тренировки', 'тренировок')}
                  </span>
                  <span className="block text-muted">
                    <span className="font-num">{row.sets}</span>{' '}
                    {plural(row.sets ?? 0, 'подход', 'подхода', 'подходов')}
                  </span>
                </>
              )}
            </span>
          </button>

          {selected === row.info.key && !row.error && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <p className="text-body text-muted">
                Текущие данные будут заменены содержимым снимка. Их копия отложится
                автоматически, так что промах обратим.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  void onRestore(row.info.key)
                }}
                className="min-h-12 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
              >
                Восстановить
              </button>
            </div>
          )}

          {selected === row.info.key && row.error && (
            <p className="border-t border-border pt-3 text-body text-danger">{row.error}</p>
          )}
        </div>
      ))}
    </section>
  )
}

/**
 * Барьер перед сбросом. Одного confirm() для необратимой потери всего журнала мало:
 * последствие должно быть названо в штуках, а не словом «все». Числа — самый честный
 * тормоз: «удалить 47 тренировок» останавливает лучше любого предупреждения.
 */
function ResetPanel({
  data,
  onCancel,
  onConfirm,
}: {
  data: AppData
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const workouts = data.workouts.length
  const sets = data.sets.length
  const changes = data.stepChanges.length
  const empty = workouts === 0 && sets === 0 && changes === 0

  return (
    <div className="flex flex-col gap-3 rounded-ctl border border-danger bg-surface p-4">
      <p className="font-medium text-danger">Будет удалено безвозвратно</p>

      {empty ? (
        <p className="text-body text-muted">
          Журнал пуст — терять нечего. Справочник вернётся к стартовому.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-body">
          <li>
            <span className="font-num text-value">{workouts}</span>{' '}
            {plural(workouts, 'тренировка', 'тренировки', 'тренировок')}
          </li>
          <li>
            <span className="font-num text-value">{sets}</span>{' '}
            {plural(sets, 'подход', 'подхода', 'подходов')}
          </li>
          <li>
            <span className="font-num text-value">{changes}</span>{' '}
            {plural(changes, 'переход', 'перехода', 'переходов')} по ступеням
          </li>
        </ul>
      )}

      <p className="text-body text-muted">
        Все упражнения вернутся на первую ступень, рекорды обнулятся, свои упражнения
        и дни исчезнут. Отменить это нельзя — если журнал нужен, сначала сделай экспорт
        кнопкой выше.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 flex-1 rounded-ctl border border-border bg-surface-2 px-4 font-medium"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          className="min-h-12 flex-1 rounded-ctl border border-danger px-4 font-medium text-danger"
        >
          {empty
            ? 'Сбросить'
            : `Удалить ${pluralize(workouts, 'тренировку', 'тренировки', 'тренировок')}`}
        </button>
      </div>
    </div>
  )
}

function SettingsRoot({ data, onOpen }: { data: AppData; onOpen: (view: View) => void }) {
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const updateSettings = useStore((s) => s.updateSettings)

  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  // список снимков перечитывается после каждой операции, которая его пополняет
  const [snapshotsAt, setSnapshotsAt] = useState(0)

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = await importBackupFile(file)
      replaceAll(imported)
      setSnapshotsAt((n) => n + 1)
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

      <Reminders data={data} />

      <NotificationCheck />

      <ToneCheck />

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
            onClick={() => setResetOpen((open) => !open)}
            aria-expanded={resetOpen}
            className="min-h-12 rounded-ctl border border-border px-4 font-medium text-danger"
          >
            Сбросить
          </button>
        </div>

        {resetOpen && (
          <ResetPanel
            data={data}
            onCancel={() => setResetOpen(false)}
            onConfirm={async () => {
              await resetToSeed()
              setResetOpen(false)
              setSnapshotsAt((n) => n + 1)
              setMessage({ text: 'Всё сброшено, упражнения на первой ступени', error: false })
            }}
          />
        )}

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

      <Snapshots
        refresh={snapshotsAt}
        onRestore={async (key) => {
          try {
            const restored = await restoreSnapshot(key)
            replaceAll(restored)
            setSnapshotsAt((n) => n + 1)
            const count = pluralize(
              restored.workouts.length,
              'тренировка',
              'тренировки',
              'тренировок',
            )
            setMessage({ text: `Восстановлено: ${count}`, error: false })
          } catch (error) {
            setMessage({
              text: error instanceof Error ? error.message : String(error),
              error: true,
            })
          }
        }}
      />
    </div>
  )
}
