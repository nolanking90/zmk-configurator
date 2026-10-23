// A layout exercising every compiler feature, for tests and the firmware build check.
import type { Action, KeyConfig, Layout, Mod } from '../../model/types'
import { defaultSettings } from '../../model/defaults'

const k = (code: string, mods?: Mod[]): Action =>
  mods ? { type: 'key', code, mods } : { type: 'key', code }
const tap = (a: Action): KeyConfig => ({ tap: a })
const trans: KeyConfig = { tap: { type: 'trans' } }

/** 42-key (corne-sized) layout; pass a key count to pad / truncate. */
export function kitchenSinkLayout(keyboard = 'corne', keyCount = 42, opts: { rgb?: boolean; encoders?: boolean } = {}): Layout {
  const base: KeyConfig[] = [
    // row 0
    { tap: k('TAB') }, { tap: k('Q'), hold: k('LALT'), tappingTerm: 250 }, { tap: k('W'), shifted: k('N2') }, tap(k('E')), { tap: k('R'), hold: k('LALT'), retroTap: true }, { tap: k('T'), shifted: k('N5'), hold: k('LCTRL') },
    tap(k('Y')), tap(k('U')), tap(k('I')), tap(k('O')), tap(k('P')), { tap: { type: 'macro', id: 'm-email' } },
    // row 1 — home row mods (positional)
    { tap: k('ESC'), hold: k('LCTRL') },
    { tap: k('A'), hold: k('LGUI') }, { tap: k('S'), hold: k('LALT') }, { tap: k('D'), hold: k('LSHIFT') },
    { tap: k('F'), hold: k('LCTRL') }, tap(k('G')),
    tap(k('H')), { tap: k('J'), hold: k('RCTRL') }, { tap: k('K'), hold: k('RSHIFT') },
    { tap: k('L'), hold: k('LALT') }, { tap: k('SEMI'), hold: k('RGUI') }, { tap: k('SQT'), hold: k('LSHIFT', ['LCTRL']) },
    // row 2
    { tap: { type: 'sticky', code: 'LSHIFT' } }, tap(k('Z')), tap(k('X')), tap(k('C')), tap(k('V')), tap(k('B')),
    tap(k('N')), tap(k('M')), tap(k('COMMA')), tap(k('DOT')), tap(k('FSLH')),
    { tap: k('RET'), hold: { type: 'macro', id: 'm-hold' } },
    // thumbs
    { tap: k('LGUI') },
    { tap: k('ESC'), hold: { type: 'layer', mode: 'mo', layer: 'l-nav' } },
    { tap: k('SPACE'), hold: { type: 'layer', mode: 'tog', layer: 'l-nav' } },
    { tap: k('BSPC'), shifted: k('DEL'), hold: k('LCTRL'), doubleTap: k('DEL'), tapHold: { type: 'layer', mode: 'mo', layer: 'l-sys' } },
    { tap: k('RET'), hold: { type: 'behavior', behavior: 'caps_word', params: [] } },
    { tap: k('TAB'), hold: { type: 'behavior', behavior: 'bt', params: ['BT_CLR'] } },
  ]
  const nav: KeyConfig[] = Array.from({ length: 42 }, () => trans)
  nav[0] = tap({ type: 'behavior', behavior: 'bt', params: ['BT_SEL', '0'] })
  nav[1] = tap({ type: 'behavior', behavior: 'bt', params: ['BT_SEL', '1'] })
  nav[2] = tap({ type: 'behavior', behavior: 'bt', params: ['BT_CLR'] })
  nav[3] = tap({ type: 'behavior', behavior: 'out', params: ['OUT_TOG'] })
  nav[4] = tap({ type: 'behavior', behavior: 'mkp', params: ['LCLK'] })
  nav[5] = tap({ type: 'behavior', behavior: 'mkp', params: ['RCLK'] })
  nav[6] = tap({ type: 'behavior', behavior: 'mmv', params: ['MOVE_LEFT'] })
  nav[7] = tap({ type: 'behavior', behavior: 'mmv', params: ['MOVE_DOWN'] })
  nav[8] = tap({ type: 'behavior', behavior: 'mmv', params: ['MOVE_UP'] })
  nav[9] = tap({ type: 'behavior', behavior: 'mmv', params: ['MOVE_RIGHT'] })
  nav[10] = tap({ type: 'behavior', behavior: 'msc', params: ['SCRL_UP'] })
  nav[11] = tap({ type: 'behavior', behavior: 'msc', params: ['SCRL_DOWN'] })
  nav[12] = tap({ type: 'raw', code: '&kp LC(LS(Z))' })
  nav[13] = tap(k('T', ['LCTRL', 'LSHIFT']))
  nav[14] = tap({ type: 'behavior', behavior: 'key_repeat', params: [] })
  nav[15] = tap({ type: 'behavior', behavior: 'gresc', params: [] })
  nav[16] = tap({ type: 'raw', code: '&bs_del' })
  nav[18] = tap(k('LEFT'))
  nav[19] = tap(k('DOWN'))
  nav[20] = tap(k('UP'))
  nav[21] = tap(k('RIGHT'))
  nav[24] = tap({ type: 'layer', mode: 'to', layer: 'l-base' })
  nav[25] = tap({ type: 'layer', mode: 'sl', layer: 'l-sys' })
  nav[26] = { tap: k('C', ['LCTRL']), hold: { type: 'behavior', behavior: 'mkp', params: ['MCLK'] } }
  nav[27] = { tap: { type: 'sticky', code: 'LCTRL' }, hold: k('LALT') }
  const sys: KeyConfig[] = Array.from({ length: 42 }, () => trans)
  sys[0] = tap({ type: 'behavior', behavior: 'bootloader', params: [] })
  sys[1] = tap({ type: 'behavior', behavior: 'sys_reset', params: [] })
  sys[2] = tap({ type: 'behavior', behavior: 'studio_unlock', params: [] })
  sys[3] = tap({ type: 'behavior', behavior: 'bt', params: ['BT_CLR_ALL'] })
  sys[4] = tap({ type: 'behavior', behavior: 'out', params: ['OUT_USB'] })
  sys[5] = tap({ type: 'behavior', behavior: 'out', params: ['OUT_BLE'] })
  sys[6] = tap({ type: 'none' })
  if (opts.rgb) {
    sys[7] = tap({ type: 'behavior', behavior: 'rgb_ug', params: ['RGB_TOG'] })
    sys[8] = tap({ type: 'behavior', behavior: 'rgb_ug', params: ['RGB_COLOR_HSB', '128', '100', '50'] })
    sys[9] = { tap: k('F1'), hold: { type: 'behavior', behavior: 'rgb_ug', params: ['RGB_EFF'] } }
  }

  const fit = (keys: KeyConfig[]) => (keys.length >= keyCount ? keys.slice(0, keyCount) : [...keys, ...Array.from({ length: keyCount - keys.length }, () => trans)])

  const settings = defaultSettings()
  Object.assign(settings, {
    positionalHoldTap: true,
    holdTriggerOnRelease: true,
    requirePriorIdle: 125,
    stickyKeyTimeout: 800,
    tapDanceTerm: 180,
    studio: true,
    pointing: true,
    mouseMoveSpeed: 1200,
    mouseAccelExponent: 2,
    mouseScrollSpeed: 20,
    mouseScrollTimeToMax: 100,
    nkro: true,
    btMaxConnections: 3,
    debounceMs: 8,
    idleTimeoutSec: 60,
    sleepTimeoutMin: 30,
    bleTxPowerPlus8: true,
    extraConf: 'CONFIG_ZMK_COMBO_MAX_PRESSED_COMBOS=6',
    rgbUnderglow: !!opts.rgb,
    extraKeymap: [
      'behaviors {',
      '    bs_del: bs_del {',
      '        compatible = "zmk,behavior-mod-morph";',
      '        #binding-cells = <0>;',
      '        bindings = <&kp BSPC>, <&kp DEL>;',
      '        mods = <(MOD_LCTL|MOD_RCTL)>;',
      '    };',
      '};',
    ].join('\n'),
  })

  return {
    id: 'kitchen-sink',
    name: 'Kitchen sink',
    description: 'Exercises every compiler feature',
    tags: [],
    keyboard,
    layers: [
      { id: 'l-base', name: 'Base', keys: fit(base), ...(opts.encoders ? { encoders: [{ cw: k('C_VOL_UP'), ccw: k('C_VOL_DN') }, { cw: k('PG_DN'), ccw: k('PG_UP') }] } : {}) },
      { id: 'l-nav', name: 'Nav & Mouse', keys: fit(nav), ...(opts.encoders ? { encoders: [{}, { cw: { type: 'behavior', behavior: 'bt', params: ['BT_NXT'] }, ccw: { type: 'behavior', behavior: 'bt', params: ['BT_PRV'] } }] } : {}) },
      { id: 'l-sys', name: 'Sys', keys: fit(sys), ...(opts.encoders ? { encoders: [{ cw: k('TAB', ['LCTRL']), ccw: k('TAB', ['LCTRL', 'LSHIFT']) }, { cw: k('RIGHT'), ccw: { type: 'macro', id: 'm-email' } }] } : {}) },
    ],
    combos: [
      { id: 'c1', name: 'esc', keys: [1, 2], action: k('ESC'), layers: [] },
      { id: 'c2', name: 'Caps word!', keys: [13, 14, 15], action: { type: 'behavior', behavior: 'caps_word', params: [] }, layers: ['l-base', 'l-nav'], timeout: 35, requirePriorIdle: 100, slowRelease: true },
      { id: 'c3', name: 'email', keys: [7, 8], action: { type: 'macro', id: 'm-email' }, layers: ['l-base'] },
    ],
    macros: [
      {
        id: 'm-email',
        name: 'Email',
        wait: 10,
        tap: 10,
        steps: [
          { type: 'text', text: 'Hello, me@example.com!' },
          { type: 'delay', ms: 100 },
          { type: 'press', action: k('LSHIFT') },
          { type: 'tap', action: k('A') },
          { type: 'release', action: k('LSHIFT') },
          { type: 'text', text: '\n' },
        ],
      },
      {
        id: 'm-hold',
        name: 'hold shift',
        steps: [
          { type: 'press', action: k('LSHIFT') },
          { type: 'pauseForRelease' },
          { type: 'release', action: k('LSHIFT') },
        ],
      },
    ],
    settings,
    createdAt: 0,
    updatedAt: 0,
  }
}
