import { useState } from 'react'
import type { KeyboardDef, Layout } from '../model/types'
import { useStore } from '../store/store'
import { Icon } from './Icon'

export function InfoPanel({ layout, kb }: { layout: Layout; kb: KeyboardDef }) {
  const update = useStore((s) => s.update)
  const [tag, setTag] = useState('')
  const keysUsed = layout.layers.reduce((n, l) => n + l.keys.filter((k) => k.tap && k.tap.type !== 'trans' && k.tap.type !== 'none').length, 0)
  const dual = layout.layers.reduce((n, l) => n + l.keys.filter((k) => k.hold || k.doubleTap || k.tapHold).length, 0)
  return (
    <div className="col" style={{ gap: 16, maxWidth: 760 }}>
      <label className="field">
        Name
        <input value={layout.name} onChange={(e) => update(layout.id, (d) => { d.name = e.target.value }, 'name')} />
      </label>
      <label className="field">
        Description / notes
        <textarea rows={6} value={layout.description} placeholder="What is this layout for? Notes for future you."
          onChange={(e) => update(layout.id, (d) => { d.description = e.target.value }, 'desc')} />
      </label>
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted">Tags</span>
        <div className="row wrap">
          {layout.tags.map((t) => (
            <span key={t} className="badge" style={{ fontSize: 12.5 }}>
              {t} <button className="ghost small" style={{ padding: 0 }} onClick={() => update(layout.id, (d) => { d.tags = d.tags.filter((x) => x !== t) })} aria-label="Remove tag"><Icon name="x" /></button>
            </span>
          ))}
          <input value={tag} placeholder="add tag" style={{ width: 120 }} onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { const v = tag.trim(); update(layout.id, (d) => { if (!d.tags.includes(v)) d.tags.push(v) }); setTag('') } }} />
        </div>
      </div>
      <div className="card small col" style={{ gap: 4 }}>
        <div><b>Keyboard:</b> {kb.name} ({kb.keys.length} keys{kb.split ? ', split' : ''})</div>
        {kb.kind === 'shield' && <div><b>Build:</b> {(kb.shields ?? []).join(', ')} on {layout.controller ?? kb.defaultController}</div>}
        {kb.kind === 'board' && <div><b>Build:</b> {(kb.boards ?? []).join(', ')}</div>}
        <div><b>Layers:</b> {layout.layers.length} · <b>assigned keys:</b> {keysUsed} · <b>dual-function keys:</b> {dual}</div>
        <div><b>Combos:</b> {layout.combos.length} · <b>Macros:</b> {layout.macros.length}</div>
        <div className="muted">Created {new Date(layout.createdAt).toLocaleString()} · last edited {new Date(layout.updatedAt).toLocaleString()}</div>
      </div>
    </div>
  )
}
