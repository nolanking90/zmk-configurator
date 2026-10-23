import { useState } from 'react'
import type { Action, EncoderConfig, KeyboardDef, Layout } from '../model/types'
import { useStore } from '../store/store'
import { actionLabel } from '../lib/labels'
import { Modal } from './Modal'
import { ActionPicker } from './ActionPicker'
import { Icon, Legend } from './Icon'

/** rotary encoder bindings for the current layer */
export function EncoderPanel({ layout, kb, layerIndex }: { layout: Layout; kb: KeyboardDef; layerIndex: number }) {
  const update = useStore((s) => s.update)
  const [editing, setEditing] = useState<{ enc: number; dir: keyof EncoderConfig } | null>(null)
  const n = kb.encoders ?? 0
  // encoders whose push switch is a key are edited from that key instead
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => kb.encoderKeys?.[i] == null)
  if (!free.length) return null
  const layer = layout.layers[layerIndex]
  const label = (a?: Action) => <Legend text={a ? actionLabel(a, layout) || '{none}' : '{trans}'} />
  const cur = editing ? layer.encoders?.[editing.enc]?.[editing.dir] : undefined
  return (
    <div className="panel">
      <div className="editor-head">
        <h3>Encoder rotation</h3>
        <span className="muted small">on layer “{layer.name}” — unset directions fall through to lower layers</span>
      </div>
      <div className="editor-body row wrap" style={{ gap: 18 }}>
        {free.map((i) => (
          <div key={i} className="row">
            <span className="small muted">{n === 2 ? (i === 0 ? 'Left' : 'Right') : `Encoder ${i + 1}`}</span>
            <button title="Counter-clockwise" onClick={() => setEditing({ enc: i, dir: 'ccw' })}><Icon name="ccw" /> {label(layer.encoders?.[i]?.ccw)}</button>
            <button title="Clockwise" onClick={() => setEditing({ enc: i, dir: 'cw' })}><Icon name="cw" /> {label(layer.encoders?.[i]?.cw)}</button>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={`${editing.dir === 'cw' ? 'Clockwise' : 'Counter-clockwise'} rotation`} onClose={() => setEditing(null)} wide>
          <ActionPicker
            layout={layout}
            value={cur}
            allowEmpty
            onChange={(a) =>
              update(layout.id, (d) => {
                const l = d.layers[layerIndex]
                l.encoders ??= []
                while (l.encoders.length < n) l.encoders.push({})
                if (a && a.type !== 'trans') l.encoders[editing.enc][editing.dir] = a
                else delete l.encoders[editing.enc][editing.dir]
              })
            }
          />
        </Modal>
      )}
    </div>
  )
}
