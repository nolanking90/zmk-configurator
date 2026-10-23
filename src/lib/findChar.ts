import type { Action, KeyboardDef, Layout } from '../model/types'
import { canonicalCode, charToKey, findKeycode } from '../data/keycodes'

export interface KeyPath {
  /** layer index the character's key lives on */
  layer: number
  /** key position on that layer */
  key: number
  /** key positions (on lower layers) that must be held to reach the layer */
  layerKeys: { layer: number; key: number }[]
  shift: boolean
}

const isKey = (a: Action | undefined, code: string, mods: number) =>
  a?.type === 'key' && canonicalCode(a.code) === code && (a.mods?.length ?? 0) === mods

/** where on the layout a character is typed, including the layer key to hold */
export function findChar(ch: string, layout: Layout, kb: KeyboardDef): KeyPath | undefined {
  const ck = charToKey(ch, layout.settings.locale)
  if (!ck) return
  const base = canonicalCode(ck.code)
  // a keycode that already includes shift, e.g. EXCL for "!"
  const shifted = ck.shift
    ? KEYCODES_SHIFTED.get(base)
    : undefined
  const n = kb.keys.length
  const candidates: { layer: number; key: number; shift: boolean }[] = []
  layout.layers.forEach((l, li) => {
    for (let i = 0; i < n; i++) {
      const tap = l.keys[i]?.tap
      if (shifted && isKey(tap, shifted, 0)) candidates.push({ layer: li, key: i, shift: false })
      else if (isKey(tap, base, 0)) candidates.push({ layer: li, key: i, shift: ck.shift })
      else if (ck.shift && tap?.type === 'key' && canonicalCode(tap.code) === base && tap.mods?.length === 1 && tap.mods[0].endsWith('SHIFT'))
        candidates.push({ layer: li, key: i, shift: false })
    }
  })
  candidates.sort((a, b) => a.layer - b.layer || Number(a.shift) - Number(b.shift))
  for (const c of candidates) {
    if (c.layer === 0) return { ...c, layerKeys: [] }
    const via = findLayerKey(layout, c.layer)
    if (via) return { ...c, layerKeys: [via] }
  }
}

function findLayerKey(layout: Layout, target: number) {
  const id = layout.layers[target].id
  for (let li = 0; li < target; li++) {
    const keys = layout.layers[li].keys
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      for (const a of [k.hold, k.tap, k.tapHold])
        if (a?.type === 'layer' && a.layer === id && (a.mode === 'mo' || a.mode === 'sl' || a === k.hold)) return { layer: li, key: i }
    }
  }
}

const KEYCODES_SHIFTED = (() => {
  // base code -> shifted symbol keycode (N1 -> EXCL)
  const m = new Map<string, string>()
  for (const ch of '!@#$%^&*()_+{}|:"~<>?') {
    const ck = charToKey(ch, 'us')
    if (!ck) continue
    const def = findKeycode(
      ({ '!': 'EXCL', '@': 'AT', '#': 'HASH', '$': 'DLLR', '%': 'PRCNT', '^': 'CARET', '&': 'AMPS', '*': 'ASTRK', '(': 'LPAR', ')': 'RPAR', '_': 'UNDER', '+': 'PLUS', '{': 'LBRC', '}': 'RBRC', '|': 'PIPE', ':': 'COLON', '"': 'DQT', '~': 'TILDE', '<': 'LT', '>': 'GT', '?': 'QMARK' } as Record<string, string>)[ch],
    )
    if (def) m.set(canonicalCode(ck.code), def.code)
  }
  return m
})()
