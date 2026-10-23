import { useState } from 'react'
import { Modal } from './Modal'
import { KEYBOARDS, getKeyboard } from '../data/keyboards'
import { importConf, importKeymap } from '../zmk/importKeymap'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'
import { cloneAsNew, decodeLayout, isLayout } from '../lib/share'
import { defaultSettings } from '../model/defaults'
import { Icon } from './Icon'

/** guess the keyboard from a filename like "corne.keymap" or the number of bindings */
function guessKeyboard(fileName: string, text: string): string {
  const base = fileName.replace(/\.(keymap|json|dtsi?)$/i, '').toLowerCase()
  const byName = KEYBOARDS.find((k) => k.zmkName === base || k.id === base)
  if (byName) return byName.id
  const m = /bindings\s*=\s*<([^;]*)>\s*;/.exec(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))
  if (m) {
    const n = (m[1].match(/&/g) ?? []).length
    const hit = KEYBOARDS.find((k) => k.keys.length === n)
    if (hit) return hit.id
  }
  return KEYBOARDS[0].id
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addLayout)
  const [text, setText] = useState('')
  const [conf, setConf] = useState('')
  const [fileName, setFileName] = useState('')
  const [kbId, setKbId] = useState(KEYBOARDS[0].id)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      const t = await f.text()
      if (f.name.endsWith('.conf')) setConf(t)
      else {
        setText(t)
        setFileName(f.name)
        setKbId(guessKeyboard(f.name, t))
      }
    }
  }

  const doImport = () => {
    setError(null)
    const t = text.trim()
    try {
      // share link?
      const share = /#\/share\/([^\s]+)/.exec(t)
      if (share) {
        const l = decodeLayout(share[1])
        if (!l) throw new Error('That share link is invalid or truncated.')
        const c = cloneAsNew(l)
        add(c)
        navigate(`/layout/${c.id}`)
        return
      }
      if (t.startsWith('{') || t.startsWith('[')) {
        const j = JSON.parse(t)
        if (!isLayout(j)) throw new Error('JSON is not a ZMK Configurator layout.')
        if (!getKeyboard(j.keyboard)) throw new Error(`Unknown keyboard “${j.keyboard}”.`)
        const c = cloneAsNew(j)
        c.settings = { ...defaultSettings(), ...c.settings }
        add(c)
        navigate(`/layout/${c.id}`)
        return
      }
      const kb = getKeyboard(kbId)!
      const r = importKeymap(t, kb)
      const layout = r.layout
      layout.keyboard = kb.id
      if (!layout.name || layout.name === 'Untitled layout') layout.name = fileName ? `Imported ${fileName}` : `Imported ${kb.name}`
      if (conf.trim()) layout.settings = importConf(conf, layout.settings)
      if (r.warnings.length && !warnings.length) {
        setWarnings(r.warnings)
        return // show warnings once; next click imports
      }
      add(layout)
      navigate(`/layout/${layout.id}`)
    } catch (e) {
      setError((e as Error).message ?? String(e))
    }
  }

  return (
    <Modal
      title="Import layout"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!text.trim()} onClick={doImport}>{warnings.length ? 'Import anyway' : 'Import'}</button>
        </>
      }
    >
      <p className="small muted">
        Import a ZMK <code>.keymap</code> (optionally with its <code>.conf</code>), a layout <code>.json</code> exported from this tool, or a share link.
      </p>
      <input type="file" multiple accept=".keymap,.json,.conf,.dtsi,.txt" onChange={(e) => onFiles(e.target.files)} />
      <textarea className="mono" rows={10} placeholder="…or paste the .keymap / JSON / share link here" value={text} onChange={(e) => { setText(e.target.value); setWarnings([]) }} />
      {!text.trim().startsWith('{') && !text.includes('#/share/') && (
        <label className="field">
          Keyboard
          <select value={kbId} onChange={(e) => { setKbId(e.target.value); setWarnings([]) }}>
            {KEYBOARDS.map((k) => <option key={k.id} value={k.id}>{k.name} ({k.keys.length} keys)</option>)}
          </select>
        </label>
      )}
      {conf && <div className="small muted">+ .conf loaded ({conf.split('\n').length} lines)</div>}
      {warnings.length > 0 && (
        <div className="card warn small" style={{ maxHeight: 180, overflowY: 'auto' }}>
          <b>Imported with {warnings.length} warning(s):</b>
          {warnings.map((w, i) => <div key={i}><Icon name="warning" /> {w}</div>)}
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
