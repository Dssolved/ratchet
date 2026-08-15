/**
 * Стрики и ачивки. Как и всё производное — считаются из журнала, не хранятся (Д-3).
 *
 * Поэтому любая ачивка, добавленная здесь завтра, немедленно получит правильную дату
 * из уже накопленной истории, а не «начнёт работать с сегодня».
 *
 * ПРИНЦИП ОТБОРА: ачивка награждает то, что мы и так хотим — постоянство, усложнение,
 * возвращение после срыва. Всё, что можно накрутить в ущерб тренировке («300 повторений
 * за раз», «самая длинная тренировка»), не награждаем: так геймификация портит
 * тренировки. По той же причине стрик недельный, а не дневной (Д-10).
 */

import { plural } from '../lib/plural.ts'
import { addDays, daysBetween, isoWeekKey, parseLocalDate, weekStart } from './dates.ts'
import { setValue, workoutById } from './selectors.ts'
import { HOLD_MILESTONES, REP_MILESTONES } from './stats.ts'
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

  const thisMonday = weekStart(new Date())
  let current = 0
  let cursor = thisMonday
  if (isClosed(cursor)) current += 1
  cursor = addDays(cursor, -7)
  while (isClosed(cursor)) {
    current += 1
    cursor = addDays(cursor, -7)
  }

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

export type AchievementKind =
  | 'step'
  | 'record'
  | 'volume'
  | 'streak'
  | 'first'
  | 'return'
  | 'milestone'

export interface Achievement {
  id: string
  kind: AchievementKind
  date: string
  title: string
  detail: string
}

const STREAK_MILESTONES = [4, 8, 13, 26, 52]
const WORKOUT_MILESTONES = new Set([10, 50, 100, 250, 500])
/** Перерыв, после которого возвращение — само по себе достижение. */
const COMEBACK_DAYS = 14

function formatHold(seconds: number): string {
  if (seconds >= 3600) {
    const hours = seconds / 3600
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${plural(Math.round(hours), 'час', 'часа', 'часов')}`
  }
  return `${Math.round(seconds / 60)} минут`
}

export function achievements(data: AppData): Achievement[] {
  const result: Achievement[] = []
  const finished = data.workouts
    .filter((w) => w.finishedAt !== undefined)
    .toSorted((a, b) => a.date.localeCompare(b.date))

  // ---------- взятые ступени ----------
  for (const change of data.stepChanges) {
    if (change.direction !== 'up') continue
    const movement = data.movements.find((m) => m.id === change.movementId)
    const step = movement?.steps.find((s) => s.order === change.toStepOrder)
    if (!movement) continue

    const isTop = step?.order === movement.steps.length
    result.push({
      id: `step-${change.id}`,
      kind: 'step',
      date: change.date,
      title: isTop ? 'Вершина лестницы' : 'Ступень взята',
      detail:
        change.toWeightKg !== undefined
          ? `${movement.name} · ${step?.name ?? ''} — ${change.toWeightKg} кг`
          : `${movement.name} · ${step?.name ?? change.toStepOrder}`,
    })
  }

  // ---------- ступень возвращена после отката ----------
  for (const movement of data.movements) {
    const changes = data.stepChanges
      .filter((c) => c.movementId === movement.id)
      .toSorted((a, b) => a.date.localeCompare(b.date))

    let peak = 0
    let fellFrom = 0
    for (const change of changes) {
      peak = Math.max(peak, change.fromStepOrder, change.toStepOrder)
      if (change.direction === 'down') {
        fellFrom = peak
      } else if (fellFrom > 0 && change.toStepOrder >= fellFrom) {
        result.push({
          id: `recovered-${change.id}`,
          kind: 'step',
          date: change.date,
          title: 'Ступень возвращена',
          detail: `${movement.name} — снова на своём максимуме`,
        })
        fellFrom = 0
      }
    }
  }

  // ---------- рекорды и первые разы ----------
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
      // первый результат на ступени рекордом не считаем: рекорд — это превышение,
      // иначе каждая новая ступень начиналась бы с фальшивого поздравления
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

  // первый раз с весом и первый раз на одной руке
  const firstWeighted = workingSets
    .filter((s) => (s.weightKg ?? 0) > 0)
    .map((s) => ({ set: s, at: workoutById(data, s.workoutId)?.startedAt ?? 0 }))
    .toSorted((a, b) => a.at - b.at)[0]
  if (firstWeighted) {
    const movement = data.movements.find((m) => m.id === firstWeighted.set.movementId)
    result.push({
      id: 'first-weighted',
      kind: 'first',
      date: workoutById(data, firstWeighted.set.workoutId)?.date ?? '',
      title: 'Впервые с весом',
      detail: `${movement?.name ?? ''} — ${firstWeighted.set.weightKg} кг`,
    })
  }

  const firstOneSided = workingSets
    .filter((s) => s.side !== 'both')
    .map((s) => ({ set: s, at: workoutById(data, s.workoutId)?.startedAt ?? 0 }))
    .toSorted((a, b) => a.at - b.at)[0]
  if (firstOneSided) {
    const movement = data.movements.find((m) => m.id === firstOneSided.set.movementId)
    result.push({
      id: 'first-one-sided',
      kind: 'first',
      date: workoutById(data, firstOneSided.set.workoutId)?.date ?? '',
      title: 'Впервые по сторонам',
      detail: movement?.name ?? '',
    })
  }

  // ---------- вехи по объёму, ПО КАЖДОМУ УПРАЖНЕНИЮ ----------
  const dateOf = new Map(data.workouts.map((w) => [w.id, w.date]))
  const perMovement = new Map<string, { date: string; reps: number; seconds: number }[]>()
  for (const set of data.sets) {
    const date = dateOf.get(set.workoutId)
    if (!date) continue
    const list = perMovement.get(set.movementId) ?? []
    list.push({ date, reps: set.reps ?? 0, seconds: set.durationSec ?? 0 })
    perMovement.set(set.movementId, list)
  }

  for (const [movementId, entries] of perMovement) {
    const movement = data.movements.find((m) => m.id === movementId)
    if (!movement) continue

    const ordered = entries.toSorted((a, b) => a.date.localeCompare(b.date))
    let reps = 0
    let seconds = 0
    for (const entry of ordered) {
      const beforeReps = reps
      const beforeSeconds = seconds
      reps += entry.reps
      seconds += entry.seconds

      for (const milestone of REP_MILESTONES) {
        if (beforeReps < milestone && reps >= milestone) {
          result.push({
            id: `volume-${movementId}-${milestone}`,
            kind: 'volume',
            date: entry.date,
            title: `${milestone.toLocaleString('ru')} — ${movement.name.toLowerCase()}`,
            detail: 'суммарно за всё время',
          })
        }
      }
      for (const milestone of HOLD_MILESTONES) {
        if (beforeSeconds < milestone && seconds >= milestone) {
          result.push({
            id: `hold-${movementId}-${milestone}`,
            kind: 'volume',
            date: entry.date,
            title: `${formatHold(milestone)} — ${movement.name.toLowerCase()}`,
            detail: 'суммарное время удержания',
          })
        }
      }
    }
  }

  // ---------- возвращение после перерыва ----------
  for (let i = 1; i < finished.length; i++) {
    const previous = finished[i - 1]
    const workout = finished[i]
    if (!previous || !workout) continue
    const gap = daysBetween(previous.date, workout.date)
    if (gap >= COMEBACK_DAYS) {
      result.push({
        id: `return-${workout.id}`,
        kind: 'return',
        date: workout.date,
        title: 'Вернулся',
        detail: `после ${gap} ${plural(gap, 'дня', 'дней', 'дней')} перерыва`,
      })
    }
  }

  // ---------- вехи по числу тренировок ----------
  finished.forEach((workout, index) => {
    const count = index + 1
    if (WORKOUT_MILESTONES.has(count)) {
      result.push({
        id: `workouts-${count}`,
        kind: 'milestone',
        date: workout.date,
        title: `${count} ${plural(count, 'тренировка', 'тренировки', 'тренировок')}`,
        detail: 'записано в журнал',
      })
    }
  })

  // ---------- год с приложением ----------
  const first = finished[0]
  const last = finished.at(-1)
  if (first && last) {
    const years = Math.floor(daysBetween(first.date, last.date) / 365)
    for (let year = 1; year <= years; year++) {
      result.push({
        id: `anniversary-${year}`,
        kind: 'milestone',
        date: last.date,
        title: `${year} ${plural(year, 'год', 'года', 'лет')} тренировок`,
        detail: 'с первой записи',
      })
    }
  }

  // ---------- вехи по стрику ----------
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
