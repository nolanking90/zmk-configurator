// ZMK Studio connection: wraps @zmkfirmware/zmk-studio-ts-client with typed
// helpers, timeouts and notification handling. Mirrors how the official
// zmk-studio app uses the client (App.tsx / Keyboard.tsx there).

import { call_rpc, create_rpc_connection, MetaError, NoResponseError, type RpcConnection } from '@zmkfirmware/zmk-studio-ts-client'
import type { Notification, Request, RequestResponse } from '@zmkfirmware/zmk-studio-ts-client'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { DeviceBehavior, DeviceBinding, DeviceKeymap, DeviceLayer, DevicePhysicalLayouts } from './convert'

// Numeric protobuf enum values (zmk-studio-messages core.proto / meta.proto / keymap.proto).
const LOCK_STATE_UNLOCKED = 1
const META_UNLOCK_REQUIRED = 1
const META_RPC_NOT_FOUND = 2

export type TransportKind = 'usb' | 'ble'

export interface StudioSupport {
  serial: boolean
  bluetooth: boolean
  secureContext: boolean
}

export function studioSupport(): StudioSupport {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as { serial?: unknown; bluetooth?: unknown }
  return {
    serial: !!nav.serial,
    bluetooth: !!nav.bluetooth,
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
  }
}

/** Thrown when an RPC needs the keyboard to be unlocked (&studio_unlock). */
export class LockedError extends Error {
  constructor() {
    super('The keyboard is locked. Press the key bound to &studio_unlock.')
  }
}

export class StudioError extends Error {}

const SAVE_ERRORS: Record<number, string> = {
  1: 'the keyboard reported a generic error',
  2: 'saving is not supported by this firmware (CONFIG_ZMK_KEYMAP_SETTINGS_STORAGE is off)',
  3: 'there is no space left in the keyboard’s settings storage',
}
const SET_BINDING_ERRORS: Record<number, string> = {
  1: 'invalid key position',
  2: 'invalid behavior',
  3: 'invalid parameters',
}

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new StudioError(`${what}: no response from the keyboard after ${ms / 1000}s`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export interface DeviceInfo {
  name: string
  serialNumber: string
}

export interface StudioEvents {
  onLockChange?(unlocked: boolean): void
  onUnsavedChange?(unsaved: boolean): void
  onDisconnect?(reason?: unknown): void
}

export class StudioDevice {
  readonly transport: TransportKind
  readonly info: DeviceInfo
  unlocked = false
  private conn: RpcConnection
  private abort: AbortController
  private events: StudioEvents
  private closed = false

  private constructor(conn: RpcConnection, abort: AbortController, transport: TransportKind, info: DeviceInfo, events: StudioEvents) {
    this.conn = conn
    this.abort = abort
    this.transport = transport
    this.info = info
    this.events = events
  }

  /**
   * Ask the user to pick a device (browser chooser), open the RPC channel and
   * fetch device info + lock state. Throws StudioError with a readable message.
   */
  static async connect(kind: TransportKind, events: StudioEvents = {}): Promise<StudioDevice> {
    let transport: RpcTransport
    try {
      if (kind === 'usb') {
        const { connect } = await import('@zmkfirmware/zmk-studio-ts-client/transport/serial')
        transport = await connect()
      } else {
        const { connect } = await import('@zmkfirmware/zmk-studio-ts-client/transport/gatt')
        transport = await connect()
      }
    } catch (e) {
      throw new StudioError(describeConnectError(e, kind))
    }
    const abort = new AbortController()
    const conn = create_rpc_connection(transport, { signal: abort.signal })
    let info: DeviceInfo | undefined
    try {
      const r = await timeout(call_rpc(conn, { core: { getDeviceInfo: true } }), 2000, 'Device info')
      const d = r.core?.getDeviceInfo
      if (d) info = { name: d.name || transport.label, serialNumber: hex(d.serialNumber) }
    } catch {
      info = undefined
    }
    if (!info) {
      abort.abort('no studio response')
      transport.abortController.abort('no studio response')
      throw new StudioError(
        kind === 'usb'
          ? 'The selected serial port did not answer ZMK Studio requests. Pick the keyboard’s port (not a USB-logging or other serial device), and make sure its firmware was built with ZMK Studio support.'
          : 'The keyboard did not answer ZMK Studio requests over Bluetooth.',
      )
    }
    const dev = new StudioDevice(conn, abort, kind, info, events)
    dev.listen()
    await dev.refreshLockState().catch(() => undefined)
    return dev
  }

  get connected() {
    return !this.closed
  }

  setEvents(events: StudioEvents) {
    this.events = events
  }

  private async listen() {
    const reader = this.conn.notification_readable.getReader()
    const onAbort = () => { reader.cancel().catch(() => undefined) }
    this.abort.signal.addEventListener('abort', onAbort, { once: true })
    let reason: unknown
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) this.handleNotification(value)
      }
    } catch (e) {
      reason = e
    } finally {
      this.abort.signal.removeEventListener('abort', onAbort)
      try { reader.releaseLock() } catch { /* already released */ }
      this.markClosed(reason)
    }
  }

  private handleNotification(n: Notification) {
    const lock = n.core?.lockStateChanged
    if (lock !== undefined) {
      this.unlocked = lock === LOCK_STATE_UNLOCKED
      this.events.onLockChange?.(this.unlocked)
    }
    const unsaved = n.keymap?.unsavedChangesStatusChanged
    if (unsaved !== undefined) this.events.onUnsavedChange?.(unsaved)
  }

  private markClosed(reason?: unknown) {
    if (this.closed) return
    this.closed = true
    this.events.onDisconnect?.(reason)
  }

  async disconnect() {
    if (this.closed) return
    try {
      await this.conn.request_writable.close()
    } catch { /* stream may already be errored */ }
    this.abort.abort('User disconnected')
    this.markClosed('User disconnected')
  }

  /** One RPC with timeout and error mapping. */
  async rpc(req: Omit<Request, 'requestId'>, what: string, ms = 5000): Promise<RequestResponse> {
    if (this.closed) throw new StudioError('Not connected to a keyboard')
    try {
      return await timeout(call_rpc(this.conn, req), ms, what)
    } catch (e) {
      if (e instanceof MetaError) {
        if (e.condition === META_UNLOCK_REQUIRED) {
          if (this.unlocked) {
            this.unlocked = false
            this.events.onLockChange?.(false)
          }
          throw new LockedError()
        }
        if (e.condition === META_RPC_NOT_FOUND) throw new StudioError(`${what}: this firmware does not support that request`)
        throw new StudioError(`${what}: the keyboard reported an error (${e.condition})`)
      }
      if (e instanceof NoResponseError) throw new StudioError(`${what}: the keyboard sent no response`)
      if (e instanceof StudioError) {
        // a timed-out call keeps the client's request mutex; the connection is unusable
        this.disconnect()
        throw e
      }
      throw new StudioError(`${what}: ${typeof e === 'string' ? e : (e as Error)?.message ?? String(e)}`)
    }
  }

  async refreshLockState(): Promise<boolean> {
    const r = await this.rpc({ core: { getLockState: true } }, 'Lock state')
    this.unlocked = r.core?.getLockState === LOCK_STATE_UNLOCKED
    this.events.onLockChange?.(this.unlocked)
    return this.unlocked
  }

  /** Lock the device again (it also re-locks on its own after idle / disconnect). */
  async lock(): Promise<void> {
    await this.rpc({ core: { lock: true } }, 'Lock')
    this.unlocked = false
    this.events.onLockChange?.(false)
  }

  async getKeymap(): Promise<DeviceKeymap> {
    const r = await this.rpc({ keymap: { getKeymap: true } }, 'Read keymap', 10000)
    const k = r.keymap?.getKeymap
    if (!k) throw new StudioError('Read keymap: empty response')
    return normalizeKeymap(k)
  }

  async getPhysicalLayouts(): Promise<DevicePhysicalLayouts> {
    const r = await this.rpc({ keymap: { getPhysicalLayouts: true } }, 'Read physical layouts', 10000)
    const p = r.keymap?.getPhysicalLayouts
    if (!p) throw new StudioError('Read physical layouts: empty response')
    return {
      activeLayoutIndex: p.activeLayoutIndex ?? 0,
      layouts: (p.layouts ?? []).map((l) => ({
        name: l.name ?? '',
        keys: (l.keys ?? []).map((k) => ({ width: k.width ?? 0, height: k.height ?? 0, x: k.x ?? 0, y: k.y ?? 0, r: k.r ?? 0, rx: k.rx ?? 0, ry: k.ry ?? 0 })),
      })),
    }
  }

  /** All behaviors with their display names and parameter metadata (one RPC each). */
  async getBehaviors(onProgress?: (done: number, total: number) => void): Promise<DeviceBehavior[]> {
    const r = await this.rpc({ behaviors: { listAllBehaviors: true } }, 'List behaviors')
    const ids = r.behaviors?.listAllBehaviors?.behaviors ?? []
    const out: DeviceBehavior[] = []
    for (const [i, behaviorId] of ids.entries()) {
      const d = await this.rpc({ behaviors: { getBehaviorDetails: { behaviorId } } }, 'Behavior details')
      const det = d.behaviors?.getBehaviorDetails
      if (det) {
        out.push({
          id: det.id ?? behaviorId,
          displayName: det.displayName ?? '',
          metadata: (det.metadata ?? []).map((s) => ({ param1: s.param1 ?? [], param2: s.param2 ?? [] })),
        })
      }
      onProgress?.(i + 1, ids.length)
    }
    return out
  }

  async setLayerBinding(layerId: number, keyPosition: number, binding: DeviceBinding): Promise<void> {
    const r = await this.rpc({ keymap: { setLayerBinding: { layerId, keyPosition, binding } } }, 'Set binding')
    const code = r.keymap?.setLayerBinding
    if (code === undefined) throw new StudioError('Set binding: unexpected response')
    if (code !== 0) throw new StudioError(`Set binding (layer ${layerId}, key ${keyPosition}): ${SET_BINDING_ERRORS[code] ?? `error ${code}`}`)
  }

  /** Append a layer; returns its index and the new layer (with its id). */
  async addLayer(): Promise<{ index: number; layer: DeviceLayer }> {
    const r = await this.rpc({ keymap: { addLayer: {} } }, 'Add layer')
    const a = r.keymap?.addLayer
    if (!a?.ok?.layer) {
      throw new StudioError(a?.err === 2 ? 'Add layer: the keyboard has no free layer slots' : 'Add layer: the keyboard refused')
    }
    return { index: a.ok.index ?? 0, layer: normalizeLayer(a.ok.layer) }
  }

  async removeLayer(layerIndex: number): Promise<void> {
    const r = await this.rpc({ keymap: { removeLayer: { layerIndex } } }, 'Remove layer')
    const rm = r.keymap?.removeLayer
    if (!rm || rm.err !== undefined) throw new StudioError(`Remove layer ${layerIndex}: the keyboard refused`)
  }

  async setLayerName(layerId: number, name: string): Promise<void> {
    const r = await this.rpc({ keymap: { setLayerProps: { layerId, name } } }, 'Rename layer')
    const code = r.keymap?.setLayerProps
    if (code !== undefined && code !== 0) throw new StudioError(`Rename layer ${layerId}: the keyboard refused (${code})`)
  }

  async checkUnsavedChanges(): Promise<boolean> {
    const r = await this.rpc({ keymap: { checkUnsavedChanges: true } }, 'Check unsaved changes')
    return !!r.keymap?.checkUnsavedChanges
  }

  /** Persist pending changes to the keyboard's flash. */
  async save(): Promise<void> {
    const r = await this.rpc({ keymap: { saveChanges: true } }, 'Save', 15000)
    const s = r.keymap?.saveChanges
    if (!s) throw new StudioError('Save: unexpected response')
    if (s.err !== undefined) throw new StudioError(`Save failed: ${SAVE_ERRORS[s.err] ?? `error ${s.err}`}`)
  }

  /** Drop pending (unsaved) changes; the keyboard reverts to its saved keymap. */
  async discard(): Promise<void> {
    const r = await this.rpc({ keymap: { discardChanges: true } }, 'Discard')
    if (!r.keymap?.discardChanges) throw new StudioError('Discard: the keyboard refused')
  }
}

function hex(b: Uint8Array | undefined): string {
  return b ? Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') : ''
}

function normalizeLayer(l: { id?: number; name?: string; bindings?: Partial<DeviceBinding>[] }): DeviceLayer {
  return {
    id: l.id ?? 0,
    name: l.name ?? '',
    bindings: (l.bindings ?? []).map((b) => ({ behaviorId: b.behaviorId ?? 0, param1: (b.param1 ?? 0) >>> 0, param2: (b.param2 ?? 0) >>> 0 })),
  }
}

function normalizeKeymap(k: { layers?: DeviceLayer[]; availableLayers?: number; maxLayerNameLength?: number }): DeviceKeymap {
  return {
    layers: (k.layers ?? []).map(normalizeLayer),
    availableLayers: k.availableLayers ?? 0,
    maxLayerNameLength: k.maxLayerNameLength ?? 0,
  }
}

function describeConnectError(e: unknown, kind: TransportKind): string {
  const name = (e as { name?: string })?.name
  const msg = (e as Error)?.message ?? String(e)
  if (name === 'NotFoundError' || (e as Error)?.constructor?.name === 'UserCancelledError') {
    return kind === 'usb'
      ? 'No serial port was selected. If your keyboard is not in the list, its firmware was probably built without ZMK Studio support (or it is connected over Bluetooth only).'
      : 'No Bluetooth device was selected. Only keyboards advertising the ZMK Studio service appear; the keyboard must be paired with this computer first.'
  }
  if (name === 'SecurityError') return 'The browser blocked access to the device. ZMK Studio needs a secure (https or localhost) page.'
  if (name === 'NetworkError' || /Failed to open the serial port/.test(msg)) {
    return 'Could not open the serial port. Close other apps using it (another ZMK Studio tab, a serial monitor) and try again. On Linux you may need permission to access the device (dialout group / udev rule).'
  }
  return `Could not connect: ${msg}`
}
