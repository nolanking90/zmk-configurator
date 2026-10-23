import { useEffect, useState } from 'react'

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
      {t === 'auto' ? '◐' : t === 'light' ? '☀' : '☾'}
    </button>
  )
}
