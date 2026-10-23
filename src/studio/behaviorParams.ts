// Numeric encoding of the parameters of ZMK's built-in behaviors, as they
// travel over ZMK Studio RPC (two uint32 cells per binding).
//
// Values come from zmkfirmware/zmk @ v0.3, app/include/dt-bindings/zmk/*.h:
// bt.h, outputs.h, rgb.h, backlight.h, ext_power.h, pointing.h. The string
// form matches Action { type: 'behavior', params } as used by
// src/data/behaviors.ts (e.g. ['BT_SEL', '0'], ['RGB_COLOR_HSB', h, s, b]).

import { decodeKeyParam, encodeKeyParam, formatKeyParam } from './hidUsage'
import { unwrapMods } from '../zmk/common'

export interface Cells {
  param1: number
  param2: number
}

type Table = Record<string, number>

const BT_CMD: Table = { BT_CLR: 0, BT_NXT: 1, BT_PRV: 2, BT_SEL: 3, BT_CLR_ALL: 4, BT_DISC: 5 }
/** bt commands whose second cell is a profile index */
const BT_WITH_PROFILE = new Set(['BT_SEL', 'BT_DISC'])
const OUT: Table = { OUT_TOG: 0, OUT_USB: 1, OUT_BLE: 2 }
const RGB_CMD: Table = {
  RGB_TOG: 0, RGB_ON: 1, RGB_OFF: 2, RGB_HUI: 3, RGB_HUD: 4, RGB_SAI: 5, RGB_SAD: 6, RGB_BRI: 7,
  RGB_BRD: 8, RGB_SPI: 9, RGB_SPD: 10, RGB_EFF: 11, RGB_EFR: 12, RGB_COLOR_HSB: 14,
}
const BL_CMD: Table = { BL_ON: 0, BL_OFF: 1, BL_TOG: 2, BL_INC: 3, BL_DEC: 4, BL_CYCLE: 5, BL_SET: 6 }
const EP: Table = { EP_OFF: 0, EP_ON: 1, EP_TOG: 2 }
const MKP: Table = { LCLK: 1, RCLK: 2, MCLK: 4, MB4: 8, MB5: 16 }
const MKP_ALIASES: Table = { MB1: 1, MB2: 2, MB3: 4 }

const u16 = (n: number) => n & 0xffff
const moveY = (v: number) => u16(v)
const moveX = (v: number) => (u16(v) << 16) >>> 0
const MOVE: Table = { MOVE_UP: moveY(-600), MOVE_DOWN: moveY(600), MOVE_LEFT: moveX(-600), MOVE_RIGHT: moveX(600) }
const SCRL: Table = { SCRL_UP: moveY(10), SCRL_DOWN: moveY(-10), SCRL_LEFT: moveX(-10), SCRL_RIGHT: moveX(10) }

/** Behaviors whose bindings take no parameters at all. */
export const ZERO_PARAM_BEHAVIORS = new Set([
  'trans', 'none', 'caps_word', 'key_repeat', 'gresc', 'sys_reset', 'bootloader', 'soft_off', 'studio_unlock',
])

function invert(t: Table): Map<number, string> {
  const m = new Map<number, string>()
  for (const [k, v] of Object.entries(t)) if (!m.has(v)) m.set(v, k)
  return m
}
const INV = {
  bt: invert(BT_CMD), out: invert(OUT), rgb: invert(RGB_CMD), bl: invert(BL_CMD), ep: invert(EP),
  mkp: invert(MKP), mmv: invert(MOVE), msc: invert(SCRL),
}

/** Parse an integer literal (decimal or 0x hex); undefined otherwise. */
export function parseIntLiteral(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const t = s.trim()
  if (/^-?\d+$/.test(t)) return Number(t) >>> 0
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16) >>> 0
  return undefined
}

/** Key expression ("LC(A)", "EXCL") or integer literal -> 32-bit value. */
export function parseKeyExpr(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const lit = parseIntLiteral(s)
  if (lit !== undefined) return lit
  const u = unwrapMods(s)
  if (!u) return undefined
  return encodeKeyParam(u.code, u.mods)
}

function num(s: string | undefined, fallback = 0): number | undefined {
  if (s === undefined || s === '') return fallback
  return parseIntLiteral(s)
}

/** RGB_COLOR_HSB(h,s,b) as one token, as written in a .keymap */
function parseHsbToken(s: string): [string, string, string] | undefined {
  const m = /^RGB_COLOR_HS[BV]\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s.trim())
  return m ? [m[1], m[2], m[3]] : undefined
}

/**
 * Encode the string params of a built-in behavior into binding cells.
 * Returns undefined when the behavior or a parameter isn't known.
 */
export function encodeBehaviorParams(behavior: string, params: readonly string[]): Cells | undefined {
  const p = params.filter((x) => x !== '')
  const [a, b] = p
  const one = (t: Table, alt?: Table): Cells | undefined => {
    if (a === undefined) return undefined
    const v = t[a] ?? alt?.[a] ?? parseIntLiteral(a)
    return v === undefined ? undefined : { param1: v, param2: 0 }
  }
  switch (behavior) {
    case 'bt': {
      if (a === undefined) return undefined
      const cmd = BT_CMD[a] ?? parseIntLiteral(a)
      if (cmd === undefined) return undefined
      const prof = num(b)
      if (prof === undefined) return undefined
      return { param1: cmd, param2: prof }
    }
    case 'out': return one(OUT)
    case 'ext_power': return one(EP)
    case 'mkp': return one(MKP, MKP_ALIASES)
    case 'mmv': return one(MOVE)
    case 'msc': return one(SCRL)
    case 'rgb_ug': {
      if (a === undefined) return undefined
      const tok = parseHsbToken(a)
      if (tok || a === 'RGB_COLOR_HSB' || a === 'RGB_COLOR_HSV') {
        const [h, s, v] = tok ?? [p[1] ?? '0', p[2] ?? '100', p[3] ?? '100']
        const [hn, sn, vn] = [num(h), num(s), num(v)]
        if (hn === undefined || sn === undefined || vn === undefined) return undefined
        return { param1: RGB_CMD.RGB_COLOR_HSB, param2: ((hn << 16) + (sn << 8) + vn) >>> 0 }
      }
      const cmd = RGB_CMD[a] ?? parseIntLiteral(a)
      if (cmd === undefined) return undefined
      const v2 = num(b)
      return v2 === undefined ? undefined : { param1: cmd, param2: v2 }
    }
    case 'bl': {
      if (a === undefined) return undefined
      const cmd = BL_CMD[a] ?? parseIntLiteral(a)
      if (cmd === undefined) return undefined
      const v2 = num(b)
      return v2 === undefined ? undefined : { param1: cmd, param2: v2 }
    }
    case 'kt': {
      const v = parseKeyExpr(a)
      return v === undefined ? undefined : { param1: v, param2: 0 }
    }
    default:
      if (ZERO_PARAM_BEHAVIORS.has(behavior)) return p.length === 0 ? { param1: 0, param2: 0 } : undefined
      return undefined
  }
}

/**
 * Decode binding cells of a built-in behavior into string params.
 * Returns undefined when they don't correspond to a named value.
 */
export function decodeBehaviorParams(behavior: string, param1: number, param2: number): string[] | undefined {
  switch (behavior) {
    case 'bt': {
      const cmd = INV.bt.get(param1)
      if (!cmd) return undefined
      return BT_WITH_PROFILE.has(cmd) ? [cmd, String(param2)] : [cmd]
    }
    case 'out': { const n = INV.out.get(param1); return n ? [n] : undefined }
    case 'ext_power': { const n = INV.ep.get(param1); return n ? [n] : undefined }
    case 'mkp': { const n = INV.mkp.get(param1); return n ? [n] : undefined }
    case 'mmv': { const n = INV.mmv.get(param1); return n ? [n] : undefined }
    case 'msc': { const n = INV.msc.get(param1); return n ? [n] : undefined }
    case 'rgb_ug': {
      const cmd = INV.rgb.get(param1)
      if (!cmd) return undefined
      if (cmd === 'RGB_COLOR_HSB') return [cmd, String((param2 >>> 16) & 0xffff), String((param2 >>> 8) & 0xff), String(param2 & 0xff)]
      return [cmd]
    }
    case 'bl': {
      const cmd = INV.bl.get(param1)
      if (!cmd) return undefined
      return cmd === 'BL_SET' ? [cmd, String(param2)] : [cmd]
    }
    case 'kt': return decodeKeyParam(param1) ? [formatKeyParam(param1)] : undefined
    default:
      return ZERO_PARAM_BEHAVIORS.has(behavior) ? [] : undefined
  }
}
