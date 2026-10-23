// Catalog of built-in ZMK behaviors other than &kp, for the key picker and the
// keymap compiler. Source of truth: zmkfirmware/zmk @ v0.3,
// app/dts/behaviors/*.dtsi (labels, #binding-cells) and the dt-bindings
// headers (parameter defines).
//
// Behaviors that Action models directly (&kp, &sk, &mo, &tog, &to, &sl, &lt,
// &mt, &none, &trans, macros) are not listed here.
//
// Parameters: `params` describes the binding cells as the user writes them,
// so `&bt BT_SEL 0` has params ['BT_SEL', '0'] and `&bt BT_CLR` has ['BT_CLR']
// (bt.h expands BT_CLR to "BT_CLR_CMD 0"). A param with `when` only applies
// if the first param is one of those values. Use formatBinding() to emit.

export interface ParamOption {
  value: string
  label: string
}

export interface BehaviorParam {
  name: string
  kind: 'enum' | 'number' | 'keycode' | 'layer'
  options?: ParamOption[]
  min?: number
  max?: number
  /** only used when params[0] is one of these values */
  when?: string[]
}

export interface BehaviorDef {
  /** devicetree label; used as Action.behavior and emitted as &<id> */
  id: string
  name: string
  description: string
  category: 'bluetooth' | 'output' | 'lighting' | 'power' | 'mouse' | 'system' | 'misc'
  params: BehaviorParam[]
  /** header needed for the parameter defines, e.g. 'dt-bindings/zmk/bt.h' */
  include?: string
  /** Kconfig lines the behavior needs in the .conf */
  kconfig?: string[]
  /** extra caveat for the UI */
  note?: string
}

const BT_PROFILE: BehaviorParam = { name: 'profile', kind: 'number', min: 0, max: 4, when: ['BT_SEL', 'BT_DISC'] }

export const BEHAVIORS: BehaviorDef[] = [
  {
    id: 'bt',
    name: 'Bluetooth',
    description: 'Select, clear or cycle Bluetooth profiles.',
    category: 'bluetooth',
    include: 'dt-bindings/zmk/bt.h',
    params: [
      {
        name: 'command',
        kind: 'enum',
        options: [
          { value: 'BT_SEL', label: 'Select profile' },
          { value: 'BT_CLR', label: 'Clear current profile' },
          { value: 'BT_CLR_ALL', label: 'Clear all profiles' },
          { value: 'BT_NXT', label: 'Next profile' },
          { value: 'BT_PRV', label: 'Previous profile' },
          { value: 'BT_DISC', label: 'Disconnect profile' },
        ],
      },
      BT_PROFILE,
    ],
    note: 'Profile numbers are 0-indexed. The number of profiles is CONFIG_BT_MAX_CONN (default 5).',
  },
  {
    id: 'out',
    name: 'Output selection',
    description: 'Choose whether keystrokes go over USB or Bluetooth.',
    category: 'output',
    include: 'dt-bindings/zmk/outputs.h',
    params: [
      {
        name: 'output',
        kind: 'enum',
        options: [
          { value: 'OUT_USB', label: 'USB' },
          { value: 'OUT_BLE', label: 'Bluetooth' },
          { value: 'OUT_TOG', label: 'Toggle USB / Bluetooth' },
        ],
      },
    ],
  },
  {
    id: 'rgb_ug',
    name: 'RGB underglow',
    description: 'Control addressable RGB underglow LEDs.',
    category: 'lighting',
    include: 'dt-bindings/zmk/rgb.h',
    kconfig: ['CONFIG_ZMK_RGB_UNDERGLOW=y'],
    params: [
      {
        name: 'command',
        kind: 'enum',
        options: [
          { value: 'RGB_TOG', label: 'Toggle on/off' },
          { value: 'RGB_ON', label: 'On' },
          { value: 'RGB_OFF', label: 'Off' },
          { value: 'RGB_HUI', label: 'Hue up' },
          { value: 'RGB_HUD', label: 'Hue down' },
          { value: 'RGB_SAI', label: 'Saturation up' },
          { value: 'RGB_SAD', label: 'Saturation down' },
          { value: 'RGB_BRI', label: 'Brightness up' },
          { value: 'RGB_BRD', label: 'Brightness down' },
          { value: 'RGB_SPI', label: 'Effect speed up' },
          { value: 'RGB_SPD', label: 'Effect speed down' },
          { value: 'RGB_EFF', label: 'Next effect' },
          { value: 'RGB_EFR', label: 'Previous effect' },
          { value: 'RGB_COLOR_HSB', label: 'Set color (HSB)' },
        ],
      },
      { name: 'hue', kind: 'number', min: 0, max: 360, when: ['RGB_COLOR_HSB'] },
      { name: 'saturation', kind: 'number', min: 0, max: 100, when: ['RGB_COLOR_HSB'] },
      { name: 'brightness', kind: 'number', min: 0, max: 100, when: ['RGB_COLOR_HSB'] },
    ],
    note: 'RGB_COLOR_HSB is emitted as one macro token: RGB_COLOR_HSB(h,s,b).',
  },
  {
    id: 'bl',
    name: 'Backlight',
    description: 'Control single-color LED backlight.',
    category: 'lighting',
    include: 'dt-bindings/zmk/backlight.h',
    kconfig: ['CONFIG_ZMK_BACKLIGHT=y'],
    params: [
      {
        name: 'command',
        kind: 'enum',
        options: [
          { value: 'BL_TOG', label: 'Toggle on/off' },
          { value: 'BL_ON', label: 'On' },
          { value: 'BL_OFF', label: 'Off' },
          { value: 'BL_INC', label: 'Brightness up' },
          { value: 'BL_DEC', label: 'Brightness down' },
          { value: 'BL_CYCLE', label: 'Cycle brightness' },
          { value: 'BL_SET', label: 'Set brightness' },
        ],
      },
      { name: 'brightness', kind: 'number', min: 0, max: 100, when: ['BL_SET'] },
    ],
  },
  {
    id: 'ext_power',
    name: 'External power',
    description: 'Switch the controller’s external power output (VCC to LEDs, displays) on or off.',
    category: 'power',
    include: 'dt-bindings/zmk/ext_power.h',
    kconfig: ['CONFIG_ZMK_EXT_POWER=y'],
    params: [
      {
        name: 'command',
        kind: 'enum',
        options: [
          { value: 'EP_TOG', label: 'Toggle' },
          { value: 'EP_ON', label: 'On' },
          { value: 'EP_OFF', label: 'Off' },
        ],
      },
    ],
    note: 'Needs an ext-power node on the board (nice!nano has one); CONFIG_ZMK_EXT_POWER defaults to y there.',
  },
  {
    id: 'soft_off',
    name: 'Soft off',
    description: 'Turn the keyboard fully off until it is woken by a dedicated wakeup key or reset.',
    category: 'power',
    kconfig: ['CONFIG_ZMK_PM_SOFT_OFF=y'],
    params: [],
    note: 'By default it only triggers after being held (hold-time-ms). Needs a board that supports power-off.',
  },
  {
    id: 'mkp',
    name: 'Mouse button',
    description: 'Press a mouse button.',
    category: 'mouse',
    include: 'dt-bindings/zmk/pointing.h',
    kconfig: ['CONFIG_ZMK_POINTING=y'],
    params: [
      {
        name: 'button',
        kind: 'enum',
        options: [
          { value: 'LCLK', label: 'Left click' },
          { value: 'RCLK', label: 'Right click' },
          { value: 'MCLK', label: 'Middle click' },
          { value: 'MB4', label: 'Button 4 (back)' },
          { value: 'MB5', label: 'Button 5 (forward)' },
        ],
      },
    ],
  },
  {
    id: 'mmv',
    name: 'Mouse move',
    description: 'Move the mouse pointer while held (accelerates to max speed).',
    category: 'mouse',
    include: 'dt-bindings/zmk/pointing.h',
    kconfig: ['CONFIG_ZMK_POINTING=y'],
    params: [
      {
        name: 'direction',
        kind: 'enum',
        options: [
          { value: 'MOVE_UP', label: 'Up' },
          { value: 'MOVE_DOWN', label: 'Down' },
          { value: 'MOVE_LEFT', label: 'Left' },
          { value: 'MOVE_RIGHT', label: 'Right' },
        ],
      },
    ],
    note: 'Custom speeds: MOVE_X(n), MOVE_Y(n) or MOVE(x,y); default max speed ZMK_POINTING_DEFAULT_MOVE_VAL = 600.',
  },
  {
    id: 'msc',
    name: 'Mouse scroll',
    description: 'Scroll the mouse wheel while held.',
    category: 'mouse',
    include: 'dt-bindings/zmk/pointing.h',
    kconfig: ['CONFIG_ZMK_POINTING=y'],
    params: [
      {
        name: 'direction',
        kind: 'enum',
        options: [
          { value: 'SCRL_UP', label: 'Up' },
          { value: 'SCRL_DOWN', label: 'Down' },
          { value: 'SCRL_LEFT', label: 'Left' },
          { value: 'SCRL_RIGHT', label: 'Right' },
        ],
      },
    ],
    note: 'Default scroll speed ZMK_POINTING_DEFAULT_SCRL_VAL = 10.',
  },
  {
    id: 'sys_reset',
    name: 'Reset',
    description: 'Restart the keyboard firmware.',
    category: 'system',
    params: [],
    note: 'On split keyboards it only resets the half it is pressed on.',
  },
  {
    id: 'bootloader',
    name: 'Bootloader',
    description: 'Reboot into the bootloader to flash new firmware.',
    category: 'system',
    params: [],
    note: 'On split keyboards it only affects the half it is pressed on.',
  },
  {
    id: 'studio_unlock',
    name: 'Studio unlock',
    description: 'Unlock the keyboard so ZMK Studio can change the keymap.',
    category: 'system',
    kconfig: ['CONFIG_ZMK_STUDIO=y'],
    params: [],
  },
  {
    id: 'caps_word',
    name: 'Caps Word',
    description: 'Shift letters until a non-word key is pressed (SHOUTING_SNAKE_CASE friendly).',
    category: 'misc',
    params: [],
  },
  {
    id: 'key_repeat',
    name: 'Key repeat',
    description: 'Send the most recently pressed key again.',
    category: 'misc',
    params: [],
  },
  {
    id: 'gresc',
    name: 'Grave / Escape',
    description: 'Escape; with Shift or GUI held it sends ` / ~ instead.',
    category: 'misc',
    params: [],
  },
  {
    id: 'kt',
    name: 'Key toggle',
    description: 'Toggle a key between pressed and released (e.g. hold Shift until tapped again).',
    category: 'misc',
    params: [{ name: 'key', kind: 'keycode' }],
  },
]

const BY_ID = new Map(BEHAVIORS.map((b) => [b.id, b]))

export function getBehavior(id: string): BehaviorDef | undefined {
  return BY_ID.get(id.replace(/^&/, ''))
}

/** The params that apply for a given first param (drops ones whose `when` doesn't match). */
export function activeParams(def: BehaviorDef, first?: string): BehaviorParam[] {
  return def.params.filter((p, i) => i === 0 || !p.when || (first !== undefined && p.when.includes(first)))
}

/** Binding text for a behavior action, e.g. ('bt', ['BT_SEL','0']) -> "&bt BT_SEL 0". */
export function formatBinding(behavior: string, params: string[]): string {
  const id = behavior.replace(/^&/, '')
  if (id === 'rgb_ug' && params[0] === 'RGB_COLOR_HSB') {
    const [, h = '0', s = '100', b = '100'] = params
    return `&rgb_ug RGB_COLOR_HSB(${h},${s},${b})`
  }
  return ['&' + id, ...params].join(' ')
}

export interface BehaviorPreset {
  behavior: string
  params: string[]
  /** short keycap legend */
  label: string
  /** human-readable description */
  name: string
  category: BehaviorDef['category']
}

function p(behavior: string, params: string[], label: string, name: string): BehaviorPreset {
  return { behavior, params, label, name, category: BY_ID.get(behavior)!.category }
}

export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  ...[0, 1, 2, 3, 4].map((i) => p('bt', ['BT_SEL', String(i)], `BT ${i + 1}`, `Select Bluetooth profile ${i + 1} (index ${i})`)),
  p('bt', ['BT_NXT'], 'BT {right}', 'Next Bluetooth profile'),
  p('bt', ['BT_PRV'], 'BT {left}', 'Previous Bluetooth profile'),
  p('bt', ['BT_CLR'], 'BT Clr', 'Clear current Bluetooth profile (unpair)'),
  p('bt', ['BT_CLR_ALL'], 'BT Clr All', 'Clear all Bluetooth profiles'),
  ...[0, 1, 2, 3, 4].map((i) =>
    p('bt', ['BT_DISC', String(i)], `BT {x}${i + 1}`, `Disconnect Bluetooth profile ${i + 1} (index ${i})`),
  ),
  p('out', ['OUT_USB'], 'USB', 'Send output over USB'),
  p('out', ['OUT_BLE'], 'BLE', 'Send output over Bluetooth'),
  p('out', ['OUT_TOG'], 'USB/BLE', 'Toggle output between USB and Bluetooth'),
  p('rgb_ug', ['RGB_TOG'], 'RGB {power}', 'Toggle RGB underglow'),
  p('rgb_ug', ['RGB_ON'], 'RGB On', 'Turn RGB underglow on'),
  p('rgb_ug', ['RGB_OFF'], 'RGB Off', 'Turn RGB underglow off'),
  p('rgb_ug', ['RGB_HUI'], 'Hue+', 'RGB hue up'),
  p('rgb_ug', ['RGB_HUD'], 'Hue-', 'RGB hue down'),
  p('rgb_ug', ['RGB_SAI'], 'Sat+', 'RGB saturation up'),
  p('rgb_ug', ['RGB_SAD'], 'Sat-', 'RGB saturation down'),
  p('rgb_ug', ['RGB_BRI'], 'RGB {sun}+', 'RGB brightness up'),
  p('rgb_ug', ['RGB_BRD'], 'RGB {sun}-', 'RGB brightness down'),
  p('rgb_ug', ['RGB_SPI'], 'Spd+', 'RGB effect speed up'),
  p('rgb_ug', ['RGB_SPD'], 'Spd-', 'RGB effect speed down'),
  p('rgb_ug', ['RGB_EFF'], 'Eff {right}', 'Next RGB effect'),
  p('rgb_ug', ['RGB_EFR'], 'Eff {left}', 'Previous RGB effect'),
  p('rgb_ug', ['RGB_COLOR_HSB', '0', '100', '100'], 'RGB Color', 'Set RGB color (hue, saturation, brightness)'),
  p('bl', ['BL_TOG'], 'BL {power}', 'Toggle backlight'),
  p('bl', ['BL_ON'], 'BL On', 'Turn backlight on'),
  p('bl', ['BL_OFF'], 'BL Off', 'Turn backlight off'),
  p('bl', ['BL_INC'], 'BL+', 'Backlight brightness up'),
  p('bl', ['BL_DEC'], 'BL-', 'Backlight brightness down'),
  p('bl', ['BL_CYCLE'], 'BL {cycle}', 'Cycle backlight brightness'),
  p('bl', ['BL_SET', '50'], 'BL 50%', 'Set backlight brightness'),
  p('ext_power', ['EP_TOG'], 'Pwr {power}', 'Toggle external power'),
  p('ext_power', ['EP_ON'], 'Pwr On', 'External power on'),
  p('ext_power', ['EP_OFF'], 'Pwr Off', 'External power off'),
  p('soft_off', [], 'Off', 'Soft off (power down the keyboard)'),
  p('mkp', ['LCLK'], 'LClk', 'Left mouse click'),
  p('mkp', ['RCLK'], 'RClk', 'Right mouse click'),
  p('mkp', ['MCLK'], 'MClk', 'Middle mouse click'),
  p('mkp', ['MB4'], 'MB4', 'Mouse button 4 (back)'),
  p('mkp', ['MB5'], 'MB5', 'Mouse button 5 (forward)'),
  p('mmv', ['MOVE_UP'], '{mouse}{up}', 'Move mouse up'),
  p('mmv', ['MOVE_DOWN'], '{mouse}{down}', 'Move mouse down'),
  p('mmv', ['MOVE_LEFT'], '{mouse}{left}', 'Move mouse left'),
  p('mmv', ['MOVE_RIGHT'], '{mouse}{right}', 'Move mouse right'),
  p('msc', ['SCRL_UP'], '{wheel}{up}', 'Scroll up'),
  p('msc', ['SCRL_DOWN'], '{wheel}{down}', 'Scroll down'),
  p('msc', ['SCRL_LEFT'], '{wheel}{left}', 'Scroll left'),
  p('msc', ['SCRL_RIGHT'], '{wheel}{right}', 'Scroll right'),
  p('sys_reset', [], 'Reset', 'Reset the keyboard'),
  p('bootloader', [], 'Boot', 'Enter bootloader (flash mode)'),
  p('studio_unlock', [], 'Studio', 'Unlock ZMK Studio'),
  p('caps_word', [], 'CapsWd', 'Caps Word'),
  p('key_repeat', [], 'Rep', 'Repeat last key'),
  p('gresc', [], 'Esc/`', 'Grave / Escape'),
]
