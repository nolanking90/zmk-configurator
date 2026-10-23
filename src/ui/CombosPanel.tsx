import { useState } from 'react'
import type { KeyboardDef, Layout } from '../model/types'
import { useStore } from '../store/store'
import { uid } from '../model/defaults'
import { KeyboardView } from './KeyboardView'
import { ActionPicker } from './ActionPicker'
import { actionDescription, actionLabel } from '../lib/labels'

export function CombosPanel({ layout, kb }: { layout: Layout; kb: KeyboardDef }) {
  const update = useStore((s) => s.update)
  const [cur, setCur] = useState<string | null>(layout.combos[0]?.id ?? null)
  const [viewLayer, setViewLayer] = useState(0)
  const combo = layout.combos.find((c) => c.id === cur)
  const ci = layout.combos.findIndex((c) => c.id === cur)

  const add = () => {
    const id = uid()
    update(layout.id, (d) => {
      d.combos.push({ id, name: `Combo ${d.combos.length + 1}`, keys: [], action: { type: 'key', code: 'ESC' }, layers: [] })
    })
    setCur(id)
  }

  const edit = (fn: (c: Layout['combos'][number]) => void, tag?: string) =>
    update(layout.id, (d) => { fn(d.combos[ci]) }, tag)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <h2 className="grow">Combos</h2>
        <button className="primary" onClick={add}>+ New combo</button>
      </div>
      <p className="help">
        A combo fires an action when several keys are pressed together. Click keys on the keyboard to add or remove them from the selected combo.
      </p>
      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="panel" style={{ width: 250, flex: 'none' }}>
          {layout.combos.map((c) => (
            <div
              key={c.id}
              className="list-item"
              style={{ cursor: 'pointer', background: c.id === cur ? 'var(--accent-soft)' : undefined }}
              onClick={() => setCur(c.id)}
            >
              <div className="grow">
                <div>{c.name}</div>
                <div className="small muted">
                  {c.keys.length} keys → {actionLabel(c.action, layout) || actionDescription(c.action, layout)}
                </div>
              </div>
            </div>
          ))}
          {!layout.combos.length && <div className="list-item muted">No combos yet.</div>}
        </div>
        <div className="col grow" style={{ minWidth: 320 }}>
          <div className="row">
            <span className="small muted">Show layer</span>
            <select value={viewLayer} onChange={(e) => setViewLayer(Number(e.target.value))}>
              {layout.layers.map((l, i) => <option key={l.id} value={i}>{i}: {l.name}</option>)}
            </select>
          </div>
          <div className="kb-wrap">
            <KeyboardView
              fit
              kb={kb}
              layout={layout}
              layer={layout.layers[viewLayer]}
              unit={50}
              selected={combo ? combo.keys : []}
              dimmed={combo ? kb.keys.map((_, i) => i).filter((i) => !combo.keys.includes(i)) : undefined}
              onKeyClick={(i) => combo && edit((c) => { c.keys = c.keys.includes(i) ? c.keys.filter((k) => k !== i) : [...c.keys, i].sort((a, b) => a - b) })}
              compact
            />
          </div>
        </div>
      </div>
      {combo && (
        <div className="panel">
          <div className="editor-head">
            <input value={combo.name} onChange={(e) => edit((c) => { c.name = e.target.value }, 'combo-name')} style={{ fontWeight: 600 }} />
            <span className="muted small">Keys: {combo.keys.length ? combo.keys.join(', ') : 'none — click keys above'}</span>
            {combo.keys.length === 1 && <span className="warn small">A combo needs at least 2 keys</span>}
            <span className="spacer" />
            <button className="small danger" onClick={() => { update(layout.id, (d) => { d.combos.splice(ci, 1) }); setCur(null) }}>Delete</button>
          </div>
          <div className="editor-body col" style={{ gap: 14 }}>
            <ActionPicker value={combo.action} onChange={(a) => edit((c) => { c.action = a ?? { type: 'none' } })} layout={layout} slot="combo" />
            <hr style={{ margin: 0 }} />
            <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
              <div className="col" style={{ gap: 4 }}>
                <span className="small muted">Active on layers (none checked = all)</span>
                <div className="row wrap">
                  {layout.layers.map((l) => (
                    <label key={l.id} className="check small">
                      <input
                        type="checkbox"
                        checked={combo.layers.includes(l.id)}
                        onChange={(e) => edit((c) => { c.layers = e.target.checked ? [...c.layers, l.id] : c.layers.filter((x) => x !== l.id) })}
                      />
                      {l.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="field">
                Timeout (ms)
                <input type="number" value={combo.timeout ?? ''} placeholder={String(layout.settings.comboTimeout)} style={{ width: 100 }}
                  onChange={(e) => edit((c) => { const n = parseInt(e.target.value); if (n > 0) c.timeout = n; else delete c.timeout }, 'combo-to')} />
              </label>
              <label className="field" title="Combo won't trigger if another key was pressed within this time (prevents misfires while typing)">
                Require prior idle (ms)
                <input type="number" value={combo.requirePriorIdle ?? ''} placeholder="off" style={{ width: 100 }}
                  onChange={(e) => edit((c) => { const n = parseInt(e.target.value); if (n > 0) c.requirePriorIdle = n; else delete c.requirePriorIdle }, 'combo-idle')} />
              </label>
              <label className="check small" style={{ marginTop: 20 }} title="Release the combo only when all its keys are released">
                <input type="checkbox" checked={!!combo.slowRelease} onChange={(e) => edit((c) => { c.slowRelease = e.target.checked || undefined })} />
                Slow release
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
