import { describe, expect, it } from 'vitest'
import { KEYCODES } from '../data/keycodes'
import { getKeyboard, KEYBOARDS } from '../data/keyboards'
import { defaultSettings, newLayout } from '../model/defaults'
import type { KeyConfig, Layout } from '../model/types'
import { decodeKeyParam, encodeKeyParam, formatKeyParam, HID_USAGE_VALUES } from './hidUsage'
import { decodeBehaviorParams, encodeBehaviorParams } from './behaviorParams'
import {
  actionToBinding, bindingToKey, deviceKeymapToLayers, indexBehaviors, keyToBinding, labelForDisplayName, matchKeyboards,
  type DeviceBehavior, type DeviceKeymap, type ReadContext, type WriteContext,
} from './convert'
import { groupSkipped, planWrite } from './sync'

// ---- HID usage ------------------------------------------------------------------

describe('HID usage encoding', () => {
  it('covers every catalog keycode', () => {
    for (const k of KEYCODES) expect(HID_USAGE_VALUES[k.code], k.code).toBeTypeOf('number')
  })

  it('matches ZMK_HID_USAGE(page, id) and implicit mods', () => {
    expect(encodeKeyParam('A')).toBe(0x00070004)
    expect(encodeKeyParam('RET')).toBe(0x00070028)
    expect(encodeKeyParam('ENTER')).toBe(0x00070028) // alias
    expect(encodeKeyParam('LSHIFT')).toBe(0x000700e1)
    expect(encodeKeyParam('C_VOL_UP')).toBe(0x000c00e9)
    expect(encodeKeyParam('C_PP')).toBe(0x000c00cd)
    expect(encodeKeyParam('EXCL')).toBe(0x0207001e) // LS(N1)
    expect(encodeKeyParam('NOPE')).toBeUndefined()
  })

  it('applies explicit mods in the top byte', () => {
    expect(encodeKeyParam('A', ['LCTRL'])).toBe(0x01070004)
    expect(encodeKeyParam('A', ['LCTRL', 'LSHIFT'])).toBe(0x03070004)
    expect(encodeKeyParam('A', ['RGUI'])).toBe(0x80070004) // stays unsigned
    expect(encodeKeyParam('EXCL', ['LCTRL'])).toBe(0x0307001e)
  })

  it('decodes values back to codes + mods', () => {
    expect(decodeKeyParam(0x00070004)).toEqual({ code: 'A', mods: [] })
    expect(decodeKeyParam(0x01070004)).toEqual({ code: 'A', mods: ['LCTRL'] })
    expect(decodeKeyParam(0x0207001e)).toEqual({ code: 'EXCL', mods: [] })
    expect(decodeKeyParam(0x0307001e)).toEqual({ code: 'EXCL', mods: ['LCTRL'] })
    expect(decodeKeyParam(0x02070004)).toEqual({ code: 'A', mods: ['LSHIFT'] })
    expect(decodeKeyParam(0x80070004)).toEqual({ code: 'A', mods: ['RGUI'] })
    expect(decodeKeyParam(0x000700ff)).toBeUndefined()
    expect(formatKeyParam(0x03070004)).toBe('LC(LS(A))')
  })

  it('round-trips every catalog code with mods', () => {
    for (const k of KEYCODES) {
      for (const mods of [[], ['LALT'], ['LCTRL', 'RGUI']] as const) {
        const v = encodeKeyParam(k.code, [...mods])!
        const d = decodeKeyParam(v)!
        expect(encodeKeyParam(d.code, d.mods), k.code).toBe(v)
      }
    }
  })
})

// ---- built-in behavior params --------------------------------------------------------

describe('behavior params', () => {
  const cases: [string, string[], number, number][] = [
    ['bt', ['BT_SEL', '2'], 3, 2],
    ['bt', ['BT_CLR'], 0, 0],
    ['bt', ['BT_NXT'], 1, 0],
    ['bt', ['BT_CLR_ALL'], 4, 0],
    ['bt', ['BT_DISC', '1'], 5, 1],
    ['out', ['OUT_USB'], 1, 0],
    ['out', ['OUT_TOG'], 0, 0],
    ['rgb_ug', ['RGB_TOG'], 0, 0],
    ['rgb_ug', ['RGB_EFR'], 12, 0],
    ['rgb_ug', ['RGB_COLOR_HSB', '300', '50', '100'], 14, (300 << 16) + (50 << 8) + 100],
    ['bl', ['BL_SET', '40'], 6, 40],
    ['bl', ['BL_TOG'], 2, 0],
    ['ext_power', ['EP_TOG'], 2, 0],
    ['mkp', ['RCLK'], 2, 0],
    ['mkp', ['MB5'], 16, 0],
    ['mmv', ['MOVE_UP'], 0xfda8, 0],
    ['msc', ['SCRL_RIGHT'], 0x000a0000, 0],
    ['kt', ['LC(A)'], 0x01070004, 0],
    ['caps_word', [], 0, 0],
  ]
  it.each(cases)('&%s %j', (b, params, p1, p2) => {
    expect(encodeBehaviorParams(b, params)).toEqual({ param1: p1, param2: p2 })
    expect(decodeBehaviorParams(b, p1, p2)).toEqual(params)
  })

  it('accepts the RGB_COLOR_HSB(h,s,b) single token', () => {
    expect(encodeBehaviorParams('rgb_ug', ['RGB_COLOR_HSB(120,100,50)'])).toEqual({ param1: 14, param2: (120 << 16) + (100 << 8) + 50 })
  })

  it('rejects unknown values', () => {
    expect(encodeBehaviorParams('bt', ['BT_FOO'])).toBeUndefined()
    expect(encodeBehaviorParams('nope', [])).toBeUndefined()
    expect(encodeBehaviorParams('caps_word', ['1'])).toBeUndefined()
    expect(decodeBehaviorParams('out', 9, 0)).toBeUndefined()
  })
})

// ---- bindings <-> actions --------------------------------------------------------------

/** A v0.3 device's behaviors (ids are arbitrary, like ZMK's crc16 local ids). */
const DEVICE_BEHAVIORS: DeviceBehavior[] = [
  ['Key Press', 101], ['Mod-Tap', 102], ['Layer-Tap', 103], ['Momentary Layer', 104], ['Toggle Layer', 105],
  ['To Layer', 106], ['Sticky Layer', 107], ['Sticky Key', 108], ['Transparent', 109], ['None', 110],
  ['Bluetooth', 111], ['Output Selection', 112], ['Caps Word', 113], ['Studio Unlock', 114], ['Bootloader', 115],
  ['Mouse Key Press', 116], ['Key Toggle', 117], ['ht_kp_kp_l', 200], ['my fancy macro', 201],
].map(([displayName, id]) => ({
  id: id as number,
  displayName: displayName as string,
  metadata: displayName === 'ht_kp_kp_l'
    ? [{ param1: [{ name: 'hold', hidUsage: { keyboardMax: 255, consumerMax: 1023 } }], param2: [{ name: 'tap', hidUsage: { keyboardMax: 255, consumerMax: 1023 } }] }]
    : [],
}))
const IDX = indexBehaviors(DEVICE_BEHAVIORS)

const readCtx: ReadContext = {
  behaviors: IDX,
  layerRef: (id) => ({ 0: 'base', 1: 'nav', 5: 'sym' } as Record<number, string>)[id],
  layerIndex: (id) => ({ 0: 0, 1: 1, 5: 2 } as Record<number, number>)[id],
}
const writeCtx: WriteContext = {
  behaviors: IDX,
  layerDeviceId: (id) => ({ base: 0, nav: 1, sym: 5 } as Record<string, number>)[id],
  settings: { tappingTerm: 200, positionalHoldTap: false },
}

describe('behavior index', () => {
  it('maps display names and node names to labels', () => {
    expect(labelForDisplayName('Key Press')).toEqual({ label: 'kp', builtin: true })
    expect(labelForDisplayName('Grave/Escape')).toEqual({ label: 'gresc', builtin: true })
    expect(labelForDisplayName('Underglow')).toEqual({ label: 'rgb_ug', builtin: true })
    expect(labelForDisplayName('mod_tap')).toEqual({ label: 'mt', builtin: true })
    expect(labelForDisplayName('ht_kp_kp_l')).toEqual({ label: 'ht_kp_kp_l', builtin: false })
    expect(labelForDisplayName('my fancy macro')).toEqual({ label: 'my_fancy_macro', builtin: false })
    expect(IDX.idByLabel.get('mt')).toBe(102)
  })
})

describe('bindingToKey / keyToBinding', () => {
  const roundTrip: [string, KeyConfig, [number, number, number]][] = [
    ['kp', { tap: { type: 'key', code: 'A' } }, [101, 0x00070004, 0]],
    ['kp + mods', { tap: { type: 'key', code: 'TAB', mods: ['LSHIFT', 'LGUI'] } }, [101, 0x0a07002b, 0]],
    ['kp implicit', { tap: { type: 'key', code: 'LPAR' } }, [101, 0x02070026, 0]],
    ['consumer', { tap: { type: 'key', code: 'C_VOL_UP' } }, [101, 0x000c00e9, 0]],
    ['mt', { tap: { type: 'key', code: 'F' }, hold: { type: 'key', code: 'LSHIFT' } }, [102, 0x000700e1, 0x00070009]],
    ['lt', { tap: { type: 'key', code: 'SPACE' }, hold: { type: 'layer', mode: 'mo', layer: 'nav' } }, [103, 1, 0x0007002c]],
    ['mo', { tap: { type: 'layer', mode: 'mo', layer: 'sym' } }, [104, 5, 0]],
    ['tog', { tap: { type: 'layer', mode: 'tog', layer: 'nav' } }, [105, 1, 0]],
    ['to', { tap: { type: 'layer', mode: 'to', layer: 'base' } }, [106, 0, 0]],
    ['sl', { tap: { type: 'layer', mode: 'sl', layer: 'sym' } }, [107, 5, 0]],
    ['sk', { tap: { type: 'sticky', code: 'LSHIFT' } }, [108, 0x000700e1, 0]],
    ['trans', { tap: { type: 'trans' } }, [109, 0, 0]],
    ['none', { tap: { type: 'none' } }, [110, 0, 0]],
    ['bt', { tap: { type: 'behavior', behavior: 'bt', params: ['BT_SEL', '1'] } }, [111, 3, 1]],
    ['out', { tap: { type: 'behavior', behavior: 'out', params: ['OUT_BLE'] } }, [112, 2, 0]],
    ['caps_word', { tap: { type: 'behavior', behavior: 'caps_word', params: [] } }, [113, 0, 0]],
    ['mkp', { tap: { type: 'behavior', behavior: 'mkp', params: ['LCLK'] } }, [116, 1, 0]],
    ['kt', { tap: { type: 'behavior', behavior: 'kt', params: ['LSHIFT'] } }, [117, 0x000700e1, 0]],
  ]
  it.each(roundTrip)('%s', (_n, key, [behaviorId, param1, param2]) => {
    const w = keyToBinding(key, 0, writeCtx)
    expect(w).toEqual({ ok: true, binding: { behaviorId, param1, param2 } })
    expect(bindingToKey({ behaviorId, param1, param2 }, readCtx)).toEqual({ key })
  })

  it('reads custom behaviors as raw bindings, decoding key params', () => {
    const r = bindingToKey({ behaviorId: 200, param1: 0x000700e0, param2: 0x00070004 }, readCtx)
    expect(r.key).toEqual({ tap: { type: 'raw', code: '&ht_kp_kp_l LCTRL A' } })
    expect(r.warning).toMatch(/custom behavior/)
    expect(bindingToKey({ behaviorId: 201, param1: 0, param2: 0 }, readCtx).key).toEqual({ tap: { type: 'raw', code: '&my_fancy_macro' } })
    expect(bindingToKey({ behaviorId: 999, param1: 7, param2: 0 }, readCtx).key).toEqual({ tap: { type: 'raw', code: '&unknown_behavior_999 7' } })
  })

  it('reads behavior id 0 (unbound) as none and missing layers as raw', () => {
    expect(bindingToKey({ behaviorId: 0, param1: 0, param2: 0 }, readCtx).key).toEqual({ tap: { type: 'none' } })
    expect(bindingToKey({ behaviorId: 104, param1: 9, param2: 0 }, readCtx).key.tap?.type).toBe('raw')
  })

  it('writes raw bindings that reference device behaviors', () => {
    expect(actionToBinding({ type: 'raw', code: '&ht_kp_kp_l LCTRL A' }, writeCtx)).toEqual({ ok: true, binding: { behaviorId: 200, param1: 0x000700e0, param2: 0x00070004 } })
    expect(actionToBinding({ type: 'raw', code: '&kp LC(Z)' }, writeCtx)).toEqual({ ok: true, binding: { behaviorId: 101, param1: 0x0107001d, param2: 0 } })
    expect(actionToBinding({ type: 'raw', code: '&bt BT_SEL 4' }, writeCtx)).toEqual({ ok: true, binding: { behaviorId: 111, param1: 3, param2: 4 } })
    expect(actionToBinding({ type: 'raw', code: '&my_custom 1' }, writeCtx).ok).toBe(false)
    expect(actionToBinding({ type: 'raw', code: '&kp A B C' }, writeCtx).ok).toBe(false)
  })

  it('reports keys Studio cannot express', () => {
    const why = (k: KeyConfig, ctx = writeCtx) => {
      const r = keyToBinding(k, 0, ctx)
      return r.ok ? 'ok' : r.reason
    }
    expect(why({ tap: { type: 'key', code: 'A' }, doubleTap: { type: 'key', code: 'B' } })).toMatch(/tap dance/)
    expect(why({ tap: { type: 'macro', id: 'm1' } })).toMatch(/macro/)
    expect(why({ tap: { type: 'key', code: 'COMMA' }, shifted: { type: 'key', code: 'SEMI' } })).toMatch(/shift morph/)
    expect(why({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LCTRL' }, retroTap: true })).toMatch(/retro-tap/)
    expect(why({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LCTRL' }, tappingTerm: 180 })).toMatch(/per-key tapping term/)
    expect(why({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LCTRL' }, tappingTerm: 200 })).toBe('ok')
    expect(why({ tap: { type: 'key', code: 'A' }, hold: { type: 'layer', mode: 'tog', layer: 'nav' } })).toMatch(/custom hold-tap/)
    expect(why({ tap: { type: 'behavior', behavior: 'bt', params: ['BT_SEL', '0'] }, hold: { type: 'key', code: 'LCTRL' } })).toMatch(/custom hold-tap/)
    expect(why({ tap: { type: 'behavior', behavior: 'rgb_ug', params: ['RGB_TOG'] } })).toMatch(/rgb_ug is not available/)
    expect(why({ tap: { type: 'key', code: 'NOT_A_KEY' } })).toMatch(/HID usage/)
    expect(why({ tap: { type: 'layer', mode: 'mo', layer: 'gone' } })).toMatch(/layer/)
    const positional = { ...writeCtx, settings: { tappingTerm: 200, positionalHoldTap: true }, hands: ['L' as const] }
    expect(why({ tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LCTRL' } }, positional)).toMatch(/positional/)
  })

  it('treats a lone hold as its plain binding (like the compiler)', () => {
    expect(keyToBinding({ hold: { type: 'key', code: 'B' } }, 0, writeCtx)).toEqual({ ok: true, binding: { behaviorId: 101, param1: 0x00070005, param2: 0 } })
    expect(keyToBinding(undefined, 0, writeCtx)).toEqual({ ok: true, binding: { behaviorId: 110, param1: 0, param2: 0 } })
  })
})

// ---- keymap / plans ---------------------------------------------------------------------

const corne = getKeyboard('corne')!

function deviceKeymap(layers: { id: number; name: string; fill: [number, number, number] }[], available = 4): DeviceKeymap {
  return {
    layers: layers.map((l) => ({
      id: l.id,
      name: l.name,
      bindings: Array.from({ length: corne.keys.length }, () => ({ behaviorId: l.fill[0], param1: l.fill[1], param2: l.fill[2] })),
    })),
    availableLayers: available,
    maxLayerNameLength: 20,
  }
}

describe('deviceKeymapToLayers', () => {
  it('converts layers and maps layer ids to new layer ids', () => {
    const km = deviceKeymap([{ id: 0, name: 'Base', fill: [101, 0x00070004, 0] }, { id: 3, name: '', fill: [109, 0, 0] }])
    km.layers[0].bindings[5] = { behaviorId: 104, param1: 3, param2: 0 }
    let n = 0
    const r = deviceKeymapToLayers(km, IDX, corne.keys.length, () => `L${n++}`)
    expect(r.layers.map((l) => [l.id, l.name])).toEqual([['L0', 'Base'], ['L1', 'Layer 1']])
    expect(r.layers[0].keys[0]).toEqual({ tap: { type: 'key', code: 'A' } })
    expect(r.layers[0].keys[5]).toEqual({ tap: { type: 'layer', mode: 'mo', layer: 'L1' } })
    expect(r.layers[1].keys.every((k) => k.tap?.type === 'trans')).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('keeps existing layer ids by index', () => {
    const km = deviceKeymap([{ id: 0, name: 'Base', fill: [110, 0, 0] }])
    const r = deviceKeymapToLayers(km, IDX, corne.keys.length, () => 'new', [{ id: 'keep', color: '#ff0000' }])
    expect(r.layers[0].id).toBe('keep')
    expect(r.layers[0].color).toBe('#ff0000')
  })
})

function layoutWith(layers: { name: string; key: KeyConfig }[]): Layout {
  const l = newLayout('corne', corne.keys.length)
  l.settings = defaultSettings()
  l.layers = layers.map((x, i) => ({ id: `id${i}`, name: x.name, keys: Array.from({ length: corne.keys.length }, () => structuredClone(x.key)) }))
  return l
}

describe('planWrite', () => {
  it('only writes changed keys and renames layers', () => {
    const layout = layoutWith([{ name: 'Base', key: { tap: { type: 'key', code: 'A' } } }, { name: 'Nav', key: { tap: { type: 'trans' } } }])
    layout.layers[0].keys[1] = { tap: { type: 'key', code: 'B' } }
    const km = deviceKeymap([{ id: 0, name: 'Base', fill: [101, 0x00070004, 0] }, { id: 1, name: 'Lower', fill: [109, 0, 0] }])
    const plan = planWrite(layout, corne, km, IDX)
    expect(plan.errors).toEqual([])
    expect(plan.changes).toEqual([{ layer: 0, deviceLayerId: 0, position: 1, binding: { behaviorId: 101, param1: 0x00070005, param2: 0 } }])
    expect(plan.unchanged).toBe(corne.keys.length * 2 - 1)
    expect(plan.renames).toEqual([{ deviceLayerId: 1, layer: 1, name: 'Nav' }])
    expect(plan.addLayers).toBe(0)
    expect(plan.removeLayers).toEqual([])
  })

  it('plans layer adds/removes and reports capacity', () => {
    const three = layoutWith([0, 1, 2].map((i) => ({ name: `L${i}`, key: { tap: { type: 'trans' } } })))
    const one = deviceKeymap([{ id: 0, name: 'L0', fill: [109, 0, 0] }], 1)
    const p = planWrite(three, corne, one, IDX)
    expect(p.addLayers).toBe(1)
    expect(p.errors[0]).toMatch(/only has room for 2/)
    // keys on the simulated new layer (lowest free id = 1) are all changes
    expect(p.changes.filter((c) => c.deviceLayerId === 1)).toHaveLength(corne.keys.length)

    const single = layoutWith([{ name: 'L0', key: { tap: { type: 'trans' } } }])
    const many = deviceKeymap([0, 1, 2].map((id) => ({ id, name: `L${id}`, fill: [109, 0, 0] as [number, number, number] })))
    expect(planWrite(single, corne, many, IDX).removeLayers).toEqual([2, 1])
    expect(planWrite(single, corne, many, IDX, { removeExtraLayers: false }).removeLayers).toEqual([])
  })

  it('lists unsupported keys and Studio-less features', () => {
    const layout = layoutWith([{ name: 'Base', key: { tap: { type: 'key', code: 'A' } } }])
    layout.layers[0].keys[0] = { tap: { type: 'key', code: 'A' }, doubleTap: { type: 'key', code: 'B' } }
    layout.layers[0].keys[1] = { tap: { type: 'macro', id: 'x' } }
    layout.layers[0].keys[2] = { tap: { type: 'key', code: 'A' }, hold: { type: 'key', code: 'LCTRL' }, tappingTerm: 150 }
    layout.layers[0].keys[3] = { tap: { type: 'key', code: 'B' }, doubleTap: { type: 'key', code: 'C' } }
    layout.combos = [{ id: 'c', name: 'esc', keys: [0, 1], action: { type: 'key', code: 'ESC' }, layers: [] }]
    const km = deviceKeymap([{ id: 0, name: 'Base', fill: [101, 0x00070004, 0] }])
    const p = planWrite(layout, corne, km, IDX)
    expect(p.skipped.map((s) => s.position)).toEqual([0, 1, 2, 3])
    expect(groupSkipped(p.skipped).map((g) => [g.reason, g.keys.length])).toEqual([
      ['tap dance', 2], ['macro', 1], ['per-key tapping term', 1],
    ])
    expect(p.notes.some((n) => /combo/.test(n))).toBe(true)
  })
})

describe('matchKeyboards', () => {
  it('ranks the geometrically matching keyboard first among same-size boards', () => {
    const physical = {
      name: 'corne',
      keys: corne.keys.map((k) => ({
        x: Math.round(k.x * 100), y: Math.round(k.y * 100), width: Math.round((k.w ?? 1) * 100), height: Math.round((k.h ?? 1) * 100),
        r: Math.round((k.r ?? 0) * 100), rx: Math.round((k.rx ?? 0) * 100), ry: Math.round((k.ry ?? 0) * 100),
      })),
    }
    const m = matchKeyboards(physical, corne.keys.length, KEYBOARDS)
    expect(m.every((x) => x.kb.keys.length === corne.keys.length)).toBe(true)
    expect(m[0].distance).toBeLessThan(0.01)
    expect(m.filter((x) => x.distance < 0.01).map((x) => x.kb.id)).toContain('corne')
  })
})
