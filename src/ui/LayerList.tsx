import { useState } from 'react'
import type { Layout } from '../model/types'
import { useStore } from '../store/store'
import { uid } from '../model/defaults'
import { ColorPicker } from './ColorPicker'

const MAX_LAYERS = 32

export function LayerList({ layout }: { layout: Layout }) {
  const sel = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState<number | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const cur = layout.layers[sel.layer]

  const addLayer = () => {
    const n = layout.layers.length
    update(layout.id, (d) => {
      d.layers.push({
        id: uid(),
        name: `Layer ${n}`,
        keys: d.layers[0].keys.map(() => ({ tap: { type: 'trans' } })),
      })
    })
    select({ layer: n })
  }

  const duplicate = () => {
    if (!cur) return
    update(layout.id, (d) => {
      const copy = structuredClone(d.layers[sel.layer])
      copy.id = uid()
      copy.name = `${copy.name} copy`
      d.layers.splice(sel.layer + 1, 0, copy)
    })
    select({ layer: sel.layer + 1 })
  }

  const remove = () => {
    if (layout.layers.length <= 1 || !cur) return
    if (!confirm(`Delete layer “${cur.name}”? Keys pointing to it will become empty.`)) return
    const id = cur.id
    update(layout.id, (d) => {
      d.layers.splice(sel.layer, 1)
      const fix = (a: unknown) => (a as { type?: string; layer?: string })?.type === 'layer' && (a as { layer: string }).layer === id
      for (const l of d.layers)
        for (const k of l.keys)
          for (const s of ['tap', 'hold', 'doubleTap', 'tapHold'] as const)
            if (fix(k[s])) {
              if (s === 'tap') k.tap = { type: 'none' }
              else delete k[s]
            }
      for (const c of d.combos) c.layers = c.layers.filter((x) => x !== id)
    })
    select({ layer: Math.max(0, sel.layer - 1), keys: [] })
  }

  const move = (from: number, to: number) => {
    if (from === to) return
    update(layout.id, (d) => {
      const [l] = d.layers.splice(from, 1)
      d.layers.splice(to > from ? to - 1 : to, 0, l)
    })
    select({ layer: to > from ? to - 1 : to })
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-title">
        Layers <span className="badge">{layout.layers.length}/{MAX_LAYERS}</span>
      </div>
      <div className="col" style={{ gap: 2 }}>
        {layout.layers.map((l, i) => (
          <div
            key={l.id}
            className={`layer-item ${i === sel.layer ? 'active' : ''} ${dragOver === i && dragFrom !== null ? 'drag-over' : ''}`}
            onClick={() => select({ layer: i })}
            onDoubleClick={() => setEditing(i)}
            draggable={editing !== i}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
            onDrop={() => { if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDragOver(null) }}
          >
            <span className="layer-index">{i}</span>
            <span className="layer-swatch" style={{ background: l.color ?? 'transparent' }} />
            {editing === i ? (
              <input
                autoFocus
                defaultValue={l.name}
                className="grow"
                style={{ padding: '2px 4px' }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v) update(layout.id, (d) => { d.layers[i].name = v }); setEditing(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
              />
            ) : (
              <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
            )}
          </div>
        ))}
        {/* drop zone at the end */}
        <div
          style={{ height: 8 }}
          className={dragOver === layout.layers.length ? 'layer-item drag-over' : ''}
          onDragOver={(e) => { e.preventDefault(); setDragOver(layout.layers.length) }}
          onDrop={() => { if (dragFrom !== null) move(dragFrom, layout.layers.length); setDragFrom(null); setDragOver(null) }}
        />
      </div>
      <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
        <button className="small" onClick={addLayer} disabled={layout.layers.length >= MAX_LAYERS}>+ Add</button>
        <button className="small" onClick={duplicate} disabled={layout.layers.length >= MAX_LAYERS}>Duplicate</button>
        <button className="small" onClick={() => setEditing(sel.layer)}>Rename</button>
        <button className="small danger" onClick={remove} disabled={layout.layers.length <= 1}>Delete</button>
      </div>
      {cur && (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="small muted">Layer color</span>
          <ColorPicker value={cur.color} onChange={(c) => update(layout.id, (d) => { if (c) d.layers[sel.layer].color = c; else delete d.layers[sel.layer].color })} />
        </div>
      )}
    </div>
  )
}
