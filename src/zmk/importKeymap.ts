// Imports ZMK .keymap / .conf files into the Layout model.
//
// Keymaps produced by compileKeymap() carry the full layout in a trailing
// metadata comment and round-trip losslessly. Anything else is parsed for real:
// C preprocessor (incl. zmk-helpers macros) -> devicetree -> Oryx-style keys.
import LZString from 'lz-string'
import type {
  Action, Combo, EncoderConfig, KeyConfig, KeyboardDef, Layer, Layout, Macro, MacroStep, Mod, Settings, HoldTapFlavor,
} from '../model/types'
import { defaultSettings, uid } from '../model/defaults'
import { canonicalCode, charToKey, findKeycode } from '../data/keycodes'
import { getBehavior } from '../data/behaviors'
import { BUILTIN_CELLS, BUILTIN_NODE_NAMES, METADATA_RE, unwrapMods } from './common'
import { Preprocessor } from './cpp'
import {
  cellToInt, findNodes, parseDts, propCells, propInt, propString, splitBindings, writeNode,
  type DtNode, type DtTree,
} from './dts'
import { ZMK_BEHAVIORS_PRELUDE, ZMK_HELPERS_PRELUDE } from './preludes'

export interface ImportOptions {
  /** contents of files the keymap #includes, keyed by path or basename */
  includes?: Record<string, string>
  /** layout name; defaults to "Imported keymap" */
  name?: string
  /** ignore the zmk-configurator metadata comment and parse the devicetree */
  ignoreMetadata?: boolean
}

export interface ImportResult {
  layout: Layout
  warnings: string[]
}

type Binding = { ref: string; params: string[] }

const HOLD_TAP = 'zmk,behavior-hold-tap'
const TAP_DANCE = 'zmk,behavior-tap-dance'
const MACRO = 'zmk,behavior-macro'
const LAYER_BEHAVIORS = new Set(['mo', 'tog', 'to', 'sl'])

const bindingText = (b: Binding) => [`&${b.ref}`, ...b.params].join(' ')
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function compatible(n: DtNode): string | undefined {
  return propString(n, 'compatible')
}

// ---------------------------------------------------------------------------

export function importKeymap(text: string, kb: KeyboardDef, opts: ImportOptions = {}): ImportResult {
  if (!opts.ignoreMetadata) {
    const meta = METADATA_RE.exec(text)
    if (meta) {
      const warnings: string[] = []
      try {
        const json = LZString.decompressFromBase64(meta[1])
        if (json) {
          const layout = JSON.parse(json) as Layout
          layout.settings = { ...defaultSettings(), ...layout.settings }
          if (layout.keyboard !== kb.id) warnings.push(`Keymap was made for keyboard "${layout.keyboard}", importing onto ${kb.id}`)
          layout.keyboard = kb.id
          fitLayers(layout.layers, kb, warnings)
          return { layout, warnings }
        }
      } catch {
        /* fall through to a real parse */
      }
      warnings.push('zmk-configurator metadata is corrupt; parsing the devicetree instead')
      const r = new Importer(text, kb, opts).run()
      r.warnings.unshift(...warnings)
      return r
    }
  }
  return new Importer(text, kb, opts).run()
}

function fitLayers(layers: Layer[], kb: KeyboardDef, warnings: string[]) {
  const n = kb.keys.length
  layers.forEach((l, i) => {
    if (l.keys.length === n) return
    warnings.push(`Layer "${l.name}" has ${l.keys.length} bindings, ${kb.name} has ${n} keys; ${l.keys.length > n ? 'truncated' : 'padded'}`)
    if (l.keys.length > n) l.keys = l.keys.slice(0, n)
    else while (l.keys.length < n) l.keys.push({ tap: { type: i === 0 ? 'none' : 'trans' } })
  })
}

class Importer {
  warnings: string[] = []
  settings: Settings = defaultSettings()
  tree!: DtTree
  labels = new Map<string, DtNode>()
  layerIds: string[] = []
  macros = new Map<string, Macro>()
  /** macro labels referenced as actions */
  macroUsed = new Set<string>()
  /** labels that must be kept verbatim in extraKeymap */
  keep = new Set<string>()
  /** builtin overrides we could not map to settings */
  builtinOverrides: DtNode[] = []
  /** `&label { ... };` overrides of nodes we do not know (hoisted to top level by the compiler) */
  labelOverrides: string[] = []
  textChars = new Map<string, string>()
  readonly text: string
  readonly kb: KeyboardDef
  readonly opts: ImportOptions

  constructor(text: string, kb: KeyboardDef, opts: ImportOptions) {
    this.text = text
    this.kb = kb
    this.opts = opts
  }

  warn(m: string) {
    if (!this.warnings.includes(m)) this.warnings.push(m)
  }

  run(): ImportResult {
    const pp = new Preprocessor({
      warn: (m) => this.warn(m),
      resolveInclude: (path, system) => this.include(path, system),
    })
    const src = pp.run(this.text)
    const speed = (name: string) => {
      const v = pp.macros.get(name)
      const n = v ? Number(v.body.map((t) => t.v).join('').trim()) : NaN
      return Number.isFinite(n) ? n : undefined
    }
    this.settings.mouseMoveSpeed = speed('ZMK_POINTING_DEFAULT_MOVE_VAL') ?? 600
    this.settings.mouseScrollSpeed = speed('ZMK_POINTING_DEFAULT_SCRL_VAL') ?? 10
    this.tree = parseDts(src)
    for (const w of this.tree.warnings) this.warn(w)
    this.labels = this.tree.labels

    const keymap = findNodes(this.tree.root, (n) => compatible(n) === 'zmk,keymap')[0]
    if (!keymap) this.warn('No keymap node (compatible = "zmk,keymap") found')
    const layerNodes = keymap ? keymap.children : []
    this.layerIds = layerNodes.map(() => uid())

    this.readGlobalSettings()
    this.buildTextTable()

    // macros first so layer decoding can reference them
    for (const n of findNodes(this.tree.root, (x) => compatible(x) === MACRO)) {
      const label = n.labels[0] ?? n.name
      if (this.wrappedBinding(n)) continue
      this.macros.set(label, this.macro(n, label))
    }

    const layers: Layer[] = layerNodes.map((n, i) => this.layer(n, i))
    fitLayers(layers, this.kb, this.warnings)

    const combos = findNodes(this.tree.root, (x) => compatible(x) === 'zmk,combos').flatMap((c) => c.children.map((n) => this.combo(n))).filter((c): c is Combo => !!c)
    this.settleComboTimeout(combos)

    this.settings.extraKeymap = this.extraKeymap()
    // a keymap using these behaviors presumes the hardware feature is enabled
    const used = new Set(layers.flatMap((l) => l.keys.flatMap((k) => [k.tap, k.hold, k.doubleTap, k.tapHold]))
      .flatMap((a) => (a?.type === 'behavior' ? [a.behavior] : [])))
    if (used.has('rgb_ug')) this.settings.rgbUnderglow = true
    if (used.has('bl')) this.settings.backlight = true
    if (used.has('studio_unlock')) this.settings.studio = true

    const now = Date.now()
    const layout: Layout = {
      id: uid(),
      name: this.opts.name ?? 'Imported keymap',
      description: '',
      tags: [],
      keyboard: this.kb.id,
      layers,
      combos,
      macros: [...this.macros.values()],
      settings: this.settings,
      createdAt: now,
      updatedAt: now,
    }
    return { layout, warnings: this.warnings }
  }

  include(path: string, system: boolean): string | undefined {
    const base = path.split('/').pop()!
    const inc = this.opts.includes
    if (inc) {
      const hit = inc[path] ?? inc[base]
      if (hit !== undefined) return hit
    }
    if (base === 'behaviors.dtsi') return ZMK_BEHAVIORS_PRELUDE
    if (/zmk-helpers\/helper\.h$|zmk-nodefree-config\/helper\.h$|^helper\.h$/.test(path)) return ZMK_HELPERS_PRELUDE
    if (path.startsWith('dt-bindings/') || path.startsWith('behaviors/') || path.startsWith('zmk-helpers/') || path.startsWith('layouts/')) return undefined
    if (!system || !path.includes('/')) this.warn(`Included file "${path}" is not available; its contents were ignored`)
    return undefined
  }

  // ---- settings -----------------------------------------------------------

  override(label: string): DtNode | undefined {
    return this.tree.externalOverrides.get(label)
  }

  readGlobalSettings() {
    const s = this.settings
    const mt = this.override('mt') ?? this.override('lt')
    if (mt) {
      s.holdTapFlavor = (propString(mt, 'flavor') as HoldTapFlavor) ?? (this.override('mt') ? 'hold-preferred' : 'tap-preferred')
      s.tappingTerm = propInt(mt, 'tapping-term-ms') ?? 200
      s.quickTap = Math.max(0, propInt(mt, 'quick-tap-ms') ?? 0)
      s.requirePriorIdle = Math.max(0, propInt(mt, 'require-prior-idle-ms') ?? 0)
      s.holdTriggerOnRelease = mt.props.has('hold-trigger-on-release')
      s.holdWhileUndecided = mt.props.has('hold-while-undecided')
    } else {
      // ZMK's stock &mt
      s.holdTapFlavor = 'hold-preferred'
      s.tappingTerm = 200
      s.quickTap = 0
      s.requirePriorIdle = 0
      s.holdTriggerOnRelease = false
      s.holdWhileUndecided = false
    }
    const sk = this.override('sk')
    s.stickyKeyTimeout = (sk && propInt(sk, 'release-after-ms')) ?? 1000
    s.stickyQuickRelease = !!sk?.props.has('quick-release')
    const mmv = this.override('mmv')
    const msc = this.override('msc')
    s.mouseTimeToMax = (mmv && propInt(mmv, 'time-to-max-speed-ms')) ?? 300
    s.mouseAccelExponent = (mmv && propInt(mmv, 'acceleration-exponent')) ?? 1
    s.mouseScrollTimeToMax = (msc && propInt(msc, 'time-to-max-speed-ms')) ?? 300
    s.mouseScrollAccelExponent = (msc && propInt(msc, 'acceleration-exponent')) ?? 0
    const td = findNodes(this.tree.root, (n) => compatible(n) === TAP_DANCE)[0]
    if (td) s.tapDanceTerm = propInt(td, 'tapping-term-ms') ?? 200
    s.positionalHoldTap = findNodes(this.tree.root, (n) => compatible(n) === HOLD_TAP && n.props.has('hold-trigger-key-positions')).length > 0

    // other overrides of builtin behaviors are kept as devicetree
    for (const [label, n] of this.tree.externalOverrides) {
      const handled = new Set(label === 'mt' || label === 'lt'
        ? ['flavor', 'tapping-term-ms', 'quick-tap-ms', 'require-prior-idle-ms', 'hold-trigger-on-release', 'hold-while-undecided']
        : label === 'sk' ? ['release-after-ms', 'quick-release']
          : label === 'trans' ? ['#sensor-binding-cells'] // emitted by the compiler when needed
            : label === 'mmv' || label === 'msc' ? ['time-to-max-speed-ms', 'acceleration-exponent']
          : label === 'sl' && propInt(n, 'release-after-ms') === s.stickyKeyTimeout ? ['release-after-ms'] : [])
      if (label === 'lt' && this.override('mt')) {
        const m = this.override('mt')!
        for (const k of handled) if (!eq(m.props.get(k), n.props.get(k))) this.warn('&mt and &lt have different settings; using the &mt ones for both')
      }
      const rest = [...n.props.keys()].filter((k) => !handled.has(k))
      if (!rest.length && !n.children.length) continue
      const nodeName = BUILTIN_NODE_NAMES[label]
      if (!nodeName) {
        // hardware nodes (e.g. `&left_encoder { status = "okay"; }`): kept as a top-level override
        this.labelOverrides.push(writeNode({ ...n, name: `&${label}`, labels: [] }, '', false))
        continue
      }
      const copy: DtNode = { name: nodeName, labels: [], props: new Map(rest.map((k) => [k, n.props.get(k)!])), children: n.children }
      this.builtinOverrides.push(copy)
    }
  }

  settleComboTimeout(combos: Combo[]) {
    const counts = new Map<number, number>()
    for (const c of combos) if (c.timeout !== undefined) counts.set(c.timeout, (counts.get(c.timeout) ?? 0) + 1)
    let best = 50
    let bestN = 0
    for (const [t, n] of counts) if (n > bestN) [best, bestN] = [t, n]
    this.settings.comboTimeout = best
    for (const c of combos) if (c.timeout === best) delete c.timeout
  }

  // ---- text macro helpers -------------------------------------------------

  buildTextTable() {
    const loc = this.settings.locale
    for (let cp = 32; cp < 127; cp++) {
      const ch = String.fromCharCode(cp)
      const k = charToKey(ch, loc)
      if (!k || k.dead) continue
      const key = `${canonicalCode(k.code)}|${k.shift ? 1 : 0}|${k.altgr ? 1 : 0}`
      if (!this.textChars.has(key)) this.textChars.set(key, ch)
    }
  }

  /** printable character typed by an &kp parameter, if obvious */
  charOf(param: string): string | undefined {
    const u = unwrapMods(param)
    if (!u) return undefined
    let shift = false
    let altgr = false
    for (const m of u.mods) {
      if (m === 'LSHIFT') shift = true
      else if (m === 'RALT') altgr = true
      else return undefined
    }
    let code = canonicalCode(u.code)
    const def = findKeycode(code)
    if (def?.base) {
      code = canonicalCode(def.base)
      shift = true
    }
    return this.textChars.get(`${code}|${shift ? 1 : 0}|${altgr ? 1 : 0}`)
  }

  // ---- behavior lookup ----------------------------------------------------

  node(ref: string): DtNode | undefined {
    return this.labels.get(ref)
  }

  cellsOf(ref: string): number | undefined {
    if (ref in BUILTIN_CELLS) return BUILTIN_CELLS[ref]
    const n = this.node(ref)
    if (n) return propInt(n, '#binding-cells')
    const b = getBehavior(ref)
    return b ? b.params.length : undefined
  }

  /** our own hold-tap wrapper: press X / pause-for-release / release X */
  wrappedBinding(n: DtNode): Binding | undefined {
    if (!n.labels[0]?.startsWith('w_')) return undefined
    const bs = splitBindings(propCells(n, 'bindings') ?? [])
    if (bs.length !== 5) return undefined
    const [p, x, pause, r, y] = bs
    if (p.ref === 'macro_press' && !p.params.length && pause.ref === 'macro_pause_for_release' && r.ref === 'macro_release' && eq(x, y)) return x
    return undefined
  }

  layerParam(p: string | undefined): string | undefined {
    if (p === undefined) return undefined
    const i = cellToInt(p)
    if (i === undefined || i < 0 || i >= this.layerIds.length) return undefined
    return this.layerIds[i]
  }

  keyParam(p: string | undefined): { code: string; mods?: Mod[] } | undefined {
    if (p === undefined) return undefined
    const u = unwrapMods(p)
    if (!u) return undefined
    const code = canonicalCode(u.code)
    return u.mods.length ? { code, mods: u.mods } : { code }
  }

  raw(b: Binding): Action {
    const cells = this.cellsOf(b.ref)
    if (cells !== undefined && b.params.length > cells) {
      this.warn(`"${bindingText(b)}" has more parameters than &${b.ref} takes (undefined macro?)`)
    }
    const n = this.node(b.ref)
    if (n) this.keep.add(b.ref)
    else if (!getBehavior(b.ref) && !(b.ref in BUILTIN_CELLS)) this.warn(`Unknown behavior &${b.ref} kept as raw binding`)
    return { type: 'raw', code: bindingText(b) }
  }

  /** Decode a binding that maps onto a single Action. */
  action(b: Binding): Action {
    const r = b.ref
    const p = b.params
    if (r === 'none' && !p.length) return { type: 'none' }
    if (r === 'trans' && !p.length) return { type: 'trans' }
    if ((r === 'kp' || r === 'sk') && p.length === 1) {
      const k = this.keyParam(p[0])
      if (k) return { type: r === 'kp' ? 'key' : 'sticky', ...k }
    }
    if (LAYER_BEHAVIORS.has(r) && p.length === 1) {
      const id = this.layerParam(p[0])
      if (id) return { type: 'layer', mode: r as 'mo', layer: id }
      this.warn(`&${r} ${p[0]}: not a valid layer index`)
    }
    const n = this.node(r)
    if (n && compatible(n) === MACRO) {
      const inner = this.wrappedBinding(n)
      if (inner) return this.action(inner)
      if (this.macros.has(r)) {
        this.macroUsed.add(r)
        return { type: 'macro', id: this.macros.get(r)!.id }
      }
    }
    if (!n && getBehavior(r)) {
      // formatBinding emits RGB_COLOR_HSB(h,s,b) as one token
      const hsb = r === 'rgb_ug' && p.length === 1 ? /^RGB_COLOR_HSB\((\d+),(\d+),(\d+)\)$/.exec(p[0]) : null
      return { type: 'behavior', behavior: r, params: hsb ? ['RGB_COLOR_HSB', hsb[1], hsb[2], hsb[3]] : [...p] }
    }
    return this.raw(b)
  }

  /** hold-tap sub-binding <&x> receiving `param` */
  sub(ref: string, param: string): Action {
    const cells = this.cellsOf(ref) ?? (param === '0' ? 0 : 1)
    return this.action({ ref, params: cells === 0 ? [] : [param] })
  }

  /** Decode a binding into tap/hold (+ double-tap/tap-hold) for a key position. */
  key(b: Binding): KeyConfig {
    const r = b.ref
    const p = b.params
    if (r === 'mt' && p.length === 2) {
      const h = this.keyParam(p[0])
      const t = this.keyParam(p[1])
      if (h && t) return { tap: { type: 'key', ...t }, hold: { type: 'key', ...h } }
    }
    if (r === 'lt' && p.length === 2) {
      const l = this.layerParam(p[0])
      const t = this.keyParam(p[1])
      if (l && t) return { tap: { type: 'key', ...t }, hold: { type: 'layer', mode: 'mo', layer: l } }
    }
    const n = this.node(r)
    const compat = n && compatible(n)
    if (n && compat === HOLD_TAP && p.length === 2) {
      const subs = splitBindings(propCells(n, 'bindings') ?? [])
      if (subs.length === 2 && subs.every((s) => !s.params.length)) {
        const mm = this.modMorph(subs[1].ref)
        const k: KeyConfig = mm
          ? { tap: mm.tap, shifted: mm.shifted, hold: this.sub(subs[0].ref, p[0]) }
          : { tap: this.sub(subs[1].ref, p[1]), hold: this.sub(subs[0].ref, p[0]) }
        if (n.props.has('retro-tap')) k.retroTap = true
        const term = propInt(n, 'tapping-term-ms')
        if (term !== undefined && term !== this.settings.tappingTerm) k.tappingTerm = term
        return k
      }
    }
    if (n && compat === TAP_DANCE && !p.length) {
      const subs = splitBindings(propCells(n, 'bindings') ?? [])
      if (subs.length === 1) return this.key(subs[0])
      if (subs.length === 2) {
        const first = this.key(subs[0])
        const second = this.key(subs[1])
        const sameTap = eq(second.tap, first.tap) && eq(second.shifted, first.shifted)
        if (!first.doubleTap && !first.tapHold && !second.doubleTap && !second.tapHold && (!second.shifted || sameTap) &&
          eq(first.retroTap, second.hold ? second.retroTap : first.retroTap)) {
          const k: KeyConfig = { tap: first.tap }
          if (first.shifted) k.shifted = first.shifted
          if (first.hold) k.hold = first.hold
          if (second.hold) k.tapHold = second.hold
          if (first.retroTap || second.retroTap) k.retroTap = true
          if (!(second.hold && sameTap)) k.doubleTap = second.tap
          const term = first.tappingTerm ?? second.tappingTerm
          if (term !== undefined) k.tappingTerm = term
          return k
        }
      }
      if (subs.length > 2) this.warn(`Tap dance &${r} has ${subs.length} bindings; only 2 are supported, kept as raw`)
      return { tap: this.raw(b) }
    }
    if (!p.length) {
      const mm = this.modMorph(r)
      if (mm) return mm
    }
    return { tap: this.action(b) }
  }

  /** A shift mod-morph of two simple bindings -> tap / shifted. */
  modMorph(ref: string): { tap: Action; shifted: Action } | undefined {
    const n = this.node(ref)
    if (!n || compatible(n) !== 'zmk,behavior-mod-morph' || n.props.has('keep-mods')) return undefined
    const mods = (propCells(n, 'mods') ?? []).join('').replace(/[()\s]/g, '').split('|').sort().join('|')
    if (mods !== 'MOD_LSFT|MOD_RSFT') return undefined
    const bs = splitBindings(propCells(n, 'bindings') ?? [])
    if (bs.length !== 2) return undefined
    const tap = this.action(bs[0])
    const shifted = this.action(bs[1])
    if (tap.type === 'raw' || shifted.type === 'raw') return undefined
    return { tap, shifted }
  }

  /** sensor-bindings -> one EncoderConfig per encoder */
  encoders(n: DtNode, layerName: string): EncoderConfig[] | undefined {
    const cells = propCells(n, 'sensor-bindings')
    if (!cells) return undefined
    const out: EncoderConfig[] = []
    for (const b of splitBindings(cells)) {
      if (b.ref === 'trans' && !b.params.length) {
        out.push({})
        continue
      }
      const node = this.node(b.ref)
      const compat = node && compatible(node)
      if ((b.ref === 'inc_dec_kp' || b.ref === 'inc_dec_cp') && b.params.length === 2) {
        out.push({ cw: this.action({ ref: 'kp', params: [b.params[0]] }), ccw: this.action({ ref: 'kp', params: [b.params[1]] }) })
        continue
      }
      if (node && (compat === 'zmk,behavior-sensor-rotate' || compat === 'zmk,behavior-sensor-rotate-var')) {
        const subs = splitBindings(propCells(node, 'bindings') ?? [])
        if (subs.length === 2) {
          const variable = compat === 'zmk,behavior-sensor-rotate-var'
          if (!variable || b.params.length === 2) {
            const [cw, ccw] = subs.map((sb, i) => this.action(variable ? { ref: sb.ref, params: [b.params[i]] } : sb))
            out.push({ cw, ccw })
            continue
          }
        }
      }
      this.warn(`Layer "${layerName}": encoder binding ${bindingText(b)} is not supported; left transparent`)
      out.push({})
    }
    const n2 = this.kb.encoders ?? 0
    if (out.length > n2) this.warn(`Layer "${layerName}" has ${out.length} encoder bindings, ${this.kb.name} has ${n2} encoders; extra ones dropped`)
    out.length = Math.min(out.length, n2)
    while (out.length && !out[out.length - 1].cw && !out[out.length - 1].ccw) out.pop()
    return out.length ? out : undefined
  }

  // ---- layers -------------------------------------------------------------

  layer(n: DtNode, i: number): Layer {
    const name = propString(n, 'display-name') ?? propString(n, 'label') ?? n.labels[0] ?? n.name.replace(/^layer_|_layer$/g, '') ?? `Layer ${i}`
    const bindings = splitBindings(propCells(n, 'bindings') ?? [])
    for (const b of bindings) if (!b.ref) this.warn(`Layer "${name}": unparsable cells ${b.params.join(' ')}`)
    const keys = bindings.filter((b) => b.ref).map((b) => this.key(b))
    const layer: Layer = { id: this.layerIds[i], name: name || n.name, keys }
    const enc = this.encoders(n, layer.name)
    if (enc) layer.encoders = enc
    return layer
  }

  // ---- combos -------------------------------------------------------------

  combo(n: DtNode): Combo | undefined {
    const keys = (propCells(n, 'key-positions') ?? []).map(cellToInt)
    const bs = splitBindings(propCells(n, 'bindings') ?? [])
    const name = n.name.replace(/^combo_/, '')
    if (!bs.length || keys.some((k) => k === undefined)) {
      this.warn(`Combo "${name}" could not be parsed (unresolved key positions or bindings); dropped`)
      return undefined
    }
    if (bs.length > 1) this.warn(`Combo "${name}" has more than one binding; using the first`)
    const k = this.key(bs[0])
    const action = k.hold || k.doubleTap || k.tapHold ? this.raw(bs[0]) : k.tap ?? { type: 'none' }
    const layers = (propCells(n, 'layers') ?? []).map((c) => this.layerParam(c)).filter((x): x is string => !!x)
    const c: Combo = {
      id: uid(),
      name,
      keys: keys as number[],
      action,
      layers: layers.length === this.layerIds.length ? [] : layers,
    }
    const t = propInt(n, 'timeout-ms')
    c.timeout = t ?? 50
    const idle = propInt(n, 'require-prior-idle-ms')
    if (idle !== undefined && idle > 0) c.requirePriorIdle = idle
    if (n.props.has('slow-release')) c.slowRelease = true
    return c
  }

  // ---- macros -------------------------------------------------------------

  macro(n: DtNode, label: string): Macro {
    const m: Macro = { id: uid(), name: label, steps: [] }
    const wait = propInt(n, 'wait-ms')
    const tap = propInt(n, 'tap-ms')
    if (wait !== undefined) m.wait = wait
    if (tap !== undefined) m.tap = tap
    const bs = splitBindings(propCells(n, 'bindings') ?? [])
    let mode: 'tap' | 'press' | 'release' = 'tap'
    let curWait = wait ?? 15
    const steps: MacroStep[] = []
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]
      switch (b.ref) {
        case 'macro_tap': mode = 'tap'; continue
        case 'macro_press': mode = 'press'; continue
        case 'macro_release': mode = 'release'; continue
        case 'macro_pause_for_release': steps.push({ type: 'pauseForRelease' }); continue
        case 'macro_wait_time': {
          const ms = cellToInt(b.params[0] ?? '') ?? 0
          // our delay idiom: wait_time N, [macro_tap], &none, wait_time <current>
          let j = i + 1
          if (bs[j]?.ref === 'macro_tap' && !bs[j].params.length) j++
          if (bs[j]?.ref === 'none' && bs[j + 1]?.ref === 'macro_wait_time' && cellToInt(bs[j + 1].params[0] ?? '') === curWait) {
            steps.push({ type: 'delay', ms })
            mode = j > i + 1 ? 'tap' : mode
            i = j + 1
            continue
          }
          if (i === 0 && wait === undefined) {
            m.wait = ms
            curWait = ms
          } else {
            this.warn(`Macro ${label}: &macro_wait_time ${ms} mid-macro approximated as a delay`)
            steps.push({ type: 'delay', ms })
          }
          continue
        }
        case 'macro_tap_time': {
          const ms = cellToInt(b.params[0] ?? '') ?? 0
          if (i === 0 && tap === undefined) m.tap = ms
          else this.warn(`Macro ${label}: &macro_tap_time mid-macro ignored`)
          continue
        }
      }
      steps.push({ type: mode, action: this.macroAction(b) })
    }
    m.steps = collapseText(steps, (p) => this.charOf(p))
    return m
  }

  macroAction(b: Binding): Action {
    // nested macros may not be registered yet (order); reference them lazily
    const n = this.node(b.ref)
    if (n && compatible(n) === MACRO && !this.wrappedBinding(n) && !this.macros.has(b.ref)) {
      const label = b.ref
      const placeholder: Macro = { id: uid(), name: label, steps: [] }
      this.macros.set(label, placeholder)
      Object.assign(placeholder, { ...this.macro(n, label), id: placeholder.id })
    }
    return this.action(b)
  }

  // ---- leftovers ----------------------------------------------------------

  /** Devicetree for nodes we keep verbatim (referenced by raw bindings). */
  extraKeymap(): string {
    // transitive closure over labels referenced by kept nodes
    const queue = [...this.keep]
    const kept = new Set<string>()
    while (queue.length) {
      const l = queue.pop()!
      if (kept.has(l)) continue
      const n = this.node(l)
      if (!n) continue
      kept.add(l)
      for (const v of n.props.values()) for (const x of v) {
        const refs = x.kind === 'cells' ? x.cells.filter((c) => c.startsWith('&')).map((c) => c.slice(1)) : x.kind === 'ref' ? [x.ref] : []
        for (const r of refs) if (this.node(r) && !kept.has(r)) queue.push(r)
      }
    }
    const behaviorNodes: string[] = []
    for (const l of kept) {
      const n = this.node(l)!
      // imported macros are emitted by the compiler under the same label
      if (compatible(n) === MACRO && this.macros.has(l)) continue
      behaviorNodes.push(writeNode(n, '    '))
    }
    for (const o of this.builtinOverrides) behaviorNodes.push(writeNode(o, '    ', false))

    const parts: string[] = []
    if (behaviorNodes.length) parts.push(`behaviors {\n${behaviorNodes.join('\n\n')}\n};`)
    // other root-level nodes we do not model (conditional layers, leader keys, ...)
    const modelled = new Set(['behaviors', 'macros', 'combos', 'keymap', 'chosen'])
    for (const c of this.tree.root.children) {
      if (modelled.has(c.name) || compatible(c) === 'zmk,keymap' || compatible(c) === 'zmk,combos') continue
      if (findNodes(c, (x) => compatible(x) === 'zmk,keymap').length) continue
      parts.push(writeNode(c))
      this.warn(`Node /${c.name} is not modelled; kept in the extra devicetree`)
    }
    if (this.tree.root.children.some((c) => c.name === 'chosen')) this.warn('/chosen node ignored (the keyboard definition supplies it)')
    parts.push(...this.labelOverrides)
    return parts.join('\n\n')
  }
}

/** Collapse runs (>=2) of tapped printable characters into text steps. */
function collapseText(steps: MacroStep[], charOf: (param: string) => string | undefined): MacroStep[] {
  const out: MacroStep[] = []
  let run: { step: MacroStep; ch: string }[] = []
  const flush = () => {
    if (run.length >= 2) out.push({ type: 'text', text: run.map((r) => r.ch).join('') })
    else out.push(...run.map((r) => r.step))
    run = []
  }
  for (const s of steps) {
    if (s.type === 'tap' && s.action.type === 'key') {
      const ch = charOf(s.action.mods?.length ? `${s.action.mods.map((m) => MODFN[m]).join('(')}(${s.action.code}${')'.repeat(s.action.mods.length)}` : s.action.code)
      if (ch !== undefined) {
        run.push({ step: s, ch })
        continue
      }
    }
    flush()
    out.push(s)
  }
  flush()
  return out
}

const MODFN: Record<Mod, string> = {
  LCTRL: 'LC', LSHIFT: 'LS', LALT: 'LA', LGUI: 'LG', RCTRL: 'RC', RSHIFT: 'RS', RALT: 'RA', RGUI: 'RG',
}

// ---------------------------------------------------------------------------
// Kconfig

export interface ImportConfOptions {
  /** the keyboard is split: CONFIG_BT_MAX_CONN counts the peripheral link */
  split?: boolean
  /** only apply what the file sets instead of resetting conf-managed settings to ZMK defaults */
  merge?: boolean
}

export function importConf(text: string, settings: Settings, opts: ImportConfOptions = {}): Settings {
  const s: Settings = { ...settings }
  if (!opts.merge) {
    Object.assign(s, {
      sleepEnabled: false, sleepTimeoutMin: 15, idleTimeoutSec: 30, rgbUnderglow: false, rgbAutoOffIdle: false,
      backlight: false, display: false, pointing: false, nkro: false, bleTxPowerPlus8: false, usbLogging: false,
      debounceMs: 5,
    } satisfies Partial<Settings>)
  }
  const extra: string[] = []
  const yes = (v: string) => v === 'y'
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(CONFIG_[A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!m) {
      extra.push(line)
      continue
    }
    const [, k, v] = m
    const n = Number(v)
    switch (k) {
      case 'CONFIG_ZMK_SLEEP': s.sleepEnabled = yes(v); break
      case 'CONFIG_ZMK_IDLE_SLEEP_TIMEOUT': s.sleepTimeoutMin = n / 60000; break
      case 'CONFIG_ZMK_IDLE_TIMEOUT': s.idleTimeoutSec = n / 1000; break
      case 'CONFIG_ZMK_RGB_UNDERGLOW': s.rgbUnderglow = yes(v); break
      case 'CONFIG_WS2812_STRIP': break
      case 'CONFIG_ZMK_RGB_UNDERGLOW_AUTO_OFF_IDLE': s.rgbAutoOffIdle = yes(v); break
      case 'CONFIG_ZMK_BACKLIGHT': s.backlight = yes(v); break
      case 'CONFIG_ZMK_DISPLAY': s.display = yes(v); break
      case 'CONFIG_ZMK_POINTING': case 'CONFIG_ZMK_MOUSE': s.pointing = yes(v); break
      case 'CONFIG_ZMK_HID_REPORT_TYPE_NKRO': s.nkro = yes(v); break
      case 'CONFIG_ZMK_HID_REPORT_TYPE_HKRO': if (yes(v)) s.nkro = false; break
      case 'CONFIG_BT_CTLR_TX_PWR_PLUS_8': s.bleTxPowerPlus8 = yes(v); break
      case 'CONFIG_BT_MAX_CONN': s.btMaxConnections = Math.max(1, n - (opts.split ? 1 : 0)); break
      case 'CONFIG_BT_MAX_PAIRED': break
      case 'CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING': s.splitBatteryFetching = yes(v); break
      case 'CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY': break
      case 'CONFIG_ZMK_USB_LOGGING': s.usbLogging = yes(v); break
      case 'CONFIG_ZMK_STUDIO': s.studio = yes(v); break
      case 'CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS': case 'CONFIG_ZMK_KSCAN_DEBOUNCE_RELEASE_MS':
        if (n >= 0) s.debounceMs = n
        break
      default: extra.push(line)
    }
  }
  s.extraConf = opts.merge && settings.extraConf ? [settings.extraConf.trim(), ...extra].filter(Boolean).join('\n') : extra.join('\n')
  return s
}
