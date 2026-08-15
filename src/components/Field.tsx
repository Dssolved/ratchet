/**
 * Поля редактора справочника.
 *
 * Здесь текстовый ввод разрешён: запрет на клавиатуру в docs/design.md касается
 * экрана тренировки, а справочник правят дома, сидя.
 */

interface TextFieldProps {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

export function TextField({ label, value, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label tracking-wider text-muted uppercase">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 rounded-ctl border border-border bg-surface-2 px-3 text-text"
      />
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: number | undefined
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}

export function NumberField({
  label,
  value,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  disabled,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-label tracking-wider text-muted uppercase">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
          }}
          className="min-h-12 w-full rounded-ctl border border-border bg-surface-2 px-3 font-num text-text disabled:opacity-40"
        />
        {suffix && <span className="shrink-0 text-body text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

interface ToggleProps {
  label: string
  hint?: string
  value: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

export function Toggle({ label, hint, value, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={value}
      onClick={() => onChange(!value)}
      className="flex min-h-12 items-center justify-between gap-3 rounded-ctl border border-border bg-surface px-3 text-left disabled:opacity-40"
    >
      <span>
        <span className="block text-body">{label}</span>
        {hint && <span className="block text-label text-muted">{hint}</span>}
      </span>
      <span className={`h-6 w-11 shrink-0 rounded-full p-1 ${value ? 'bg-accent' : 'bg-surface-2'}`}>
        <span
          className={`block size-4 rounded-full transition-transform ${
            value ? 'translate-x-5 bg-on-accent' : 'translate-x-0 bg-muted'
          }`}
        />
      </span>
    </button>
  )
}

interface ChoiceProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  disabled?: boolean
  onChange: (value: T) => void
}

export function Choice<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label tracking-wider text-muted uppercase">{label}</span>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-12 flex-1 rounded-ctl border text-body disabled:opacity-40 ${
              option.value === value
                ? 'border-accent-ink bg-accent/15 text-text'
                : 'border-border text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
