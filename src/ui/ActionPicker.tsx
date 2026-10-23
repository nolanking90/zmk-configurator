import { useEffect, useMemo, useState } from 'react'
import type { Action, LayerMode, Layout, Mod } from '../model/types'
import { ALL_MODS } from '../model/types'
import { KEYCODES, KEY_SEARCH, canonicalCode, isModifierCode, type KeyCategory, type KeycodeDef } from '../data/keycodes'
import { BEHAVIOR_PRESETS, BEHAVIORS, getBehavior, type BehaviorPreset } from '../data/behaviors'
import { LAYER_MODE_NAME, MOD_NAME, actionDescription, keyLabel, sameAction } from '../lib/labels'
import { domCodeToZmk } from '../lib/domcodes'
import { SHORTCUTS } from '../data/shortcuts'

type Cat =
  | KeyCategory
  | 'basic'
  | 'layers'
  | 'macros'
  | 'shortcuts'
  | 'bluetooth'
  | 'lighting'
  | 'mouse'
  | 'systemb'
  | 'custom'

const CATS: { id: Cat; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'letters', name: 'Letters' },
  { id: 'numbers', name: 'Numbers' },
  { id: 'symbols', name: 'Symbols' },
  { id: 'function', name: 'F-keys' },
  { id: 'navigation', name: 'Navigation' },
  { id: 'editing', name: 'Editing' },
  { id: 'modifiers', name: 'Modifiers' },
  { id: 'layers', name: 'Layers' },
  { id: 'shortcuts', name: 'Shortcuts' },
  { id: 'macros', name: 'Macros' },
  { id: 'media', name: 'Media' },
  { id: 'mouse', name: 'Mouse' },
  { id: 'bluetooth', name: 'Bluetooth' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'systemb', name: 'Firmware' },
  { id: 'keypad', name: 'Keypad' },
  { id: 'app', name: 'Apps' },
  { id: 'system', name: 'Power' },
  { id: 'international', name: 'Intl' },
  { id: 'other', name: 'Other' },
  { id: 'custom', name: 'Custom' },
]

const BEHAVIOR_CAT: Partial<Record<Cat, string[]>> = {
  bluetooth: ['bluetooth', 'output'],
  lighting: ['lighting'],
  mouse: ['mouse'],
  systemb: ['system', 'power', 'misc'],
}

export interface ActionPickerProps {
  value: Action | undefined
  onChange: (a: Action | undefined) => void
  layout: Layout
  /** which slot is being edited; affects defaults (hold => momentary layers) */
  slot?: 'tap' | 'hold' | 'doubleTap' | 'tapHold' | 'combo' | 'macro'
  allowEmpty?: boolean
  onCreateMacro?: () => void
}

function codeOf(a?: Action): string | undefined {
  return a && (a.type === 'key' || a.type === 'sticky') ? canonicalCode(a.code) : undefined
}

export function ActionPicker({ value, onChange, layout, slot = 'tap', allowEmpty, onCreateMacro }: ActionPickerProps) {
  const [cat, setCat] = useState<Cat>('basic')
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const locale = layout.settings.locale
  const curCode = codeOf(value)
  const mods: Mod[] = value && (value.type === 'key' || value.type === 'sticky') ? (value.mods ?? []) : []
  const sticky = value?.type === 'sticky'

  useEffect(() => {
    if (!listening) return
    const h = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const z = domCodeToZmk(e.code)
      if (z) setKey(canonicalCode(z))
      setListening(false)
    }
    window.addEventListener('keydown', h, { capture: true })
    return () => window.removeEventListener('keydown', h, { capture: true })
  })

  const setKey = (code: string) => {
    const keepMods = isModifierCode(code) ? [] : mods
    onChange({ type: sticky ? 'sticky' : 'key', code, ...(keepMods.length ? { mods: keepMods } : {}) })
  }

  const toggleMod = (m: Mod) => {
    if (!value || (value.type !== 'key' && value.type !== 'sticky')) {
      // a modifier on its own
      onChange({ type: 'key', code: canonicalCode(m) })
      return
    }
    const next = mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m]
    onChange({ ...value, mods: next.length ? next : undefined })
  }

  const toggleSticky = () => {
    if (!value || (value.type !== 'key' && value.type !== 'sticky')) return
    onChange({ ...value, type: value.type === 'sticky' ? 'key' : 'sticky' })
  }

  const results = useMemo(() => (query.trim() ? KEY_SEARCH(query.trim()).slice(0, 80) : []), [query])
  const presetResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return BEHAVIOR_PRESETS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.label.toLowerCase().includes(q) || p.behavior === q,
    ).slice(0, 30)
  }, [query])

  const keyButton = (k: KeycodeDef) => (
    <button
      key={k.code}
      className={`pick ${curCode === k.code ? 'active' : ''}`}
      title={`${k.name}  (${[k.code, ...k.aliases].join(', ')})`}
      onClick={() => setKey(k.code)}
    >
      <span>{keyLabel(k.code, locale)}</span>
      <small>{k.code.length <= 10 ? k.code : k.name.slice(0, 14)}</small>
    </button>
  )

  const presetButton = (p: BehaviorPreset) => {
    const a: Action = { type: 'behavior', behavior: p.behavior, params: p.params }
    return (
      <button
        key={p.behavior + p.params.join(' ')}
        className={`pick ${sameAction(value, a) ? 'active' : ''}`}
        title={p.name}
        onClick={() => onChange(a)}
      >
        <span style={{ fontSize: p.label.length > 6 ? 10.5 : 13 }}>{p.label}</span>
        <small>{p.name.slice(0, 22)}</small>
      </button>
    )
  }

  const simple = (a: Action, label: string, sub: string) => (
    <button key={label} className={`pick ${sameAction(value, a) ? 'active' : ''}`} onClick={() => onChange(a)}>
      <span>{label}</span>
      <small>{sub}</small>
    </button>
  )

  const BASIC = [
    'ESC', 'TAB', 'RET', 'SPACE', 'BSPC', 'DEL', 'LSHIFT', 'LCTRL', 'LALT', 'LGUI',
    'LEFT', 'DOWN', 'UP', 'RIGHT', 'HOME', 'END', 'PG_UP', 'PG_DN', 'CAPS', 'K_APP',
  ]

  let body: React.ReactNode
  if (query.trim()) {
    body = (
      <div className="picker-grid">
        {results.map(keyButton)}
        {presetResults.map(presetButton)}
        {!results.length && !presetResults.length && <span className="muted">No matches</span>}
      </div>
    )
  } else if (cat === 'basic') {
    body = (
      <div className="picker-grid">
        {simple({ type: 'none' }, '∅', 'None')}
        {simple({ type: 'trans' }, '▽', 'Transparent')}
        {BASIC.map((c) => KEYCODES.find((k) => k.code === canonicalCode(c))).filter(Boolean).map((k) => keyButton(k!))}
        {getBehavior('caps_word') && presetButton(BEHAVIOR_PRESETS.find((p) => p.behavior === 'caps_word')!)}
        {getBehavior('key_repeat') && presetButton(BEHAVIOR_PRESETS.find((p) => p.behavior === 'key_repeat')!)}
      </div>
    )
  } else if (cat === 'layers') {
    const modes: LayerMode[] = slot === 'hold' || slot === 'tapHold' ? ['mo'] : ['mo', 'tog', 'to', 'sl']
    body = (
      <div className="col">
        {layout.layers.map((l, i) => (
          <div key={l.id} className="row wrap">
            <span className="layer-swatch" style={{ background: l.color ?? 'transparent' }} />
            <span style={{ minWidth: 140 }}>
              <span className="muted small">{i}</span> {l.name}
            </span>
            {modes.map((m) => {
              const a: Action = { type: 'layer', mode: m, layer: l.id }
              return (
                <button key={m} className={`small ${sameAction(value, a) ? 'active' : ''}`} onClick={() => onChange(a)}>
                  {LAYER_MODE_NAME[m]}
                </button>
              )
            })}
          </div>
        ))}
        <p className="help">
          Momentary: active while held. Toggle: on/off. Switch to: makes it the only active layer (plus base). One-shot:
          active for the next key press only. In the Hold slot a layer is always momentary (layer-tap).
        </p>
      </div>
    )
  } else if (cat === 'macros') {
    body = (
      <div className="col">
        <div className="picker-grid">
          {layout.macros.map((m) => simple({ type: 'macro', id: m.id }, m.name.slice(0, 10), 'Macro'))}
        </div>
        {!layout.macros.length && <span className="muted">No macros yet.</span>}
        {onCreateMacro && (
          <div>
            <button className="small" onClick={onCreateMacro}>
              + New macro
            </button>
          </div>
        )}
      </div>
    )
  } else if (cat === 'shortcuts') {
    body = (
      <div className="col">
        {(['win', 'mac'] as const).map((os) => (
          <div key={os}>
            <h3 style={{ margin: '4px 0 6px' }}>{os === 'win' ? 'Windows / Linux' : 'macOS'}</h3>
            <div className="picker-grid">
              {SHORTCUTS.filter((s) => s.os === os).map((s) =>
                simple({ type: 'key', code: canonicalCode(s.code), mods: s.mods }, s.label, s.name),
              )}
            </div>
          </div>
        ))}
      </div>
    )
  } else if (BEHAVIOR_CAT[cat]) {
    const cats = BEHAVIOR_CAT[cat]!
    const presets = BEHAVIOR_PRESETS.filter((p) => cats.includes(p.category))
    body = (
      <div className="picker-grid">
        {presets.map(presetButton)}
        {!presets.length && <span className="muted">Not available in this ZMK version.</span>}
      </div>
    )
  } else if (cat === 'custom') {
    body = <CustomAction value={value} onChange={onChange} />
  } else {
    const list = KEYCODES.filter((k) => k.category === cat)
    body = <div className="picker-grid">{list.map(keyButton)}</div>
  }

  const isKeyish = value?.type === 'key' || value?.type === 'sticky'

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row wrap">
        <input
          placeholder="Search keys, e.g. 'vol', 'ctrl', 'bt'…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260 }}
        />
        <button className={listening ? 'active' : ''} onClick={() => setListening(!listening)} title="Press a key on your keyboard to assign it">
          {listening ? 'Press a key…' : '⌨ Press to assign'}
        </button>
        {allowEmpty && (
          <button className="ghost" onClick={() => onChange(undefined)}>
            Clear
          </button>
        )}
        <span className="spacer" />
        <span className="muted small">{value ? actionDescription(value, layout) : 'Not set'}</span>
      </div>
      <div className="row wrap" style={{ gap: 4 }}>
        <span className="small muted" style={{ marginRight: 4 }}>
          Modifiers:
        </span>
        <div className="mods">
          {ALL_MODS.map((m) => (
            <button
              key={m}
              className={`small ${mods.includes(m) || (curCode && isModifierCode(curCode) === m) ? 'active' : ''}`}
              onClick={() => toggleMod(m)}
              title={isKeyish ? `Add ${MOD_NAME[m]} to this key` : `Send ${MOD_NAME[m]}`}
            >
              {MOD_NAME[m]}
            </button>
          ))}
        </div>
        <label className="check small" style={{ marginLeft: 8 }} title="One-shot: the key/modifier stays active for the next key press">
          <input type="checkbox" checked={sticky} disabled={!isKeyish} onChange={toggleSticky} /> One-shot
        </label>
      </div>
      {!query.trim() && (
        <div className="picker-cats">
          {CATS.map((c) => (
            <button key={c.id} className={`small ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {body}
    </div>
  )
}

function CustomAction({ value, onChange }: { value?: Action; onChange: (a: Action) => void }) {
  const [behavior, setBehavior] = useState(value?.type === 'behavior' ? value.behavior : BEHAVIORS[0]?.id ?? '')
  const def = getBehavior(behavior)
  const [params, setParams] = useState<string[]>(value?.type === 'behavior' ? value.params : [])
  const [raw, setRaw] = useState(value?.type === 'raw' ? value.code : '')
  return (
    <div className="col">
      <h3>ZMK behavior</h3>
      <div className="row wrap">
        <select value={behavior} onChange={(e) => { setBehavior(e.target.value); setParams([]) }}>
          {BEHAVIORS.map((b) => (
            <option key={b.id} value={b.id}>
              &{b.id} — {b.name}
            </option>
          ))}
        </select>
        {def?.params.map((p, i) =>
          p.kind === 'enum' && p.options ? (
            <select key={i} value={params[i] ?? ''} onChange={(e) => { const n = [...params]; n[i] = e.target.value; setParams(n) }}>
              <option value="">{p.name}…</option>
              {p.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input key={i} placeholder={p.name} value={params[i] ?? ''} style={{ width: 120 }}
              onChange={(e) => { const n = [...params]; n[i] = e.target.value; setParams(n) }} />
          ),
        )}
        <button
          className="primary small"
          disabled={!def || def.params.some((_, i) => !params[i])}
          onClick={() => onChange({ type: 'behavior', behavior, params: params.slice(0, def?.params.length ?? 0) })}
        >
          Use
        </button>
      </div>
      {def && <p className="help">{def.description}</p>}
      <hr />
      <h3>Raw binding</h3>
      <p className="help">Any ZMK binding, emitted verbatim — e.g. <code>&amp;my_behavior 1 2</code>. Define custom behaviors in Settings → Advanced.</p>
      <div className="row">
        <input className="grow mono" value={raw} placeholder="&kp LC(A)" onChange={(e) => setRaw(e.target.value)} />
        <button className="primary small" disabled={!raw.trim().startsWith('&')} onClick={() => onChange({ type: 'raw', code: raw.trim() })}>
          Use
        </button>
      </div>
    </div>
  )
}
