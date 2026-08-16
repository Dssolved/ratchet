/**
 * Иконки нижнего меню. Четыре инлайновых SVG, без библиотеки (Д-26).
 *
 * Нижнее меню ловится боковым зрением, а четыре текстовые вкладки различаются только
 * чтением — то же соображение, по которому в Д-17 переименовывались упражнения.
 * Подписи при этом остаются: иконка ускоряет попадание, а не заменяет слово.
 *
 * Все — `currentColor` и `stroke-width: 2`, поэтому активное состояние красится тем же
 * правилом, что и подпись (`text` против `muted`), и ни одного цвета мимо токена.
 */

type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * Сегодня — перекладина. Единственный знак, говорящий про этот проект, а не про
 * абстрактный «главный экран». Зуб храповика сюда не годится: это знак приложения
 * целиком, и внутри одного раздела он поместил бы приложение внутрь себя.
 */
export function TodayIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h18" />
      <path d="M6 6v14" />
      <path d="M18 6v14" />
      {/* Пробовал добавить насечки хвата под перекладиной — знак стал читаться
          как четыре стойки подряд. Три штриха и подпись работают лучше. */}
    </svg>
  )
}

/** Прогресс — лесенка вверх. Метафора продукта, а не просто «график». */
export function ProgressIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 20v-4h6v-4h6V8h6" />
    </svg>
  )
}

/** Профиль — медаль. Вкладка про достижения, а не про аккаунт: человечек соврал бы. */
export function ProfileIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 3l2.5 6.5" />
      <path d="M16 3l-2.5 6.5" />
      <circle cx="12" cy="15" r="5.5" />
    </svg>
  )
}

/** Настройки — ползунки. */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8h16" />
      <circle cx="15" cy="8" r="2" />
      <path d="M4 16h16" />
      <circle cx="9" cy="16" r="2" />
    </svg>
  )
}
