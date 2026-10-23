import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import type { Layout, Revision } from '../model/types'
import { defaultSettings, uid } from '../model/defaults'
import { deleteLayoutDb, loadLayouts, loadRevisions, saveLayout, saveRevisions } from './db'

const HISTORY_LIMIT = 200

export interface Selection {
  layer: number
  /** selected key positions; first one is the "primary" key shown in the editor */
  keys: number[]
}

interface History {
  past: Layout[]
  future: Layout[]
  /** coalescing key of the last edit, so typing in an input is one undo step */
  lastTag?: string
  lastAt: number
}

interface State {
  ready: boolean
  layouts: Record<string, Layout>
  revisions: Record<string, Revision[]>
  history: Record<string, History>
  selection: Selection
  clipboard: import('../model/types').KeyConfig | null

  init(): Promise<void>
  addLayout(layout: Layout): void
  deleteLayout(id: string): void
  duplicateLayout(id: string): Layout | undefined
  /** mutate a layout; `tag` coalesces consecutive edits with the same tag into one undo step */
  update(id: string, fn: (d: Draft<Layout>) => void, tag?: string): void
  undo(id: string): void
  redo(id: string): void
  select(sel: Partial<Selection>): void
  setClipboard(k: import('../model/types').KeyConfig | null): void

  loadRevisions(id: string): Promise<Revision[]>
  createRevision(id: string, message: string): Revision | undefined
  restoreRevision(id: string, revId: string): void
  deleteRevision(id: string, revId: string): void
}

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function persist(layout: Layout) {
  clearTimeout(saveTimers[layout.id])
  saveTimers[layout.id] = setTimeout(() => saveLayout(layout), 300)
}

export const useStore = create<State>()((set, get) => ({
  ready: false,
  layouts: {},
  revisions: {},
  history: {},
  selection: { layer: 0, keys: [] },
  clipboard: null,

  async init() {
    if (get().ready) return
    // fill in settings added after a layout was saved
    const all = (await loadLayouts()).map((l) => ({ ...l, settings: { ...defaultSettings(), ...l.settings } }))
    set({ ready: true, layouts: Object.fromEntries(all.map((l) => [l.id, l])) })
  },

  addLayout(layout) {
    set((s) => ({ layouts: { ...s.layouts, [layout.id]: layout } }))
    saveLayout(layout)
  },

  deleteLayout(id) {
    set((s) => {
      const layouts = { ...s.layouts }
      delete layouts[id]
      return { layouts }
    })
    deleteLayoutDb(id)
  },

  duplicateLayout(id) {
    const src = get().layouts[id]
    if (!src) return
    const copy: Layout = {
      ...structuredClone(src),
      id: uid(),
      name: `${src.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    get().addLayout(copy)
    return copy
  },

  update(id, fn, tag) {
    const cur = get().layouts[id]
    if (!cur) return
    const next = produce(cur, (d) => {
      fn(d)
      d.updatedAt = Date.now()
    })
    if (next === cur) return
    const h = get().history[id] ?? { past: [], future: [], lastAt: 0 }
    const now = Date.now()
    const coalesce = tag !== undefined && h.lastTag === tag && now - h.lastAt < 1500
    const past = coalesce ? h.past : [...h.past, cur].slice(-HISTORY_LIMIT)
    set((s) => ({
      layouts: { ...s.layouts, [id]: next },
      history: { ...s.history, [id]: { past, future: [], lastTag: tag, lastAt: now } },
    }))
    persist(next)
  },

  undo(id) {
    const h = get().history[id]
    const cur = get().layouts[id]
    if (!h || !h.past.length || !cur) return
    const prev = h.past[h.past.length - 1]
    set((s) => ({
      layouts: { ...s.layouts, [id]: prev },
      history: { ...s.history, [id]: { past: h.past.slice(0, -1), future: [cur, ...h.future], lastAt: 0 } },
    }))
    persist(prev)
  },

  redo(id) {
    const h = get().history[id]
    const cur = get().layouts[id]
    if (!h || !h.future.length || !cur) return
    const next = h.future[0]
    set((s) => ({
      layouts: { ...s.layouts, [id]: next },
      history: { ...s.history, [id]: { past: [...h.past, cur], future: h.future.slice(1), lastAt: 0 } },
    }))
    persist(next)
  },

  select(sel) {
    set((s) => ({ selection: { ...s.selection, ...sel } }))
  },

  setClipboard(k) {
    set({ clipboard: k })
  },

  async loadRevisions(id) {
    const cached = get().revisions[id]
    if (cached) return cached
    const revs = await loadRevisions(id)
    set((s) => ({ revisions: { ...s.revisions, [id]: revs } }))
    return revs
  },

  createRevision(id, message) {
    const layout = get().layouts[id]
    if (!layout) return
    const rev: Revision = {
      id: uid(),
      layoutId: id,
      createdAt: Date.now(),
      message,
      snapshot: structuredClone(layout),
    }
    const revs = [rev, ...(get().revisions[id] ?? [])]
    set((s) => ({ revisions: { ...s.revisions, [id]: revs } }))
    saveRevisions(id, revs)
    return rev
  },

  restoreRevision(id, revId) {
    const rev = get().revisions[id]?.find((r) => r.id === revId)
    if (!rev) return
    get().update(id, (d) => {
      const snap = structuredClone(rev.snapshot)
      Object.assign(d, { ...snap, id, createdAt: d.createdAt })
    })
  },

  deleteRevision(id, revId) {
    const revs = (get().revisions[id] ?? []).filter((r) => r.id !== revId)
    set((s) => ({ revisions: { ...s.revisions, [id]: revs } }))
    saveRevisions(id, revs)
  },
}))

/** layout hook + bound updater for the editor */
export function useLayout(id: string) {
  const layout = useStore((s) => s.layouts[id])
  return layout
}
