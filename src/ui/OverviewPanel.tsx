import { useState } from 'react'
import type { KeyConfig, KeyboardDef, Layout } from '../model/types'
import { actionDescription, actionLabel } from '../lib/labels'
import { KeyboardView } from './KeyboardView'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'

/** All layers at a glance (Oryx's layout overview), also used by the print view */
export function OverviewPanel({ layout, kb, unit = 44 }: { layout: Layout; kb: KeyboardDef; unit?: number }) {
  const select = useStore((s) => s.select)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const matches = (k: KeyConfig | undefined) =>
    !!k && [k.tap, k.hold, k.doubleTap, k.tapHold].some((a) => a && (actionLabel(a, layout).toLowerCase() === needle || actionDescription(a, layout).toLowerCase().includes(needle))) ||
    (!!k?.label && k.label.toLowerCase().includes(needle))
  return (
    <div className="col" style={{ gap: 22 }}>
      <div className="row no-print">
        <input placeholder="Find a key on any layer (e.g. 'esc', 'vol', 'bt')" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 340 }} />
        {needle && <span className="small muted">{layout.layers.reduce((n, l) => n + l.keys.filter(matches).length, 0)} matches</span>}
      </div>
      {layout.layers.map((l, i) => (
        <div key={l.id} className="print-layer col">
          <div className="row">
            <span className="layer-swatch" style={{ background: l.color ?? 'transparent' }} />
            <h3>
              <span className="muted">{i}</span> {l.name}
            </h3>
          </div>
          <div className="kb-wrap" style={{ justifyContent: 'flex-start' }}>
            <KeyboardView
              fit
              kb={kb}
              layout={layout}
              layer={l}
              unit={unit}
              highlight={needle ? l.keys.map((k, j) => (matches(k) ? j : -1)).filter((j) => j >= 0) : undefined}
              dimmed={needle ? l.keys.map((k, j) => (matches(k) ? -1 : j)).filter((j) => j >= 0) : undefined}
              onKeyClick={(k) => { select({ layer: i, keys: [k] }); navigate(`/layout/${layout.id}/keys`) }}
            />
          </div>
        </div>
      ))}
      {layout.combos.length > 0 && (
        <div className="print-layer">
          <h3>Combos</h3>
          <ul className="small">
            {layout.combos.map((c) => (
              <li key={c.id}>{c.name}: keys {c.keys.join(' + ')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
