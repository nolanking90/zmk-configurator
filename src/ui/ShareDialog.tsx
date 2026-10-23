import { useMemo, useState } from 'react'
import type { Layout } from '../model/types'
import { Modal } from './Modal'
import { shareUrl } from '../lib/share'
import { GitHub, getToken } from '../lib/github'
import { toast } from './Toast'
import { slug } from '../lib/download'

export function ShareDialog({ layout, onClose }: { layout: Layout; onClose: () => void }) {
  const url = useMemo(() => shareUrl(layout), [layout])
  const [gist, setGist] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const token = getToken()
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast('Link copied') }

  const makeGist = async () => {
    setBusy(true)
    setErr(null)
    try {
      const g = await new GitHub(token).createGist(
        { [`${slug(layout.name)}.zmk-layout.json`]: JSON.stringify(layout, null, 1) },
        `ZMK layout: ${layout.name}`,
        false,
      )
      setGist(`${window.location.href.split('#')[0]}#/gist/${g.id}`)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Modal title="Share layout" onClose={onClose}>
      <p>Anyone with the link can view this layout and copy it into their own layouts. The whole layout is stored in the link itself.</p>
      <div className="row">
        <input className="grow mono" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button className="primary" onClick={() => copy(url)}>Copy</button>
      </div>
      <span className="help">{(url.length / 1024).toFixed(1)} KB link. Changes you make later aren't reflected — share again after editing.</span>
      <hr />
      <h3>Short link via GitHub Gist</h3>
      {token ? (
        <>
          <p className="small muted">Creates a secret gist on your GitHub account holding the layout JSON.</p>
          <div className="row">
            <button onClick={makeGist} disabled={busy}>{busy ? 'Creating…' : 'Create gist link'}</button>
            {gist && <><input className="grow mono" readOnly value={gist} onFocus={(e) => e.target.select()} /><button onClick={() => copy(gist)}>Copy</button></>}
          </div>
          {err && <div className="error small">{err} (classic tokens need the <code>gist</code> scope; fine-grained tokens need Gists: write)</div>}
        </>
      ) : (
        <p className="small muted">Connect GitHub in “Download / Build firmware” to enable short gist links.</p>
      )}
    </Modal>
  )
}
