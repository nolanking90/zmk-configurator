import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { KEYBOARDS, getKeyboard } from '../data/keyboards'
import { StudioDevice, studioSupport } from '../studio/device'
import { deviceKeyCount, readDevice, snapshotToLayout, type DeviceSnapshot } from '../studio/sync'
import { matchKeyboards } from '../studio/convert'
import { useStore } from '../store/store'
import { navigate } from '../lib/router'
import { Icon } from './Icon'

/** Start page: create a new layout from the keymap on a connected ZMK Studio keyboard. */
export function ReadKeyboardDialog({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addLayout)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [snap, setSnap] = useState<DeviceSnapshot | null>(null)
  const [kbId, setKbId] = useState('')
  const [candidates, setCandidates] = useState<string[]>([])
  const devRef = useRef<StudioDevice | null>(null)
  const support = studioSupport()

  useEffect(() => () => { devRef.current?.disconnect() }, [])

  const read = async (dev: StudioDevice) => {
    setStatus('Reading keymap…')
    const s = await readDevice(dev, setStatus)
    const phys = s.physical.layouts[s.physical.activeLayoutIndex]
    const ranked = matchKeyboards(phys, deviceKeyCount(s), KEYBOARDS).map((m) => m.kb)
    // a catalog keyboard with the device's own name wins (e.g. "Sofle")
    const named = KEYBOARDS.filter((k) => k.name.toLowerCase() === s.name.toLowerCase() && k.keys.length === deviceKeyCount(s))
    const list = [...named, ...ranked.filter((k) => !named.includes(k))]
    setCandidates(list.map((k) => k.id))
    setKbId(list[0]?.id ?? '')
    setSnap(s)
    setStatus(null)
  }

  const connect = async () => {
    setError(null)
    setStatus('Choose your keyboard in the browser’s device list…')
    try {
      const dev = await StudioDevice.connect('usb', {
        onLockChange: (l) => { setLocked(l); if (!l && !snap) read(dev).catch((e) => setError(String(e.message ?? e))) },
      })
      devRef.current = dev
      if (!dev.unlocked) {
        setLocked(true)
        setStatus(null)
        return
      }
      await read(dev)
    } catch (e) {
      setStatus(null)
      setError((e as Error).message ?? String(e))
    }
  }

  const create = () => {
    const kb = getKeyboard(kbId)
    if (!snap || !kb) return
    const { layout } = snapshotToLayout(snap, kb)
    layout.name = `${snap.name} (from keyboard)`
    add(layout)
    devRef.current?.disconnect()
    navigate(`/layout/${layout.id}`)
  }

  return (
    <Modal
      title="Read layout from keyboard"
      onClose={onClose}
      footer={snap ? <><button onClick={onClose}>Cancel</button><button className="primary" disabled={!kbId} onClick={create}>Create layout</button></> : undefined}
    >
      {!support.serial ? (
        <p className="error">This browser can’t talk to USB serial devices. Use Chrome, Edge or another Chromium browser.</p>
      ) : !snap ? (
        <>
          <p>
            Plug your keyboard in over USB (for split keyboards, the left/central half). Its firmware must be built with ZMK Studio
            support. The keymap is read into a new layout in this browser; nothing on the keyboard changes.
          </p>
          <div><button className="primary" onClick={connect} disabled={!!status}>Connect via USB</button></div>
          {locked && <p className="warn">The keyboard is locked. Press its Studio unlock key (&amp;studio_unlock) — reading starts automatically.</p>}
          {status && <p className="muted"><Icon name="spinner" /> {status}</p>}
        </>
      ) : (
        <>
          <p>
            Read <b>{snap.name}</b>: {snap.keymap.layers.length} layers, {deviceKeyCount(snap)} keys.
          </p>
          <label className="field">
            Keyboard
            <select value={kbId} onChange={(e) => setKbId(e.target.value)}>
              {candidates.map((id) => { const k = getKeyboard(id)!; return <option key={id} value={id}>{k.name} ({k.keys.length} keys)</option> })}
              <option disabled>Other keyboards</option>
              {KEYBOARDS.filter((k) => !candidates.includes(k.id)).map((k) => <option key={k.id} value={k.id}>{k.name} ({k.keys.length} keys)</option>)}
            </select>
            <span className="help">Best match first, based on the keyboard’s name and physical layout.</span>
          </label>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  )
}
