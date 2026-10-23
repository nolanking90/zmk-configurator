import { useStore } from '../store/store'
import { getKeyboard } from '../data/keyboards'
import { OverviewPanel } from '../ui/OverviewPanel'

export function Print({ id }: { id: string }) {
  const layout = useStore((s) => s.layouts[id])
  const kb = layout ? getKeyboard(layout.keyboard) : undefined
  if (!layout || !kb) return <div className="page muted">Layout not found.</div>
  return (
    <>
      <div className="topbar">
        <a className="btn ghost" href={`#/layout/${id}`}>← Back to editor</a>
        <span className="spacer" />
        <button className="primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <div className="page col" style={{ gap: 12 }}>
        <h1>{layout.name}</h1>
        <div className="muted">{kb.name}{layout.description ? ` — ${layout.description}` : ''}</div>
        <OverviewPanel layout={layout} kb={kb} unit={46} />
      </div>
    </>
  )
}
