import type { KeyConfig, Layer, Layout, Settings } from './types'

export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const defaultSettings = (): Settings => ({
  tappingTerm: 200,
  quickTap: 150,
  requirePriorIdle: 0,
  holdTapFlavor: 'balanced',
  positionalHoldTap: false,
  holdTriggerOnRelease: false,
  holdWhileUndecided: false,
  tapDanceTerm: 200,
  comboTimeout: 50,
  stickyKeyTimeout: 1000,
  stickyQuickRelease: true,
  locale: 'us',
  zmkRevision: 'v0.3',

  sleepEnabled: true,
  sleepTimeoutMin: 15,
  idleTimeoutSec: 30,
  rgbUnderglow: false,
  rgbAutoOffIdle: true,
  backlight: false,
  display: false,
  studio: false,
  pointing: false,
  nkro: false,
  bleTxPowerPlus8: false,
  btMaxConnections: 5,
  splitBatteryFetching: true,
  usbLogging: false,
  debounceMs: 5,
  extraConf: '',
  extraKeymap: '',
})

export const emptyKeys = (n: number): KeyConfig[] =>
  Array.from({ length: n }, () => ({ tap: { type: 'trans' } }))

export const newLayer = (name: string, keyCount: number, base = false): Layer => ({
  id: uid(),
  name,
  keys: base
    ? Array.from({ length: keyCount }, () => ({ tap: { type: 'none' } }))
    : emptyKeys(keyCount),
})

export const newLayout = (keyboard: string, keyCount: number, name = 'Untitled layout'): Layout => ({
  id: uid(),
  name,
  description: '',
  tags: [],
  keyboard,
  layers: [newLayer('Base', keyCount, true)],
  combos: [],
  macros: [],
  settings: defaultSettings(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
