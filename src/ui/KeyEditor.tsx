import { useState } from 'react'
import type { Action, KeyConfig, Layout } from '../model/types'
import { useStore } from '../store/store'
import { ActionPicker } from './ActionPicker'
import { actionLabel } from '../lib/labels'
import { ColorPicker } from './ColorPicker'
import { Legend } from './Icon'
import { encoderAtKey, getKeyboard } from '../data/keyboards'

type KeySlot = 'tap' | 'hold' | 'doubleTap' | 'tapHold' | 'shifted'
type Slot = KeySlot | 'ccw' | 'cw'
const SLOTS: { id: KeySlot; name: string; help: string }[] = [
  { id: 'tap', name: 'Tap', help: 'Sent when the key is tapped.' },
  { id: 'hold', name: 'Hold', help: 'Sent when the key is held past the tapping term (mod-tap / layer-tap).' },
  { id: 'doubleTap', name: 'Double tap', help: 'Sent when the key is tapped twice quickly (tap dance).' },
  { id: 'tapHold', name: 'Tap + hold', help: 'Sent when the key is tapped once, then held (tap dance).' },
  { id: 'shifted', name: 'Shifted', help: 'Sent instead of the tap action while Shift is held (mod-morph), e.g. comma sends semicolon when shifted' },
]

export function KeyEditor({ layout, onCreateMacro }: { layout: Layout; onCreateMacro: () => void }) {
  const sel = useStore((s) => s.selection)
  const update = useStore((s) => s.update)
  const clipboard = useStore((s) => s.clipboard)
  const setClipboard = useStore((s) => s.setClipboard)
  const [slot, setSlot] = useState<Slot>('tap')
  const layer = layout.layers[sel.layer]
  const idx = sel.keys[0]
  if (!layer || idx === undefined) {
    return (
      <div className="panel editor-panel">
        <div className="editor-body muted">
          Select a key to edit it. Shift-click or Ctrl/Cmd-click to select several. Drag a key onto another to swap (hold Alt to copy).
          Shortcuts: Ctrl/Cmd+C and Ctrl/Cmd+V copy and paste keys, Delete clears, Ctrl/Cmd+Z undoes.
        </div>
      </div>
    )
  }
  const key: KeyConfig = layer.keys[idx] ?? {}
  const keys = sel.keys
  const kb = getKeyboard(layout.keyboard)
  const enc = kb ? encoderAtKey(kb, idx) : undefined
  const ENC_SLOTS: { id: 'ccw' | 'cw'; name: string; help: string }[] =
    enc === undefined ? [] : [
      { id: 'ccw', name: 'Rotate left', help: 'Sent for each counter-clockwise step of the encoder. Unset = falls through to lower layers.' },
      { id: 'cw', name: 'Rotate right', help: 'Sent for each clockwise step of the encoder. Unset = falls through to lower layers.' },
    ]
  const cur: Slot = (slot === 'ccw' || slot === 'cw') && enc === undefined ? 'tap' : slot
  const slotValue = (s: Slot) => (s === 'ccw' || s === 'cw' ? layer.encoders?.[enc!]?.[s] : key[s])

  const edit = (fn: (k: KeyConfig) => void, tag?: string) =>
    update(
      layout.id,
      (d) => {
        for (const i of keys) {
          const k = d.layers[sel.layer].keys[i] ?? (d.layers[sel.layer].keys[i] = {})
          fn(k)
        }
      },
      tag,
    )

  const setAction = (a: Action | undefined) => {
    if (cur === 'ccw' || cur === 'cw') {
      const n = kb?.encoders ?? 0
      return update(layout.id, (d) => {
        const l = d.layers[sel.layer]
        l.encoders ??= []
        while (l.encoders.length < n) l.encoders.push({})
        if (a && a.type !== 'trans') l.encoders[enc!][cur] = a
        else delete l.encoders[enc!][cur]
      })
    }
    const ks: KeySlot = cur
    edit((k) => {
      if (a === undefined || (ks !== 'tap' && a.type === 'none')) delete k[ks]
      else k[ks] = a
      if (ks === 'tap' && !a) k.tap = { type: 'none' }
    })
  }

  return (
    <div className="panel editor-panel">
      <div className="editor-head">
        <h2>
          {enc !== undefined ? `Encoder ${enc + 1}` : `Key ${idx}`}
          {keys.length > 1 && <span className="muted small"> + {keys.length - 1} more</span>}
        </h2>
        <span className="muted small">on layer “{layer.name}”</span>
        <span className="spacer" />
        <button className="small" onClick={() => setClipboard(structuredClone(key))} title="Copy key (Ctrl/Cmd+C)">
          Copy
        </button>
        <button className="small" disabled={!clipboard} onClick={() => clipboard && edit((k) => { Object.keys(k).forEach((p) => delete (k as Record<string, unknown>)[p]); Object.assign(k, structuredClone(clipboard)) })}>
          Paste
        </button>
        <button className="small" onClick={() => edit((k) => { Object.keys(k).forEach((p) => delete (k as Record<string, unknown>)[p]); k.tap = { type: sel.layer === 0 ? 'none' : 'trans' } })}>
          Reset
        </button>
      </div>
      <div className="editor-body col" style={{ gap: 14 }}>
        <div className="slot-tabs">
          {[...SLOTS, ...ENC_SLOTS].map((s) => {
            const a = slotValue(s.id)
            const v = a ? actionLabel(a, layout) || (a.type === 'none' ? 'None' : '') : ''
            return (
              <button key={s.id} className={`slot-tab ${cur === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)} title={s.help}>
                <span>{s.name}</span>
                <span className="slot-val">{v ? <Legend text={v} /> : '—'}</span>
              </button>
            )
          })}
        </div>
        <ActionPicker
          value={slotValue(cur)}
          onChange={setAction}
          layout={layout}
          slot={cur === 'tap' || cur === 'hold' || cur === 'doubleTap' || cur === 'tapHold' ? cur : 'tap'}
          allowEmpty={cur !== 'tap'}
          onCreateMacro={onCreateMacro}
        />
        <hr style={{ margin: 0 }} />
        <div className="row wrap" style={{ gap: 18, alignItems: 'flex-end' }}>
          <label className="field">
            Custom label
            <input
              value={key.label ?? ''}
              placeholder="auto"
              style={{ width: 130 }}
              onChange={(e) => edit((k) => { if (e.target.value) k.label = e.target.value; else delete k.label }, `label-${idx}`)}
            />
          </label>
          <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>
            Key color
            <ColorPicker value={key.color} onChange={(c) => edit((k) => { if (c) k.color = c; else delete k.color })} />
          </div>
          {key.hold && key.hold.type !== 'none' && (
            <label className="check small" title="If you hold the key past the tapping term and release it without pressing another key, send the tap anyway">
              <input type="checkbox" checked={!!key.retroTap} onChange={(e) => edit((k) => { if (e.target.checked) k.retroTap = true; else delete k.retroTap })} />
              Retro tap
            </label>
          )}
          {(key.hold || key.doubleTap || key.tapHold) && (
            <label className="field" title="Overrides the global tapping term for this key">
              Tapping term (ms)
              <input
                type="number"
                min={50}
                max={1000}
                step={10}
                value={key.tappingTerm ?? ''}
                placeholder={String(layout.settings.tappingTerm)}
                style={{ width: 110 }}
                onChange={(e) => edit((k) => { const n = parseInt(e.target.value); if (n > 0) k.tappingTerm = n; else delete k.tappingTerm }, `tt-${idx}`)}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
