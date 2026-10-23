import { useEffect, useMemo, useState } from 'react'
import type { Layout } from '../model/types'
import { decodeLayout, cloneAsNew, isLayout } from '../lib/share'
import { getKeyboard } from '../data/keyboards'
import { OverviewPanel } from '../ui/OverviewPanel'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'
import { fetchGist } from '../lib/github'

export function SharePage({ data, gist }: { data?: string; gist?: string }) {
  const add = useStore((s) => s.addLayout)
  const fromHash = useMemo(() => (data ? decodeLayout(data) : null), [data])
  const [fromGist, setFromGist] = useState<Layout | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!gist) return
    fetchGist(gist)
      .then((files) => {
        const f = Object.values(files)[0]
        const j = JSON.parse(f)
        if (!isLayout(j)) throw new Error('Gist does not contain a layout')
        setFromGist(j)
      })
      .catch((e) => setErr(String(e.message ?? e)))
  }, [gist])
  const layout = fromHash ?? fromGist
  const kb = layout ? getKeyboard(layout.keyboard) : undefined
  return (
    <>
      <div className="topbar">
        <a className="brand" href="#/"><span className="brand-logo">Z</span> ZMK Configurator</a>
        <span className="spacer" />
        {layout && kb && (
          <button className="primary" onClick={() => { const c = cloneAsNew(layout); add(c); navigate(`/layout/${c.id}`) }}>
            Copy to my layouts
          </button>
        )}
      </div>
      <div className="page col" style={{ gap: 12 }}>
        {err ? <div className="error">{err}</div>
          : !layout ? <div className="muted">{gist ? 'Loading…' : 'This share link is invalid.'}</div>
          : !kb ? <div className="error">Unknown keyboard “{layout.keyboard}”.</div>
          : (
            <>
              <h1>{layout.name}</h1>
              <div className="muted">Shared {kb.name} layout{layout.description ? ` — ${layout.description}` : ''}</div>
              <OverviewPanel layout={layout} kb={kb} unit={46} />
            </>
          )}
      </div>
    </>
  )
}
