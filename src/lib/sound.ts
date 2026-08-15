/**
 * Короткий тон на конец отдыха — для случая, когда приложение открыто и экран горит.
 *
 * Почему только для переднего плана: свёрнутому WebView система приостанавливает
 * аудио вместе со всем остальным, поэтому звук из приложения не сыграет ровно тогда,
 * когда он нужнее всего — с телефоном в кармане. Тот случай закрывает звук
 * уведомления, который проигрывает система (см. ensureRestChannel).
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

/** Две короткие ноты — заметно, но не похоже на будильник. */
export function playRestTone(): void {
  const ctx = getContext()
  if (!ctx || ctx.state !== 'running') return

  const play = (startAt: number, frequency: number) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency

    // мягкие фронты: щелчок на резком старте и обрыве раздражает сильнее самого сигнала
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(0.25, startAt + 0.02)
    gain.gain.setValueAtTime(0.25, startAt + 0.12)
    gain.gain.linearRampToValueAtTime(0, startAt + 0.18)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.2)
  }

  const now = ctx.currentTime
  play(now, 880)
  play(now + 0.22, 1174)
}
