import { describe, expect, it } from 'vitest'
import { CONTROLLERS, KEYBOARDS, getKeyboard } from './keyboards'

describe('keyboard catalog', () => {
  it('has keyboards with keys and unique ids', () => {
    expect(KEYBOARDS.length).toBeGreaterThan(50)
    const ids = new Set<string>()
    for (const kb of KEYBOARDS) {
      expect(kb.keys.length, kb.id).toBeGreaterThan(0)
      expect(ids.has(kb.id), `duplicate id ${kb.id}`).toBe(false)
      ids.add(kb.id)
      if (kb.hands) expect(kb.hands.length, kb.id).toBe(kb.keys.length)
      if (kb.kind === 'shield') expect(kb.shields?.length, kb.id).toBeGreaterThan(0)
      else expect(kb.boards?.length, kb.id).toBeGreaterThan(0)
      if (kb.split) expect((kb.shields ?? kb.boards)!.length, kb.id).toBe(2)
      for (const k of kb.keys) {
        expect(Number.isFinite(k.x) && Number.isFinite(k.y), kb.id).toBe(true)
        expect(k.x).toBeGreaterThanOrEqual(0)
        expect(k.y).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('matches known key counts', () => {
    expect(getKeyboard('corne')?.keys).toHaveLength(42)
    expect(getKeyboard('corne_5col')?.keys).toHaveLength(36)
    expect(getKeyboard('glove80')?.keys).toHaveLength(80)
    expect(getKeyboard('sofle')?.keys).toHaveLength(60)
    expect(getKeyboard('lily58')?.keys).toHaveLength(58)
    expect(getKeyboard('kyria')?.keys).toHaveLength(50)
    expect(getKeyboard('cradio')?.keys).toHaveLength(34)
    expect(getKeyboard('adv360pro')?.keys).toHaveLength(76)
  })

  it('splits halves evenly on symmetric splits', () => {
    for (const id of ['corne', 'glove80', 'sofle', 'lily58', 'kyria', 'adv360pro']) {
      const kb = getKeyboard(id)!
      expect(kb.hands!.filter((h) => h === 'L').length, id).toBe(kb.keys.length / 2)
    }
  })

  it('popular boards come first', () => {
    expect(KEYBOARDS[0].id).toBe('corne')
  })

  it('shield default controllers are known controllers', () => {
    const ids = new Set(CONTROLLERS.map((c) => c.id))
    expect(CONTROLLERS[0].id).toBe('nice_nano_v2')
    for (const kb of KEYBOARDS) if (kb.defaultController) expect(ids.has(kb.defaultController), kb.id).toBe(true)
  })
})
