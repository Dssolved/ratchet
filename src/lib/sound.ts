/**
 * Тон конца отдыха и удержания — для случая, когда приложение открыто и экран горит.
 *
 * Разделение труда с уведомлением (Д-33): звучит ровно один сигнал. Смотришь в экран —
 * играет этот тон, а запланированное уведомление снимается за пару секунд до срабатывания.
 * Телефон в кармане — тон молчит, будит системный звук уведомления. Раньше в потушенный
 * экран прилетали оба сразу.
 *
 * Громкость здесь наша: тон играет в аудиопоток приложения, а не в поток уведомлений,
 * которым владеет системный ползунок. Поэтому единственный способ сделать сигнал заметнее
 * на улице — крутить эти цифры.
 */

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (context) return context
  try {
    const Ctor = window.AudioContext
    if (!Ctor) return null
    context = new Ctor()
    return context
  } catch {
    return null
  }
}

/**
 * Браузеры не дают запускать звук без жеста пользователя, а конец отдыха — не жест.
 * Поэтому контекст создаётся и раскрывается заранее, на отметке подхода: она жест
 * и всегда предшествует отдыху.
 */
export function unlockAudio(): void {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

interface Note {
  /** сдвиг от начала сигнала, секунды */
  at: number
  hz: number
  /** длительность звучания, секунды */
  dur: number
  /** 0..1 */
  gain?: number
}

/** Базовая громкость. Прежние 0.25 на улице терялись. */
const LEVEL = 0.7

function play(notes: Note[]): void {
  const ctx = getContext()
  if (!ctx || ctx.state !== 'running') return

  const start = ctx.currentTime
  for (const note of notes) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = note.hz

    const at = start + note.at
    const peak = note.gain ?? LEVEL

    // мягкие фронты: щелчок на резком старте и обрыве раздражает сильнее самого сигнала
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(peak, at + 0.015)
    gain.gain.setValueAtTime(peak, at + note.dur * 0.7)
    gain.gain.linearRampToValueAtTime(0, at + note.dur)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(at)
    oscillator.stop(at + note.dur + 0.02)
  }
}

/**
 * Варианты сигнала конца отдыха.
 *
 * Выбирать их в браузере бессмысленно: судить надо на площадке, на ветру, с телефоном
 * на земле. Поэтому они временно вынесены кнопками в «Настройки» — послушать
 * на месте и оставить один (Д-33).
 */
export type ToneVariant = 'two' | 'rising' | 'double' | 'gong'

export const TONE_VARIANTS: { id: ToneVariant; name: string; hint: string }[] = [
  { id: 'two', name: 'Две ноты', hint: 'как было, но громче' },
  { id: 'rising', name: 'Три вверх', hint: 'длиннее, с направлением' },
  { id: 'double', name: 'Двойной сигнал', hint: 'рисунок «ди-ди · ди-ди»' },
  { id: 'gong', name: 'Низкий', hint: 'мягче, но плотнее' },
]

const TONES: Record<ToneVariant, Note[]> = {
  two: [
    { at: 0, hz: 880, dur: 0.18 },
    { at: 0.22, hz: 1174, dur: 0.18 },
  ],
  rising: [
    { at: 0, hz: 784, dur: 0.14 },
    { at: 0.16, hz: 1046, dur: 0.14 },
    { at: 0.32, hz: 1568, dur: 0.3 },
  ],
  double: [
    { at: 0, hz: 1318, dur: 0.09 },
    { at: 0.13, hz: 1318, dur: 0.09 },
    { at: 0.42, hz: 1318, dur: 0.09 },
    { at: 0.55, hz: 1318, dur: 0.09 },
  ],
  gong: [
    { at: 0, hz: 392, dur: 0.5 },
    { at: 0, hz: 588, dur: 0.5, gain: LEVEL * 0.4 },
  ],
}

/** Пока варианты не выбраны на площадке, звучит этот. */
export const CURRENT_TONE: ToneVariant = 'rising'

export function playTone(variant: ToneVariant = CURRENT_TONE): void {
  play(TONES[variant])
}

/** Обратный отсчёт перед удержанием: три щелчка, чтобы успеть встать в упор. */
export function playTick(): void {
  play([{ at: 0, hz: 660, dur: 0.06, gain: LEVEL * 0.5 }])
}
