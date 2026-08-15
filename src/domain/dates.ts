/**
 * Даты хранятся строкой 'YYYY-MM-DD' в ЛОКАЛЬНОМ времени.
 *
 * Не UTC и не ISO с зоной: иначе вечерняя тренировка уезжает на следующий день
 * и недельные стрики начинают врать. См. docs/data-model.md#даты.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Локальная дата в формате 'YYYY-MM-DD'. */
export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Разбор 'YYYY-MM-DD' в локальную полночь. Бросает на некорректном формате. */
export function parseLocalDate(value: string): Date {
  const parts = value.split('-')
  if (parts.length !== 3) throw new Error(`Некорректная дата: ${value}`)
  const [y, m, d] = parts.map(Number)
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Некорректная дата: ${value}`)
  }
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    throw new Error(`Некорректная дата: ${value}`)
  }
  return new Date(y, m - 1, d)
}

/**
 * Ключ ISO-недели: 'YYYY-Www', понедельник–воскресенье.
 * Год берётся по четвергу недели — так требует ISO 8601 для пограничных недель.
 */
export function isoWeekKey(date: string | Date): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date

  // сдвигаемся на четверг текущей недели: он однозначно задаёт ISO-год
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const mondayBased = (thursday.getDay() + 6) % 7
  thursday.setDate(thursday.getDate() - mondayBased + 3)

  const isoYear = thursday.getFullYear()

  // четверг первой ISO-недели года — тот, что в одной неделе с 4 января
  const jan4 = new Date(isoYear, 0, 4)
  const jan4MondayBased = (jan4.getDay() + 6) % 7
  const firstThursday = new Date(isoYear, 0, 4 - jan4MondayBased + 3)

  // обе даты — локальная полночь четверга, поэтому переход на летнее время
  // даёт погрешность меньше половины суток и снимается округлением
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** Сегодняшний ключ недели. */
export function currentWeekKey(): string {
  return isoWeekKey(new Date())
}

/** Понедельник той недели, в которую попадает дата. */
export function weekStart(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayBased = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - mondayBased)
  return copy
}

/** Сдвиг на N дней. Через setDate, поэтому переход на летнее время не ломает счёт. */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Разница в календарных днях между двумя локальными датами. */
export function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from)
  const b = parseLocalDate(to)
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/** Дата для отображения: '15 авг'. */
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

export function formatDateShort(value: string): string {
  const d = parseLocalDate(value)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()] ?? ''}`
}
