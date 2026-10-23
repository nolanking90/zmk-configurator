import { useSyncExternalStore } from 'react'

// Hash routing so the app works on GitHub Pages without server rewrites.
// Routes: #/  #/new  #/layout/<id>[/<view>]  #/share/<data>

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const snapshot = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, snapshot)
  return path.split('?')[0].split('/').filter(Boolean)
}

export function navigate(path: string) {
  window.location.hash = path
}
