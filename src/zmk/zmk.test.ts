import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { KeyboardDef, Layout } from '../model/types'
import { defaultSettings, newLayout } from '../model/defaults'
import { getKeyboard, KEYBOARDS } from '../data/keyboards'
import defaultKeymaps from '../data/defaultKeymaps.json'
import { compileKeymap, generateConfigRepo } from './compile'
import { importConf, importKeymap } from './importKeymap'
import { Preprocessor } from './cpp'
import { parseDts, propCells } from './dts'
import { kitchenSinkLayout } from './fixtures/kitchenSink'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const corne = getKeyboard('corne')!
const stripMeta = (s: string) => s.replace(/\/\* zmk-configurator:[^*]*\*\/\n?/, '')
/** keymap without the header comment and metadata, for equivalence checks */
const body = (s: string) => stripMeta(s).replace(/^\/\*[\s\S]*?\*\/\n/, '')

/** tiny 2x3 split keyboard for focused tests */
const mini: KeyboardDef = {
  id: 'mini', name: 'Mini', zmkName: 'mini', kind: 'shield', shields: ['mini_left', 'mini_right'], split: true,
  keys: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }],
  hands: ['L', 'L', 'L', 'R', 'R', 'R'],
}

function miniLayout(): Layout {
  const l = newLayout('mini', 6, 'Mini')
  l.layers.push({ id: 'nav', name: 'Nav', keys: Array.from({ length: 6 }, () => ({ tap: { type: 'trans' } })) })
  return l
}

describe('compileKeymap', () => {
  const ks = compileKeymap(kitchenSinkLayout(), corne)
  const km = ks.keymap

  it('emits includes needed by used behaviors', () => {
    expect(km).toContain('#include <behaviors.dtsi>')
    expect(km).toContain('#include <dt-bindings/zmk/keys.h>')
    expect(km).toContain('#include <dt-bindings/zmk/bt.h>')
    expect(km).toContain('#include <dt-bindings/zmk/outputs.h>')
    expect(km).toContain('#include <dt-bindings/zmk/pointing.h>')
  })

  it('defines layer indexes and uses them', () => {
    expect(km).toMatch(/#define BASE 0\n#define NAV_MOUSE 1\n#define SYS 2/)
    expect(km).toContain('&lt NAV_MOUSE ESC')
    expect(km).toContain('&to BASE')
    expect(km).toContain('&sl SYS')
    expect(km).toContain('display-name = "Nav & Mouse";')
  })

  it('positional hold-tap: left/right hold-taps triggered by the opposite hand', () => {
    expect(km).toContain('&mt_l LGUI A')
    expect(km).toContain('&mt_r RCTRL J')
    const right = corne.hands!.flatMap((h, i) => (h === 'R' ? [i] : [])).join(' ')
    expect(km).toMatch(new RegExp(`mt_l: mt_l \\{[^}]*hold-trigger-key-positions = <${right}>`))
    expect(km).toContain('hold-trigger-on-release;')
    expect(km).toContain('&mt_r LC(LSHIFT) SQT') // modifier-function hold
  })

  it('per-key tapping term gets its own hold-tap', () => {
    expect(km).toContain('&mt_l_250 LALT Q')
    expect(km).toMatch(/mt_l_250: mt_l_250 \{[^}]*tapping-term-ms = <250>/)
  })

  it('synthesizes hold-taps for non-kp holds', () => {
    expect(km).toContain('&ht_tog_kp NAV_MOUSE SPACE')
    expect(km).toContain('&ht_caps_word_kp 0 RET')
    expect(km).toContain('bindings = <&caps_word>, <&kp>;')
    expect(km).toContain('&ht_mkp_kp MCLK LC(C)')
    expect(km).toContain('&ht_kp_sk_l LALT LCTRL')
    // macro as hold
    expect(km).toContain('&ht_hold_shift_kp 0 RET')
    // 2-cell behavior is wrapped in a macro
    expect(km).toContain('&ht_w_bt_bt_clr_kp 0 TAB')
    expect(km).toContain('bindings = <&macro_press &bt BT_CLR>, <&macro_pause_for_release>, <&macro_release &bt BT_CLR>;')
    // global settings applied
    expect(km).toMatch(/ht_tog_kp: ht_tog_kp \{[^}]*flavor = "balanced";[^}]*quick-tap-ms = <150>;[^}]*require-prior-idle-ms = <125>;/)
  })

  it('tap dance with a hold-tap inside', () => {
    expect(km).toMatch(/td_\w+: td_\w+ \{[^}]*zmk,behavior-tap-dance[^}]*tapping-term-ms = <180>;[^}]*bindings = <&ht_kp_mm_kp_bspc_r LCTRL 0>, <&lt SYS DEL>;/)
  })

  it('stock overrides for &lt / &sk / &sl', () => {
    expect(km).toMatch(/&lt \{\n {4}flavor = "balanced";\n {4}tapping-term-ms = <200>;/)
    expect(km).toMatch(/&sk \{\n {4}release-after-ms = <800>;\n {4}quick-release;\n\};/)
    expect(km).toContain('&sl {\n    release-after-ms = <800>;\n};')
  })

  it('combos', () => {
    expect(km).toContain('compatible = "zmk,combos";')
    expect(km).toMatch(/combo_esc \{\n\s+timeout-ms = <50>;\n\s+key-positions = <1 2>;\n\s+bindings = <&kp ESC>;\n\s+\};/)
    expect(km).toMatch(/combo_caps_word \{[^}]*timeout-ms = <35>;[^}]*layers = <BASE NAV_MOUSE>;[^}]*require-prior-idle-ms = <100>;[^}]*slow-release;/)
    expect(km).toContain('bindings = <&email>;')
  })

  it('macros: text, delay, press/release', () => {
    expect(km).toContain('email: email {')
    expect(km).toContain('wait-ms = <10>;')
    expect(km).toContain('<&kp LS(H) &kp E &kp L &kp L &kp O &kp COMMA &kp SPACE &kp M &kp E &kp LS(N2)')
    expect(km).toContain(', <&macro_wait_time 100>\n                , <&macro_tap &none>\n                , <&macro_wait_time 10>')
    expect(km).toContain('<&macro_press &kp LSHIFT>')
    expect(km).toContain('<&macro_release &kp LSHIFT>')
    expect(km).toContain('<&macro_pause_for_release>')
  })

  it('behaviors, raw bindings, modifier functions', () => {
    expect(km).toContain('&bt BT_SEL 0')
    expect(km).toContain('&out OUT_TOG')
    expect(km).toContain('&mmv MOVE_LEFT')
    expect(km).toContain('&kp LC(LS(T))')
    expect(km).toContain('&kp LC(LS(Z))')
    expect(km).toContain('&bs_del')
    expect(km).toContain('bs_del: bs_del {') // extraKeymap inside root
  })

  it('pretty-prints rows aligned by physical position', () => {
    const layer = /base_layer \{[\s\S]*?bindings = <\n([\s\S]*?)\n\s*>;/.exec(km)![1].split('\n')
    expect(layer).toHaveLength(4)
    expect(layer[0].trim().startsWith('&kp TAB')).toBe(true)
    expect(layer[3].trim().startsWith('&kp LGUI')).toBe(true)
    // the "&kp Y" column starts at the same offset in rows 0 and 1 ("&kp H")
    expect(layer[0].indexOf('&kp Y')).toBe(layer[1].indexOf('&kp H'))
  })

  it('mouse key tuning: speed #defines before includes, &mmv/&msc overrides', () => {
    expect(km).toMatch(/#define ZMK_POINTING_DEFAULT_MOVE_VAL 1200\n#define ZMK_POINTING_DEFAULT_SCRL_VAL 20\n\n#include <behaviors.dtsi>/)
    expect(km).toContain('&mmv {\n    acceleration-exponent = <2>;\n};')
    expect(km).toContain('&msc {\n    time-to-max-speed-ms = <100>;\n};')
    const plain = compileKeymap(newLayout('corne', 42), corne).keymap
    expect(plain).not.toContain('ZMK_POINTING_DEFAULT')
    const { layout } = importKeymap(stripMeta(km), corne)
    expect(layout.settings).toMatchObject({ mouseMoveSpeed: 1200, mouseScrollSpeed: 20, mouseTimeToMax: 300, mouseAccelExponent: 2, mouseScrollTimeToMax: 100, mouseScrollAccelExponent: 0 })
  })

  it('embeds metadata', () => {
    expect(km).toMatch(/\/\* zmk-configurator:[A-Za-z0-9+/=]+ \*\/\n$/)
  })

  it('conf only contains non-defaults; split central gets BT/battery settings', () => {
    expect(ks.conf).toContain('CONFIG_ZMK_SLEEP=y')
    expect(ks.conf).toContain('CONFIG_ZMK_IDLE_SLEEP_TIMEOUT=1800000')
    expect(ks.conf).toContain('CONFIG_ZMK_IDLE_TIMEOUT=60000')
    expect(ks.conf).toContain('CONFIG_ZMK_POINTING=y')
    expect(ks.conf).toContain('CONFIG_ZMK_HID_REPORT_TYPE_NKRO=y')
    expect(ks.conf).toContain('CONFIG_BT_CTLR_TX_PWR_PLUS_8=y')
    expect(ks.conf).toContain('CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=8')
    expect(ks.conf).toContain('CONFIG_ZMK_COMBO_MAX_PRESSED_COMBOS=6')
    expect(ks.conf).not.toContain('CONFIG_ZMK_STUDIO')
    expect(ks.conf).not.toContain('BT_MAX_CONN')
    expect(ks.centralConf).toContain('CONFIG_BT_MAX_CONN=4')
    expect(ks.centralConf).toContain('CONFIG_BT_MAX_PAIRED=4')
    expect(ks.centralConf).toContain('CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING=y')
    expect(ks.warnings).toEqual([])

    const plain = compileKeymap(newLayout('corne', 42), corne)
    expect(plain.conf.split('\n').filter((l) => l.startsWith('CONFIG_'))).toEqual(['CONFIG_ZMK_SLEEP=y'])
  })

  it('unibody: BT profile count without the peripheral slot', () => {
    const kb = { ...mini, split: false, shields: ['mini'] }
    const l = miniLayout()
    l.settings.btMaxConnections = 3
    const r = compileKeymap(l, kb)
    expect(r.conf).toContain('CONFIG_BT_MAX_CONN=3')
    expect(r.centralConf).toBe('')
  })

  it('uses stock &mt/&lt with overrides when not positional; dedupes per-key terms', () => {
    const l = miniLayout()
    l.layers[0].keys[0] = { tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LSHIFT' } }
    l.layers[0].keys[1] = { tap: { type: 'key', code: 'B' }, hold: { type: 'layer', mode: 'mo', layer: 'nav' } }
    l.layers[0].keys[2] = { tap: { type: 'key', code: 'C' }, hold: { type: 'key', code: 'LALT' }, tappingTerm: 300 }
    l.layers[0].keys[3] = { tap: { type: 'key', code: 'D' }, hold: { type: 'key', code: 'LCTRL' }, tappingTerm: 300 }
    l.layers[0].keys[4] = { tap: { type: 'key', code: 'E' }, doubleTap: { type: 'key', code: 'F' } }
    l.layers[1].keys[4] = { tap: { type: 'key', code: 'E' }, doubleTap: { type: 'key', code: 'F' } }
    const km = compileKeymap(l, mini).keymap
    expect(km).toContain('&mt LSHIFT A')
    expect(km).toContain('&lt NAV B')
    expect(km).toContain('&mt_300 LALT C')
    expect(km).toContain('&mt_300 LCTRL D')
    expect(km.match(/mt_300: mt_300/g)).toHaveLength(1)
    expect(km.match(/zmk,behavior-tap-dance/g)).toHaveLength(1)
    expect(km).toContain('bindings = <&kp E>, <&kp F>;')
    expect(km).toMatch(/&mt \{\n {4}flavor = "balanced";\n {4}tapping-term-ms = <200>;\n {4}quick-tap-ms = <150>;\n\};/)
  })

  it('avoids #define names that clash with key codes', () => {
    const l = miniLayout()
    l.layers[1].name = 'Tab'
    l.layers[0].keys[0] = { tap: { type: 'layer', mode: 'mo', layer: 'nav' } }
    const km = compileKeymap(l, mini).keymap
    expect(km).toContain('#define TAB_LAYER 1')
    expect(km).toContain('&mo TAB_LAYER')
  })

  it('gates hardware behaviors that are disabled', () => {
    const l = miniLayout()
    l.layers[0].keys[0] = { tap: { type: 'behavior', behavior: 'rgb_ug', params: ['RGB_TOG'] } }
    const r = compileKeymap(l, mini)
    expect(r.keymap).not.toContain('&rgb_ug')
    expect(r.warnings.join()).toContain('rgb_ug')
    l.settings.rgbUnderglow = true
    const r2 = compileKeymap(l, mini)
    expect(r2.keymap).toContain('&rgb_ug RGB_TOG')
    expect(r2.conf).toContain('CONFIG_ZMK_RGB_UNDERGLOW=y')
    expect(r2.keymap).toContain('#include <dt-bindings/zmk/rgb.h>')
  })

  it('pads short layers and warns', () => {
    const l = miniLayout()
    l.layers[0].keys = l.layers[0].keys.slice(0, 4)
    const r = compileKeymap(l, mini)
    expect(r.warnings.some((w) => w.includes('padded'))).toBe(true)
    expect(r.keymap).toMatch(/&none\s+&none\s+&none\s+&none\s+&none\s+&none/)
  })

  it('appends kb.notes devicetree', () => {
    const kb = getKeyboard('corne_5col')!
    const r = compileKeymap(newLayout(kb.id, kb.keys.length), kb)
    expect(r.keymap).toContain('zmk,physical-layout = &foostan_corne_5col_layout;')
  })
})

describe('generateConfigRepo', () => {
  it('writes a complete zmk-config', () => {
    const files = generateConfigRepo(kitchenSinkLayout(), corne)
    expect(Object.keys(files).sort()).toEqual([
      '.github/workflows/build.yml', 'README.md', 'build.yaml', 'config/corne.conf', 'config/corne.keymap',
      'config/corne_left.conf', 'config/west.yml', 'config/zmk-configurator.json',
    ])
    expect(files['config/west.yml']).toContain('revision: v0.3')
    expect(files['config/west.yml']).toContain('import: app/west.yml')
    expect(files['.github/workflows/build.yml']).toContain('uses: zmkfirmware/zmk/.github/workflows/build-user-config.yml@v0.3')
    expect(files['build.yaml']).toContain([
      '  - board: nice_nano_v2',
      '    shield: corne_left',
      '    snippet: studio-rpc-usb-uart',
      '    cmake-args: -DCONFIG_ZMK_STUDIO=y',
      '  - board: nice_nano_v2',
      '    shield: corne_right',
    ].join('\n'))
    expect(JSON.parse(files['config/zmk-configurator.json']).name).toBe('Kitchen sink')
  })

  it('boards and custom controllers', () => {
    const g = getKeyboard('glove80')!
    const files = generateConfigRepo(newLayout('glove80', g.keys.length), g)
    expect(files['build.yaml']).toContain('  - board: glove80_lh\n  - board: glove80_rh\n')
    const l = newLayout('corne', 42)
    l.controller = 'nrfmicro_13'
    expect(generateConfigRepo(l, corne)['build.yaml']).toContain('board: nrfmicro_13')
  })
})

describe('importKeymap', () => {
  it('metadata round-trips losslessly', () => {
    const layout = kitchenSinkLayout()
    const { layout: back, warnings } = importKeymap(compileKeymap(layout, corne).keymap, corne)
    expect(warnings).toEqual([])
    expect(back).toEqual(layout)
  })

  it('round-trips through the devicetree (metadata stripped)', () => {
    const layout = kitchenSinkLayout()
    const first = compileKeymap(layout, corne).keymap
    const { layout: imported, warnings } = importKeymap(stripMeta(first), corne, { name: layout.name })
    expect(warnings).toEqual([])
    expect(imported.layers.map((l) => l.name)).toEqual(['Base', 'Nav & Mouse', 'Sys'])
    expect(imported.macros.find((m) => m.name === 'email')!.steps[0]).toEqual({ type: 'text', text: 'Hello, me@example.com!' })
    expect(imported.settings).toMatchObject({
      positionalHoldTap: true, holdTriggerOnRelease: true, requirePriorIdle: 125, quickTap: 150,
      holdTapFlavor: 'balanced', stickyKeyTimeout: 800, stickyQuickRelease: true, tapDanceTerm: 180,
    })
    const base = imported.layers[0].keys
    expect(base[1]).toEqual({ tap: { type: 'key', code: 'Q' }, hold: { type: 'key', code: 'LALT' }, tappingTerm: 250 })
    expect(base[39]).toMatchObject({
      tap: { type: 'key', code: 'BSPC' }, hold: { type: 'key', code: 'LCTRL' }, doubleTap: { type: 'key', code: 'DEL' },
      tapHold: { type: 'layer', mode: 'mo', layer: imported.layers[2].id },
    })
    expect(base[41]).toEqual({ tap: { type: 'key', code: 'TAB' }, hold: { type: 'behavior', behavior: 'bt', params: ['BT_CLR'] } })
    // Studio is a build.yaml setting, not part of the keymap
    imported.settings.studio = layout.settings.studio
    const second = compileKeymap(imported, corne).keymap
    expect(body(second)).toBe(body(first))
  })

  it('imports the stock corne keymap', () => {
    const { layout, warnings } = importKeymap(fixture('corne.keymap'), corne)
    expect(warnings).toEqual([])
    expect(layout.layers.map((l) => l.name)).toEqual(['default', 'lower', 'raise'])
    const [base, lower] = layout.layers
    expect(base.keys[0]).toEqual({ tap: { type: 'key', code: 'TAB' } })
    expect(base.keys[37]).toEqual({ tap: { type: 'layer', mode: 'mo', layer: lower.id } })
    expect(lower.keys[13]).toEqual({ tap: { type: 'behavior', behavior: 'bt', params: ['BT_SEL', '0'] } })
    expect(layout.layers[2].keys[1].tap).toEqual({ type: 'key', code: 'EXCL' })
    // recompiles to the same bindings
    const first = compileKeymap(layout, corne).keymap
    const again = importKeymap(stripMeta(first), corne, { name: layout.name }).layout
    expect(body(compileKeymap(again, corne).keymap)).toBe(body(first))
  })

  it('imports the stock glove80 keymap', () => {
    const g = getKeyboard('glove80')!
    const { layout, warnings } = importKeymap(fixture('glove80.keymap'), g)
    expect(layout.layers).toHaveLength(3)
    expect(layout.layers.every((l) => l.keys.length === 80)).toBe(true)
    const all = layout.layers.flatMap((l) => l.keys)
    expect(all.some((k) => k.tap?.type === 'behavior' && k.tap.behavior === 'rgb_ug')).toBe(true)
    expect(all.some((k) => k.tap?.type === 'layer')).toBe(true)
    expect(warnings.filter((w) => !w.includes('chosen'))).toEqual([])
  })

  it('imports an urob-style keymap built on zmk-helpers', () => {
    const kb = getKeyboard('cradio')!
    const { layout, warnings } = importKeymap(fixture('urob_base.keymap'), kb)
    expect(layout.layers.map((l) => l.name)).toEqual(['Base', 'Nav', 'Fn', 'Num', 'Sys', 'Mouse'])
    const base = layout.layers[0].keys
    expect(base[0]).toEqual({ tap: { type: 'key', code: 'Q' } })
    // homerow mod via ZMK_HOLD_TAP(hml, ...) with tapping-term 280
    expect(base[10]).toEqual({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LGUI' }, tappingTerm: 280 })
    // &lt_spc NAV 0: hold-tap of <&mo>, <&spc_morph> -> mod-morph is kept raw
    expect(base[30].hold).toEqual({ type: 'layer', mode: 'mo', layer: layout.layers[1].id })
    // ... whose tap is a shift mod-morph: space / dot_spc macro
    expect(base[30].tap).toEqual({ type: 'key', code: 'SPACE' })
    expect(base[30].shifted).toEqual({ type: 'macro', id: layout.macros.find((m) => m.name === 'dot_spc')!.id })
    // non-shift mod-morphs stay raw and are kept as devicetree
    expect(layout.settings.extraKeymap).toContain('masked_home: masked_home {')
    expect(layout.settings.holdTapFlavor).toBe('tap-preferred') // from &mt { MT_CORE }
    expect(layout.settings.stickyKeyTimeout).toBe(900)
    // tap dance: copy / cut
    expect(warnings.some((w) => w.includes('combos.dtsi'))).toBe(true)
    // Sys layer: _BT_SEL_KEYS_ (#ifdef CONFIG_WIRELESS is undefined -> &trans)
    expect(layout.layers[4].keys[0]).toEqual({ tap: { type: 'trans' } })
    expect(() => compileKeymap(layout, kb)).not.toThrow()
  })

  it('imports every stock keymap in the catalog without throwing', () => {
    const counts: Record<string, number> = {}
    for (const [id, text] of Object.entries(defaultKeymaps as Record<string, string>)) {
      const kb = KEYBOARDS.find((k) => k.id === id)
      if (!kb) continue
      const { layout, warnings } = importKeymap(text, kb)
      expect(layout.layers.length, id).toBeGreaterThan(0)
      expect(layout.layers.every((l) => l.keys.length === kb.keys.length), id).toBe(true)
      expect(() => compileKeymap(layout, kb), id).not.toThrow()
      if (warnings.length) counts[id] = warnings.length
    }
    // eslint-disable-next-line no-console
    console.log('stock keymap import warnings:', JSON.stringify(counts))
  })

  it('handles &label overrides, #defines and hand-written hold-taps / tap-dances / macros', () => {
    const src = `
      #include <behaviors.dtsi>
      #include <dt-bindings/zmk/keys.h>
      #define BASE 0
      #define NAV 1
      &mt { tapping-term-ms = <180>; flavor = "tap-preferred"; quick-tap-ms = <120>; };
      / {
        behaviors {
          hm: homerow_mods { compatible = "zmk,behavior-hold-tap"; #binding-cells = <2>;
            tapping-term-ms = <220>; bindings = <&kp>, <&kp>; };
          td0: tap_dance_0 { compatible = "zmk,behavior-tap-dance"; #binding-cells = <0>;
            tapping-term-ms = <175>; bindings = <&kp N1>, <&kp N2>; };
        };
        macros {
          ZMK_MACRO(hi, wait-ms = <30>; bindings = <&kp H &kp I>, <&macro_press &kp LSHIFT>, <&macro_tap &kp A>, <&macro_release &kp LSHIFT>;)
        };
        combos {
          compatible = "zmk,combos";
          combo_tab { timeout-ms = <40>; key-positions = <0 1>; bindings = <&kp TAB>; layers = <NAV>; };
        };
        keymap {
          compatible = "zmk,keymap";
          base { bindings = <&hm LSHIFT A &td0 &hi &mt LCTRL ESC &lt NAV SPACE &kp LC(LA(DEL))>; };
          nav_layer { display-name = "Navigation"; bindings = <&trans &tog BASE &sk LSHIFT &my_unknown 1 2 &none &bt BT_SEL 2>; };
        };
      };`
    const { layout, warnings } = importKeymap(src, mini)
    expect(warnings).toEqual(['Unknown behavior &my_unknown kept as raw binding'])
    const [base, nav] = layout.layers
    expect(base.name).toBe('base')
    expect(nav.name).toBe('Navigation')
    expect(layout.settings).toMatchObject({ tappingTerm: 180, holdTapFlavor: 'tap-preferred', quickTap: 120, tapDanceTerm: 175 })
    expect(base.keys[0]).toEqual({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LSHIFT' }, tappingTerm: 220 })
    expect(base.keys[1]).toEqual({ tap: { type: 'key', code: 'N1' }, doubleTap: { type: 'key', code: 'N2' } })
    expect(base.keys[2].tap).toEqual({ type: 'macro', id: layout.macros[0].id })
    expect(layout.macros[0]).toMatchObject({ name: 'hi', wait: 30, steps: [
      { type: 'text', text: 'hi' },
      { type: 'press', action: { type: 'key', code: 'LSHIFT' } },
      { type: 'tap', action: { type: 'key', code: 'A' } },
      { type: 'release', action: { type: 'key', code: 'LSHIFT' } },
    ] })
    expect(base.keys[3]).toEqual({ tap: { type: 'key', code: 'ESC' }, hold: { type: 'key', code: 'LCTRL' } })
    expect(base.keys[4]).toEqual({ tap: { type: 'key', code: 'SPACE' }, hold: { type: 'layer', mode: 'mo', layer: nav.id } })
    expect(base.keys[5]).toEqual({ tap: { type: 'key', code: 'DEL', mods: ['LCTRL', 'LALT'] } })
    expect(nav.keys[1].tap).toEqual({ type: 'layer', mode: 'tog', layer: base.id })
    expect(nav.keys[2].tap).toEqual({ type: 'sticky', code: 'LSHIFT' })
    expect(nav.keys[3].tap).toEqual({ type: 'raw', code: '&my_unknown 1 2' })
    expect(nav.keys[5].tap).toEqual({ type: 'behavior', behavior: 'bt', params: ['BT_SEL', '2'] })
    expect(layout.combos).toMatchObject([{ name: 'tab', keys: [0, 1], action: { type: 'key', code: 'TAB' }, layers: [nav.id] }])
    expect(layout.settings.comboTimeout).toBe(40)
    expect(layout.settings.stickyQuickRelease).toBe(false)
  })

  it('pads and truncates layers', () => {
    const src = '/ { keymap { compatible = "zmk,keymap"; a { bindings = <&kp A &kp B>; }; b { bindings = <&kp A &kp B &kp C &kp D &kp E &kp F &kp G>; }; }; };'
    const { layout, warnings } = importKeymap(src, mini)
    expect(layout.layers.map((l) => l.keys.length)).toEqual([6, 6])
    expect(layout.layers[0].keys[5]).toEqual({ tap: { type: 'none' } })
    expect(warnings).toHaveLength(2)
  })

  it('never throws on garbage', () => {
    for (const src of ['', '/ {', '&kp {', 'FOO(', '/ { keymap { compatible = "zmk,keymap"; x { bindings = <&kp A; }; }; };', '#if\n#endif', '}}}};;']) {
      expect(() => importKeymap(src, mini)).not.toThrow()
    }
  })
})

describe('importConf', () => {
  it('maps known Kconfig back and keeps the rest', () => {
    const layout = kitchenSinkLayout()
    const { conf, centralConf } = compileKeymap(layout, corne)
    const s = importConf(centralConf, importConf(conf, defaultSettings(), { split: true }), { split: true, merge: true })
    for (const k of ['sleepEnabled', 'sleepTimeoutMin', 'idleTimeoutSec', 'pointing', 'nkro', 'bleTxPowerPlus8', 'btMaxConnections', 'debounceMs', 'splitBatteryFetching', 'extraConf'] as const) {
      expect(s[k], k).toEqual(layout.settings[k])
    }
  })

  it('resets to ZMK defaults when a setting is absent', () => {
    const s = importConf('CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_FOO=y\n# comment\n', defaultSettings())
    expect(s.sleepEnabled).toBe(false)
    expect(s.rgbUnderglow).toBe(true)
    expect(s.rgbAutoOffIdle).toBe(false)
    expect(s.extraConf).toBe('CONFIG_FOO=y')
  })
})

describe('mod-morph, retro-tap, encoders, HWMv2', () => {
  const sofle = getKeyboard('sofle')!
  const ks = () => {
    const l = kitchenSinkLayout('sofle', sofle.keys.length, { encoders: true })
    l.settings.holdWhileUndecided = true
    return l
  }

  it('compiles shift mod-morphs, also as hold-tap tap and inside tap dances', () => {
    const km = compileKeymap(ks(), sofle).keymap
    expect(km).toMatch(/mm_kp_w: mm_kp_w \{[^}]*compatible = "zmk,behavior-mod-morph";[^}]*bindings = <&kp W>, <&kp N2>;[^}]*mods = <\(MOD_LSFT\|MOD_RSFT\)>;/)
    expect(km).toContain('&mm_kp_w ')
    expect(km).toContain('bindings = <&kp>, <&mm_kp_t>;')
    expect(km).toMatch(/bindings = <&ht_kp_mm_kp_bspc_\w LCTRL 0>, <&lt SYS DEL>;/)
  })

  it('retro-tap gets its own hold-tap; hold-while-undecided is global', () => {
    const km = compileKeymap(ks(), sofle).keymap
    expect(km).toMatch(/mt_l_rt: mt_l_rt \{[^}]*retro-tap;/)
    expect(km).toContain('&mt_l_rt LALT R')
    expect(km).toMatch(/ht_tog_kp: ht_tog_kp \{[^}]*hold-while-undecided;/)
  })

  it('emits sensor-bindings and enables EC11', () => {
    const r = compileKeymap(ks(), sofle)
    expect(r.keymap).toContain('sensor-bindings = <&inc_dec_kp C_VOL_UP C_VOL_DN &inc_dec_kp PG_DN PG_UP>;')
    expect(r.keymap).toContain('sensor-bindings = <&trans &enc_bt_bt_nxt>;')
    expect(r.keymap).toMatch(/enc_bt_bt_nxt: enc_bt_bt_nxt \{[^}]*zmk,behavior-sensor-rotate[^}]*#sensor-binding-cells = <0>;[^}]*bindings = <&bt BT_NXT>, <&bt BT_PRV>;/)
    expect(r.keymap).toContain('sensor-bindings = <&inc_dec_kp LC(TAB) LC(LS(TAB)) &enc_kp_right>;')
    expect(r.keymap).toContain('&trans {\n    #sensor-binding-cells = <0>;\n};')
    expect(r.conf).toContain('CONFIG_EC11=y')
    expect(r.conf).toContain('CONFIG_EC11_TRIGGER_GLOBAL_THREAD=y')
    expect(r.warnings).toEqual([])
    // keyboards without encoders: nothing emitted
    const c = compileKeymap(kitchenSinkLayout('corne', 42, { encoders: true }), corne)
    expect(c.keymap).not.toContain('sensor-bindings')
    expect(c.conf).not.toContain('EC11')
  })

  it('round-trips the new features through the devicetree', () => {
    const layout = ks()
    const first = compileKeymap(layout, sofle).keymap
    const { layout: imported, warnings } = importKeymap(stripMeta(first), sofle, { name: layout.name })
    expect(warnings).toEqual([])
    const base = imported.layers[0]
    expect(base.keys[2]).toEqual({ tap: { type: 'key', code: 'W' }, shifted: { type: 'key', code: 'N2' } })
    expect(base.keys[4]).toEqual({ tap: { type: 'key', code: 'R' }, hold: { type: 'key', code: 'LALT' }, retroTap: true })
    expect(base.encoders).toEqual([
      { cw: { type: 'key', code: 'C_VOL_UP' }, ccw: { type: 'key', code: 'C_VOL_DN' } },
      { cw: { type: 'key', code: 'PG_DN' }, ccw: { type: 'key', code: 'PG_UP' } },
    ])
    expect(imported.layers[1].encoders![0]).toEqual({})
    expect(imported.settings.holdWhileUndecided).toBe(true)
    imported.settings.studio = layout.settings.studio
    expect(body(compileKeymap(imported, sofle).keymap)).toBe(body(first))
  })

  it('imports the stock sofle keymap encoders', () => {
    const { layout } = importKeymap((defaultKeymaps as Record<string, string>).sofle, sofle)
    expect(layout.layers[0].encoders).toEqual([
      { cw: { type: 'key', code: 'C_VOL_UP' }, ccw: { type: 'key', code: 'C_VOL_DN' } },
      { cw: { type: 'key', code: 'PG_UP' }, ccw: { type: 'key', code: 'PG_DN' } },
    ])
  })

  it('keeps hardware overrides (encoder enable) at top level', () => {
    const src = '&left_encoder { status = "okay"; };\n/ { keymap { compatible = "zmk,keymap"; a { bindings = <&kp A>; }; }; };'
    const { layout, warnings } = importKeymap(src, mini)
    expect(warnings.some((w) => w.includes('left_encoder'))).toBe(false)
    expect(layout.settings.extraKeymap).toContain('&left_encoder {')
    const km = compileKeymap(layout, mini).keymap
    expect(km).toMatch(/\n\};\n\n&left_encoder \{\n {4}status = "okay";\n\};/)
  })

  it('translates board names for HWMv2 revisions', () => {
    const l = newLayout('corne', 42)
    l.settings.zmkRevision = 'main'
    expect(generateConfigRepo(l, corne)['build.yaml']).toContain('board: nice_nano//zmk')
    const z = getKeyboard('corneish_zen_v1')!
    const lz = newLayout(z.id, z.keys.length)
    lz.settings.zmkRevision = 'main'
    lz.settings.btMaxConnections = 3
    const files = generateConfigRepo(lz, z)
    expect(files['build.yaml']).toContain('board: corneish_zen_left@1//zmk')
    expect(files['config/corneish_zen_left.conf']).toContain('CONFIG_BT_MAX_CONN=4')
    const d = getKeyboard('dz60rgb_rev1')!
    const ld = newLayout(d.id, d.keys.length)
    ld.settings.zmkRevision = 'main'
    expect(compileKeymap(ld, d).warnings.join()).toContain('HWMv2')
    l.settings.zmkRevision = 'v0.3'
    expect(generateConfigRepo(l, corne)['build.yaml']).toContain('board: nice_nano_v2')
  })
})

describe('preprocessor / devicetree', () => {
  it('expands object/function-like, variadic, # and ## macros', () => {
    const pp = new Preprocessor()
    const out = pp.run([
      '#define A 1',
      '#define F(x, y) x + y',
      '#define V(n, ...) n: __VA_ARGS__',
      '#define S(x) #x',
      '#define P(a, b) a ## b',
      '#define VARGS_(_3, _2, _1, N, ...) N',
      '#define VARGS(...) VARGS_(__VA_ARGS__, 3, 2, 1, 0)',
      '#define CAT_(a, b) a##b',
      '#define CAT(a, b) CAT_(a, b)',
      '#define OV(...) CAT(OV_, VARGS(__VA_ARGS__))(__VA_ARGS__)',
      '#define OV_1(a) one a',
      '#define OV_2(a, b) two a b',
      '#ifdef A',
      'F(A, 2) V(x, a, b) S(hello world) P(foo, bar) OV(q) OV(q, r)',
      '#else',
      'nope',
      '#endif',
      '#if defined(B) || A == 1',
      'yes',
      '#endif',
    ].join('\n'))
    expect(out).toContain('1 + 2 x: a, b "hello world" foobar one q two q r')
    expect(out).toContain('yes')
    expect(out).not.toContain('nope')
  })

  it('parses labels, overrides and cells', () => {
    const t = parseDts('/ { a: n { p = <&kp LC(A) (1|2)>, <&x>; s = "q"; b; }; }; &a { c = <3>; };')
    const n = t.labels.get('a')!
    expect(propCells(n, 'p')).toEqual(['&kp', 'LC(A)', '(1|2)', '&x'])
    expect(n.props.has('b')).toBe(true)
    expect(propCells(n, 'c')).toEqual(['3'])
  })
})
