// Pure conversions between ZMK Studio RPC data (behavior ids + two uint32
// cells per key) and our Layout model. No I/O here; see ./device.ts for the
// connection and ./sync.ts for the read/write workflows.
//
// Studio identifies behaviors by a device-local numeric id and reports a
// display name for each (ZMK's `display-name` property, or the devicetree node
// name for behaviors without one, e.g. a user's custom hold-tap). We map those
// names to our behavior labels (&kp, &mt, ...).
//
// Layer parameters (&mo, &lt, ...) are layer *ids*, which are stable when
// layers are reordered on the device; Keymap.layers is in index order.

import type { Action, KeyConfig, KeyboardDef, Layer, Mod, Settings } from '../model/types'
import { isModifierCode } from '../data/keycodes'
import { BUILTIN_NODE_NAMES, sanitizeIdent, unwrapMods } from '../zmk/common'
import { decodeKeyParam, encodeKeyParam, formatKeyParam } from './hidUsage'
import { decodeBehaviorParams, encodeBehaviorParams, parseKeyExpr } from './behaviorParams'

// ---- device-side shapes (structurally identical to the ts-client's protobuf types) ----

export interface DeviceBinding {
  behaviorId: number
  param1: number
  param2: number
}

export interface DeviceLayer {
  id: number
  name: string
  bindings: DeviceBinding[]
}

export interface DeviceKeymap {
  layers: DeviceLayer[]
  availableLayers: number
  maxLayerNameLength: number
}

export interface DeviceKeyAttrs {
  width: number
  height: number
  x: number
  y: number
  r: number
  rx: number
  ry: number
}

export interface DevicePhysicalLayout {
  name: string
  keys: DeviceKeyAttrs[]
}

export interface DevicePhysicalLayouts {
  activeLayoutIndex: number
  layouts: DevicePhysicalLayout[]
}

export interface DeviceParamValue {
  name: string
  nil?: object
  constant?: number
  range?: { min: number; max: number }
  hidUsage?: { keyboardMax: number; consumerMax: number }
  layerId?: object
}

export interface DeviceBehavior {
  id: number
  displayName: string
  metadata: { param1: DeviceParamValue[]; param2: DeviceParamValue[] }[]
}

// ---- behavior index -----------------------------------------------------------

/** ZMK v0.3 `display-name`s of the built-in behaviors (app/dts/behaviors/*.dtsi). */
export const DISPLAY_NAME_TO_LABEL: Record<string, string> = {
  'key press': 'kp',
  'mod-tap': 'mt',
  'layer-tap': 'lt',
  'momentary layer': 'mo',
  'toggle layer': 'tog',
  'to layer': 'to',
  'sticky layer': 'sl',
  'sticky key': 'sk',
  transparent: 'trans',
  none: 'none',
  bluetooth: 'bt',
  'output selection': 'out',
  underglow: 'rgb_ug',
  backlight: 'bl',
  'external power': 'ext_power',
  'mouse key press': 'mkp',
  reset: 'sys_reset',
  bootloader: 'bootloader',
  'studio unlock': 'studio_unlock',
  'caps word': 'caps_word',
  'key repeat': 'key_repeat',
  'grave/escape': 'gresc',
  'key toggle': 'kt',
  // not exposed by v0.3, but likely names if a newer firmware adds them
  'mouse move': 'mmv',
  'mouse scroll': 'msc',
  'soft off': 'soft_off',
}

const NODE_NAME_TO_LABEL = new Map(Object.entries(BUILTIN_NODE_NAMES).map(([label, node]) => [node, label]))

export interface IndexedBehavior extends DeviceBehavior {
  /** our label: a built-in (kp, mt, bt...) or a sanitized node name for custom behaviors */
  label: string
  builtin: boolean
}

export interface BehaviorIndex {
  byId: Map<number, IndexedBehavior>
  idByLabel: Map<string, number>
}

/** Label for a device behavior's display name. */
export function labelForDisplayName(displayName: string): { label: string; builtin: boolean } {
  const n = displayName.trim().toLowerCase()
  const b = DISPLAY_NAME_TO_LABEL[n] ?? NODE_NAME_TO_LABEL.get(n)
  if (b) return { label: b, builtin: true }
  const raw = displayName.trim()
  return { label: /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw) ? raw : sanitizeIdent(raw, 'behavior'), builtin: false }
}

export function indexBehaviors(list: DeviceBehavior[]): BehaviorIndex {
  const byId = new Map<number, IndexedBehavior>()
  const idByLabel = new Map<string, number>()
  for (const b of list) {
    const { label, builtin } = labelForDisplayName(b.displayName)
    byId.set(b.id, { ...b, label, builtin })
    if (!idByLabel.has(label)) idByLabel.set(label, b.id)
  }
  return { byId, idByLabel }
}

/** Number of binding cells a behavior takes according to its metadata (0-2). */
export function metadataCells(b: DeviceBehavior | undefined, p1: number, p2: number): number {
  if (!b || !b.metadata.length) return p2 ? 2 : p1 ? 1 : 0
  const real = (vals: DeviceParamValue[]) => vals.some((v) => !v.nil)
  let n = 0
  for (const set of b.metadata) {
    if (real(set.param2)) n = Math.max(n, 2)
    else if (real(set.param1)) n = Math.max(n, 1)
  }
  return n
}

// ---- device -> model ------------------------------------------------------------

export interface ReadContext {
  behaviors: BehaviorIndex
  /** device layer id -> our Layer.id */
  layerRef(deviceLayerId: number): string | undefined
  /** device layer id -> index (for raw bindings) */
  layerIndex(deviceLayerId: number): number | undefined
}

function keyAction(type: 'key' | 'sticky', v: number): Action | undefined {
  const d = decodeKeyParam(v)
  if (!d) return undefined
  return d.mods.length ? { type, code: d.code, mods: d.mods } : { type, code: d.code }
}

function rawBinding(b: DeviceBinding, ctx: ReadContext): Action {
  const beh = ctx.behaviors.byId.get(b.behaviorId)
  const label = beh?.label ?? `unknown_behavior_${b.behaviorId}`
  const cells = metadataCells(beh, b.param1, b.param2)
  const fmt = (v: number, which: 'param1' | 'param2') => {
    const descs = beh?.metadata.flatMap((s) => s[which]) ?? []
    if (descs.some((d) => d.hidUsage) && decodeKeyParam(v)) return formatKeyParam(v)
    if (descs.some((d) => d.layerId)) {
      const i = ctx.layerIndex(v)
      if (i !== undefined) return String(i)
    }
    return String(v)
  }
  const params = [b.param1, b.param2].slice(0, cells).map((v, i) => fmt(v, i ? 'param2' : 'param1'))
  return { type: 'raw', code: ['&' + label, ...params].join(' ') }
}

/**
 * Convert one device binding to a KeyConfig. Never fails: anything that
 * can't be modelled becomes a raw binding (and `warning` says why).
 */
export function bindingToKey(b: DeviceBinding, ctx: ReadContext): { key: KeyConfig; warning?: string } {
  const beh = ctx.behaviors.byId.get(b.behaviorId)
  if (!beh) {
    // ZMK reports unbound positions as behavior id 0
    if (b.behaviorId === 0) return { key: { tap: { type: 'none' } } }
    return { key: { tap: rawBinding(b, ctx) }, warning: `unknown behavior id ${b.behaviorId}` }
  }
  const raw = (why: string) => ({ key: { tap: rawBinding(b, ctx) }, warning: why })
  const layer = (v: number) => ctx.layerRef(v)
  switch (beh.label) {
    case 'none': return { key: { tap: { type: 'none' } } }
    case 'trans': return { key: { tap: { type: 'trans' } } }
    case 'kp': case 'sk': {
      const a = keyAction(beh.label === 'kp' ? 'key' : 'sticky', b.param1)
      return a ? { key: { tap: a } } : raw(`unknown HID usage 0x${b.param1.toString(16)}`)
    }
    case 'mt': {
      const hold = keyAction('key', b.param1)
      const tap = keyAction('key', b.param2)
      return hold && tap ? { key: { tap, hold } } : raw('unknown HID usage in mod-tap')
    }
    case 'lt': {
      const l = layer(b.param1)
      const tap = keyAction('key', b.param2)
      if (!l) return raw(`layer-tap to missing layer id ${b.param1}`)
      return tap ? { key: { tap, hold: { type: 'layer', mode: 'mo', layer: l } } } : raw('unknown HID usage in layer-tap')
    }
    case 'mo': case 'tog': case 'to': case 'sl': {
      const l = layer(b.param1)
      return l ? { key: { tap: { type: 'layer', mode: beh.label, layer: l } } } : raw(`reference to missing layer id ${b.param1}`)
    }
    default: {
      if (!beh.builtin) return raw(`custom behavior “${beh.displayName}”`)
      const params = decodeBehaviorParams(beh.label, b.param1, b.param2)
      if (!params) return raw(`unrecognised parameters for &${beh.label}`)
      return { key: { tap: { type: 'behavior', behavior: beh.label, params } } }
    }
  }
}

export interface ImportedLayers {
  layers: Layer[]
  /** human-readable notes about raw / unknown bindings */
  warnings: string[]
}

/**
 * Convert a device keymap into Layers with `keyCount` keys each.
 * `existing` lets a re-read keep layer ids/colors of the current layout (by index).
 */
export function deviceKeymapToLayers(
  keymap: DeviceKeymap,
  behaviors: BehaviorIndex,
  keyCount: number,
  newId: () => string,
  existing: Pick<Layer, 'id' | 'color'>[] = [],
): ImportedLayers {
  const ids = keymap.layers.map((_, i) => existing[i]?.id ?? newId())
  const idOf = new Map(keymap.layers.map((l, i) => [l.id, ids[i]]))
  const idxOf = new Map(keymap.layers.map((l, i) => [l.id, i]))
  const ctx: ReadContext = { behaviors, layerRef: (v) => idOf.get(v), layerIndex: (v) => idxOf.get(v) }
  const warnings: string[] = []
  const layers = keymap.layers.map((dl, li) => {
    const name = dl.name || (li === 0 ? 'Base' : `Layer ${li}`)
    const keys: KeyConfig[] = []
    for (let p = 0; p < keyCount; p++) {
      const b = dl.bindings[p]
      if (!b) {
        keys.push({ tap: { type: li === 0 ? 'none' : 'trans' } })
        continue
      }
      const r = bindingToKey(b, ctx)
      if (r.warning) warnings.push(`${name}, key ${p}: ${r.warning} — kept as raw “${(r.key.tap as { code: string }).code}”`)
      keys.push(r.key)
    }
    const layer: Layer = { id: ids[li], name, keys }
    const color = existing[li]?.color
    if (color) layer.color = color
    return layer
  })
  return { layers, warnings }
}

// ---- model -> device ------------------------------------------------------------

export interface WriteContext {
  behaviors: BehaviorIndex
  /** our Layer.id -> device layer id */
  layerDeviceId(layerId: string): number | undefined
  settings: Pick<Settings, 'tappingTerm' | 'positionalHoldTap'>
  hands?: KeyboardDef['hands']
}

export type BindingResult = { ok: true; binding: DeviceBinding } | { ok: false; reason: string }

const fail = (reason: string): BindingResult => ({ ok: false, reason })

function behaviorId(ctx: WriteContext, label: string): number | undefined {
  return ctx.behaviors.idByLabel.get(label)
}

function missing(label: string): BindingResult {
  const hint: Record<string, string> = {
    rgb_ug: ' (enable RGB underglow and rebuild)',
    bl: ' (enable backlight and rebuild)',
    mkp: ' (enable pointing / mouse keys and rebuild)',
    mmv: ' (Studio in this firmware cannot set mouse movement)',
    msc: ' (Studio in this firmware cannot set mouse scrolling)',
    soft_off: ' (soft off is not exposed to Studio)',
  }
  return fail(`&${label} is not available to Studio on this keyboard${hint[label] ?? ''}`)
}

function make(ctx: WriteContext, label: string, param1 = 0, param2 = 0): BindingResult {
  const id = behaviorId(ctx, label)
  if (id === undefined) return missing(label)
  return { ok: true, binding: { behaviorId: id, param1: param1 >>> 0, param2: param2 >>> 0 } }
}

function keyValue(a: Action): number | undefined {
  if (a.type !== 'key' && a.type !== 'sticky') return undefined
  return encodeKeyParam(a.code, a.mods)
}

function describeKey(a: Action): string {
  return a.type === 'key' || a.type === 'sticky' ? [...(a.mods ?? []), a.code].join('+') : a.type
}

/** Parse a raw binding like "&my_ht LSHIFT A" or "&bt BT_SEL 1" against the device's behaviors. */
export function rawToBinding(code: string, ctx: WriteContext): BindingResult {
  const m = /^&([A-Za-z_][A-Za-z0-9_]*)((?:\s+\S+)*)\s*$/.exec(code.trim())
  if (!m) return fail(`raw binding “${code}” is not a simple behavior reference`)
  const label = m[1]
  const tokens = m[2].trim() ? m[2].trim().split(/\s+/) : []
  // built-ins we model: route through the regular encoders
  const viaAction = rawAsAction(label, tokens)
  if (viaAction) return actionToBinding(viaAction, ctx)
  if (tokens.length > 2) return fail(`raw binding “${code}” has more than 2 parameters`)
  const id = behaviorId(ctx, label)
  if (id === undefined) return fail(`raw binding “${code}”: &${label} is not on the keyboard (needs a firmware build)`)
  const vals = tokens.map((t) => parseKeyExpr(t))
  if (vals.some((v) => v === undefined)) return fail(`raw binding “${code}”: can't encode its parameters`)
  return { ok: true, binding: { behaviorId: id, param1: vals[0] ?? 0, param2: vals[1] ?? 0 } }
}

function rawAsAction(label: string, t: string[]): Action | undefined {
  const key = (s: string | undefined): { code: string; mods?: Mod[] } | undefined => {
    if (!s) return undefined
    const u = unwrapMods(s)
    if (!u || encodeKeyParam(u.code, u.mods) === undefined) return undefined
    return u.mods.length ? { code: u.code, mods: u.mods } : { code: u.code }
  }
  switch (label) {
    case 'kp': { const k = key(t[0]); return k && t.length === 1 ? { type: 'key', ...k } : undefined }
    case 'sk': { const k = key(t[0]); return k && t.length === 1 ? { type: 'sticky', ...k } : undefined }
    case 'none': case 'trans': return t.length === 0 ? { type: label } : undefined
    default:
      return encodeBehaviorParams(label, t) ? { type: 'behavior', behavior: label, params: t } : undefined
  }
}

/** Binding for a single action (no hold). */
export function actionToBinding(a: Action | undefined, ctx: WriteContext): BindingResult {
  if (!a) return make(ctx, 'none')
  switch (a.type) {
    case 'none': return make(ctx, 'none')
    case 'trans': return make(ctx, 'trans')
    case 'key': case 'sticky': {
      const v = keyValue(a)
      if (v === undefined) return fail(`key code “${a.code}” has no known HID usage`)
      return make(ctx, a.type === 'key' ? 'kp' : 'sk', v)
    }
    case 'layer': {
      const id = ctx.layerDeviceId(a.layer)
      if (id === undefined) return fail('refers to a layer that does not exist on the keyboard')
      return make(ctx, a.mode, id)
    }
    case 'macro': return fail('macro (macros need a firmware build)')
    case 'behavior': {
      const cells = encodeBehaviorParams(a.behavior, a.params)
      if (!cells) return fail(`&${a.behavior} ${a.params.join(' ')}: parameters can't be expressed in Studio`)
      return make(ctx, a.behavior, cells.param1, cells.param2)
    }
    case 'raw': return rawToBinding(a.code, ctx)
  }
}

/**
 * Binding for a full key (tap / hold / double-tap / tap-hold). Mirrors the
 * keymap compiler: only what compiles to &mt / &lt / a plain binding can be
 * written through Studio; everything else needs a firmware build.
 */
export function keyToBinding(k: KeyConfig | undefined, pos: number, ctx: WriteContext): BindingResult {
  if (!k) return make(ctx, 'none')
  if (k.doubleTap || k.tapHold) return fail('tap dance (double-tap / tap-then-hold)')
  if (k.shifted) return fail('shift morph (different output with Shift held)')
  const { tap, hold } = k
  if (!hold) return actionToBinding(tap, ctx)
  if (!tap) return actionToBinding(hold, ctx)
  if (k.tappingTerm !== undefined && k.tappingTerm !== ctx.settings.tappingTerm) return fail(`per-key tapping term (${k.tappingTerm} ms)`)
  if (k.retroTap) return fail('retro-tap (custom hold-tap behavior)')
  if (tap.type === 'key' && hold.type === 'key') {
    if (ctx.settings.positionalHoldTap && isModifierCode(hold.code) && ctx.hands?.[pos]) return fail('positional hold-tap (custom hold-tap behavior)')
    const h = keyValue(hold)
    const t = keyValue(tap)
    if (h === undefined || t === undefined) return fail(`key code without a known HID usage (${describeKey(h === undefined ? hold : tap)})`)
    return make(ctx, 'mt', h, t)
  }
  if (tap.type === 'key' && hold.type === 'layer' && hold.mode === 'mo') {
    const t = keyValue(tap)
    if (t === undefined) return fail(`key code “${tap.code}” has no known HID usage`)
    const l = ctx.layerDeviceId(hold.layer)
    if (l === undefined) return fail('refers to a layer that does not exist on the keyboard')
    return make(ctx, 'lt', l, t)
  }
  return fail(`custom hold-tap (tap: ${describeKey(tap)}, hold: ${hold.type === 'layer' ? `&${hold.mode}` : describeKey(hold)})`)
}

export function sameBinding(a: DeviceBinding | undefined, b: DeviceBinding): boolean {
  return !!a && a.behaviorId === b.behaviorId && a.param1 >>> 0 === b.param1 >>> 0 && a.param2 >>> 0 === b.param2 >>> 0
}

// ---- keyboard matching ----------------------------------------------------------

/** Device physical layout (centi-units, centi-degrees) -> our PhysicalKey units. */
export function devicePhysicalKeys(l: DevicePhysicalLayout): KeyboardDef['keys'] {
  return l.keys.map((k) => {
    const key: KeyboardDef['keys'][number] = { x: k.x / 100, y: k.y / 100 }
    if (k.width && k.width !== 100) key.w = k.width / 100
    if (k.height && k.height !== 100) key.h = k.height / 100
    if (k.r) {
      key.r = k.r / 100
      key.rx = k.rx / 100
      key.ry = k.ry / 100
    }
    return key
  })
}

function centers(keys: KeyboardDef['keys']): [number, number][] {
  const pts = keys.map((k) => [k.x + (k.w ?? 1) / 2, k.y + (k.h ?? 1) / 2] as [number, number])
  const mx = Math.min(...pts.map((p) => p[0]))
  const my = Math.min(...pts.map((p) => p[1]))
  return pts.map(([x, y]) => [x - mx, y - my])
}

/**
 * Catalog keyboards with the same key count as the device's physical layout,
 * best geometric match first (`distance` = mean key-center offset in units).
 */
export function matchKeyboards(
  physical: DevicePhysicalLayout | undefined,
  keyCount: number,
  catalog: KeyboardDef[],
): { kb: KeyboardDef; distance: number }[] {
  const dev = physical && physical.keys.length ? centers(devicePhysicalKeys(physical)) : undefined
  return catalog
    .filter((kb) => kb.keys.length === keyCount)
    .map((kb) => {
      if (!dev) return { kb, distance: Infinity }
      const c = centers(kb.keys)
      let sum = 0
      for (let i = 0; i < c.length; i++) sum += Math.hypot(c[i][0] - dev[i][0], c[i][1] - dev[i][1])
      return { kb, distance: sum / c.length }
    })
    .sort((a, b) => a.distance - b.distance || a.kb.name.localeCompare(b.kb.name))
}
