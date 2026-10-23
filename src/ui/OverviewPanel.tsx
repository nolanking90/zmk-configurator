import type { KeyboardDef, Layout } from '../model/types'
import { KeyboardView } from './KeyboardView'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'

/** All layers at a glance (Oryx's layout overview), also used by the print view */
export function OverviewPanel({ layout, kb, unit = 44 }: { layout: Layout; kb: KeyboardDef; unit?: number }) {
  const select = useStore((s) => s.select)
  return (
    <div className="col" style={{ gap: 22 }}>
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
              kb={kb}
              layout={layout}
              layer={l}
              unit={unit}
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
