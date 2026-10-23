import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardDef, Layout } from '../model/types'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { toast } from './Toast'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'
import { KEYBOARDS, getKeyboard } from '../data/keyboards'
import { LockedError, StudioDevice, studioSupport, type TransportKind } from '../studio/device'
import { deviceKeymapToLayers, matchKeyboards } from '../studio/convert'
import { applyWrite, deviceKeyCount, groupSkipped, planWrite, readDevice, snapshotToLayout, type DeviceSnapshot, type WritePlan } from '../studio/sync'
import { uid } from '../model/defaults'

const errMsg = (e: unknown) => (e as Error)?.message ?? String(e)

export function StudioDialog({ layout, kb, onClose }: { layout: Layout; kb: KeyboardDef; onClose: () => void }) {
  const support = useMemo(() => studioSupport(), [])
  const [dev, setDev] = useState<StudioDevice | null>(null)
  const devRef = useRef<StudioDevice | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [snap, setSnap] = useState<DeviceSnapshot | null>(null)
  const [plan, setPlan] = useState<WritePlan | null>(null)
  const [removeExtra, setRemoveExtra] = useState(true)
  const [lastWrite, setLastWrite] = useState<string | null>(null)

  // disconnect when the dialog closes
  useEffect(() => () => { devRef.current?.disconnect() }, [])

  // poll the lock state while locked (the unlock notification usually arrives first)
  useEffect(() => {
    if (!dev || unlocked) return
    const t = setInterval(() => { dev.refreshLockState().catch(() => undefined) }, 2000)
    return () => clearInterval(t)
  }, [dev, unlocked])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof LockedError) setUnlocked(false)
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const connect = (kind: TransportKind) =>
    run('Connecting…', async () => {
      const d = await StudioDevice.connect(kind, {
        onLockChange: setUnlocked,
        onUnsavedChange: setUnsaved,
        onDisconnect: () => {
          devRef.current = null
          setDev(null)
          setSnap(null)
          setPlan(null)
        },
      })
      devRef.current = d
      setDev(d)
      setUnlocked(d.unlocked)
      if (d.unlocked) setUnsaved(await d.checkUnsavedChanges().catch(() => false))
    })

  const read = () =>
    run('Reading…', async () => {
      if (!dev) return
      const s = await readDevice(dev, setBusy)
      setSnap(s)
      setPlan(null)
      setUnsaved(await dev.checkUnsavedChanges().catch(() => unsaved))
    })

  const preview = () =>
    run('Comparing…', async () => {
      if (!dev) return
      let s = snap
      if (!s) {
        s = await readDevice(dev, setBusy)
        setSnap(s)
      } else {
        s = { ...s, keymap: await dev.getKeymap() }
        setSnap(s)
      }
      setPlan(planWrite(layout, kb, s.keymap, s.index, { removeExtraLayers: removeExtra }))
      setLastWrite(null)
    })

  const write = () =>
    run('Writing…', async () => {
      if (!dev || !snap) return
      const r = await applyWrite(dev, layout, kb, snap.index, { removeExtraLayers: removeExtra }, setBusy)
      setSnap({ ...snap, keymap: await dev.getKeymap() })
      setPlan(null)
      setUnsaved(true)
      const f = r.failed.length ? ` ${r.failed.length} rejected by the keyboard: ${r.failed.slice(0, 5).map((x) => `layer ${x.layer} key ${x.position} (${x.error})`).join('; ')}` : ''
      setLastWrite(`Wrote ${r.written} key${r.written === 1 ? '' : 's'}${r.plan.renames.length ? ` and ${r.plan.renames.length} layer name(s)` : ''}. Changes are live but not saved yet.${f}`)
    })

  const save = () => run('Saving…', async () => {
    await dev?.save()
    setUnsaved(false)
    setLastWrite(null)
    toast('Saved to the keyboard')
  })
  const discard = () => run('Discarding…', async () => {
    await dev?.discard()
    setUnsaved(false)
    setLastWrite(null)
    setPlan(null)
    if (dev && snap) setSnap({ ...snap, keymap: await dev.getKeymap() })
    toast('Discarded changes on the keyboard')
  })

  const footer = dev ? (
    <>
      <span className="small muted" style={{ marginRight: 'auto' }}>{unsaved ? <><Icon name="dot" /> Unsaved changes on the keyboard</> : ''}</span>
      <button disabled={!!busy || !unsaved} onClick={discard}>Discard</button>
      <button className="primary" disabled={!!busy || !unsaved} onClick={save}>Save to keyboard</button>
    </>
  ) : undefined

  return (
    <Modal title="Live (ZMK Studio)" onClose={onClose} wide footer={footer}>
      {!support.serial && !support.bluetooth ? (
        <Unsupported />
      ) : !support.secureContext ? (
        <div className="card warn">ZMK Studio needs a secure page. Open this app over <b>https</b> or on <b>localhost</b>.</div>
      ) : !dev ? (
        <ConnectPanel layout={layout} support={support} busy={!!busy} onConnect={connect} />
      ) : (
        <>
          <div className="row wrap">
            <span>Connected to <b>{dev.info.name}</b> <span className="badge">{dev.transport === 'usb' ? 'USB' : 'Bluetooth'}</span></span>
            <span className={`badge ${unlocked ? '' : 'warn'}`}>{unlocked ? <><Icon name="unlock" /> Unlocked</> : <><Icon name="lock" /> Locked</>}</span>
            <span className="spacer" />
            <button className="small ghost" onClick={() => dev.disconnect()}>Disconnect</button>
          </div>
          {!unlocked ? (
            <div className="card col">
              <h3>Unlock the keyboard</h3>
              <p>
                Press the key bound to <code>&amp;studio_unlock</code> on your keyboard. This dialog continues automatically.
              </p>
              <p className="help">
                No unlock key? Add “Studio unlock” (System behaviors) to a key, rebuild and flash once. The keyboard locks again when it disconnects
                or after a period of inactivity.
              </p>
            </div>
          ) : (
            <>
              <ReadPanel layout={layout} kb={kb} snap={snap} busy={!!busy} onRead={read} />
              <WritePanel
                plan={plan}
                busy={!!busy}
                removeExtra={removeExtra}
                setRemoveExtra={setRemoveExtra}
                onPreview={preview}
                onWrite={write}
                lastWrite={lastWrite}
              />
            </>
          )}
        </>
      )}
      {busy && <div className="muted small"><Icon name="spinner" /> {busy}</div>}
      {error && <div className="error small" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
    </Modal>
  )
}

function Unsupported() {
  return (
    <div className="card col">
      <h3>This browser can’t talk to keyboards</h3>
      <p>
        Live editing uses <b>WebSerial</b> (USB) or <b>Web Bluetooth</b>, which only Chromium-based desktop browsers support: Chrome, Edge, Opera,
        Brave, Vivaldi. Firefox and Safari don’t implement them.
      </p>
      <p className="help">
        You can still build firmware with “Download / Build firmware”, or use the ZMK Studio desktop app.
      </p>
    </div>
  )
}

function ConnectPanel(props: { layout: Layout; support: ReturnType<typeof studioSupport>; busy: boolean; onConnect: (k: TransportKind) => void }) {
  const { layout, support } = props
  return (
    <div className="col" style={{ gap: 12 }}>
      <p>
        Read and change the keymap of a connected keyboard without reflashing, through <b>ZMK Studio</b>. Plain keys, mod-tap, layer-tap, layer
        switching, sticky keys, Bluetooth / output / RGB controls and similar can be changed live; tap dances, macros, combos, custom hold-taps and
        timing settings still need a firmware build.
      </p>
      <div className="row wrap">
        <button className="primary" disabled={props.busy || !support.serial} onClick={() => props.onConnect('usb')}>Connect via USB</button>
        <button disabled={props.busy || !support.bluetooth} onClick={() => props.onConnect('ble')}>Connect via Bluetooth (experimental)</button>
      </div>
      {!support.serial && <div className="small warn">This browser has no WebSerial; only Bluetooth is available.</div>}
      <div className="card col small">
        <b>The keyboard must run firmware built with ZMK Studio support</b>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            In this layout’s <a href={`#/layout/${layout.id}/settings`}>Settings</a>, turn on <b>ZMK Studio support</b>
            {layout.settings.studio ? <span className="muted"> (already on for this layout)</span> : <span className="warn"> (currently off)</span>}.
            This adds the <code>studio-rpc-usb-uart</code> snippet and <code>CONFIG_ZMK_STUDIO=y</code> to the build.
          </li>
          <li>Put a <b>Studio unlock</b> key (<code>&amp;studio_unlock</code>) somewhere in the keymap.</li>
          <li>Build and flash the firmware (split keyboards: the central / left half), then connect that half over USB.</li>
        </ol>
        <span className="help">
          If the keyboard doesn’t appear in the browser’s device list, its firmware doesn’t have Studio enabled. Bluetooth works best on Linux and
          ChromeOS, and the keyboard must already be paired.
        </span>
      </div>
    </div>
  )
}

function ReadPanel(props: { layout: Layout; kb: KeyboardDef; snap: DeviceSnapshot | null; busy: boolean; onRead: () => void }) {
  const { snap, kb, layout } = props
  const addLayout = useStore((s) => s.addLayout)
  const update = useStore((s) => s.update)
  const n = snap ? deviceKeyCount(snap) : 0
  const matches = useMemo(() => {
    if (!snap) return []
    return matchKeyboards(snap.physical.layouts[snap.physical.activeLayoutIndex], n, KEYBOARDS)
  }, [snap, n])
  const [target, setTarget] = useState('')
  const targetId = target || (matches.find((m) => m.kb.id === kb.id)?.kb.id ?? matches[0]?.kb.id ?? '')
  const targetKb = getKeyboard(targetId)
  const sameKb = kb.keys.length === n

  const importNew = () => {
    if (!snap || !targetKb) return
    const { layout: l, warnings } = snapshotToLayout(snap, targetKb)
    addLayout(l)
    toast(warnings.length ? `Imported with ${warnings.length} note(s) — see raw keys` : 'Imported from keyboard')
    navigate(`/layout/${l.id}`)
  }

  const replaceCurrent = () => {
    if (!snap) return
    if (!confirm(`Replace all ${layout.layers.length} layers of “${layout.name}” with the keymap read from the keyboard? (Undo is available.)`)) return
    const r = deviceKeymapToLayers(snap.keymap, snap.index, kb.keys.length, uid, layout.layers)
    update(layout.id, (d) => {
      d.layers = r.layers
    })
    toast(r.warnings.length ? `Loaded; ${r.warnings.length} key(s) kept as raw bindings` : 'Loaded the keyboard’s keymap')
  }

  const warnings = useMemo(() => (snap ? deviceKeymapToLayers(snap.keymap, snap.index, n, () => '').warnings : []), [snap, n])

  return (
    <div className="card col">
      <div className="row">
        <h3 className="grow">Read from keyboard</h3>
        <button disabled={props.busy} onClick={props.onRead}>{snap ? 'Read again' : 'Read from keyboard'}</button>
      </div>
      {snap && (
        <>
          <div className="small">
            {snap.keymap.layers.length} layer{snap.keymap.layers.length === 1 ? '' : 's'} ({snap.keymap.layers.map((l, i) => l.name || `Layer ${i}`).join(', ')}),{' '}
            {n} keys, {snap.behaviors.length} behaviors, room for {snap.keymap.availableLayers} more layer{snap.keymap.availableLayers === 1 ? '' : 's'}.
            {snap.physical.layouts.length > 1 && (
              <> Physical layout: <b>{snap.physical.layouts[snap.physical.activeLayoutIndex]?.name}</b> (of {snap.physical.layouts.length}).</>
            )}
          </div>
          {warnings.length > 0 && (
            <details className="small">
              <summary className="warn">{warnings.length} binding(s) can’t be modelled and will be imported as raw bindings</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
          <div className="row wrap">
            <label className="field grow">
              Keyboard for the new layout
              <select value={targetId} onChange={(e) => setTarget(e.target.value)}>
                {matches.length > 0 && (
                  <optgroup label={`Keyboards with ${n} keys (best match first)`}>
                    {matches.map((m) => <option key={m.kb.id} value={m.kb.id}>{m.kb.name}</option>)}
                  </optgroup>
                )}
                <optgroup label="Other keyboards (keys will be truncated / padded)">
                  {KEYBOARDS.filter((k) => k.keys.length !== n).map((k) => <option key={k.id} value={k.id}>{k.name} ({k.keys.length} keys)</option>)}
                </optgroup>
              </select>
            </label>
            <button className="primary" disabled={!targetKb} onClick={importNew} style={{ alignSelf: 'flex-end' }}>Import as new layout</button>
            <button disabled={!sameKb} onClick={replaceCurrent} style={{ alignSelf: 'flex-end' }} title={sameKb ? '' : `This layout's keyboard has ${kb.keys.length} keys, the device ${n}`}>
              Load into this layout
            </button>
          </div>
          {matches.length === 0 && <div className="small warn">No keyboard in the catalog has {n} keys; pick the closest one.</div>}
        </>
      )}
    </div>
  )
}

function WritePanel(props: {
  plan: WritePlan | null
  busy: boolean
  removeExtra: boolean
  setRemoveExtra: (v: boolean) => void
  onPreview: () => void
  onWrite: () => void
  lastWrite: string | null
}) {
  const { plan } = props
  const groups = plan ? groupSkipped(plan.skipped) : []
  const blocking = plan ? plan.errors.length > 0 && plan.addLayers === 0 : false
  const nothing = plan && !plan.changes.length && !plan.renames.length && !plan.addLayers && !plan.removeLayers.length
  return (
    <div className="card col">
      <div className="row">
        <h3 className="grow">Write this layout to the keyboard</h3>
        <button disabled={props.busy} onClick={props.onPreview}>{plan ? 'Compare again' : 'Compare with keyboard'}</button>
      </div>
      <label className="row small">
        <input type="checkbox" checked={props.removeExtra} onChange={(e) => props.setRemoveExtra(e.target.checked)} />
        Remove keyboard layers this layout doesn’t have
      </label>
      {plan && (
        <>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li><b>{plan.changes.length}</b> key{plan.changes.length === 1 ? '' : 's'} to change, {plan.unchanged} already match</li>
            {plan.addLayers > 0 && <li>{plan.addLayers} layer(s) to add</li>}
            {plan.removeLayers.length > 0 && <li>{plan.removeLayers.length} layer(s) to remove from the keyboard</li>}
            {plan.renames.length > 0 && <li>Rename: {plan.renames.map((r) => `layer ${r.layer} to “${r.name}”`).join(', ')}</li>}
          </ul>
          {plan.errors.map((e, i) => <div key={i} className="error small">{e}</div>)}
          {plan.skipped.length > 0 && (
            <div className="col small" style={{ gap: 4 }}>
              <b className="warn">These {plan.skipped.length} key{plan.skipped.length === 1 ? '' : 's'} need a firmware build and will be skipped:</b>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {groups.map((g) => (
                  <li key={g.reason}>
                    {g.reason} — {g.keys.length}:{' '}
                    <span className="muted">
                      {g.keys.slice(0, 12).map((k) => `${k.layerName} #${k.position}`).join(', ')}
                      {g.keys.length > 12 ? `, +${g.keys.length - 12} more` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.notes.map((n, i) => <div key={i} className="help">ℹ {n}</div>)}
          <div className="row">
            <button className="primary" disabled={props.busy || blocking || !!nothing} onClick={props.onWrite}>
              {nothing ? 'Keyboard already matches' : `Write ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`}
            </button>
            <span className="help">Changes take effect immediately; use Save to keep them after a restart, or Discard to revert.</span>
          </div>
        </>
      )}
      {props.lastWrite && <div className="small">{props.lastWrite}</div>}
    </div>
  )
}
