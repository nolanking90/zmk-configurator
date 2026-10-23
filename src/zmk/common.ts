// Helpers shared by the ZMK compiler and importer.
import type { Mod } from '../model/types'
import { MOD_FUNCTIONS } from '../data/keycodes'

/** Behavior labels defined by ZMK's behaviors.dtsi (v0.3) plus macro controls. */
export const BUILTIN_BEHAVIOR_LABELS = new Set([
  'kp', 'mt', 'lt', 'mo', 'tog', 'to', 'sl', 'sk', 'trans', 'none', 'bt', 'out', 'rgb_ug',
  'caps_word', 'key_repeat', 'mkp', 'mmv', 'msc', 'bootloader', 'sys_reset', 'ext_power', 'bl',
  'gresc', 'kt', 'soft_off', 'studio_unlock', 'inc_dec_kp',
  'macro_tap', 'macro_press', 'macro_release', 'macro_tap_time', 'macro_wait_time',
  'macro_pause_for_release', 'macro_param_1to1', 'macro_param_1to2', 'macro_param_2to1',
  'macro_param_2to2',
])

/** C / devicetree words we never want to emit as a label or a #define. */
const RESERVED = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed',
  'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile',
  'while', 'defined', 'keymap', 'behaviors', 'combos', 'macros', 'chosen', 'aliases',
])

/** Lowercase devicetree-safe identifier (valid both as a node name and a label). */
export function sanitizeIdent(name: string, fallback = 'x'): string {
  let s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!s) s = fallback
  if (/^[0-9]/.test(s)) s = `${fallback}_${s}`
  return s
}

/** Make `base` unique within `used` (adds it). */
export function uniqueName(base: string, used: Set<string>): string {
  let n = base
  for (let i = 2; used.has(n) || RESERVED.has(n); i++) n = `${base}_${i}`
  used.add(n)
  return n
}

/** Wrap a key code in modifier functions: (A, [LCTRL, LSHIFT]) -> LC(LS(A)) */
export function wrapMods(code: string, mods?: Mod[]): string {
  let out = code
  if (mods) for (let i = mods.length - 1; i >= 0; i--) out = `${MOD_FUNCTIONS[mods[i]]}(${out})`
  return out
}

let modFnInverse: Record<string, Mod> | undefined
export function modFunctionToMod(fn: string): Mod | undefined {
  if (!modFnInverse) {
    modFnInverse = {}
    for (const [mod, f] of Object.entries(MOD_FUNCTIONS) as [Mod, string][]) modFnInverse[f] = mod
  }
  return modFnInverse[fn]
}

/** Parse LC(LS(A)) -> { code: 'A', mods: [LCTRL, LSHIFT] }. Returns undefined for anything else. */
export function unwrapMods(param: string): { code: string; mods: Mod[] } | undefined {
  const mods: Mod[] = []
  let s = param.replace(/\s+/g, '')
  for (;;) {
    const m = /^([A-Z]{2})\((.*)\)$/.exec(s)
    if (!m) break
    const mod = modFunctionToMod(m[1])
    if (!mod) return undefined
    mods.push(mod)
    s = m[2]
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return undefined
  return { code: s, mods }
}

export const METADATA_PREFIX = 'zmk-configurator:'
export const METADATA_RE = /\/\*\s*zmk-configurator:([A-Za-z0-9+/=]+)\s*\*\//

/** #binding-cells of ZMK's built-in behaviors at v0.3 (app/dts/behaviors/*.dtsi). */
export const BUILTIN_CELLS: Record<string, number> = {
  kp: 1, mt: 2, lt: 2, mo: 1, tog: 1, to: 1, sl: 1, sk: 1, kt: 1, trans: 0, none: 0,
  bt: 2, bl: 2, rgb_ug: 2, out: 1, ext_power: 1, mkp: 1, mmv: 1, msc: 1,
  caps_word: 0, key_repeat: 0, gresc: 0, sys_reset: 0, bootloader: 0, soft_off: 0, studio_unlock: 0,
}

/** Builtin behavior label -> node name under /behaviors (for re-emitting overrides). */
export const BUILTIN_NODE_NAMES: Record<string, string> = {
  bl: 'bcklight', bootloader: 'bootload', bt: 'bluetooth', caps_word: 'caps_word', ext_power: 'extpower',
  gresc: 'grave_escape', key_repeat: 'key_repeat', kp: 'key_press', kt: 'key_toggle', lt: 'layer_tap',
  mkp: 'mouse_key_press', mo: 'momentary_layer', mt: 'mod_tap', none: 'none', out: 'outputs',
  rgb_ug: 'rgb_ug', sk: 'sticky_key', sl: 'sticky_layer', soft_off: 'z_so_off', studio_unlock: 'studio_unlock',
  sys_reset: 'sysreset', tog: 'toggle_layer', to: 'to_layer', trans: 'transparent',
}
