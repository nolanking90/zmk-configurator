import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Layout } from '../model/types'
import { uid } from '../model/defaults'

export function encodeLayout(l: Layout): string {
  return compressToEncodedURIComponent(JSON.stringify(l))
}

export function decodeLayout(s: string): Layout | null {
  try {
    const j = JSON.parse(decompressFromEncodedURIComponent(s) ?? '')
    return isLayout(j) ? j : null
  } catch {
    return null
  }
}

export function isLayout(j: unknown): j is Layout {
  const l = j as Layout
  return !!l && typeof l === 'object' && typeof l.keyboard === 'string' && Array.isArray(l.layers)
}

export function shareUrl(l: Layout): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/share/${encodeLayout(l)}`
}

/** fresh copy of a layout for adding to "my layouts" */
export function cloneAsNew(l: Layout, name?: string): Layout {
  return { ...structuredClone(l), id: uid(), name: name ?? l.name, createdAt: Date.now(), updatedAt: Date.now() }
}
