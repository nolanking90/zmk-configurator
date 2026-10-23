import type { Action, KeyConfig, Layout, Mod } from '../model/types'
import { findKeycode, isModifierCode } from '../data/keycodes'
import { localeLabel } from '../data/locales'
import { BEHAVIOR_PRESETS, getBehavior } from '../data/behaviors'

/** keycap legends for modifiers; words read better than ⌃⇧⌥ at keycap size */
export const MOD_SYMBOL: Record<Mod, string> = {
  LCTRL: 'Ctrl', RCTRL: 'R Ctrl',
  LSHIFT: 'Shift', RSHIFT: 'R Shift',
  LALT: 'Alt', RALT: 'R Alt',
  LGUI: 'GUI', RGUI: 'R GUI',
}

export const MOD_NAME: Record<Mod, string> = {
  LCTRL: 'L Ctrl', RCTRL: 'R Ctrl',
  LSHIFT: 'L Shift', RSHIFT: 'R Shift',
  LALT: 'L Alt', RALT: 'R Alt / AltGr',
  LGUI: 'L GUI', RGUI: 'R GUI',
}

export const LAYER_MODE_NAME = {
  mo: 'Momentary',
  tog: 'Toggle',
  to: 'Switch to',
  sl: 'One-shot',
} as const

const LAYER_MODE_PREFIX = { mo: 'MO', tog: 'TG', to: 'TO', sl: 'OSL' } as const

export function keyLabel(code: string, locale = 'us'): string {
  const mod = isModifierCode(code)
  if (mod) return MOD_SYMBOL[mod]
  if (locale !== 'us') {
    const l = localeLabel(code, locale)
    if (l) return l.label
  }
  return findKeycode(code)?.label ?? code
}

export function keyShiftLabel(code: string, locale = 'us'): string | undefined {
  if (locale !== 'us') return localeLabel(code, locale)?.shiftLabel
  return findKeycode(code)?.shiftLabel
}

function modPrefix(mods?: Mod[]) {
  return (mods ?? []).map((m) => MOD_SYMBOL[m] + '+').join('')
}

/** short keycap legend for an action */
export function actionLabel(a: Action | undefined, layout: Layout): string {
  if (!a) return ''
  const locale = layout.settings.locale
  switch (a.type) {
    case 'none':
      return ''
    case 'trans':
      return '▽'
    case 'key':
      return modPrefix(a.mods) + keyLabel(a.code, locale)
    case 'sticky':
      return 'OS ' + modPrefix(a.mods) + keyLabel(a.code, locale)
    case 'layer': {
      const idx = layout.layers.findIndex((l) => l.id === a.layer)
      const name = idx >= 0 ? layout.layers[idx].name : '?'
      return `${LAYER_MODE_PREFIX[a.mode]} ${name}`
    }
    case 'macro':
      return layout.macros.find((m) => m.id === a.id)?.name ?? 'Macro?'
    case 'behavior': {
      const p = BEHAVIOR_PRESETS.find(
        (p) => p.behavior === a.behavior && p.params.join(' ') === a.params.join(' '),
      )
      if (p) return p.label
      const b = getBehavior(a.behavior)
      return [b?.name ?? a.behavior, ...a.params].join(' ')
    }
    case 'raw':
      return a.code.replace(/^&/, '')
  }
}

/** longer human description for tooltips / editor headers */
export function actionDescription(a: Action | undefined, layout: Layout): string {
  if (!a) return 'Nothing'
  switch (a.type) {
    case 'none':
      return 'No action'
    case 'trans':
      return 'Transparent (falls through to lower layer)'
    case 'key': {
      const k = findKeycode(a.code)
      const mods = (a.mods ?? []).map((m) => MOD_NAME[m])
      return [...mods, k?.name ?? a.code].join(' + ')
    }
    case 'sticky': {
      const k = findKeycode(a.code)
      return 'One-shot ' + [...(a.mods ?? []).map((m) => MOD_NAME[m]), k?.name ?? a.code].join(' + ')
    }
    case 'layer': {
      const l = layout.layers.find((l) => l.id === a.layer)
      return `${LAYER_MODE_NAME[a.mode]} layer: ${l?.name ?? '(deleted layer)'}`
    }
    case 'macro':
      return 'Macro: ' + (layout.macros.find((m) => m.id === a.id)?.name ?? '(deleted macro)')
    case 'behavior': {
      const p = BEHAVIOR_PRESETS.find(
        (p) => p.behavior === a.behavior && p.params.join(' ') === a.params.join(' '),
      )
      if (p) return p.name
      return getBehavior(a.behavior)?.name ?? `&${a.behavior} ${a.params.join(' ')}`
    }
    case 'raw':
      return 'Custom binding: ' + a.code
  }
}

export function isEmptyAction(a?: Action) {
  return !a || a.type === 'none'
}

export function keyIsDual(k: KeyConfig) {
  return !!(k.hold && k.hold.type !== 'none') || !!k.doubleTap || !!k.tapHold
}

/** layer id that a key leads to (for coloring keys like Oryx does) */
export function keyTargetLayer(k: KeyConfig): string | undefined {
  for (const a of [k.tap, k.hold, k.doubleTap, k.tapHold, k.shifted]) if (a?.type === 'layer') return a.layer
}

export function sameAction(a?: Action, b?: Action) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
