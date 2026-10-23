import { useEffect, useMemo, useState } from 'react'
import type { KeyboardDef, Layout } from '../model/types'
import { useStore } from '../store/store'
import { diffLayouts } from '../lib/diff'
import { toast } from './Toast'

const fmt = (t: number) => new Date(t).toLocaleString()

export function RevisionsPanel({ layout }: { layout: Layout; kb: KeyboardDef }) {
  const load = useStore((s) => s.loadRevisions)
  const revs = useStore((s) => s.revisions[layout.id])
  const create = useStore((s) => s.createRevision)
  const restore = useStore((s) => s.restoreRevision)
  const remove = useStore((s) => s.deleteRevision)
  const [msg, setMsg] = useState('')
  const [cur, setCur] = useState<string | null>(null)

  useEffect(() => { load(layout.id) }, [layout.id, load])

  const rev = revs?.find((r) => r.id === cur)
  const diff = useMemo(() => (rev ? diffLayouts(rev.snapshot, layout) : []), [rev, layout])

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row wrap">
        <h2 className="grow">Revisions</h2>
        <input placeholder="Describe this version (optional)" value={msg} onChange={(e) => setMsg(e.target.value)} style={{ width: 280 }} />
        <button className="primary" onClick={() => { create(layout.id, msg || 'Manual save'); setMsg(''); toast('Revision saved') }}>Save revision</button>
      </div>
      <p className="help">Every firmware download/build also saves a revision automatically. Select one to compare with the current layout or restore it.</p>
      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="panel" style={{ width: 320, flex: 'none', maxHeight: 520, overflowY: 'auto' }}>
          {(revs ?? []).map((r, i) => (
            <div key={r.id} className="list-item" style={{ cursor: 'pointer', background: r.id === cur ? 'var(--accent-soft)' : undefined }} onClick={() => setCur(r.id)}>
              <div className="grow">
                <div>{r.message || 'Revision'}</div>
                <div className="small muted">#{(revs?.length ?? 0) - i} · {fmt(r.createdAt)}</div>
              </div>
            </div>
          ))}
          {!revs?.length && <div className="list-item muted">No revisions yet.</div>}
        </div>
        {rev && (
          <div className="panel grow" style={{ minWidth: 320 }}>
            <div className="editor-head">
              <h3 className="grow">{rev.message} <span className="muted small">{fmt(rev.createdAt)}</span></h3>
              <button className="small" onClick={() => { if (confirm('Replace the current layout with this revision? (You can undo.)')) { restore(layout.id, rev.id); toast('Revision restored') } }}>Restore</button>
              <button className="small danger" onClick={() => { remove(layout.id, rev.id); setCur(null) }}>Delete</button>
            </div>
            <div className="editor-body">
              {diff.length === 0 ? (
                <span className="muted">Identical to the current layout.</span>
              ) : (
                <>
                  <div className="small muted" style={{ marginBottom: 8 }}>{diff.length} difference{diff.length > 1 ? 's' : ''} between this revision and now</div>
                  <table className="diff">
                    <thead><tr><th>Where</th><th>This revision</th><th>Now</th></tr></thead>
                    <tbody>
                      {diff.slice(0, 400).map((d, i) => (
                        <tr key={i}><td>{d.where}</td><td className="muted">{d.before}</td><td>{d.after}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
