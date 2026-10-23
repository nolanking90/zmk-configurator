import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import type { KeyboardDef, Layout } from '../model/types'
import { compileKeymap, generateConfigRepo } from '../zmk/compile'
import { Modal } from './Modal'
import { useStore } from '../store/store'
import { GitHub, getSavedRepo, getToken, setSavedRepo, setToken, type WorkflowRun } from '../lib/github'
import { downloadBlob, downloadText, slug } from '../lib/download'
import { Icon } from './Icon'

type Tab = 'build' | 'download'

export function ExportDialog({ layout, kb, onClose }: { layout: Layout; kb: KeyboardDef; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('build')
  const compiled = useMemo(() => {
    try {
      return { ok: true as const, ...compileKeymap(layout, kb), files: generateConfigRepo(layout, kb) }
    } catch (e) {
      return { ok: false as const, error: String(e) }
    }
  }, [layout, kb])
  const createRevision = useStore((s) => s.createRevision)

  return (
    <Modal title="Download / build firmware" onClose={onClose} wide>
      <div className="tabs">
        <button className={`tab ${tab === 'build' ? 'active' : ''}`} onClick={() => setTab('build')}>Build firmware on GitHub</button>
        <button className={`tab ${tab === 'download' ? 'active' : ''}`} onClick={() => setTab('download')}>Download source</button>
      </div>
      {!compiled.ok ? (
        <div className="error">Could not compile this layout: {compiled.error}</div>
      ) : (
        <>
          {compiled.warnings.length > 0 && (
            <div className="card warn small">{compiled.warnings.map((w, i) => <div key={i}><Icon name="warning" /> {w}</div>)}</div>
          )}
          {tab === 'download' ? (
            <DownloadTab layout={layout} kb={kb} files={compiled.files} keymap={compiled.keymap} conf={compiled.conf} onDone={() => createRevision(layout.id, 'Downloaded source')} />
          ) : (
            <BuildTab layout={layout} kb={kb} files={compiled.files} onPushed={(repo) => createRevision(layout.id, `Built on ${repo}`)} />
          )}
        </>
      )}
    </Modal>
  )
}

function DownloadTab(props: { layout: Layout; kb: KeyboardDef; files: Record<string, string>; keymap: string; conf: string; onDone: () => void }) {
  const { layout, kb, files } = props
  const zip = async () => {
    const z = new JSZip()
    const root = z.folder(`zmk-config-${slug(layout.name)}`)!
    for (const [p, c] of Object.entries(files)) root.file(p, c)
    downloadBlob(await z.generateAsync({ type: 'blob' }), `zmk-config-${slug(layout.name)}.zip`)
    props.onDone()
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      <p>
        Get a complete <b>zmk-config</b> repository: push it to GitHub and the included workflow builds your firmware, or build locally with
        the ZMK toolchain.
      </p>
      <div className="row wrap">
        <button className="primary" onClick={zip}>Download zmk-config (.zip)</button>
        <button onClick={() => { downloadText(props.keymap, `${kb.zmkName}.keymap`); props.onDone() }}>{kb.zmkName}.keymap</button>
        <button onClick={() => downloadText(props.conf, `${kb.zmkName}.conf`)}>{kb.zmkName}.conf</button>
        <button onClick={() => downloadText(JSON.stringify(layout, null, 2), `${slug(layout.name)}.json`, 'application/json')}>Layout JSON</button>
      </div>
      <div className="help">
        Already have a zmk-config repo? Replace <code>config/{kb.zmkName}.keymap</code> and <code>config/{kb.zmkName}.conf</code> with these files and push.
      </div>
    </div>
  )
}

type Phase = 'idle' | 'pushing' | 'waiting' | 'building' | 'done' | 'failed'

function BuildTab({ layout, files, onPushed }: { layout: Layout; kb: KeyboardDef; files: Record<string, string>; onPushed: (repo: string) => void }) {
  const [token, setTok] = useState(getToken())
  const [login, setLogin] = useState<string | null>(null)
  const [repos, setRepos] = useState<string[]>([])
  const [repo, setRepo] = useState(getSavedRepo(layout.id))
  const [newName, setNewName] = useState(`zmk-config-${slug(layout.name)}`)
  const [phase, setPhase] = useState<Phase>('idle')
  const [log, setLog] = useState<string[]>([])
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [artifacts, setArtifacts] = useState<{ id: number; name: string; size_in_bytes: number; archive_download_url: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const cancelled = useRef(false)
  const gh = useMemo(() => (token ? new GitHub(token) : null), [token])
  const say = (m: string) => setLog((l) => [...l, m])

  useEffect(() => () => { cancelled.current = true }, [])

  useEffect(() => {
    if (!gh) return
    let live = true
    gh.user()
      .then((u) => { if (live) setLogin(u.login) })
      .then(() => gh.repos())
      .then((r) => { if (live && r) setRepos(r.map((x) => x.full_name)) })
      .catch((e) => { if (live) { setLogin(null); setError(String(e.message ?? e)) } })
    return () => { live = false }
  }, [gh])

  const go = async (target: string, create: boolean) => {
    if (!gh) return
    setError(null)
    setLog([])
    setArtifacts([])
    setRun(null)
    try {
      setPhase('pushing')
      let full = target
      let branch: string
      if (create) {
        say(`Creating repository ${target}…`)
        const r = await gh.createRepo(target, true)
        full = r.full_name
        branch = r.default_branch
        await new Promise((res) => setTimeout(res, 1500))
      } else {
        branch = (await gh.repo(full)).default_branch
      }
      setRepo(full)
      setSavedRepo(layout.id, full)
      say(`Committing ${Object.keys(files).length} files to ${full}@${branch}…`)
      const sha = await gh.commitFiles(full, branch, files, `Update keymap: ${layout.name}`)
      say(`Pushed ${sha.slice(0, 7)}.`)
      onPushed(full)
      setPhase('waiting')
      say('Waiting for GitHub Actions to pick up the build…')
      let r: WorkflowRun | undefined
      for (let i = 0; i < 60 && !r && !cancelled.current; i++) {
        await new Promise((res) => setTimeout(res, 3000))
        r = await gh.runForCommit(full, sha)
      }
      if (!r) throw new Error('No workflow run started. Check that Actions are enabled for the repository.')
      setRun(r)
      setPhase('building')
      say('Build started — this usually takes 1–3 minutes.')
      while (r.status !== 'completed' && !cancelled.current) {
        await new Promise((res) => setTimeout(res, 5000))
        r = await gh.run(full, r.id)
        setRun(r)
      }
      if (r.conclusion !== 'success') {
        setPhase('failed')
        const jobs = await gh.jobs(full, r.id).catch(() => [])
        for (const j of jobs.filter((j) => j.conclusion === 'failure')) say(`Failed: ${j.name}`)
        throw new Error(`Build ${r.conclusion}. Open the run on GitHub for the log.`)
      }
      const arts = await gh.artifacts(full, r.id)
      setArtifacts(arts)
      setPhase('done')
      say('Build succeeded.')
    } catch (e) {
      setPhase('failed')
      setError((e as Error).message ?? String(e))
    }
  }

  const download = async (a: { name: string; archive_download_url: string }) => {
    if (!gh) return
    try {
      downloadBlob(await gh.downloadArtifact(a.archive_download_url), `${a.name}.zip`)
    } catch {
      // Blob storage redirect can be blocked by CORS; fall back to the run page.
      if (run) window.open(run.html_url, '_blank')
    }
  }

  if (!gh || !login) {
    return (
      <div className="col" style={{ gap: 12 }}>
        <p>
          ZMK firmware is compiled by GitHub Actions in a <b>zmk-config</b> repository you own. Paste a GitHub token and this tool will push
          your keymap, run the build, and hand you the firmware files — no local toolchain needed.
        </p>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> with
            Repository access: your config repo (or “All repositories” to let this tool create one), and permissions <b>Contents</b>,{' '}
            <b>Workflows</b>, <b>Actions</b>: Read and write (<b>Administration</b>: write to create repos). Or a{' '}
            <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=ZMK%20Configurator" target="_blank" rel="noreferrer">classic token</a> with <code>repo</code> and <code>workflow</code>.
          </li>
          <li>Paste it below. It is stored only in this browser and sent only to api.github.com.</li>
        </ol>
        <div className="row">
          <input type="password" className="grow mono" placeholder="github_pat_… or ghp_…" defaultValue={token} id="ghtoken" />
          <button className="primary" onClick={() => { const v = (document.getElementById('ghtoken') as HTMLInputElement).value.trim(); setToken(v); setTok(v); setError(null) }}>Connect</button>
        </div>
        {error && <div className="error small">{error}</div>}
      </div>
    )
  }

  const busy = phase === 'pushing' || phase === 'waiting' || phase === 'building'
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row">
        <span>Connected as <b>{login}</b></span>
        <span className="spacer" />
        <button className="small ghost" onClick={() => { setToken(''); setTok(''); setLogin(null) }}>Disconnect</button>
      </div>
      <div className="row wrap">
        <label className="field grow">
          Existing zmk-config repository
          <input list="gh-repos" value={repo} placeholder={`${login}/zmk-config`} onChange={(e) => setRepo(e.target.value)} />
          <datalist id="gh-repos">{repos.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        <button className="primary" disabled={busy || !repo.includes('/')} onClick={() => go(repo, false)} style={{ alignSelf: 'flex-end' }}>
          Push &amp; build
        </button>
      </div>
      <div className="row wrap">
        <label className="field grow">
          …or create a new private repository
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <button disabled={busy || !newName} onClick={() => go(newName, true)} style={{ alignSelf: 'flex-end' }}>
          Create, push &amp; build
        </button>
      </div>
      <p className="help">
        Pushing overwrites <code>config/</code>, <code>build.yaml</code> and <code>.github/workflows/build.yml</code> in that repo; other files are kept.
      </p>
      {(log.length > 0 || error) && (
        <div className="card col small" style={{ gap: 4 }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
          {busy && <div className="muted"><Icon name="spinner" /> {phase === 'building' ? `Building (${run?.status})…` : 'Working…'}</div>}
          {error && <div className="error">{error}</div>}
          {run && <a href={run.html_url} target="_blank" rel="noreferrer">Open the run on GitHub <Icon name="external" /></a>}
        </div>
      )}
      {phase === 'done' && (
        <div className="card col">
          <h3>Firmware ready</h3>
          {artifacts.map((a) => (
            <div key={a.id} className="row">
              <button className="primary" onClick={() => download(a)}><Icon name="download" /> {a.name}.zip</button>
              <span className="muted small">{(a.size_in_bytes / 1024).toFixed(0)} KB</span>
            </div>
          ))}
          <p className="help">
            To flash: plug in one half, double-tap its reset button so it appears as a USB drive, and copy the matching <code>.uf2</code> file onto it.
            Repeat for the other half.
          </p>
        </div>
      )}
    </div>
  )
}
