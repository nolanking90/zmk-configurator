export function hexToRgb(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return
  let h = m[1]
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** black or white text, whichever reads better on `bg` */
export function contrastText(bg: string): string {
  const rgb = hexToRgb(bg)
  if (!rgb) return 'inherit'
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#1d1d24' : '#ffffff'
}

/** Oryx-like palette offered for layer and key colors */
export const PALETTE = [
  '#ffd6d6', '#ffe4c2', '#fff3b0', '#d6f5c9', '#c9f0ee', '#cfe3ff', '#e0d6ff', '#f9d4f0',
  '#ff6b6b', '#ff9f43', '#f7d046', '#5fcf73', '#36c5bd', '#4c8dff', '#8b72ff', '#e05fc4',
  '#2d3436', '#636e72', '#b2bec3', '#ffffff',
]
