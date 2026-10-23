import { useMemo, useState } from 'react'
import type { KeyboardDef, Layout } from '../model/types'
import { generateConfigRepo, compileKeymap } from '../zmk/compile'
import { toast } from './Toast'

export function CodePanel({ layout, kb }: { layout: Layout; kb: KeyboardDef }) {
  const files = useMemo(() => {
    try {
      return generateConfigRepo(layout, kb)
    } catch (e) {
      return { error: String(e) } as Record<string, string>
    }
  }, [layout, kb])
  const warnings = useMemo(() => {
    try {
      return compileKeymap(layout, kb).warnings
    } catch {
      return []
    }
  }, [layout, kb])
  const names = Object.keys(files)
  const [file, setFile] = useState(names.find((n) => n.endsWith('.keymap')) ?? names[0])
  const text = files[file] ?? ''
  return (
    <div className="col">
      <div className="row wrap">
        <h2 className="grow">Generated ZMK config</h2>
        <button className="small" onClick={() => { navigator.clipboard.writeText(text); toast('Copied') }}>Copy file</button>
      </div>
      {warnings.length > 0 && (
        <div className="card warn small">
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      <div className="row wrap" style={{ gap: 4 }}>
        {names.map((n) => (
          <button key={n} className={`small ${n === file ? 'active' : ''}`} onClick={() => setFile(n)}>
            {n}
          </button>
        ))}
      </div>
      <pre className="code-view" style={{ maxHeight: '65vh' }}>{text}</pre>
    </div>
  )
}
