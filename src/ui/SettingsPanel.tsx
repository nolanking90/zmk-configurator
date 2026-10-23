import type { HoldTapFlavor, KeyboardDef, Layout, Settings } from '../model/types'
import { useStore } from '../store/store'
import { LOCALES } from '../data/locales'
import { CONTROLLERS } from '../data/keyboards'
import { defaultSettings } from '../model/defaults'

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings]
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

const FLAVORS: { id: HoldTapFlavor; name: string; help: string }[] = [
  { id: 'balanced', name: 'Balanced', help: 'Hold if another key is pressed and released while held. Good default for home-row mods.' },
  { id: 'hold-preferred', name: 'Hold preferred', help: 'Hold as soon as another key is pressed or the tapping term expires.' },
  { id: 'tap-preferred', name: 'Tap preferred', help: 'Hold only when the tapping term expires.' },
  { id: 'tap-unless-interrupted', name: 'Tap unless interrupted', help: 'Hold only if another key is pressed before the tapping term.' },
]

export function SettingsPanel({ layout, kb }: { layout: Layout; kb: KeyboardDef }) {
  const update = useStore((s) => s.update)
  const s = layout.settings
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update(layout.id, (d) => { d.settings[k] = v }, `set-${k}`)
  const def = defaultSettings()

  const num = (k: NumKey, label: string, help?: string, unit = 'ms') => (
    <label className="field" title={help}>
      {label}
      <div className="row">
        <input type="number" value={s[k]} min={0} style={{ width: 110 }} onChange={(e) => set(k, Number(e.target.value))} />
        <span className="small muted">{unit}</span>
        {s[k] !== def[k] && <button className="small ghost" onClick={() => set(k, def[k])} title={`Reset to ${def[k]}`}>↺</button>}
      </div>
      {help && <span className="help">{help}</span>}
    </label>
  )
  const bool = (k: BoolKey, label: string, help?: string) => (
    <label className="check" title={help}>
      <input type="checkbox" checked={s[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        {label}
        {help && <span className="help" style={{ display: 'block' }}>{help}</span>}
      </span>
    </label>
  )

  return (
    <div className="col" style={{ gap: 20, maxWidth: 980 }}>
      <section className="card col">
        <h2>Dual-function keys (hold-tap)</h2>
        <div className="settings-grid">
          {num('tappingTerm', 'Tapping term', 'How long a key must be held to count as a hold.')}
          {num('quickTap', 'Quick tap', 'Tapping then holding within this time repeats the tap instead of holding (0 disables).')}
          {num('requirePriorIdle', 'Require prior idle', 'If another key was pressed within this time, a hold-tap always taps. Great for fast typists with home-row mods (0 = off).')}
          <label className="field">
            Flavor
            <select value={s.holdTapFlavor} onChange={(e) => set('holdTapFlavor', e.target.value as HoldTapFlavor)}>
              {FLAVORS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <span className="help">{FLAVORS.find((f) => f.id === s.holdTapFlavor)?.help}</span>
          </label>
        </div>
        {bool('positionalHoldTap', 'Opposite-hand only (positional hold-tap)', kb.hands ? 'Modifier holds only trigger when the next key is on the other hand — reduces home-row-mod misfires.' : 'Not available: this keyboard has no hand information.')}
        {bool('holdWhileUndecided', 'Hold while undecided', 'Activate the hold (e.g. a modifier) immediately while waiting to decide; it is released if the key turns out to be a tap. Handy for mod+click.')}
        {bool('holdTriggerOnRelease', 'Decide on release', 'With opposite-hand only: wait until the other key is released before deciding (lets you combine same-hand mods).')}
      </section>

      <section className="card col">
        <h2>Tap dance, combos & one-shot</h2>
        <div className="settings-grid">
          {num('tapDanceTerm', 'Tap dance term', 'Time window for a double tap.')}
          {num('comboTimeout', 'Combo timeout', 'All combo keys must be pressed within this time.')}
          {num('stickyKeyTimeout', 'One-shot timeout', 'How long a one-shot key/layer stays active.')}
        </div>
        {bool('stickyQuickRelease', 'One-shot quick release', 'Release one-shot modifiers as soon as the next key is pressed (instead of released).')}
      </section>

      <section className="card col">
        <h2>Language</h2>
        <label className="field" style={{ maxWidth: 320 }}>
          Keyboard language set in your operating system
          <select value={s.locale} onChange={(e) => set('locale', e.target.value)}>
            {LOCALES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <span className="help">Changes the legends shown on keys and how text macros are typed. ZMK always sends US key positions; your OS translates them.</span>
        </label>
      </section>

      <section className="card col">
        <h2>Firmware</h2>
        <div className="settings-grid">
          <label className="field">
            ZMK version (git revision)
            <input value={s.zmkRevision} onChange={(e) => set('zmkRevision', e.target.value)} list="zmk-revs" />
            <datalist id="zmk-revs"><option value="v0.3" /><option value="main" /></datalist>
            <span className="help">Used in west.yml and the build workflow.</span>
          </label>
          {kb.kind === 'shield' && (
            <label className="field">
              Controller
              <select value={layout.controller ?? kb.defaultController ?? 'nice_nano_v2'} onChange={(e) => update(layout.id, (d) => { d.controller = e.target.value })}>
                {CONTROLLERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="help">The microcontroller board in your keyboard.</span>
            </label>
          )}
          {num('debounceMs', 'Debounce', 'Key switch debounce time.')}
        </div>
        <div className="settings-grid">
          {bool('studio', 'ZMK Studio support', 'Enables live keymap editing with ZMK Studio over USB.')}
          {bool('nkro', 'N-key rollover', 'Report any number of simultaneous keys. Some BIOS/KVMs dislike NKRO.')}
          {bool('pointing', 'Mouse keys', 'Enables mouse movement, scrolling and clicks.')}
          {bool('usbLogging', 'USB logging', 'Debug output over USB serial. Uses more power.')}
        </div>
        {(
          <div className="settings-grid">
            {num('mouseMoveSpeed', 'Mouse speed', 'Maximum pointer speed of mouse-move keys.', '')}
            {num('mouseTimeToMax', 'Mouse time to max', 'Time for the pointer to accelerate to full speed.')}
            {num('mouseAccelExponent', 'Mouse acceleration', 'Acceleration curve exponent (0 = constant speed, 1 = linear, 2 = quadratic).', '')}
            {num('mouseScrollSpeed', 'Scroll speed', 'Maximum speed of scroll keys.', '')}
            {num('mouseScrollTimeToMax', 'Scroll time to max', 'Time for scrolling to reach full speed.')}
            {num('mouseScrollAccelExponent', 'Scroll acceleration', 'Scroll acceleration exponent (0 = constant).', '')}
          </div>
        )}
      </section>

      <section className="card col">
        <h2>Power & wireless</h2>
        <div className="settings-grid">
          {bool('sleepEnabled', 'Deep sleep', 'Turn the keyboard off after inactivity (a key press wakes it).')}
          {num('sleepTimeoutMin', 'Sleep after', undefined, 'min')}
          {num('idleTimeoutSec', 'Idle after', 'Idle state turns off lighting/displays.', 's')}
          {num('btMaxConnections', 'Bluetooth profiles', 'Number of host devices you can pair.', '')}
        </div>
        <div className="settings-grid">
          {bool('bleTxPowerPlus8', 'Boost Bluetooth power (+8 dBm)', 'Better range, slightly shorter battery life.')}
          {kb.split && bool('splitBatteryFetching', 'Report both halves’ battery', 'Shows the peripheral half’s battery on the host.')}
        </div>
      </section>

      <section className="card col">
        <h2>Lighting & display</h2>
        <div className="settings-grid">
          {bool('rgbUnderglow', 'RGB underglow')}
          {bool('rgbAutoOffIdle', 'Underglow off when idle')}
          {bool('backlight', 'Backlight')}
          {bool('display', 'Display (OLED / nice!view)')}
        </div>
        <span className="help">Only enable hardware your keyboard actually has; some shields need extra devicetree setup.</span>
      </section>

      <section className="card col">
        <h2>Advanced</h2>
        <label className="field">
          Extra Kconfig (.conf lines)
          <textarea className="mono" rows={4} value={s.extraConf} placeholder="CONFIG_ZMK_..." onChange={(e) => set('extraConf', e.target.value)} />
        </label>
        <label className="field">
          Extra devicetree (inserted into the keymap's root node — define custom behaviors here and use them with a Custom → Raw binding)
          <textarea className="mono" rows={6} value={s.extraKeymap} placeholder={'behaviors {\n  ...\n};'} onChange={(e) => set('extraKeymap', e.target.value)} />
        </label>
      </section>
    </div>
  )
}
