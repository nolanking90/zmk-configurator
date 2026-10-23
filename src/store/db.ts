import { createStore, del, entries, get, set } from 'idb-keyval'
import type { Layout, Revision } from '../model/types'

const layoutsDb = createStore('zmk-configurator', 'layouts')
const revisionsDb = createStore('zmk-configurator-revisions', 'revisions')

export async function loadLayouts(): Promise<Layout[]> {
  try {
    const all = await entries<string, Layout>(layoutsDb)
    return all.map(([, v]) => v)
  } catch {
    return []
  }
}

export const saveLayout = (layout: Layout) => set(layout.id, layout, layoutsDb).catch(() => {})
export const deleteLayoutDb = async (id: string) => {
  await del(id, layoutsDb).catch(() => {})
  await del(id, revisionsDb).catch(() => {})
}

export async function loadRevisions(layoutId: string): Promise<Revision[]> {
  try {
    return (await get<Revision[]>(layoutId, revisionsDb)) ?? []
  } catch {
    return []
  }
}

export const saveRevisions = (layoutId: string, revs: Revision[]) =>
  set(layoutId, revs, revisionsDb).catch(() => {})
