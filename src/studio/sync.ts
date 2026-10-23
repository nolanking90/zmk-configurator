// Read / write workflows between a Layout and a ZMK Studio device.
// planWrite() is pure (unit-tested); applyWrite() drives a StudioDevice.

import type { KeyboardDef, Layout } from '../model/types'
import { newLayout, uid } from '../model/defaults'
import {
  deviceKeymapToLayers, indexBehaviors, keyToBinding, sameBinding,
  type BehaviorIndex, type DeviceBehavior, type DeviceBinding, type DeviceKeymap, type DevicePhysicalLayouts,
} from './convert'
import type { StudioDevice } from './device'

/** Everything read from the keyboard in one go. */
export interface DeviceSnapshot {
  name: string
  keymap: DeviceKeymap
  physical: DevicePhysicalLayouts
  behaviors: DeviceBehavior[]
  index: BehaviorIndex
}

export async function readDevice(dev: StudioDevice, onProgress?: (msg: string) => void): Promise<DeviceSnapshot> {
  onProgress?.('Reading physical layout…')
  const physical = await dev.getPhysicalLayouts()
  onProgress?.('Reading behaviors…')
  const behaviors = await dev.getBehaviors((d, t) => onProgress?.(`Reading behaviors… ${d}/${t}`))
  onProgress?.('Reading keymap…')
  const keymap = await dev.getKeymap()
  return { name: dev.info.name, keymap, physical, behaviors, index: indexBehaviors(behaviors) }
}

/** Number of keys the device's active physical layout has (falls back to binding count). */
export function deviceKeyCount(s: Pick<DeviceSnapshot, 'keymap' | 'physical'>): number {
  const active = s.physical.layouts[s.physical.activeLayoutIndex]
  if (active?.keys.length) return active.keys.length
  return s.keymap.layers[0]?.bindings.length ?? 0
}

/** Build a new Layout (for catalog keyboard `kb`) from a device snapshot. */
export function snapshotToLayout(s: DeviceSnapshot, kb: KeyboardDef): { layout: Layout; warnings: string[] } {
  const n = kb.keys.length
  const layout = newLayout(kb.id, n, `${s.name || kb.name} (from keyboard)`)
  const r = deviceKeymapToLayers(s.keymap, s.index, n, uid)
  layout.layers = r.layers.length ? r.layers : layout.layers
  layout.settings.studio = true
  const has = (l: string) => s.index.idByLabel.has(l)
  if (has('rgb_ug')) layout.settings.rgbUnderglow = true
  if (has('bl')) layout.settings.backlight = true
  if (has('mkp')) layout.settings.pointing = true
  const warnings = [...r.warnings]
  if (deviceKeyCount(s) !== n) warnings.unshift(`The keyboard reports ${deviceKeyCount(s)} keys but ${kb.name} has ${n}; extra positions were dropped or filled with &none.`)
  return { layout, warnings }
}

// ---- writing --------------------------------------------------------------------

export interface PlannedChange {
  layer: number
  deviceLayerId: number
  position: number
  binding: DeviceBinding
}

export interface SkippedKey {
  layer: number
  layerName: string
  position: number
  reason: string
}

export interface WritePlan {
  /** layers to append on the device before writing bindings */
  addLayers: number
  /** device layer indexes to remove (highest first) */
  removeLayers: number[]
  renames: { deviceLayerId: number; layer: number; name: string }[]
  changes: PlannedChange[]
  unchanged: number
  skipped: SkippedKey[]
  /** things Studio never stores (combos, macros, settings...) */
  notes: string[]
  /** problems that block writing entirely */
  errors: string[]
}

/** ZMK's add_layer() picks the lowest unused layer id. */
function simulateAdd(keymap: DeviceKeymap, count: number, keyCount: number): DeviceKeymap {
  const layers = keymap.layers.slice()
  const used = new Set(layers.map((l) => l.id))
  for (let i = 0; i < count; i++) {
    let id = 0
    while (used.has(id)) id++
    used.add(id)
    // unknown content: an impossible behavior id makes every key count as a change
    layers.push({ id, name: '', bindings: Array.from({ length: keyCount }, () => ({ behaviorId: -1, param1: 0, param2: 0 })) })
  }
  return { ...keymap, layers, availableLayers: keymap.availableLayers - count }
}

export interface PlanOptions {
  /** remove device layers beyond the layout's layer count (default true) */
  removeExtraLayers?: boolean
}

/**
 * Work out what to send. Our layer i maps to the device layer at index i;
 * key positions are the keymap's binding order (KeyboardDef.keys order).
 * If layers must be added, the plan is computed against simulated new layers;
 * applyWrite() re-plans against the real ones after adding them.
 */
export function planWrite(layout: Layout, kb: KeyboardDef, keymap: DeviceKeymap, index: BehaviorIndex, opts: PlanOptions = {}): WritePlan {
  const removeExtra = opts.removeExtraLayers ?? true
  const plan: WritePlan = { addLayers: 0, removeLayers: [], renames: [], changes: [], unchanged: 0, skipped: [], notes: [], errors: [] }
  const want = layout.layers.length
  const have = keymap.layers.length
  const keyCount = kb.keys.length
  const deviceKeys = keymap.layers[0]?.bindings.length ?? keyCount

  if (!index.idByLabel.has('kp')) plan.errors.push('The keyboard did not report the &kp behavior; cannot write.')
  if (deviceKeys < keyCount) {
    plan.notes.push(`The keyboard has ${deviceKeys} key positions but ${kb.name} has ${keyCount}; positions ${deviceKeys}–${keyCount - 1} are skipped. Is this the right keyboard?`)
  } else if (deviceKeys > keyCount) {
    plan.notes.push(`The keyboard has ${deviceKeys} key positions but ${kb.name} has ${keyCount}; positions from ${keyCount} on are left unchanged. Is this the right keyboard?`)
  }

  let km = keymap
  if (want > have) {
    const free = keymap.availableLayers
    const add = Math.min(want - have, free)
    if (add < want - have) {
      plan.errors.push(`The layout has ${want} layers but the keyboard only has room for ${have + free}. Remove layers or rebuild the firmware with more layers (e.g. empty extra layers in the keymap).`)
    }
    plan.addLayers = add
    km = simulateAdd(keymap, add, deviceKeys)
  } else if (want < have && removeExtra) {
    for (let i = have - 1; i >= want; i--) plan.removeLayers.push(i)
  }

  const deviceIdByLayerId = new Map<string, number>()
  layout.layers.forEach((l, i) => {
    const dl = km.layers[i]
    if (dl) deviceIdByLayerId.set(l.id, dl.id)
  })
  const ctx = {
    behaviors: index,
    layerDeviceId: (id: string) => deviceIdByLayerId.get(id),
    settings: layout.settings,
    hands: kb.hands,
  }

  layout.layers.forEach((layer, li) => {
    const dl = km.layers[li]
    if (!dl) return
    const maxName = keymap.maxLayerNameLength || 0
    const name = maxName ? layer.name.slice(0, maxName) : layer.name
    if (name && name !== dl.name) plan.renames.push({ deviceLayerId: dl.id, layer: li, name })
    for (let p = 0; p < Math.min(keyCount, deviceKeys); p++) {
      const r = keyToBinding(layer.keys[p], p, ctx)
      if (!r.ok) {
        plan.skipped.push({ layer: li, layerName: layer.name, position: p, reason: r.reason })
        continue
      }
      if (sameBinding(dl.bindings[p], r.binding)) plan.unchanged++
      else plan.changes.push({ layer: li, deviceLayerId: dl.id, position: p, binding: r.binding })
    }
  })

  if (layout.combos.length) plan.notes.push(`${layout.combos.length} combo${layout.combos.length > 1 ? 's are' : ' is'} not stored by ZMK Studio — they need a firmware build.`)
  if (layout.macros.length) plan.notes.push('Macro definitions are not stored by ZMK Studio — keys using macros need a firmware build.')
  plan.notes.push('Hold-tap timing (tapping term, flavor, quick-tap), sticky-key, tap-dance and Kconfig settings come from the firmware; Studio only changes which behavior each key uses.')
  return plan
}

export interface ApplyResult {
  written: number
  failed: { layer: number; position: number; error: string }[]
  plan: WritePlan
}

/**
 * Execute a write: structural layer changes first, then re-read the keymap
 * (to learn the new layers' ids), re-plan, rename layers and set bindings.
 * Changes are pending on the device until save() / discard().
 */
export async function applyWrite(
  dev: StudioDevice,
  layout: Layout,
  kb: KeyboardDef,
  index: BehaviorIndex,
  opts: PlanOptions = {},
  onProgress?: (msg: string) => void,
): Promise<ApplyResult> {
  let keymap = await dev.getKeymap()
  let plan = planWrite(layout, kb, keymap, index, opts)
  if (plan.errors.length && !plan.addLayers) throw new Error(plan.errors.join('\n'))
  if (plan.addLayers || plan.removeLayers.length) {
    for (let i = 0; i < plan.addLayers; i++) {
      onProgress?.(`Adding layer ${i + 1}/${plan.addLayers}…`)
      await dev.addLayer()
    }
    for (const idx of plan.removeLayers) {
      onProgress?.(`Removing layer ${idx}…`)
      await dev.removeLayer(idx)
    }
    keymap = await dev.getKeymap()
    plan = planWrite(layout, kb, keymap, index, opts)
  }
  for (const r of plan.renames) {
    onProgress?.(`Renaming layer ${r.layer} to “${r.name}”…`)
    await dev.setLayerName(r.deviceLayerId, r.name)
  }
  const failed: ApplyResult['failed'] = []
  let written = 0
  for (const [i, c] of plan.changes.entries()) {
    if (i % 4 === 0) onProgress?.(`Writing keys… ${i}/${plan.changes.length}`)
    try {
      await dev.setLayerBinding(c.deviceLayerId, c.position, c.binding)
      written++
    } catch (e) {
      const msg = (e as Error).message ?? String(e)
      // lost connection / locked: stop instead of failing every remaining key
      if (!dev.connected || /locked/i.test(msg)) throw e
      failed.push({ layer: c.layer, position: c.position, error: msg })
    }
  }
  onProgress?.(`Wrote ${written} keys.`)
  return { written, failed, plan }
}

/** Group skipped keys by the kind of reason (text before any parenthesised detail). */
export function groupSkipped(skipped: SkippedKey[]): { reason: string; keys: SkippedKey[] }[] {
  const m = new Map<string, SkippedKey[]>()
  for (const s of skipped) {
    const kind = s.reason.split(' (')[0]
    const g = m.get(kind)
    if (g) g.push(s)
    else m.set(kind, [s])
  }
  return [...m.entries()].map(([reason, keys]) => ({ reason, keys })).sort((a, b) => b.keys.length - a.keys.length)
}
