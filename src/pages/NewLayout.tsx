import { useMemo, useState } from 'react'
import { KEYBOARDS, CONTROLLERS } from '../data/keyboards'
import type { KeyboardDef, Layout } from '../model/types'
import { newLayout } from '../model/defaults'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'
import { KeyboardView } from '../ui/KeyboardView'
import { importKeymap } from '../zmk/importKeymap'
import { cloneAsNew } from '../lib/share'
import { toast } from '../ui/Toast'

type Start = 'default' | 'blank' | 'copy'

export function NewLayout() {
  const add = useStore((s) => s.addLayout)
  const layouts = useStore((s) => s.layouts)
  const [q, setQ] = useState('')
  const [kb, setKb] = useState<KeyboardDef | null>(null)
  const [name, setName] = useState('')
  const [controller, setController] = useState('')
  const [start, setStart] = useState<Start>('default')
  const [copyFrom, setCopyFrom] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return KEYBOARDS.filter((k) => !s || k.name.toLowerCase().includes(s) || k.id.includes(s))
  }, [q])
  const sameKb = Object.values(layouts).filter((l) => l.keyboard === kb?.id)
  const blankPreview = useMemo(() => (kb ? newLayout(kb.id, kb.keys.length) : null), [kb])

  const create = async () => {
    if (!kb) return
    setBusy(true)
    let layout: Layout = newLayout(kb.id, kb.keys.length, name || `My ${kb.name}`)
    if (start === 'default') {
      try {
        const defaults = (await import('../data/defaultKeymaps.json')).default as Record<string, string>
        const text = defaults[kb.id]
        if (text) {
          const r = importKeymap(text, kb)
          layout = { ...r.layout, id: layout.id, name: layout.name, keyboard: kb.id, createdAt: layout.createdAt, updatedAt: Date.now() }
          if (r.warnings.length) console.warn('default keymap import warnings', r.warnings)
        } else toast('No stock keymap for this keyboard; starting blank')
      } catch (e) {
        console.error(e)
        toast('Could not load the stock keymap; starting blank')
      }
    } else if (start === 'copy' && copyFrom) {
      const src = layouts[copyFrom]
      if (src) layout = { ...cloneAsNew(src), name: layout.name }
    }
    if (kb.kind === 'shield' && controller) layout.controller = controller
    add(layout)
    setBusy(false)
    navigate(`/layout/${layout.id}`)
  }

  return (
    <>
      <div className="topbar">
        <a className="brand" href="#/"><span className="brand-logo">Z</span> ZMK Configurator</a>
      </div>
      <div className="page col" style={{ gap: 18 }}>
        <div className="row">
          <h1 className="grow">New layout</h1>
          <a href="#/">Cancel</a>
        </div>
        {!kb ? (
          <>
            <div className="row">
              <input autoFocus placeholder={`Search ${KEYBOARDS.length} keyboards…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 320 }} />
              <span className="muted small">All keyboards supported in-tree by ZMK.</span>
            </div>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
              {list.map((k) => (
                <div key={k.id} className="card layout-card" onClick={() => { setKb(k); setController(k.defaultController ?? '') }}>
                  <div className="row">
                    <h3 className="grow">{k.name}</h3>
                    <span className="badge">{k.keys.length} keys</span>
                  </div>
                  <div className="mini-kb" style={{ display: 'flex', justifyContent: 'center', height: 80, overflow: 'hidden' }}>
                    <Preview kb={k} />
                  </div>
                  <div className="small muted">{k.split ? 'Split' : 'Unibody'} · {k.kind === 'shield' ? 'needs a controller' : 'complete board'}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card col" style={{ gap: 16 }}>
            <div className="row">
              <h2 className="grow">{kb.name}</h2>
              <button className="small" onClick={() => setKb(null)}>Change keyboard</button>
            </div>
            <div className="kb-wrap">{blankPreview && <KeyboardView kb={kb} layout={blankPreview} layer={blankPreview.layers[0]} unit={40} compact />}</div>
            {kb.notes && <p className="help">Variant: {kb.notes}</p>}
            <div className="row wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
              <label className="field" style={{ width: 280 }}>
                Layout name
                <input value={name} placeholder={`My ${kb.name}`} onChange={(e) => setName(e.target.value)} />
              </label>
              {kb.kind === 'shield' && (
                <label className="field">
                  Controller
                  <select value={controller} onChange={(e) => setController(e.target.value)}>
                    {CONTROLLERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="col" style={{ gap: 6 }}>
              <span className="small muted">Start from</span>
              <label className="check"><input type="radio" checked={start === 'default'} onChange={() => setStart('default')} /> The keyboard’s stock ZMK keymap</label>
              <label className="check"><input type="radio" checked={start === 'blank'} onChange={() => setStart('blank')} /> A blank layout</label>
              <label className="check">
                <input type="radio" checked={start === 'copy'} disabled={!sameKb.length} onChange={() => setStart('copy')} /> A copy of one of my {kb.name} layouts
                {start === 'copy' && (
                  <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                    <option value="">Choose…</option>
                    {sameKb.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </label>
            </div>
            <div>
              <button className="primary" disabled={busy || (start === 'copy' && !copyFrom)} onClick={create}>
                {busy ? 'Creating…' : 'Create layout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Preview({ kb }: { kb: KeyboardDef }) {
  const l = useMemo(() => newLayout(kb.id, kb.keys.length), [kb])
  const w = Math.max(...kb.keys.map((k) => k.x + (k.w ?? 1)))
  return <KeyboardView kb={kb} layout={l} layer={l.layers[0]} unit={Math.min(16, 200 / w)} compact />
}
