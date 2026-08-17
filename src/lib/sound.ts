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
 * Сигнал конца отдыха и удержания: «ди-ди · ди-ди».
 *
 * Выбран на площадке из четырёх вариантов (Д-33) — короткие одинаковые пики бьют через
 * уличный шум лучше, чем мелодия из разных нот: разбирать интервалы на ветру не нужно,
 * узнаётся сам рисунок. Проигранные и отвергнутые варианты остались в истории коммитов.
 */
const REST_TONE: Note[] = [
  { at: 0, hz: 1318, dur: 0.09 },
  { at: 0.13, hz: 1318, dur: 0.09 },
  { at: 0.42, hz: 1318, dur: 0.09 },
  { at: 0.55, hz: 1318, dur: 0.09 },
]

export function playTone(): void {
  play(REST_TONE)
}

/** Обратный отсчёт перед удержанием: три щелчка, чтобы успеть встать в упор. */
export function playTick(): void {
  play([{ at: 0, hz: 660, dur: 0.06, gain: LEVEL * 0.5 }])
}
