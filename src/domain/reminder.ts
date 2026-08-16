/**
 * Когда и о чём напомнить. Чистая функция от журнала и настроек (Д-3, Д-29).
 *
 * Вся логика напоминания собрана здесь и не размазана по слою уведомлений: планировщик
 * умеет только «поставь вот это на такой-то момент», а решение «надо ли и что написать»
 * принимается один раз и проверяется без Android.
 */

import { addDays, parseLocalDate } from './dates.ts'
import { daysSinceLastWorkout, lastWorkoutDate, suggestedTemplateId, weekProgress } from './selectors.ts'
import type { AppData } from './types.ts'
import { plural } from '../lib/plural.ts'

export interface ReminderPlan {
  at: Date
  title: string
  body: string
}

/** Ближайший момент с этим часом: сегодня, если он ещё впереди, иначе завтра. */
function nextOccurrence(hour: number, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0)
  if (today.getTime() > now.getTime()) return today
  const tomorrow = addDays(now, 1)
  return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hour, 0, 0, 0)
}

/** Сколько дней остаётся до конца недели, включая сегодня (воскресенье — последний). */
function daysLeftInWeek(now: Date): number {
  const mondayBased = (now.getDay() + 6) % 7
  return 7 - mondayBased
}

/**
 * Расписание напоминания или `undefined`, если напоминать не надо.
 *
 * Дни отдыха решают **когда**, недельная цель — **надо ли вообще**. Ни одна половина
 * по отдельности этого не даёт: голый интервал звонит после выполненной нормы,
 * а голая цель не знает, что человек тренировался вчера.
 */
export function reminderPlan(data: AppData, now: Date = new Date()): ReminderPlan | undefined {
  const { remindersOn, restDaysBetweenWorkouts, reminderHour, weeklyTarget } = data.settings
  if (!remindersOn) return undefined

  // норма недели закрыта — отдыхай спокойно. Пересчёт случится при следующем открытии
  // приложения или после тренировки, так что новая неделя своё напоминание получит
  const week = weekProgress(data)
  if (week.done >= week.target) return undefined

  const last = lastWorkoutDate(data)
  // тренировок ещё не было: напоминать не о чем, приложение только поставили
  if (last === undefined) return undefined

  const target = addDays(parseLocalDate(last), restDaysBetweenWorkouts + 1)
  const at = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    reminderHour,
    0,
    0,
    0,
  )

  // отдых уже затянулся сверх нормы — момент в прошлом, двигаем на ближайший вечер.
  // Заодно это и есть правило «проигнорированное не повторяется раньше суток»:
  // сегодняшний час уже прошёл, значит следующее будет завтра
  const when = at.getTime() > now.getTime() ? at : nextOccurrence(reminderHour, now)

  const rest = daysSinceLastWorkout(data)
  const remaining = weeklyTarget - week.done
  const left = daysLeftInWeek(now)

  // неделя поджимает: тренировок осталось больше, чем свободных дней с запасом
  const tight = remaining > 0 && left <= remaining + 1

  const suggested = data.templates.find((t) => t.id === suggestedTemplateId(data))
  const restLabel =
    rest !== undefined && rest >= 2
      ? `${rest - 1} ${plural(rest - 1, 'день', 'дня', 'дней')} отдыха`
      : 'пора'

  return {
    at: when,
    title: 'Пора на площадку',
    body: tight
      ? `${restLabel}. До конца недели ${left} ${plural(left, 'день', 'дня', 'дней')}, ` +
        `а тренировок осталось ${remaining} из ${weeklyTarget}.`
      : `${restLabel}. Следующая — ${suggested?.name ?? 'свободная'}.`,
  }
}

/** Ключ расписания: по нему видно, надо ли перепланировать. */
export function reminderKey(plan: ReminderPlan | undefined): string {
  return plan ? `${plan.at.getTime()}|${plan.body}` : 'нет'
}
