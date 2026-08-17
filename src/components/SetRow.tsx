import type { MeasuredStep, Side } from '../domain/types.ts'

const SIDE_LABEL: Record<Side, string> = { both: '', left: 'Л', right: 'П' }

/** Подпись строки: «1» или «1 Л». */
export function rowLabel(order: number, side: Side): string {
  return `${order}${SIDE_LABEL[side] ? ` ${SIDE_LABEL[side]}` : ''}`
}

/** Шаг степпера: секунды крутить по одной бессмысленно. */
export function stepAmount(step: MeasuredStep): number {
  return step.unit === 'seconds' ? 5 : 1
}

interface Props {
  order: number
  side: Side
  step: MeasuredStep
  value: number
  done: boolean
  dimmed: boolean
  onChange: (value: number) => void
  onConfirm: () => void
  onUndo: () => void
}

/**
 * Строка подхода. Во время тренировки это единственный элемент, с которым
 * взаимодействуют, поэтому кнопки 56px и никакого текстового ввода —
 * см. docs/design.md#тач-таргеты.
 */
export default function SetRow({
  order,
  side,
  step,
  value,
  done,
  dimmed,
  onChange,
  onConfirm,
  onUndo,
}: Props) {
  const label = rowLabel(order, side)
  const amount = stepAmount(step)
  const timed = step.unit === 'seconds'

  if (done) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-6 font-num text-body text-muted">{label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex h-14 flex-1 items-center gap-3 rounded-ctl bg-accent/15 px-4 text-left"
          aria-label={`Отменить подход ${label}`}
        >
          <span className="text-accent-ink">✓</span>
          <span className="font-num text-value">{value}</span>
          {step.unit === 'seconds' && <span className="text-body text-muted">сек</span>}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${dimmed ? 'opacity-45' : ''}`}>
      <span className="w-6 font-num text-body text-muted">{label}</span>

      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - amount))}
        className="size-14 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
        aria-label="Убавить"
      >
        −
      </button>

      <span className="flex-1 text-center font-num text-set font-semibold">{value}</span>

      <button
        type="button"
        onClick={() => onChange(value + amount)}
        className="size-14 shrink-0 rounded-ctl border border-border bg-surface-2 text-xl"
        aria-label="Прибавить"
      >
        +
      </button>

      {/* на секундных ступенях подход не отмечают, а запускают: галочка означала бы
          «столько я продержусь», то есть обещание вместо факта (Д-34) */}
      <button
        type="button"
        onClick={onConfirm}
        className={`size-14 shrink-0 rounded-ctl text-xl font-semibold ${
          dimmed
            ? "border border-border text-muted"
            : "bg-accent text-on-accent"
        }`}
        aria-label={
          timed ? `Начать удержание, подход ${label}` : `Засчитать подход ${label}`
        }
      >
        {timed ? '▶' : '✓'}
      </button>
    </div>
  )
}
