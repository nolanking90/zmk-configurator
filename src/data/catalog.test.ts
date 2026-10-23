import { describe, expect, it } from 'vitest'
import { ALL_MODS } from '../model/types'
import {
  KEYCODES,
  KEY_SEARCH,
  MOD_CODES,
  MOD_FUNCTIONS,
  canonicalCode,
  charToKey,
  findKeycode,
  isModifierCode,
} from './keycodes'
import { LOCALES, LOCALE_TABLES, localeLabel } from './locales'
import { BEHAVIORS, BEHAVIOR_PRESETS, formatBinding, getBehavior } from './behaviors'

describe('keycodes', () => {
  it('has unique names across codes and aliases', () => {
    const seen = new Set<string>()
    for (const k of KEYCODES) {
      for (const n of [k.code, ...k.aliases]) {
        expect(seen.has(n), n).toBe(false)
        seen.add(n)
      }
    }
    // keys.h @ v0.3 defines 644 names
    expect(seen.size).toBe(644)
  })

  it('resolves aliases to canonical codes', () => {
    expect(canonicalCode('LEFT_SHIFT')).toBe('LSHIFT')
    expect(canonicalCode('LSFT')).toBe('LSHIFT')
    expect(canonicalCode('LSHFT')).toBe('LSHIFT')
    expect(canonicalCode('ENTER')).toBe('RET')
    expect(canonicalCode('RETURN')).toBe('RET')
    expect(canonicalCode('BACKSPACE')).toBe('BSPC')
    expect(canonicalCode('NUMBER_1')).toBe('N1')
    expect(canonicalCode('EXCLAMATION')).toBe('EXCL')
    expect(canonicalCode('LEFT_BRACKET')).toBe('LBKT')
    expect(canonicalCode('LCMD')).toBe('LGUI')
    expect(canonicalCode('M_VOLU')).toBe('C_VOL_UP')
    expect(canonicalCode('NOT_A_KEY')).toBe('NOT_A_KEY')
    expect(findKeycode('lshift')).toBeUndefined()
    expect(findKeycode('F24')?.category).toBe('function')
    expect(findKeycode('C_AL_CALC')?.category).toBe('app')
    expect(findKeycode('INT1')?.category).toBe('international')
    expect(findKeycode('EXCL')?.base).toBe('N1')
    expect(findKeycode('N1')?.shiftLabel).toBe('!')
  })

  it('MOD_CODES resolve and round-trip', () => {
    for (const m of ALL_MODS) {
      const def = findKeycode(MOD_CODES[m])
      expect(def?.code).toBe(MOD_CODES[m])
      expect(def?.category).toBe('modifiers')
      expect(findKeycode(m)?.code).toBe(m)
      expect(isModifierCode(m)).toBe(m)
      expect(MOD_FUNCTIONS[m]).toMatch(/^[LR][CSAG]$/)
    }
    expect(isModifierCode('LSFT')).toBe('LSHIFT')
    expect(isModifierCode('A')).toBeUndefined()
  })

  it('searches', () => {
    expect(KEY_SEARCH('a')[0].code).toBe('A')
    expect(KEY_SEARCH('enter')[0].code).toBe('RET')
    expect(KEY_SEARCH('!')[0].code).toBe('EXCL')
    expect(KEY_SEARCH('volume').map((k) => k.code)).toContain('C_VOL_UP')
  })
})

describe('charToKey', () => {
  it('US defaults', () => {
    expect(charToKey('a')).toEqual({ code: 'A', shift: false })
    expect(charToKey('A')).toEqual({ code: 'A', shift: true })
    expect(charToKey('!')).toEqual({ code: 'N1', shift: true })
    expect(charToKey('\n')).toEqual({ code: 'RET', shift: false })
    expect(charToKey(' ')).toEqual({ code: 'SPACE', shift: false })
    expect(charToKey('"')).toEqual({ code: 'SQT', shift: true })
    expect(charToKey('é')).toBeUndefined()
  })

  it('German', () => {
    expect(charToKey('@', 'de')).toEqual({ code: 'Q', shift: false, altgr: true })
    expect(charToKey('z', 'de')).toEqual({ code: 'Y', shift: false })
    expect(charToKey('Y', 'de')).toEqual({ code: 'Z', shift: true })
    expect(charToKey('ß', 'de')).toEqual({ code: 'MINUS', shift: false })
    expect(charToKey('^', 'de')).toEqual({ code: 'GRAVE', shift: false, dead: true })
  })

  it('other layouts', () => {
    expect(charToKey('a', 'fr')).toEqual({ code: 'Q', shift: false })
    expect(charToKey('1', 'fr')).toEqual({ code: 'N1', shift: true })
    expect(charToKey('"', 'uk')).toEqual({ code: 'N2', shift: true })
    expect(charToKey('s', 'dvorak')).toEqual({ code: 'SEMI', shift: false })
    expect(charToKey('t', 'colemak')).toEqual({ code: 'F', shift: false })
    expect(charToKey('@', 'jp')).toEqual({ code: 'LBKT', shift: false })
    for (const l of LOCALES) expect(LOCALE_TABLES[l.id], l.id).toBeDefined()
  })
})

describe('localeLabel', () => {
  it('maps legends', () => {
    expect(localeLabel('Y', 'de')).toEqual({ label: 'Z' })
    expect(localeLabel('SEMI', 'de')).toEqual({ label: 'Ö' })
    expect(localeLabel('MINUS', 'de')).toEqual({ label: 'ß', shiftLabel: '?', altgrLabel: '\\' })
    expect(localeLabel('EXCL', 'de')).toEqual({ label: '!' })
    expect(localeLabel('AT', 'de')).toEqual({ label: '"' })
    expect(localeLabel('N1', 'fr')).toEqual({ label: '&', shiftLabel: '1' })
    expect(localeLabel('NUHS', 'uk')?.label).toBe('#')
    expect(localeLabel('RET', 'de')).toBeUndefined()
    expect(localeLabel('A', 'xx')).toBeUndefined()
  })
})

describe('behaviors', () => {
  it('presets reference known behaviors with valid params', () => {
    for (const p of BEHAVIOR_PRESETS) {
      const def = getBehavior(p.behavior)
      expect(def, p.behavior).toBeDefined()
      const first = def!.params[0]
      if (first?.kind === 'enum') expect(first.options!.map((o) => o.value)).toContain(p.params[0])
    }
    expect(new Set(BEHAVIORS.map((b) => b.id)).size).toBe(BEHAVIORS.length)
  })

  it('formats bindings', () => {
    expect(formatBinding('bt', ['BT_SEL', '0'])).toBe('&bt BT_SEL 0')
    expect(formatBinding('caps_word', [])).toBe('&caps_word')
    expect(formatBinding('rgb_ug', ['RGB_COLOR_HSB', '128', '100', '50'])).toBe('&rgb_ug RGB_COLOR_HSB(128,100,50)')
  })
})
