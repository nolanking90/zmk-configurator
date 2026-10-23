import { useEffect, useRef, useState } from 'react'
import type { Layout, Macro, MacroStep } from '../model/types'
import { useStore } from '../store/store'
import { uid } from '../model/defaults'
import { ActionPicker } from './ActionPicker'
import { actionLabel } from '../lib/labels'
import { domCodeToZmk } from '../lib/domcodes'
import { canonicalCode, isModifierCode } from '../data/keycodes'
import { Modal } from './Modal'

const STEP_NAMES: Record<MacroStep['type'], string> = {
  text: 'Type text',
  tap: 'Tap',
  press: 'Press (hold down)',
  release: 'Release',
  delay: 'Delay',
  pauseForRelease: 'Pause until key released',
}

function newStep(type: MacroStep['type']): MacroStep {
  switch (type) {
    case 'text': return { type, text: '' }
    case 'delay': return { type, ms: 100 }
    case 'pauseForRelease': return { type }
    default: return { type, action: { type: 'key', code: 'A' } }
  }
}

/** Convert recorded key events into compact macro steps. */
function compactRecording(events: { down: boolean; code: string; key: string }[]): MacroStep[] {
  const steps: MacroStep[] = []
  const held = new Set<string>()
  for (const ev of events) {
    const zmk = domCodeToZmk(ev.code)
    if (!zmk) continue
    const code = canonicalCode(zmk)
    if (isModifierCode(code)) {
      steps.push({ type: ev.down ? 'press' : 'release', action: { type: 'key', code } })
      if (ev.down) held.add(code)
      else held.delete(code)
      continue
    }
    if (!ev.down) continue
    const last = steps[steps.length - 1]
    if (ev.key.length === 1 && held.size === 0) {
      if (last?.type === 'text') last.text += ev.key
      else steps.push({ type: 'text', text: ev.key })
    } else steps.push({ type: 'tap', action: { type: 'key', code } })
  }
  return steps
}

export function MacrosPanel({ layout }: { layout: Layout }) {
  const update = useStore((s) => s.update)
  const [cur, setCur] = useState<string | null>(layout.macros[layout.macros.length - 1]?.id ?? null)
  const macro = layout.macros.find((m) => m.id === cur)
  const mi = layout.macros.findIndex((m) => m.id === cur)
  const [picking, setPicking] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const rec = useRef<{ down: boolean; code: string; key: string }[]>([])

  useEffect(() => {
    if (!recording) return
    rec.current = []
    const down = (e: KeyboardEvent) => { e.preventDefault(); if (!e.repeat) rec.current.push({ down: true, code: e.code, key: e.key }) }
    const up = (e: KeyboardEvent) => { e.preventDefault(); rec.current.push({ down: false, code: e.code, key: e.key }) }
    window.addEventListener('keydown', down, { capture: true })
    window.addEventListener('keyup', up, { capture: true })
    return () => {
      window.removeEventListener('keydown', down, { capture: true })
      window.removeEventListener('keyup', up, { capture: true })
    }
  }, [recording])

  const stopRecording = () => {
    setRecording(false)
    const steps = compactRecording(rec.current)
    if (steps.length) edit((m) => { m.steps.push(...steps) })
  }

  const add = () => {
    const id = uid()
    update(layout.id, (d) => { d.macros.push({ id, name: `Macro ${d.macros.length + 1}`, steps: [] }) })
    setCur(id)
  }
  const edit = (fn: (m: Macro) => void, tag?: string) => update(layout.id, (d) => { fn(d.macros[mi]) }, tag)
  const usedBy = (id: string) =>
    layout.layers.some((l) => l.keys.some((k) => [k.tap, k.hold, k.doubleTap, k.tapHold].some((a) => a?.type === 'macro' && a.id === id))) ||
    layout.combos.some((c) => c.action.type === 'macro' && c.action.id === id)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <h2 className="grow">Macros</h2>
        <button className="primary" onClick={add}>+ New macro</button>
      </div>
      <p className="help">Macros send a sequence of keys. Assign them to a key from the key editor's “Macros” tab.</p>
      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="panel" style={{ width: 250, flex: 'none' }}>
          {layout.macros.map((m) => (
            <div key={m.id} className="list-item" style={{ cursor: 'pointer', background: m.id === cur ? 'var(--accent-soft)' : undefined }} onClick={() => setCur(m.id)}>
              <div className="grow">
                <div>{m.name}</div>
                <div className="small muted">{m.steps.length} steps{usedBy(m.id) ? '' : ' · unused'}</div>
              </div>
            </div>
          ))}
          {!layout.macros.length && <div className="list-item muted">No macros yet.</div>}
        </div>
        {macro && (
          <div className="panel grow" style={{ minWidth: 340 }}>
            <div className="editor-head">
              <input value={macro.name} onChange={(e) => edit((m) => { m.name = e.target.value }, 'macro-name')} style={{ fontWeight: 600 }} />
              <span className="spacer" />
              {recording ? (
                <button className="active" onClick={stopRecording}>■ Stop recording</button>
              ) : (
                <button onClick={() => setRecording(true)} title="Record keystrokes from your keyboard">● Record</button>
              )}
              <button className="small danger" onClick={() => { update(layout.id, (d) => { d.macros.splice(mi, 1) }); setCur(null) }}>Delete</button>
            </div>
            <div className="editor-body col">
              {recording && <div className="warn small">Recording… type on your keyboard, then press Stop.</div>}
              {macro.steps.map((s, i) => (
                <div key={i} className="row" style={{ gap: 6 }}>
                  <span className="muted small" style={{ width: 18, textAlign: 'right' }}>{i + 1}</span>
                  <select value={s.type} onChange={(e) => edit((m) => { m.steps[i] = newStep(e.target.value as MacroStep['type']) })}>
                    {Object.entries(STEP_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {s.type === 'text' && (
                    <input className="grow" value={s.text} placeholder="Text to type" onChange={(e) => edit((m) => { (m.steps[i] as { text: string }).text = e.target.value }, `mt-${i}`)} />
                  )}
                  {s.type === 'delay' && (
                    <><input type="number" min={1} value={s.ms} style={{ width: 90 }} onChange={(e) => edit((m) => { (m.steps[i] as { ms: number }).ms = Math.max(1, parseInt(e.target.value) || 1) }, `md-${i}`)} /> <span className="small muted">ms</span></>
                  )}
                  {(s.type === 'tap' || s.type === 'press' || s.type === 'release') && (
                    <button className="grow" style={{ justifyContent: 'flex-start' }} onClick={() => setPicking(i)}>
                      {actionLabel(s.action, layout) || '(choose)'}
                    </button>
                  )}
                  {s.type === 'pauseForRelease' && <span className="grow small muted">Steps after this run when the macro key is released</span>}
                  <button className="small ghost" disabled={i === 0} onClick={() => edit((m) => { [m.steps[i - 1], m.steps[i]] = [m.steps[i], m.steps[i - 1]] })}>↑</button>
                  <button className="small ghost" disabled={i === macro.steps.length - 1} onClick={() => edit((m) => { [m.steps[i + 1], m.steps[i]] = [m.steps[i], m.steps[i + 1]] })}>↓</button>
                  <button className="small ghost danger" onClick={() => edit((m) => { m.steps.splice(i, 1) })}>✕</button>
                </div>
              ))}
              <div className="row wrap" style={{ gap: 4 }}>
                {(Object.keys(STEP_NAMES) as MacroStep['type'][]).map((t) => (
                  <button key={t} className="small" onClick={() => edit((m) => { m.steps.push(newStep(t)) })}>+ {STEP_NAMES[t]}</button>
                ))}
              </div>
              <hr />
              <div className="row wrap" style={{ gap: 16 }}>
                <label className="field">Wait between steps (ms)
                  <input type="number" min={0} value={macro.wait ?? ''} placeholder="15" style={{ width: 100 }} onChange={(e) => edit((m) => { const n = parseInt(e.target.value); if (n >= 0) m.wait = n; else delete m.wait }, 'mw')} />
                </label>
                <label className="field">Tap duration (ms)
                  <input type="number" min={0} value={macro.tap ?? ''} placeholder="15" style={{ width: 100 }} onChange={(e) => edit((m) => { const n = parseInt(e.target.value); if (n >= 0) m.tap = n; else delete m.tap }, 'mtap')} />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      {macro && picking !== null && macro.steps[picking] && 'action' in macro.steps[picking] && (
        <Modal title={`Step ${picking + 1}: choose key`} onClose={() => setPicking(null)} wide>
          <ActionPicker
            layout={layout}
            slot="macro"
            value={(macro.steps[picking] as { action: import('../model/types').Action }).action}
            onChange={(a) => edit((m) => { (m.steps[picking] as { action: import('../model/types').Action }).action = a ?? { type: 'none' } })}
          />
        </Modal>
      )}
    </div>
  )
}
