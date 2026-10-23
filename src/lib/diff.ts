import type { Layout } from '../model/types'
import { actionLabel } from './labels'

export interface DiffEntry {
  where: string
  before: string
  after: string
}

const keyText = (l: Layout, k: Layout['layers'][number]['keys'][number] | undefined) => {
  if (!k) return '—'
  const parts = [actionLabel(k.tap, l) || '∅']
  if (k.hold) parts.push('hold ' + actionLabel(k.hold, l))
  if (k.doubleTap) parts.push('2× ' + actionLabel(k.doubleTap, l))
  if (k.tapHold) parts.push('tap-hold ' + actionLabel(k.tapHold, l))
  if (k.label) parts.push(`“${k.label}”`)
  if (k.color) parts.push(k.color)
  return parts.join(', ')
}

/** human-readable differences between two versions of a layout */
export function diffLayouts(a: Layout, b: Layout): DiffEntry[] {
  const out: DiffEntry[] = []
  if (a.name !== b.name) out.push({ where: 'Name', before: a.name, after: b.name })
  const aLayers = new Map(a.layers.map((l, i) => [l.id, { l, i }]))
  const bLayers = new Map(b.layers.map((l, i) => [l.id, { l, i }]))
  for (const [id, { l, i }] of aLayers)
    if (!bLayers.has(id)) out.push({ where: `Layer ${i}`, before: l.name, after: '(deleted)' })
  for (const [id, { l, i }] of bLayers) {
    const old = aLayers.get(id)
    if (!old) {
      out.push({ where: `Layer ${i}`, before: '(new)', after: l.name })
      continue
    }
    if (old.l.name !== l.name) out.push({ where: `Layer ${i}`, before: old.l.name, after: l.name })
    if (old.i !== i) out.push({ where: `Layer “${l.name}”`, before: `position ${old.i}`, after: `position ${i}` })
    if ((old.l.color ?? '') !== (l.color ?? ''))
      out.push({ where: `Layer “${l.name}” color`, before: old.l.color ?? 'default', after: l.color ?? 'default' })
    const n = Math.max(old.l.keys.length, l.keys.length)
    for (let k = 0; k < n; k++) {
      const x = JSON.stringify(old.l.keys[k] ?? null)
      const y = JSON.stringify(l.keys[k] ?? null)
      if (x !== y) out.push({ where: `${l.name} · key ${k}`, before: keyText(a, old.l.keys[k]), after: keyText(b, l.keys[k]) })
    }
  }
  const cmp = <T extends { id: string; name: string }>(kind: string, xs: T[], ys: T[]) => {
    const xm = new Map(xs.map((x) => [x.id, x]))
    const ym = new Map(ys.map((y) => [y.id, y]))
    for (const [id, x] of xm) if (!ym.has(id)) out.push({ where: kind, before: x.name, after: '(deleted)' })
    for (const [id, y] of ym) {
      const x = xm.get(id)
      if (!x) out.push({ where: kind, before: '(new)', after: y.name })
      else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ where: `${kind} “${y.name}”`, before: 'changed', after: 'changed' })
    }
  }
  cmp('Combo', a.combos, b.combos)
  cmp('Macro', a.macros, b.macros)
  for (const k of Object.keys(b.settings) as (keyof Layout['settings'])[])
    if (JSON.stringify(a.settings[k]) !== JSON.stringify(b.settings[k]))
      out.push({ where: `Setting ${k}`, before: String(a.settings[k]), after: String(b.settings[k]) })
  return out
}
