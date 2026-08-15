import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Ловушка исключений.
 *
 * Без неё любая ошибка рендера даёт белый экран без единого слова — человек решает,
 * что приложение сломалось насмерть, и в худшем случае переустанавливает его,
 * теряя весь журнал. Поэтому здесь важнее всего сказать вслух: **данные целы**.
 *
 * Экспорт доступен прямо отсюда: если приложение падает на каком-то экране, сначала
 * надо дать человеку вынести журнал, а уже потом разбираться.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // единственное место, где консоль оправдана: в APK это единственный способ
    // увидеть стек — через chrome://inspect, см. docs/android.md
    // oxlint-disable-next-line no-console
    console.error('Ratchet упал:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pt-16">
        <h1 className="text-title font-semibold">Что-то сломалось</h1>

        <p className="text-body text-muted">
          Тренировки и настройки <span className="text-text">не потеряны</span> — они лежат
          в хранилище телефона и не зависят от этого экрана.
        </p>

        <div className="rounded-card border border-border bg-surface p-4">
          <p className="font-num text-body break-words text-danger">{error.message}</p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-14 rounded-ctl bg-accent font-semibold text-on-accent"
        >
          Перезапустить
        </button>

        <p className="text-body text-muted">
          Если не помогает — сделай экспорт из настроек на всякий случай и напиши, что
          было на экране перед падением.
        </p>
      </div>
    )
  }
}
