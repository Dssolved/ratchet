import type { CapacitorConfig } from '@capacitor/cli'

/**
 * ВНИМАНИЕ: appId менять после первой установки нельзя.
 * Android считает приложение с другим appId другим приложением: старое придётся
 * удалить, а вместе с ним уйдёт вся IndexedDB, то есть весь журнал тренировок.
 * Если менять — то сейчас, до первой установки на телефон.
 */
const config: CapacitorConfig = {
  appId: 'io.github.dssolved.ratchet',
  appName: 'Ratchet',
  webDir: 'dist',
  android: {
    // приложение открывается сразу, без белой вспышки поверх тёмной темы
    backgroundColor: '#0a0a0a',
  },
}

export default config
