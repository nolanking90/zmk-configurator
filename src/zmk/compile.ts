// Compiles an Oryx-style Layout into a ZMK keymap (.keymap devicetree), Kconfig
// (.conf) and a complete zmk-config repository. Targets ZMK v0.3 semantics; all
// property / Kconfig names were checked against the zmkfirmware/zmk v0.3 tag.
import LZString from 'lz-string'
import type {
  Action, Combo, KeyConfig, KeyboardDef, Layout, Macro, MacroStep, Mod, Settings,
} from '../model/types'
import { charToKey, findKeycode, isModifierCode } from '../data/keycodes'
import { formatBinding, getBehavior } from '../data/behaviors'
import {
  BUILTIN_BEHAVIOR_LABELS, BUILTIN_CELLS, METADATA_PREFIX, sanitizeIdent, uniqueName, wrapMods,
} from './common'

export interface CompileResult {
  keymap: string
  /** config/<zmkName>.conf — shared by every half */
  conf: string
  /**
   * Kconfig that must only be applied to the split central (BT profile count,
   * peripheral battery fetching). Written to config/<central>.conf. Empty for
   * unibody keyboards (those settings go into `conf`).
   */
  centralConf: string
  warnings: string[]
}

/** ZMK's own defaults (v0.3) — used to decide what needs emitting. */
const ZMK = {
  idleTimeoutMs: 30000,
  sleepTimeoutMs: 900000,
  btMaxConn: 5,
  debounceMs: 5,
  stickyReleaseMs: 1000,
}

const I1 = '    '
const I2 = I1 + I1
const I3 = I2 + I1

// ---------------------------------------------------------------------------

interface SubBinding { ref: string; param: string }

interface HoldTapCfg {
  hold: SubBinding
  tap: SubBinding
  term?: number
  side?: 'L' | 'R'
  retro?: boolean
}

class Compiler {
  readonly s: Settings
  readonly warnings: string[] = []
  /** labels used by nodes we emit (and builtin behaviors we must not shadow) */
  private labels = new Set<string>(BUILTIN_BEHAVIOR_LABELS)
  private layerIndex = new Map<string, number>()
  private layerDefine = new Map<string, string>()
  private macroLabel = new Map<string, string>()
  /** behavior labels referenced anywhere (for includes/kconfig) */
  readonly refs = new Set<string>()

  private holdTaps = new Map<string, { label: string; node: string }>()
  private tapDances = new Map<string, { label: string; node: string }>()
  private modMorphs = new Map<string, { label: string; node: string }>()
  private sensorRotates = new Map<string, { label: string; node: string }>()
  private wrappers = new Map<string, { label: string; node: string }>()

  readonly layout: Layout
  readonly kb: KeyboardDef
  constructor(layout: Layout, kb: KeyboardDef) {
    this.layout = layout
    this.kb = kb
    this.s = layout.settings
    // labels defined by hand-written devicetree must not be reused
    for (const m of (this.s.extraKeymap ?? '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z_]/g)) this.labels.add(m[1])
    this.assignLayerNames()
    this.assignMacroLabels()
  }

  warn(msg: string) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg)
  }

  // ---- names --------------------------------------------------------------

  private assignLayerNames() {
    const used = new Set<string>()
    this.layout.layers.forEach((layer, i) => {
      this.layerIndex.set(layer.id, i)
      let base = sanitizeIdent(layer.name, 'layer').toUpperCase()
      if (isReservedDefine(base)) base = `${base}_LAYER`
      this.layerDefine.set(layer.id, uniqueName(base, used))
    })
  }

  private assignMacroLabels() {
    for (const m of this.layout.macros) {
      let base = sanitizeIdent(m.name, 'macro')
      if (BUILTIN_BEHAVIOR_LABELS.has(base) || getBehavior(base)) base = `m_${base}`
      this.macroLabel.set(m.id, uniqueName(base, this.labels))
    }
  }

  layerDefines(): { name: string; index: number }[] {
    return this.layout.layers.map((l, i) => ({ name: this.layerDefine.get(l.id)!, index: i }))
  }

  layerRef(id: string): string {
    const d = this.layerDefine.get(id)
    if (d === undefined) {
      this.warn(`Reference to a deleted layer (${id}); using layer 0`)
      return '0'
    }
    return d
  }

  macroRef(id: string): string | undefined {
    return this.macroLabel.get(id)
  }

  private ref(label: string): string {
    this.refs.add(label)
    return `&${label}`
  }

  // ---- actions ------------------------------------------------------------

  /** Full binding for a simple action, e.g. "&kp LC(A)". */
  action(a: Action | undefined): string {
    if (!a) return this.ref('none')
    switch (a.type) {
      case 'none': return this.ref('none')
      case 'trans': return this.ref('trans')
      case 'key': return `${this.ref('kp')} ${this.keyParam(a.code, a.mods)}`
      case 'sticky': return `${this.ref('sk')} ${this.keyParam(a.code, a.mods)}`
      case 'layer': return `${this.ref(a.mode)} ${this.layerRef(a.layer)}`
      case 'macro': {
        const l = this.macroRef(a.id)
        if (!l) {
          this.warn(`Reference to a deleted macro (${a.id}); using &none`)
          return this.ref('none')
        }
        return this.ref(l)
      }
      case 'behavior': {
        if (this.gatedOff(a.behavior)) return this.ref('none')
        this.refs.add(a.behavior)
        return formatBinding(a.behavior, a.params.filter((p) => p !== ''))
      }
      case 'raw': {
        const code = a.code.trim()
        const m = /^&([A-Za-z_][A-Za-z0-9_]*)/.exec(code)
        if (m) this.refs.add(m[1])
        else this.warn(`Raw binding "${code}" does not start with &`)
        return code || this.ref('none')
      }
    }
  }

  /**
   * Behaviors whose driver is only compiled when a hardware feature is enabled.
   * Referencing them otherwise fails at link time, so they become &none.
   */
  private gatedOff(behavior: string): boolean {
    const gate: Record<string, [boolean, string]> = {
      rgb_ug: [this.s.rgbUnderglow, 'RGB underglow'],
      bl: [this.s.backlight, 'backlight'],
      studio_unlock: [this.s.studio, 'ZMK Studio'],
    }
    const g = gate[behavior]
    if (!g || g[0]) return false
    this.warn(`&${behavior} needs ${g[1]}, which is disabled in settings; emitted as &none`)
    return true
  }

  private keyParam(code: string, mods?: Mod[]): string {
    if (!code) {
      this.warn('Key action without a key code; using NONE')
      code = 'NONE'
    }
    return wrapMods(code, mods)
  }

  /** Pure modifier hold (LSHIFT, or LC(LSHIFT)) -> its &kp/&mt parameter. */
  private modifierParam(a: Action | undefined): string | undefined {
    if (!a || a.type !== 'key' || !isModifierCode(a.code)) return undefined
    return wrapMods(a.code, a.mods)
  }

  /**
   * Hold-tap sub-binding: hold-tap passes exactly one parameter to each of its
   * two bindings. Behaviors that take none ignore it (we pass 0); anything that
   * needs two cells, or arbitrary raw bindings, gets wrapped in a macro.
   */
  private sub(a: Action | undefined): SubBinding {
    if (!a) return { ref: this.ref('none'), param: '0' }
    switch (a.type) {
      case 'none': case 'trans':
        return { ref: this.ref(a.type), param: '0' }
      case 'key': return { ref: this.ref('kp'), param: this.keyParam(a.code, a.mods) }
      case 'sticky': return { ref: this.ref('sk'), param: this.keyParam(a.code, a.mods) }
      case 'layer': return { ref: this.ref(a.mode), param: this.layerRef(a.layer) }
      case 'macro': return { ref: this.action(a), param: '0' }
      case 'behavior': {
        if (this.gatedOff(a.behavior)) return { ref: this.ref('none'), param: '0' }
        const params = a.params.filter((p) => p !== '')
        const cells = BUILTIN_CELLS[a.behavior] ?? getBehavior(a.behavior)?.params.length ?? params.length
        if (cells === 0 && params.length === 0) return { ref: this.ref(a.behavior), param: '0' }
        if (cells === 1 && params.length === 1) return { ref: this.ref(a.behavior), param: params[0] }
        return { ref: this.wrapper(this.action(a)), param: '0' }
      }
      case 'raw': {
        const code = this.action(a)
        if (/^&[A-Za-z_][A-Za-z0-9_]*$/.test(code)) return { ref: code, param: '0' }
        return { ref: this.wrapper(code), param: '0' }
      }
    }
  }

  /** A 0-param macro that presses `binding` while held and releases it on release. */
  private wrapper(binding: string): string {
    let w = this.wrappers.get(binding)
    if (!w) {
      const label = uniqueName(`w_${sanitizeIdent(binding.replace(/&/g, ''), 'b').slice(0, 28)}`, this.labels)
      const node = [
        `${I2}${label}: ${label} {`,
        `${I3}compatible = "zmk,behavior-macro";`,
        `${I3}#binding-cells = <0>;`,
        `${I3}wait-ms = <0>;`,
        `${I3}tap-ms = <0>;`,
        `${I3}bindings = <&macro_press ${binding}>, <&macro_pause_for_release>, <&macro_release ${binding}>;`,
        `${I2}};`,
      ].join('\n')
      w = { label, node }
      this.wrappers.set(binding, w)
    }
    return this.ref(w.label)
  }

  // ---- keys ---------------------------------------------------------------

  /** Binding for a key position (tap / hold / double-tap / tap-hold). */
  key(k: KeyConfig | undefined, pos: number): string {
    if (!k) return this.ref('none')
    // mod-morph: the shifted variant replaces the tap action wherever it is used
    const tap = k.shifted ? this.modMorph(k.tap, k.shifted) : k.tap
    const retro = !!k.retroTap
    if (k.doubleTap || k.tapHold) {
      const first = this.tapHold(tap, k.hold, k.tappingTerm, pos, retro)
      const second = this.tapHold(k.doubleTap ?? tap, k.tapHold, k.tappingTerm, pos, retro)
      return this.tapDance(first, second)
    }
    return this.tapHold(tap, k.hold, k.tappingTerm, pos, retro)
  }

  private tapHold(tap: Action | undefined, hold: Action | undefined, term: number | undefined, pos: number, retro = false): string {
    if (!hold) return this.action(tap)
    if (!tap) return this.action(hold)
    if (term === this.s.tappingTerm) term = undefined

    const holdMod = this.modifierParam(hold)
    const side = holdMod !== undefined && this.s.positionalHoldTap ? this.hand(pos) : undefined

    if (tap.type === 'key' && hold.type === 'key' && term === undefined && !side && !retro) {
      return `${this.ref('mt')} ${this.keyParam(hold.code, hold.mods)} ${this.keyParam(tap.code, tap.mods)}`
    }
    if (tap.type === 'key' && hold.type === 'layer' && hold.mode === 'mo' && term === undefined && !retro) {
      return `${this.ref('lt')} ${this.layerRef(hold.layer)} ${this.keyParam(tap.code, tap.mods)}`
    }
    const cfg: HoldTapCfg = { hold: this.sub(hold), tap: this.sub(tap), term, side, retro }
    return `${this.holdTap(cfg)} ${cfg.hold.param} ${cfg.tap.param}`
  }

  /** Shift-morph: `tap` normally, `shifted` while either Shift is held. Returns a 0-param raw action. */
  private modMorph(tap: Action | undefined, shifted: Action): Action {
    const a = this.action(tap)
    const b = this.action(shifted)
    const key = JSON.stringify([a, b])
    let mm = this.modMorphs.get(key)
    if (!mm) {
      const label = uniqueName(`mm_${sanitizeIdent(a.replace(/&/g, ''), 'k').slice(0, 24)}`, this.labels)
      const node = [
        `${I2}${label}: ${label} {`,
        `${I3}compatible = "zmk,behavior-mod-morph";`,
        `${I3}#binding-cells = <0>;`,
        `${I3}bindings = <${a}>, <${b}>;`,
        `${I3}mods = <(MOD_LSFT|MOD_RSFT)>;`,
        `${I2}};`,
      ].join('\n')
      mm = { label, node }
      this.modMorphs.set(key, mm)
    }
    this.refs.add(mm.label)
    return { type: 'raw', code: `&${mm.label}` }
  }

  // ---- encoders -----------------------------------------------------------

  /** sensor-bindings for one layer, or undefined if every encoder is transparent. */
  sensorBindings(layer: { name: string; encoders?: { cw?: Action; ccw?: Action }[] }): string | undefined {
    const n = this.kb.encoders ?? 0
    const enc = layer.encoders ?? []
    if (!n) {
      if (enc.some((e) => e && (e.cw || e.ccw))) this.warn(`Layer "${layer.name}" has encoder bindings but ${this.kb.name} has no encoders; ignored`)
      return undefined
    }
    if (enc.length > n) this.warn(`Layer "${layer.name}" has ${enc.length} encoder entries, ${this.kb.name} has ${n}; extra ones ignored`)
    const isTrans = (a?: Action) => !a || a.type === 'trans'
    const out: string[] = []
    for (let i = 0; i < n; i++) {
      const e = enc[i]
      if (!e || (isTrans(e.cw) && isTrans(e.ccw))) {
        out.push('&trans')
        continue
      }
      if (isTrans(e.cw) !== isTrans(e.ccw)) this.warn(`Layer "${layer.name}" encoder ${i + 1}: one direction is transparent; it does nothing instead`)
      const cw = isTrans(e.cw) ? { type: 'none' } as Action : e.cw!
      const ccw = isTrans(e.ccw) ? { type: 'none' } as Action : e.ccw!
      const kp = (a: Action) => (a.type === 'key' ? this.keyParam(a.code, a.mods) : a.type === 'none' ? 'NONE' : undefined)
      const pc = kp(cw)
      const pcc = kp(ccw)
      if (pc !== undefined && pcc !== undefined && (cw.type === 'key' || ccw.type === 'key')) {
        this.refs.add('kp')
        out.push(`&inc_dec_kp ${pc} ${pcc}`)
      } else out.push(this.sensorRotate(this.action(cw), this.action(ccw)))
    }
    while (out.length && out[out.length - 1] === '&trans') out.pop()
    if (out.includes('&trans')) this.sensorTrans = true
    return out.length ? out.join(' ') : undefined
  }

  private sensorRotate(cw: string, ccw: string): string {
    const key = JSON.stringify([cw, ccw])
    let sr = this.sensorRotates.get(key)
    if (!sr) {
      const label = uniqueName(`enc_${sanitizeIdent(cw.replace(/&/g, ''), 'b').slice(0, 24)}`, this.labels)
      const node = [
        `${I2}${label}: ${label} {`,
        `${I3}compatible = "zmk,behavior-sensor-rotate";`,
        `${I3}#sensor-binding-cells = <0>;`,
        `${I3}bindings = <${cw}>, <${ccw}>;`,
        `${I2}};`,
      ].join('\n')
      sr = { label, node }
      this.sensorRotates.set(key, sr)
    }
    return `&${sr.label}`
  }

  usesEncoders = false
  /** &trans used inside sensor-bindings (needs #sensor-binding-cells, see below) */
  sensorTrans = false

  private hand(pos: number): 'L' | 'R' | undefined {
    const h = this.kb.hands?.[pos]
    if (!h) this.warn('Positional hold-tap needs hand information for this keyboard; ignored')
    return h
  }

  private holdTapProps(): string[] {
    const s = this.s
    const out = [`flavor = "${s.holdTapFlavor}";`, `tapping-term-ms = <${s.tappingTerm}>;`]
    if (s.quickTap > 0) out.push(`quick-tap-ms = <${s.quickTap}>;`)
    if (s.requirePriorIdle > 0) out.push(`require-prior-idle-ms = <${s.requirePriorIdle}>;`)
    if (s.holdWhileUndecided) out.push('hold-while-undecided;')
    return out
  }

  usesBuiltinHoldTap(): boolean {
    return this.refs.has('mt') || this.refs.has('lt') || this.holdTaps.size > 0
  }

  /** Global hold-tap settings applied to the stock &mt / &lt. */
  holdTapOverrides(): string {
    const out: string[] = []
    for (const l of ['mt', 'lt']) {
      if (!this.refs.has(l)) continue
      const props = this.holdTapProps()
      if (this.s.holdTriggerOnRelease) props.push('hold-trigger-on-release;')
      out.push(`&${l} {\n${props.map((p) => I1 + p).join('\n')}\n};`)
    }
    return out.join('\n\n')
  }

  private holdTap(cfg: HoldTapCfg): string {
    const key = JSON.stringify([cfg.hold.ref, cfg.tap.ref, cfg.term, cfg.side, cfg.retro])
    let ht = this.holdTaps.get(key)
    if (!ht) {
      const h = cfg.hold.ref.slice(1)
      const t = cfg.tap.ref.slice(1)
      let base = h === 'kp' && t === 'kp' ? 'mt' : h === 'mo' && t === 'kp' ? 'lt' : `ht_${h}_${t}`
      if (cfg.side) base += `_${cfg.side.toLowerCase()}`
      if (cfg.retro) base += '_rt'
      if (cfg.term !== undefined) base += `_${cfg.term}`
      const label = uniqueName(sanitizeIdent(base, 'ht'), this.labels)
      const props = [
        'compatible = "zmk,behavior-hold-tap";',
        '#binding-cells = <2>;',
        `bindings = <${cfg.hold.ref}>, <${cfg.tap.ref}>;`,
        ...this.holdTapProps(),
      ]
      if (cfg.term !== undefined) props[props.findIndex((p) => p.startsWith('tapping-term-ms'))] = `tapping-term-ms = <${cfg.term}>;`
      if (cfg.side) {
        const opposite = (this.kb.hands ?? []).flatMap((hand, i) => (hand && hand !== cfg.side ? [i] : []))
        props.push(`hold-trigger-key-positions = <${opposite.join(' ')}>;`)
      }
      if (this.s.holdTriggerOnRelease) props.push('hold-trigger-on-release;')
      if (cfg.retro) props.push('retro-tap;')
      const node = [`${I2}${label}: ${label} {`, ...props.map((p) => I3 + p), `${I2}};`].join('\n')
      ht = { label, node }
      this.holdTaps.set(key, ht)
    }
    return this.ref(ht.label)
  }

  private tapDance(first: string, second: string): string {
    const key = JSON.stringify([first, second])
    let td = this.tapDances.get(key)
    if (!td) {
      const label = uniqueName(`td_${sanitizeIdent(first.replace(/&/g, ''), 'k').slice(0, 24)}`, this.labels)
      const node = [
        `${I2}${label}: ${label} {`,
        `${I3}compatible = "zmk,behavior-tap-dance";`,
        `${I3}#binding-cells = <0>;`,
        `${I3}tapping-term-ms = <${this.s.tapDanceTerm}>;`,
        `${I3}bindings = <${first}>, <${second}>;`,
        `${I2}};`,
      ].join('\n')
      td = { label, node }
      this.tapDances.set(key, td)
    }
    return this.ref(td.label)
  }

  // ---- macros -------------------------------------------------------------

  macro(m: Macro): string {
    const label = this.macroLabel.get(m.id)!
    const groups: string[] = []
    let mode: 'tap' | 'press' | 'release' = 'tap'
    let cur: string[] = []
    const flush = () => {
      if (cur.length) groups.push(cur.join(' '))
      cur = []
    }
    const setMode = (next: 'tap' | 'press' | 'release') => {
      if (mode === next) return
      flush()
      mode = next
      cur.push(`&macro_${next}`)
    }
    const wait = m.wait ?? 15
    for (const step of m.steps as MacroStep[]) {
      switch (step.type) {
        case 'tap': case 'press': case 'release':
          setMode(step.type)
          cur.push(this.action(step.action))
          break
        case 'text':
          setMode('tap')
          for (const ch of step.text) {
            const k = charToKey(ch, this.s.locale)
            if (!k) {
              this.warn(`Macro "${m.name}": no key for character ${JSON.stringify(ch)} in locale ${this.s.locale}; skipped`)
              continue
            }
            const mods: Mod[] = []
            if (k.altgr) mods.push('RALT')
            if (k.shift) mods.push('LSHIFT')
            cur.push(`${this.ref('kp')} ${wrapMods(k.code, mods)}`)
            // dead key on this OS layout: SPACE yields the bare character
            if (k.dead) cur.push(`${this.ref('kp')} SPACE`)
          }
          break
        case 'delay':
          flush()
          groups.push(`&macro_wait_time ${Math.max(0, Math.round(step.ms))}`)
          mode = 'tap'
          groups.push('&macro_tap &none')
          groups.push(`&macro_wait_time ${wait}`)
          break
        case 'pauseForRelease':
          flush()
          groups.push('&macro_pause_for_release')
          break
      }
    }
    flush()
    if (!groups.length) groups.push('&none')
    const props = ['compatible = "zmk,behavior-macro";', '#binding-cells = <0>;']
    if (m.wait !== undefined) props.push(`wait-ms = <${m.wait}>;`)
    if (m.tap !== undefined) props.push(`tap-ms = <${m.tap}>;`)
    const bindings = groups.length === 1
      ? [`bindings = <${groups[0]}>;`]
      : ['bindings', ...groups.map((g, i) => `${i === 0 ? '= ' : ', '}<${g}>`)].map((l, i) => (i === 0 ? l : I1 + l))
    if (bindings.length > 1) bindings[bindings.length - 1] += ';'
    return [`${I2}${label}: ${label} {`, ...[...props, ...bindings].map((p) => I3 + p), `${I2}};`].join('\n')
  }

  // ---- combos -------------------------------------------------------------

  combo(c: Combo, used: Set<string>): string | undefined {
    const n = this.kb.keys.length
    const keys = [...new Set(c.keys)].filter((k) => k >= 0 && k < n)
    if (keys.length !== c.keys.length) this.warn(`Combo "${c.name}": invalid or duplicate key positions removed`)
    if (keys.length < 2) {
      this.warn(`Combo "${c.name}" needs at least two keys; skipped`)
      return undefined
    }
    const name = uniqueName(`combo_${sanitizeIdent(c.name, 'c')}`, used)
    const props = [
      `timeout-ms = <${c.timeout ?? this.s.comboTimeout}>;`,
      `key-positions = <${keys.join(' ')}>;`,
      `bindings = <${this.action(c.action)}>;`,
    ]
    const layers = c.layers.filter((id) => this.layerIndex.has(id))
    if (layers.length && layers.length < this.layout.layers.length) {
      props.push(`layers = <${layers.map((id) => this.layerRef(id)).join(' ')}>;`)
    }
    if (c.requirePriorIdle !== undefined && c.requirePriorIdle > 0) props.push(`require-prior-idle-ms = <${c.requirePriorIdle}>;`)
    if (c.slowRelease) props.push('slow-release;')
    return [`${I2}${name} {`, ...props.map((p) => I3 + p), `${I2}};`].join('\n')
  }

  synthesizedNodes(): { behaviors: string[]; macros: string[] } {
    return {
      behaviors: [...this.modMorphs.values(), ...this.holdTaps.values(), ...this.tapDances.values(), ...this.sensorRotates.values()].map((x) => x.node),
      macros: [...this.wrappers.values()].map((x) => x.node),
    }
  }
}

function isReservedDefine(name: string): boolean {
  if (/^(CONFIG|BT|RGB|OUT|EXT|BL|MOD|ZMK|DT|LC|LS|LA|LG|RC|RS|RA|RG|MOVE|SCRL|MB|C|K)_?$/.test(name)) return true
  if (/^(BT|RGB|OUT|EP|BL|MOD|ZMK|DT|MOVE|SCRL|MB|INPUT|HID|KEY|LCLK|RCLK|MCLK)_/.test(name)) return true
  try {
    return !!findKeycode(name)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// bindings pretty-printer

function formatBindings(bindings: string[], kb: KeyboardDef, indent: string): string {
  type Cell = { col: number; text: string }
  const lines: Cell[][] = []
  // A new row starts when the key order wraps back to the left, or jumps down
  // by more than a row (column stagger moves keys within a row by < 1u).
  let prevY = 0
  let prevX = -Infinity
  bindings.forEach((text, i) => {
    const k = kb.keys[i]
    const x = k ? k.x : prevX + 1
    const y = k ? k.y : prevY
    if (!lines.length || x <= prevX || Math.abs(y - prevY) >= 1.5) lines.push([])
    const line = lines[lines.length - 1]
    let col = Math.round(x)
    if (line.length && col <= line[line.length - 1].col) col = line[line.length - 1].col + 1
    line.push({ col, text })
    prevY = y
    prevX = x
  })
  const width = new Map<number, number>()
  for (const line of lines) for (const c of line) width.set(c.col, Math.max(width.get(c.col) ?? 0, c.text.length))
  const cols = [...width.keys()].sort((a, b) => a - b)
  return lines
    .map((line) => {
      const byCol = new Map(line.map((c) => [c.col, c.text]))
      let out = ''
      for (const col of cols) {
        const w = width.get(col)!
        const t = byCol.get(col)
        out += (t ?? '').padEnd(w + 2)
      }
      return indent + out.trimEnd()
    })
    .join('\n')
}

/**
 * extraKeymap is placed inside the root node, except `&label { ... };`
 * overrides (e.g. enabling an encoder node), which must be at top level.
 */
export function splitExtraKeymap(text: string): { inner: string; top: string } {
  const inner: string[] = []
  const top: string[] = []
  let i = 0
  const src = text.trim()
  while (i < src.length) {
    // one top-level statement: up to `;` at brace depth 0
    let depth = 0
    let j = i
    let inStr = false
    for (; j < src.length; j++) {
      const ch = src[j]
      if (inStr) {
        if (ch === '\\') j++
        else if (ch === '"') inStr = false
      } else if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === ';' && depth <= 0) break
    }
    const stmt = src.slice(i, j + 1).trim()
    if (stmt) (stmt.startsWith('&') ? top : inner).push(stmt)
    i = j + 1
  }
  // keep hand-written formatting untouched unless something needs hoisting
  if (!top.length) return { inner: src, top: '' }
  return { inner: inner.join('\n\n'), top: top.join('\n\n') }
}

function dtString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function includeLine(inc: string): string {
  const t = inc.trim()
  if (t.startsWith('#include')) return t
  if (t.startsWith('<') || t.startsWith('"')) return `#include ${t}`
  return `#include <${t}>`
}

// ---------------------------------------------------------------------------

export function compileKeymap(layout: Layout, kb: KeyboardDef): CompileResult {
  const c = new Compiler(layout, kb)
  const s = layout.settings
  const nKeys = kb.keys.length

  if (!layout.layers.length) c.warn('Layout has no layers')

  // layers
  const layerNodes: string[] = []
  const usedNodeNames = new Set<string>()
  layout.layers.forEach((layer, li) => {
    if (layer.keys.length !== nKeys) {
      c.warn(`Layer "${layer.name}" has ${layer.keys.length} keys but ${kb.name} has ${nKeys}; ${layer.keys.length > nKeys ? 'truncated' : 'padded'}`)
    }
    const bindings: string[] = []
    for (let i = 0; i < nKeys; i++) {
      const k = layer.keys[i]
      bindings.push(k ? c.key(k, i) : li === 0 ? '&none' : '&trans')
    }
    const nodeName = uniqueName(`${sanitizeIdent(layer.name, 'layer')}_layer`, usedNodeNames)
    const sensors = c.sensorBindings(layer)
    if (sensors !== undefined) c.usesEncoders = true
    layerNodes.push([
      `${I2}${nodeName} {`,
      `${I3}display-name = ${dtString(layer.name)};`,
      `${I3}bindings = <`,
      formatBindings(bindings, kb, I3 + I1),
      `${I3}>;`,
      ...(sensors !== undefined ? [`${I3}sensor-bindings = <${sensors}>;`] : []),
      `${I2}};`,
    ].join('\n'))
  })

  // combos
  const comboNames = new Set<string>()
  const comboNodes = layout.combos.map((cb) => c.combo(cb, comboNames)).filter((x): x is string => !!x)

  // macros
  const macroNodes = layout.macros.map((m) => c.macro(m))

  const synth = c.synthesizedNodes()

  // includes from referenced behaviors
  const includes = new Set<string>(['#include <behaviors.dtsi>', '#include <dt-bindings/zmk/keys.h>'])
  const behaviorKconfig: string[] = []
  for (const r of c.refs) {
    const b = getBehavior(r)
    if (!b) continue
    if (b.include) includes.add(includeLine(b.include))
    // Studio is enabled per-target via build.yaml (central only), never in the shared .conf
    if (b.kconfig) behaviorKconfig.push(...b.kconfig.filter((l) => !l.startsWith('CONFIG_ZMK_STUDIO=')))
  }
  if (c.refs.has('studio_unlock') && !s.studio) {
    c.warn('&studio_unlock is used but ZMK Studio is disabled in settings')
  }
  // ---- assemble keymap ----
  const out: string[] = []
  out.push('/*')
  out.push(` * ${layout.name || 'Untitled layout'} — ${kb.name}`)
  out.push(' * Generated by zmk-configurator. Edits made here are preserved when this')
  out.push(' * file is imported again, but regenerating it overwrites them.')
  out.push(' */')
  out.push('')
  out.push(...includes)
  out.push('')
  for (const d of c.layerDefines()) out.push(`#define ${d.name} ${d.index}`)
  out.push('')

  const overrides: string[] = []
  const htOver = c.holdTapOverrides()
  if (htOver) overrides.push(htOver)
  if (c.refs.has('sk')) {
    const p: string[] = []
    if (s.stickyKeyTimeout !== ZMK.stickyReleaseMs) p.push(`release-after-ms = <${s.stickyKeyTimeout}>;`)
    if (s.stickyQuickRelease) p.push('quick-release;')
    if (p.length) overrides.push(`&sk {\n${p.map((x) => I1 + x).join('\n')}\n};`)
  }
  if (c.sensorTrans) {
    // &trans has no #sensor-binding-cells, so devicetree rejects it in sensor-bindings.
    // With the property it is accepted; at runtime it does not handle sensor data,
    // and the keymap falls through to the next active layer.
    overrides.push(`&trans {\n${I1}#sensor-binding-cells = <0>;\n};`)
  }
  if (c.refs.has('sl') && s.stickyKeyTimeout !== ZMK.stickyReleaseMs) {
    overrides.push(`&sl {\n${I1}release-after-ms = <${s.stickyKeyTimeout}>;\n};`)
  }
  if (overrides.length) {
    out.push(overrides.join('\n\n'))
    out.push('')
  }

  out.push('/ {')
  const sections: string[] = []
  if (synth.behaviors.length) sections.push(`${I1}behaviors {\n${synth.behaviors.join('\n\n')}\n${I1}};`)
  const allMacros = [...macroNodes, ...synth.macros]
  if (allMacros.length) sections.push(`${I1}macros {\n${allMacros.join('\n\n')}\n${I1}};`)
  if (comboNodes.length) sections.push(`${I1}combos {\n${I2}compatible = "zmk,combos";\n\n${comboNodes.join('\n\n')}\n${I1}};`)
  sections.push(`${I1}keymap {\n${I2}compatible = "zmk,keymap";\n\n${layerNodes.join('\n\n')}\n${I1}};`)
  const extra = splitExtraKeymap(s.extraKeymap ?? '')
  if (extra.inner) {
    sections.push(extra.inner.split('\n').map((l) => (l ? I1 + l : l)).join('\n'))
  }
  out.push(sections.join('\n\n'))
  out.push('};')
  if (extra.top) {
    out.push('')
    out.push(extra.top)
  }
  if (kb.notes?.trim()) {
    out.push('')
    out.push(kb.notes.trim())
  }
  out.push('')
  out.push(`/* ${METADATA_PREFIX}${LZString.compressToBase64(JSON.stringify(layout))} */`)
  out.push('')

  // encoders: the shield/board enables its encoder nodes; the EC11 driver is opt-in
  buildTargets(layout, kb, c.warnings)
  if (c.usesEncoders) behaviorKconfig.push('CONFIG_EC11=y', 'CONFIG_EC11_TRIGGER_GLOBAL_THREAD=y')
  const { conf, centralConf } = compileConf(layout, kb, behaviorKconfig)
  return { keymap: out.join('\n'), conf, centralConf, warnings: c.warnings }
}

// ---------------------------------------------------------------------------
// Kconfig

function compileConf(layout: Layout, kb: KeyboardDef, behaviorKconfig: string[]): { conf: string; centralConf: string } {
  const s = layout.settings
  const main = new Map<string, string>()
  const central = new Map<string, string>()
  const set = (m: Map<string, string>, k: string, v: string | number | boolean) =>
    m.set(k, typeof v === 'boolean' ? (v ? 'y' : 'n') : String(v))
  const centralTarget = kb.split ? central : main

  if (s.sleepEnabled) {
    set(main, 'CONFIG_ZMK_SLEEP', true)
    const ms = Math.round(s.sleepTimeoutMin * 60000)
    if (ms !== ZMK.sleepTimeoutMs) set(main, 'CONFIG_ZMK_IDLE_SLEEP_TIMEOUT', ms)
  }
  const idle = Math.round(s.idleTimeoutSec * 1000)
  if (idle !== ZMK.idleTimeoutMs) set(main, 'CONFIG_ZMK_IDLE_TIMEOUT', idle)
  if (s.rgbUnderglow) {
    set(main, 'CONFIG_ZMK_RGB_UNDERGLOW', true)
    set(main, 'CONFIG_WS2812_STRIP', true)
    if (s.rgbAutoOffIdle) set(main, 'CONFIG_ZMK_RGB_UNDERGLOW_AUTO_OFF_IDLE', true)
  }
  if (s.backlight) set(main, 'CONFIG_ZMK_BACKLIGHT', true)
  if (s.display) set(main, 'CONFIG_ZMK_DISPLAY', true)
  if (s.pointing) set(main, 'CONFIG_ZMK_POINTING', true)
  if (s.nkro) set(main, 'CONFIG_ZMK_HID_REPORT_TYPE_NKRO', true)
  if (s.bleTxPowerPlus8) set(main, 'CONFIG_BT_CTLR_TX_PWR_PLUS_8', true)
  if (s.btMaxConnections !== ZMK.btMaxConn) {
    // ZMK docs: on splits, set only on the central and add one for the peripheral link.
    const n = s.btMaxConnections + (kb.split ? 1 : 0)
    set(centralTarget, 'CONFIG_BT_MAX_CONN', n)
    set(centralTarget, 'CONFIG_BT_MAX_PAIRED', n)
  }
  if (kb.split && s.splitBatteryFetching) {
    set(central, 'CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING', true)
    set(central, 'CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY', true)
  }
  if (s.usbLogging) set(main, 'CONFIG_ZMK_USB_LOGGING', true)
  if (s.debounceMs !== ZMK.debounceMs) {
    set(main, 'CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS', s.debounceMs)
    set(main, 'CONFIG_ZMK_KSCAN_DEBOUNCE_RELEASE_MS', s.debounceMs)
  }
  for (const line of behaviorKconfig) {
    const m = /^\s*(CONFIG_[A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !main.has(m[1])) main.set(m[1], m[2])
  }

  const render = (m: Map<string, string>, title: string, extra = '') => {
    const lines = [`# ${title}`, '# Generated by zmk-configurator.', '']
    for (const [k, v] of m) lines.push(`${k}=${v}`)
    if (extra.trim()) lines.push('', '# Extra configuration', extra.trim())
    return lines.join('\n') + '\n'
  }
  return {
    conf: render(main, `${layout.name || 'Layout'} — ${kb.name}`, s.extraConf),
    centralConf: kb.split ? render(central, 'Split central only') : '',
  }
}

// ---------------------------------------------------------------------------
// repository

/** ZMK revisions that still use Zephyr's hardware model v1 board names (v0.3 and older). */
export function isHwmV1Revision(rev: string): boolean {
  return /^v0\.[0-3](\b|[.-]|$)/.test(rev)
}

/**
 * v0.3 board name -> HWMv2 name used by ZMK main (Zephyr 4.1). From the table in
 * docs/blog/2025-12-09-zephyr-4-1.md and app/boards/** /board.yml on main
 * (every in-tree board except glove80 gained a `zmk` variant).
 */
export const HWMV2_BOARD_NAMES: Record<string, string> = {
  nice_nano: 'nice_nano@1//zmk',
  nice_nano_v2: 'nice_nano//zmk',
  nrfmicro_11: 'nrfmicro@1.1/nrf52840/zmk',
  nrfmicro_11_flipped: 'nrfmicro@1.1/nrf52840/flipped_zmk',
  nrfmicro_13: 'nrfmicro/nrf52840/zmk',
  nrfmicro_13_52833: 'nrfmicro/nrf52833/zmk',
  mikoto: 'mikoto//zmk',
  seeeduino_xiao_rp2040: 'xiao_rp2040//zmk',
  seeeduino_xiao_ble: 'xiao_ble//zmk',
  seeeduino_xiao: 'seeeduino_xiao//zmk',
  bluemicro840_v1: 'bluemicro840//zmk',
  puchi_ble_v1: 'puchi_ble//zmk',
  sparkfun_pro_micro_rp2040: 'sparkfun_pro_micro_rp2040//zmk',
  adafruit_kb2040: 'adafruit_kb2040//zmk',
  adafruit_qt_py_rp2040: 'adafruit_qt_py_rp2040//zmk',
  boardsource_blok: 'boardsource_blok//zmk',
  proton_c: 'proton_c//zmk',
  nrf52840_m2: 'nrf52840_m2//zmk',
  adv360pro_left: 'adv360pro_left//zmk',
  adv360pro_right: 'adv360pro_right//zmk',
  bdn9_rev2: 'bdn9//zmk',
  bt60_v1: 'bt60@1//zmk',
  bt60_v2: 'bt60//zmk',
  bt60_v1_hs: 'bt60_hs//zmk',
  bt65_v1: 'bt65//zmk',
  bt75_v1: 'bt75//zmk',
  corneish_zen_v1_left: 'corneish_zen_left@1//zmk',
  corneish_zen_v1_right: 'corneish_zen_right@1//zmk',
  corneish_zen_v2_left: 'corneish_zen_left//zmk',
  corneish_zen_v2_right: 'corneish_zen_right//zmk',
  ferris_rev02: 'ferris//zmk',
  glove80_lh: 'glove80_lh',
  glove80_rh: 'glove80_rh',
  kbdfans_tofu65_v2: 'tofu65//zmk',
  nice60: 'nice60//zmk',
  planck_rev6: 'planck//zmk',
  preonic_rev3: 'preonic//zmk',
  s40nc: 's40nc//zmk',
}

/** Build targets: [{board, shield?, central}] — the first target is the split central. */
export function buildTargets(layout: Layout, kb: KeyboardDef, warnings?: string[]): { board: string; shield?: string; central: boolean }[] {
  const rev = layout.settings.zmkRevision || 'main'
  const name = (b: string) => {
    if (isHwmV1Revision(rev) || b.includes('/') || b.includes('@')) return b
    const v2 = HWMV2_BOARD_NAMES[b]
    if (v2) return v2
    warnings?.push(`Board "${b}" has no known HWMv2 name for ZMK ${rev}; check the board name in build.yaml`)
    return b
  }
  if (kb.kind === 'shield') {
    const board = name(layout.controller ?? kb.defaultController ?? 'nice_nano_v2')
    const shields = kb.shields?.length ? kb.shields : [kb.zmkName]
    return shields.map((shield, i) => ({ board, shield, central: i === 0 }))
  }
  const boards = kb.boards?.length ? kb.boards : [kb.zmkName]
  return boards.map((board, i) => ({ board: name(board), central: i === 0 }))
}

export function generateConfigRepo(layout: Layout, kb: KeyboardDef): Record<string, string> {
  const s = layout.settings
  const rev = s.zmkRevision || 'main'
  const { keymap, conf, centralConf } = compileKeymap(layout, kb)
  const targets = buildTargets(layout, kb)
  const files: Record<string, string> = {}

  files['config/west.yml'] = [
    'manifest:',
    '  remotes:',
    '    - name: zmkfirmware',
    '      url-base: https://github.com/zmkfirmware',
    '  projects:',
    '    - name: zmk',
    '      remote: zmkfirmware',
    `      revision: ${rev}`,
    '      import: app/west.yml',
    '  self:',
    '    path: config',
    '',
  ].join('\n')

  const build: string[] = [
    '# Firmware build matrix for the ZMK GitHub Actions workflow.',
    '# See https://zmk.dev/docs/user-setup',
    '---',
    'include:',
  ]
  for (const t of targets) {
    build.push(`  - board: ${t.board}`)
    if (t.shield) build.push(`    shield: ${t.shield}`)
    if (s.studio && t.central) {
      build.push('    snippet: studio-rpc-usb-uart')
      build.push('    cmake-args: -DCONFIG_ZMK_STUDIO=y')
    }
  }
  files['build.yaml'] = build.join('\n') + '\n'

  files['.github/workflows/build.yml'] = [
    'name: Build ZMK firmware',
    'on: [push, pull_request, workflow_dispatch]',
    '',
    'jobs:',
    '  build:',
    `    uses: zmkfirmware/zmk/.github/workflows/build-user-config.yml@${rev}`,
    '',
  ].join('\n')

  files[`config/${kb.zmkName}.keymap`] = keymap
  files[`config/${kb.zmkName}.conf`] = conf
  const central = targets.find((t) => t.central)
  if (kb.split && central && centralConf.split('\n').some((l) => l.startsWith('CONFIG_'))) {
    // HWMv2 names carry @revision / qualifiers; the conf file uses the bare board name
    const name = central.shield ?? central.board.split(/[@/]/)[0]
    if (name !== kb.zmkName) files[`config/${name}.conf`] = centralConf
  }
  files['config/zmk-configurator.json'] = JSON.stringify(layout, null, 2) + '\n'

  const targetList = targets.map((t) => `- \`${t.board}${t.shield ? ` / ${t.shield}` : ''}\`${t.central && targets.length > 1 ? ' (central)' : ''}`)
  files['README.md'] = [
    `# ${layout.name || 'ZMK config'}`,
    '',
    layout.description || `ZMK firmware configuration for ${kb.name}.`,
    '',
    `Generated by zmk-configurator for ZMK \`${rev}\`.`,
    '',
    '## Build',
    '',
    'Push this repository to GitHub. The **Build ZMK firmware** workflow builds every',
    'target in `build.yaml`; download the firmware from the run\'s artifacts and flash',
    'the `.uf2` files by double-tapping reset and copying them to the USB drive.',
    '',
    'Targets:',
    '',
    ...targetList,
    '',
    '## Files',
    '',
    `- \`config/${kb.zmkName}.keymap\` — keymap (devicetree)`,
    `- \`config/${kb.zmkName}.conf\` — Kconfig options`,
    '- `config/zmk-configurator.json` — the layout, for re-importing into the configurator',
    '- `config/west.yml` — pins the ZMK revision',
    '',
  ].join('\n')
  return files
}
