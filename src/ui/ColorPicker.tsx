import { useState } from 'react'
import { PALETTE } from '../lib/color'

export function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="small" onClick={() => setOpen(!open)} style={{ gap: 6 }}>
        <span className="layer-swatch" style={{ background: value ?? 'transparent' }} />
        {value ?? 'Default'}
      </button>
      {open && (
        <div
          className="card"
          style={{ position: 'absolute', zIndex: 30, top: '110%', left: 0, padding: 10, width: 232 }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 5 }}>
            {PALETTE.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => { onChange(c); setOpen(false) }}
                style={{ width: 22, height: 22, padding: 0, background: c, borderColor: c === value ? 'var(--accent)' : 'var(--border-strong)' }}
              />
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input type="color" value={value ?? '#ffffff'} onChange={(e) => onChange(e.target.value)} />
            <span className="spacer" />
            <button className="small ghost" onClick={() => { onChange(undefined); setOpen(false) }}>
              Default
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
