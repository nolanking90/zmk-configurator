import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { getKeyboard } from '../data/keyboards'
import { navigate } from '../lib/router'
import { KeyboardView } from '../ui/KeyboardView'
import { ImportDialog } from '../ui/ImportDialog'
import { isLayout, cloneAsNew } from '../lib/share'
import { toast } from '../ui/Toast'
import { ThemeToggle } from '../ui/ThemeToggle'

export function Home() {
  const layouts = useStore((s) => s.layouts)
  const ready = useStore((s) => s.ready)
  const del = useStore((s) => s.deleteLayout)
  const dup = useStore((s) => s.duplicateLayout)
  const add = useStore((s) => s.addLayout)
  const [importOpen, setImportOpen] = useState(false)
  const [q, setQ] = useState('')
  const restoreRef = useRef<HTMLInputElement>(null)
  const list = Object.values(layouts)
    .filter((l) => !q || (l.name + ' ' + l.tags.join(' ') + ' ' + l.keyboard).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const backup = () => {
    const blob = new Blob([JSON.stringify(Object.values(layouts), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'zmk-configurator-backup.json'
    a.click()
  }
  const restore = async (f: File) => {
    try {
      const j = JSON.parse(await f.text())
      const arr = (Array.isArray(j) ? j : [j]).filter(isLayout)
      for (const l of arr) add(layouts[l.id] ? cloneAsNew(l) : l)
      toast(`Restored ${arr.length} layout${arr.length === 1 ? '' : 's'}`)
    } catch {
      toast('Not a valid backup file')
    }
  }

  return (
    <>
      <div className="topbar">
        <a className="brand" href="#/"><span className="brand-logo">Z</span> ZMK Configurator</a>
        <span className="spacer" />
        <ThemeToggle />
        <a className="btn ghost" href="https://zmk.dev/docs" target="_blank" rel="noreferrer">ZMK docs ↗</a>
      </div>
      <div className="page col" style={{ gap: 20 }}>
        <div className="row wrap">
          <h1 className="grow">My layouts</h1>
          <input placeholder="Search layouts" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <button onClick={() => setImportOpen(true)}>Import</button>
          <button className="primary" onClick={() => navigate('/new')}>+ New layout</button>
        </div>
        {!ready ? (
          <div className="muted">Loading…</div>
        ) : list.length === 0 && !q ? (
          <div className="card col" style={{ alignItems: 'center', padding: 48, gap: 14, textAlign: 'center' }}>
            <h2>Design your ZMK keymap visually</h2>
            <p className="muted" style={{ maxWidth: 520 }}>
              Pick your keyboard, assign keys, layers, tap-hold, tap dance, combos and macros, then build firmware on GitHub
              in one click. Everything is saved in your browser.
            </p>
            <div className="row">
              <button className="primary" onClick={() => navigate('/new')}>Create your first layout</button>
              <button onClick={() => setImportOpen(true)}>Import a .keymap</button>
            </div>
          </div>
        ) : (
          <div className="grid-cards">
            {list.map((l) => {
              const kb = getKeyboard(l.keyboard)
              return (
                <div key={l.id} className="card layout-card" onClick={() => navigate(`/layout/${l.id}`)}>
                  <div className="row">
                    <h3 className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</h3>
                    <span className="badge">{kb?.name ?? l.keyboard}</span>
                  </div>
                  {kb && (
                    <div className="mini-kb" style={{ display: 'flex', justifyContent: 'center', height: 90, overflow: 'hidden' }}>
                      <KeyboardView kb={kb} layout={l} layer={l.layers[0]} unit={Math.min(18, 250 / 20)} compact />
                    </div>
                  )}
                  <div className="small muted">
                    {l.layers.length} layers · {l.combos.length} combos · {l.macros.length} macros · edited {new Date(l.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="row" onClick={(e) => e.stopPropagation()}>
                    <button className="small" onClick={() => { const c = dup(l.id); if (c) toast('Duplicated') }}>Duplicate</button>
                    <span className="spacer" />
                    <button className="small danger ghost" onClick={() => { if (confirm(`Delete “${l.name}” and all its revisions?`)) del(l.id) }}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="row small muted" style={{ gap: 12 }}>
          <span>Your layouts are stored only in this browser — no account, nothing uploaded. Back them up to move to another device.</span>
          <button className="small" onClick={backup} disabled={!list.length}>Back up all</button>
          <button className="small" onClick={() => restoreRef.current?.click()}>Restore backup</button>
          <input ref={restoreRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = '' }} />
        </div>
      </div>
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </>
  )
}
