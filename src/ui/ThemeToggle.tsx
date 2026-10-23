import { useEffect, useState } from 'react'
import { Icon } from './Icon'

type Theme = 'auto' | 'light' | 'dark'
const KEY = 'zmkc.theme'

const read = (): Theme => {
  try { return (localStorage.getItem(KEY) as Theme) || 'auto' } catch { return 'auto' }
}

export function applyTheme(t: Theme = read()) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(read)
  useEffect(() => {
    applyTheme(t)
    try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  }, [t])
  const next: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
  return (
    <button className="ghost" onClick={() => setT(next[t])} title={`Theme: ${t}`}>
      <Icon name={t === 'auto' ? 'contrast' : t === 'light' ? 'sun' : 'moon'} />
    </button>
  )
}
