/**
 * Песочница дизайна — временный код для выбора направления.
 * После выбора победитель переезжает в src/index.css как единственная тема,
 * остальные удаляются вместе с этой папкой.
 */

export interface Palette {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  muted: string
  accent: string
  /** текст поверх залитого акцентом фона */
  onAccent: string
  danger: string
}

export interface Direction {
  id: string
  name: string
  idea: string
  /** скругление карточек */
  radius: string
  /** шрифт для чисел — часть характера направления */
  numFont: string
  light: Palette
  dark: Palette
}

export const DIRECTIONS: Direction[] = [
  {
    id: 'mech',
    name: 'Механика',
    idea: 'Графит и янтарь, как маркировка на станке. Прямые углы, плотная сетка, моноширинные цифры. Инструмент, а не приложение.',
    radius: '0.25rem',
    numFont: 'ui-monospace, "Cascadia Mono", "Roboto Mono", monospace',
    dark: {
      bg: '#0F1113',
      surface: '#191C1F',
      surface2: '#22262A',
      border: '#2C3136',
      text: '#E8E6E3',
      muted: '#878D94',
      accent: '#F5A524',
      onAccent: '#14100A',
      danger: '#E5484D',
    },
    light: {
      bg: '#EDEBE7',
      surface: '#FFFFFF',
      surface2: '#F4F2EE',
      border: '#D5D1CA',
      text: '#16181A',
      muted: '#5F656C',
      accent: '#A85D00',
      onAccent: '#FFFFFF',
      danger: '#C62A2F',
    },
  },
  {
    id: 'sport',
    name: 'Спорт',
    idea: 'Почти чёрный и кислотный лайм. Крупные скругления, много воздуха, очень большие цифры. Громко и современно.',
    radius: '1rem',
    numFont: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    dark: {
      bg: '#09090B',
      surface: '#17171A',
      surface2: '#212125',
      border: '#27272B',
      text: '#FAFAFA',
      muted: '#7C7C85',
      accent: '#BEF264',
      onAccent: '#0A0F02',
      danger: '#F87171',
    },
    light: {
      bg: '#FFFFFF',
      surface: '#F4F4F5',
      surface2: '#E9E9EC',
      border: '#E4E4E7',
      text: '#09090B',
      muted: '#71717A',
      accent: '#4D7C0F',
      onAccent: '#FFFFFF',
      danger: '#DC2626',
    },
  },
  {
    id: 'calm',
    name: 'Тихий',
    idea: 'Сине-серый и спокойный зелёный. Средние скругления, ничего не кричит. Приложение, которое не мешает.',
    radius: '0.75rem',
    numFont: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    dark: {
      bg: '#0B0F14',
      surface: '#141A21',
      surface2: '#1C242D',
      border: '#232C36',
      text: '#E3E9EF',
      muted: '#8496A8',
      accent: '#46C97A',
      onAccent: '#04140A',
      danger: '#F2555A',
    },
    light: {
      bg: '#F7F9FB',
      surface: '#FFFFFF',
      surface2: '#EEF2F6',
      border: '#DFE6EC',
      text: '#0F1720',
      muted: '#5A6B7B',
      accent: '#137A47',
      onAccent: '#FFFFFF',
      danger: '#C4262B',
    },
  },
]

export function paletteVars(palette: Palette, direction: Direction): React.CSSProperties {
  return {
    '--c-bg': palette.bg,
    '--c-surface': palette.surface,
    '--c-surface-2': palette.surface2,
    '--c-border': palette.border,
    '--c-text': palette.text,
    '--c-muted': palette.muted,
    '--c-accent': palette.accent,
    '--c-on-accent': palette.onAccent,
    '--c-danger': palette.danger,
    '--radius': direction.radius,
    '--num-font': direction.numFont,
  } as React.CSSProperties
}
