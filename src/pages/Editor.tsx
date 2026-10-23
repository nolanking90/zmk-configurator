import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { getKeyboard } from '../data/keyboards'
import { navigate } from '../lib/router'
import { KeyboardView } from '../ui/KeyboardView'
import { KeyEditor } from '../ui/KeyEditor'
import { LayerList } from '../ui/LayerList'
import { CombosPanel } from '../ui/CombosPanel'
import { MacrosPanel } from '../ui/MacrosPanel'
import { SettingsPanel } from '../ui/SettingsPanel'
import { RevisionsPanel } from '../ui/RevisionsPanel'
import { CodePanel } from '../ui/CodePanel'
import { OverviewPanel } from '../ui/OverviewPanel'
import { ExportDialog } from '../ui/ExportDialog'
import { ShareDialog } from '../ui/ShareDialog'
import { InfoPanel } from '../ui/InfoPanel'
import { uid } from '../model/defaults'
import type { KeyConfig } from '../model/types'
import { toast } from '../ui/Toast'

export type EditorView = 'keys' | 'combos' | 'macros' | 'settings' | 'overview' | 'revisions' | 'code' | 'info'

const VIEWS: { id: EditorView; name: string }[] = [
  { id: 'keys', name: 'Keys' },
  { id: 'combos', name: 'Combos' },
  { id: 'macros', name: 'Macros' },
  { id: 'settings', name: 'Settings' },
  { id: 'overview', name: 'Overview' },
  { id: 'revisions', name: 'Revisions' },
  { id: 'code', name: 'Code' },
  { id: 'info', name: 'Info' },
]

export function Editor({ id, view = 'keys' }: { id: string; view?: string }) {
  const layout = useStore((s) => s.layouts[id])
  const ready = useStore((s) => s.ready)
  const sel = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const update = useStore((s) => s.update)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const history = useStore((s) => s.history[id])
  const setClipboard = useStore((s) => s.setClipboard)
  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const kb = layout ? getKeyboard(layout.keyboard) : undefined
  const v = (VIEWS.some((x) => x.id === view) ? view : 'keys') as EditorView
  const setView = (nv: EditorView) => navigate(`/layout/${id}/${nv}`)

  useEffect(() => {
    select({ layer: 0, keys: [] })
  }, [id, select])

  // global shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      const mod = e.metaKey || e.ctrlKey
      const s = useStore.getState()
      const lay = s.layouts[id]
      if (!lay) return
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(id)
        else undo(id)
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo(id)
      } else if (v === 'keys' && s.selection.keys.length) {
        const layer = lay.layers[s.selection.layer]
        if (mod && e.key.toLowerCase() === 'c') {
          setClipboard(structuredClone(layer.keys[s.selection.keys[0]]))
          toast('Key copied')
        } else if (mod && e.key.toLowerCase() === 'v' && s.clipboard) {
          const clip = s.clipboard
          update(id, (d) => {
            for (const i of s.selection.keys) d.layers[s.selection.layer].keys[i] = structuredClone(clip)
          })
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          update(id, (d) => {
            for (const i of s.selection.keys)
              d.layers[s.selection.layer].keys[i] = { tap: { type: s.selection.layer === 0 ? 'none' : 'trans' } }
          })
        } else if (e.key === 'Escape') {
          select({ keys: [] })
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          if (!kb) return
          const n = kb.keys.length
          const cur = s.selection.keys[0]
          select({ keys: [(cur + (e.key === 'ArrowRight' ? 1 : n - 1)) % n] })
        }
      }
      if (!mod && /^[0-9]$/.test(e.key) && e.altKey) {
        const n = Number(e.key)
        if (n < lay.layers.length) select({ layer: n })
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [id, v, kb, undo, redo, update, select, setClipboard])

  if (!ready) return <div className="page muted">Loading…</div>
  if (!layout) {
    return (
      <div className="page">
        <h1>Layout not found</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          It may have been deleted. <a href="#/">Back to my layouts</a>
        </p>
      </div>
    )
  }
  if (!kb) {
    return (
      <div className="page">
        <h1>Unknown keyboard “{layout.keyboard}”</h1>
        <p className="muted">This layout references a keyboard that isn't in the catalog.</p>
      </div>
    )
  }

  const layer = layout.layers[Math.min(sel.layer, layout.layers.length - 1)]

  const onKeyClick = (i: number, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const keys = sel.keys.includes(i) ? sel.keys.filter((k) => k !== i) : [...sel.keys, i]
      select({ keys })
    } else select({ keys: [i] })
  }

  const onKeyDrop = (from: number, to: number, copy: boolean) => {
    update(id, (d) => {
      const keys = d.layers[sel.layer].keys
      const a = structuredClone(keys[from]) as KeyConfig
      if (copy) keys[to] = a
      else {
        keys[from] = keys[to]
        keys[to] = a
      }
    })
    select({ keys: [to] })
  }

  const createMacro = () => {
    const mid = uid()
    update(id, (d) => {
      d.macros.push({ id: mid, name: `Macro ${d.macros.length + 1}`, steps: [{ type: 'text', text: 'hello' }] })
    })
    setView('macros')
  }

  return (
    <>
      <div className="topbar">
        <a className="brand" href="#/">
          <span className="brand-logo">Z</span>
        </a>
        <input
          value={layout.name}
          onChange={(e) => update(id, (d) => { d.name = e.target.value }, 'name')}
          style={{ fontWeight: 650, fontSize: 15, border: '1px solid transparent', background: 'transparent', width: 260 }}
          title="Layout name"
        />
        <span className="badge">{kb.name}</span>
        <span className="spacer" />
        <button className="ghost" disabled={!history?.past.length} onClick={() => undo(id)} title="Undo (⌘/Ctrl+Z)">↶</button>
        <button className="ghost" disabled={!history?.future.length} onClick={() => redo(id)} title="Redo (⌘/Ctrl+Shift+Z)">↷</button>
        <button onClick={() => setShareOpen(true)}>Share</button>
        <button onClick={() => navigate(`/layout/${id}/train`)}>Train</button>
        <button onClick={() => navigate(`/layout/${id}/print`)}>Print</button>
        <button className="primary" onClick={() => setExportOpen(true)}>Download / Build firmware</button>
      </div>
      <div className="editor">
        <aside className="sidebar">
          <LayerList layout={layout} />
          <div className="sidebar-section small muted">
            <div className="sidebar-title">Tips</div>
            Double-click a layer to rename, drag to reorder. Alt+0…9 jumps to a layer.
          </div>
        </aside>
        <main className="main">
          <div className="main-inner">
            <div className="tabs">
              {VIEWS.map((x) => (
                <button key={x.id} className={`tab ${v === x.id ? 'active' : ''}`} onClick={() => setView(x.id)}>
                  {x.name}
                  {x.id === 'combos' && layout.combos.length ? <span className="badge">{layout.combos.length}</span> : null}
                  {x.id === 'macros' && layout.macros.length ? <span className="badge">{layout.macros.length}</span> : null}
                </button>
              ))}
            </div>
            {v === 'keys' && (
              <>
                <div className="row">
                  <h2>
                    <span className="muted">{sel.layer}</span> {layer.name}
                  </h2>
                </div>
                <div className="kb-wrap">
                  <KeyboardView
                    fit
                    kb={kb}
                    layout={layout}
                    layer={layer}
                    selected={sel.keys}
                    onKeyClick={onKeyClick}
                    onKeyDrop={onKeyDrop}
                  />
                </div>
                <KeyEditor layout={layout} onCreateMacro={createMacro} />
              </>
            )}
            {v === 'combos' && <CombosPanel layout={layout} kb={kb} />}
            {v === 'macros' && <MacrosPanel layout={layout} />}
            {v === 'settings' && <SettingsPanel layout={layout} kb={kb} />}
            {v === 'overview' && <OverviewPanel layout={layout} kb={kb} />}
            {v === 'revisions' && <RevisionsPanel layout={layout} kb={kb} />}
            {v === 'code' && <CodePanel layout={layout} kb={kb} />}
            {v === 'info' && <InfoPanel layout={layout} kb={kb} />}
          </div>
        </main>
      </div>
      {exportOpen && <ExportDialog layout={layout} kb={kb} onClose={() => setExportOpen(false)} />}
      {shareOpen && <ShareDialog layout={layout} onClose={() => setShareOpen(false)} />}
    </>
  )
}
