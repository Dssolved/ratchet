/**
 * Стрики и ачивки. Как и всё производное — считаются из журнала, не хранятся (Д-3).
 *
 * Поэтому любая ачивка, добавленная здесь завтра, немедленно получит правильную дату
 * из уже накопленной истории, а не «начнёт работать с сегодня».
 */

import { plural } from '../lib/plural.ts'
import { addDays, isoWeekKey, parseLocalDate, weekStart } from './dates.ts'
import { setValue, workoutById } from './selectors.ts'
import { isMeasured, type AppData, type SetEntry } from './types.ts'

export interface Streak {
  current: number
  longest: number
}

/**
 * Стрик считается по НЕДЕЛЯМ, а не по дням (Д-10): дневной штрафовал бы за отдых,
 * который силовым тренировкам необходим, то есть геймификация толкала бы к перетрену.
 *
 * Текущая неделя ещё не закончилась, поэтому не ломает стрик: она либо уже закрыта
 * и считается, либо просто пропускается.
 */
export function weeklyStreak(data: AppData): Streak {
  const target = Math.max(1, data.settings.weeklyTarget)

  const perWeek = new Map<string, number>()
  for (const workout of data.workouts) {
    if (workout.finishedAt === undefined) continue
    const key = isoWeekKey(workout.date)
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1)
  }
  if (perWeek.size === 0) return { current: 0, longest: 0 }

  const isClosed = (monday: Date) => (perWeek.get(isoWeekKey(monday)) ?? 0) >= target

  // --- текущий стрик: идём назад от этой недели ---
  const thisMonday = weekStart(new Date())
  let current = 0
  let cursor = thisMonday
  if (isClosed(cursor)) current += 1
  cursor = addDays(cursor, -7)
  while (isClosed(cursor)) {
    current += 1
    cursor = addDays(cursor, -7)
  }

  // --- самый длинный: проходим все недели от первой тренировки до текущей ---
  const dates = data.workouts
    .filter((w) => w.finishedAt !== undefined)
    .map((w) => parseLocalDate(w.date).getTime())
  const first = weekStart(new Date(Math.min(...dates)))

  let longest = 0
  let run = 0
  for (let week = first; week <= thisMonday; week = addDays(week, 7)) {
    if (isClosed(week)) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  return { current, longest: Math.max(longest, current) }
}

export type AchievementKind = 'step' | 'record' | 'volume' | 'streak'

export interface Achievement {
  id: string
  kind: AchievementKind
  date: string
  title: string
  detail: string
}

/** Вехи по суммарным повторениям — те самые долгоиграющие, что копятся годами. */
const VOLUME_MILESTONES = [1000, 5000, 10_000, 25_000, 50_000, 100_000]

/** Вехи по стрику: 4 недели — месяц, 13 — квартал, 52 — год. */
const STREAK_MILESTONES = [4, 8, 13, 26, 52]

export function achievements(data: AppData): Achievement[] {
  const result: Achievement[] = []

  // --- взятые ступени ---
  for (const change of data.stepChanges) {
    if (change.direction !== 'up') continue
    const movement = data.movements.find((m) => m.id === change.movementId)
    const step = movement?.steps.find((s) => s.order === change.toStepOrder)
    if (!movement) continue

    result.push({
      id: `step-${change.id}`,
      kind: 'step',
      date: change.date,
      title: 'Ступень взята',
      detail:
        change.toWeightKg !== undefined
          ? `${movement.name} · ${step?.name ?? ''} — ${change.toWeightKg} кг`
          : `${movement.name} · ${step?.name ?? change.toStepOrder}`,
    })
  }

  // --- рекорды: максимум в одном подходе в пределах ступени ---
  const workingSets = data.sets.filter((s) => !s.isWarmup)
  const byStep = new Map<string, SetEntry[]>()
  for (const set of workingSets) {
    byStep.set(set.stepId, [...(byStep.get(set.stepId) ?? []), set])
  }

  for (const [stepId, sets] of byStep) {
    const movement = data.movements.find((m) => m.steps.some((s) => s.id === stepId))
    const step = movement?.steps.find((s) => s.id === stepId)
    if (!movement || !step || !isMeasured(step)) continue

    const dated = sets
      .map((s) => ({
        set: s,
        value: setValue(s, step) ?? 0,
        date: workoutById(data, s.workoutId)?.date ?? '',
        startedAt: workoutById(data, s.workoutId)?.startedAt ?? 0,
      }))
      .filter((x) => x.value > 0 && x.date !== '')
      .toSorted((a, b) => a.startedAt - b.startedAt)

    let best = 0
    for (const entry of dated) {
      if (entry.value <= best) continue
      // первый результат на ступени рекордом не считаем: рекорд — это превышение
      if (best > 0) {
        result.push({
          id: `record-${entry.set.id}`,
          kind: 'record',
          date: entry.date,
          title: 'Рекорд',
          detail: `${movement.name} · ${step.name} — ${entry.value}${
            step.unit === 'seconds' ? ' сек' : ''
          } (было ${best})`,
        })
      }
      best = entry.value
    }
  }

  // --- вехи по объёму: накапливаем повторения по датам тренировок ---
  const byDate = new Map<string, number>()
  for (const set of data.sets) {
    const date = workoutById(data, set.workoutId)?.date
    if (!date) continue
    byDate.set(date, (byDate.get(date) ?? 0) + (set.reps ?? 0))
  }

  let running = 0
  for (const [date, reps] of [...byDate.entries()].toSorted((a, b) => a[0].localeCompare(b[0]))) {
    const before = running
    running += reps
    for (const milestone of VOLUME_MILESTONES) {
      if (before < milestone && running >= milestone) {
        result.push({
          id: `volume-${milestone}`,
          kind: 'volume',
          date,
          title: `${milestone.toLocaleString('ru')} повторений`,
          detail: 'суммарно за всё время',
        })
      }
    }
  }

  // --- вехи по стрику ---
  const streak = weeklyStreak(data)
  for (const milestone of STREAK_MILESTONES) {
    if (streak.longest >= milestone) {
      result.push({
        id: `streak-${milestone}`,
        kind: 'streak',
        date: '',
        title: `${milestone} ${plural(milestone, 'неделя', 'недели', 'недель')} подряд`,
        detail: 'цель по тренировкам выполнена',
      })
    }
  }

  return result.toSorted((a, b) => b.date.localeCompare(a.date))
}
