import { create } from 'zustand'

/**
 * Таймер удержания для секундных ступеней — планка и всё, что меряется временем (Д-34).
 *
 * Вместо галочки на строке подхода стоит «Старт»: степпер задаёт цель, таймер её
 * отсчитывает, по нулю подход записывается сам. Прежний порядок требовал выставить
 * число, которое ещё не выполнено, и подтвердить его на честном слове.
 *
 * Как и отдых, хранит МОМЕНТ, а не остаток: свернул приложение, вернулся — время верное.
 * В отличие от отдыха НЕ переживает перезапуск WebView: удержание длится меньше минуты
 * и делается глядя в экран, а восстановленная планка, которую ты уже бросил, врала бы
 * в журнал.
 *
 * Сам факт в журнал пишет компонент строки: здесь только время, без знания о подходах.
 */

/** Секунды на изготовку: нажать «Старт», уже стоя в упоре, невозможно. */
export const PREROLL_SEC = 3

/**
 * Короче этого остановку считаем промахом по кнопке и не записываем.
 * Иначе журнал копил бы планки по три секунды.
 */
export const MIN_LOGGED_SEC = 5

/** Ключ строки: у односторонних ступеней таймер идёт на конкретную сторону. */
export interface HoldRow {
  workoutId: string
  movementId: string
  order: number
  side: string
}

export function holdKey(row: HoldRow): string {
  return `${row.workoutId}:${row.movementId}:${row.order}:${row.side}`
}

interface HoldTimerState {
  /** какая строка бежит, null — не бежит ни одна */
  key: string | null
  /** момент начала самого удержания, уже после изготовки */
  startsAt: number
  /** момент, когда цель будет достигнута */
  endsAt: number
  /** цель, секунды */
  targetSec: number

  start: (key: string, targetSec: number) => void
  stop: () => void
}

export const useHoldTimer = create<HoldTimerState>()((set) => ({
  key: null,
  startsAt: 0,
  endsAt: 0,
  targetSec: 0,

  start: (key, targetSec) => {
    const startsAt = Date.now() + PREROLL_SEC * 1000
    set({ key, startsAt, endsAt: startsAt + targetSec * 1000, targetSec })
  },

  stop: () => {
    set({ key: null, startsAt: 0, endsAt: 0, targetSec: 0 })
  },
}))
