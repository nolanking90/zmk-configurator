// Core data model. Mirrors the ZSA Oryx mental model (tap / hold / double-tap /
// tap-hold per key) and is compiled down to ZMK devicetree by src/zmk/compile.ts.

export type Mod =
  | 'LCTRL' | 'LSHIFT' | 'LALT' | 'LGUI'
  | 'RCTRL' | 'RSHIFT' | 'RALT' | 'RGUI'

export const ALL_MODS: Mod[] = ['LCTRL', 'LSHIFT', 'LALT', 'LGUI', 'RCTRL', 'RSHIFT', 'RALT', 'RGUI']

export type LayerMode = 'mo' | 'tog' | 'to' | 'sl'

export type Action =
  | { type: 'none' }
  | { type: 'trans' }
  /** &kp CODE, optionally wrapped in modifier functions, e.g. LC(LS(A)) */
  | { type: 'key'; code: string; mods?: Mod[] }
  /** &sk — one-shot (sticky) key/modifier */
  | { type: 'sticky'; code: string; mods?: Mod[] }
  /** layer switching; `layer` is a Layer.id (stable across reorder) */
  | { type: 'layer'; mode: LayerMode; layer: string }
  /** reference to Layout.macros[].id */
  | { type: 'macro'; id: string }
  /** any other ZMK behavior: &bt BT_SEL 0, &mkp LCLK, &caps_word, &rgb_ug RGB_TOG ... */
  | { type: 'behavior'; behavior: string; params: string[] }
  /** verbatim binding text, e.g. "&my_custom 1 2" — used for things we can't model */
  | { type: 'raw'; code: string }

export type ActionType = Action['type']

export interface KeyConfig {
  tap?: Action
  hold?: Action
  doubleTap?: Action
  tapHold?: Action
  /** custom label shown on the key instead of the generated one */
  label?: string
  /** hex color, e.g. "#ff8800" */
  color?: string
  /** per-key tapping term override (ms) for dual-function keys */
  tappingTerm?: number
}

export interface Layer {
  id: string
  name: string
  color?: string
  /** one entry per physical key, same order as KeyboardDef.keys */
  keys: KeyConfig[]
}

export interface Combo {
  id: string
  name: string
  /** physical key positions (indexes into KeyboardDef.keys) */
  keys: number[]
  action: Action
  /** layer ids; empty = all layers */
  layers: string[]
  timeout?: number
  requirePriorIdle?: number
  slowRelease?: boolean
}

export type MacroStep =
  | { type: 'tap'; action: Action }
  | { type: 'press'; action: Action }
  | { type: 'release'; action: Action }
  | { type: 'text'; text: string }
  | { type: 'delay'; ms: number }
  | { type: 'pauseForRelease' }

export interface Macro {
  id: string
  name: string
  steps: MacroStep[]
  /** ms between steps (wait-ms), default 15 */
  wait?: number
  /** ms each tap is held (tap-ms), default 15 */
  tap?: number
}

export type HoldTapFlavor = 'hold-preferred' | 'balanced' | 'tap-preferred' | 'tap-unless-interrupted'

export interface Settings {
  tappingTerm: number
  quickTap: number
  requirePriorIdle: number
  holdTapFlavor: HoldTapFlavor
  /** "positional hold-tap": only trigger hold when the other key is on the opposite hand */
  positionalHoldTap: boolean
  holdTriggerOnRelease: boolean
  tapDanceTerm: number
  comboTimeout: number
  stickyKeyTimeout: number
  stickyQuickRelease: boolean
  /** OS keyboard language, affects labels and text macros. "us" = default */
  locale: string
  /** ZMK git revision used in west.yml, e.g. "v0.3" or "main" */
  zmkRevision: string

  // Kconfig (.conf) options
  sleepEnabled: boolean
  sleepTimeoutMin: number
  idleTimeoutSec: number
  rgbUnderglow: boolean
  rgbAutoOffIdle: boolean
  backlight: boolean
  display: boolean
  studio: boolean
  pointing: boolean
  nkro: boolean
  bleTxPowerPlus8: boolean
  btMaxConnections: number
  splitBatteryFetching: boolean
  usbLogging: boolean
  debounceMs: number
  /** extra raw Kconfig lines appended to the .conf */
  extraConf: string
  /** extra raw devicetree appended inside the root node of the .keymap */
  extraKeymap: string
}

export interface Layout {
  id: string
  name: string
  description: string
  tags: string[]
  keyboard: string
  /** controller board used for shield-based keyboards, e.g. nice_nano_v2 */
  controller?: string
  layers: Layer[]
  combos: Combo[]
  macros: Macro[]
  settings: Settings
  createdAt: number
  updatedAt: number
}

export interface Revision {
  id: string
  layoutId: string
  createdAt: number
  message: string
  snapshot: Layout
}

// ---- physical keyboards -----------------------------------------------------

export interface PhysicalKey {
  /** position/size in key units (1u = 1 standard key) */
  x: number
  y: number
  w?: number
  h?: number
  /** rotation in degrees, clockwise, around (rx, ry) */
  r?: number
  rx?: number
  ry?: number
}

export interface BuildTarget {
  board: string
  shield?: string
}

export interface KeyboardDef {
  id: string
  name: string
  /** base name for config files: <zmkName>.keymap / <zmkName>.conf */
  zmkName: string
  /** 'shield' needs a controller board; 'board' is a complete keyboard */
  kind: 'shield' | 'board'
  /** for shields: shield names to build (e.g. ["corne_left", "corne_right"]) */
  shields?: string[]
  /** for boards: board names to build (e.g. ["glove80_lh", "glove80_rh"]) */
  boards?: string[]
  /** default controller for shields */
  defaultController?: string
  split: boolean
  keys: PhysicalKey[]
  /** index of the first right-half key for split boards' hand detection; optional */
  hands?: ('L' | 'R')[]
  /** extra devicetree / includes needed in the keymap, rarely used */
  notes?: string
  source?: string
}
