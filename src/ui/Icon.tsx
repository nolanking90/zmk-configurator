// One consistent line-icon set, drawn as inline SVG so legends look the same in
// every browser and font (Unicode symbols like ⏯ ☀ ⏻ render as mismatched emoji).

const P: Record<string, React.ReactNode> = {
  'play': <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />,
  'pause': <><rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  'play-pause': <><path d="M3 6v12l8-6z" fill="currentColor" stroke="none" /><rect x="13.5" y="6" width="2.8" height="12" rx=".8" fill="currentColor" stroke="none" /><rect x="18.5" y="6" width="2.8" height="12" rx=".8" fill="currentColor" stroke="none" /></>,
  'stop': <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />,
  'record': <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  'next': <><path d="M5 6v12l9-6z" fill="currentColor" stroke="none" /><rect x="16" y="6" width="2.8" height="12" rx=".8" fill="currentColor" stroke="none" /></>,
  'prev': <><path d="M19 6v12l-9-6z" fill="currentColor" stroke="none" /><rect x="5.2" y="6" width="2.8" height="12" rx=".8" fill="currentColor" stroke="none" /></>,
  'ff': <><path d="M3 6v12l9-6z" fill="currentColor" stroke="none" /><path d="M12 6v12l9-6z" fill="currentColor" stroke="none" /></>,
  'rw': <><path d="M21 6v12l-9-6z" fill="currentColor" stroke="none" /><path d="M12 6v12l-9-6z" fill="currentColor" stroke="none" /></>,
  'eject': <><path d="M12 5l7 8H5z" fill="currentColor" stroke="none" /><rect x="5" y="16" width="14" height="2.8" rx=".8" fill="currentColor" stroke="none" /></>,
  'power': <><path d="M12 3v8" /><path d="M6.3 7.5a8 8 0 1 0 11.4 0" /></>,
  'sun': <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  'moon': <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  'contrast': <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></>,
  'up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'down': <path d="M12 5v14M6 13l6 6 6-6" />,
  'left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  'right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'first': <path d="M5 5v14M19 12H9M14 7l-5 5 5 5" />,
  'last': <path d="M19 5v14M5 12h10M10 7l5 5-5 5" />,
  'enter': <path d="M19 5v7a3 3 0 0 1-3 3H6M10 11l-4 4 4 4" />,
  'globe': <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  'trans': <path d="M6 8h12l-6 9z" />,
  'none': <><circle cx="12" cy="12" r="7" /><path d="M7 17L17 7" /></>,
  'check': <path d="M5 12.5l4.5 4.5L19 7" />,
  'x': <path d="M6 6l12 12M18 6L6 18" />,
  'undo': <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  'redo': <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
  'reset': <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  'cycle': <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.6M20 3v5.6h-5.6" />,
  'ccw': <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 3v5.6h5.6" />,
  'cw': <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.6M20 3v5.6h-5.6" />,
  'warning': <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></>,
  'spinner': <path d="M12 3a9 9 0 1 1-9 9" />,
  'external': <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  'download': <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  'keyboard': <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>,
  'lock': <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  'unlock': <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.8-1.2" /></>,
  'dot': <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  'mouse': <><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /></>,
  'wheel': <><rect x="7" y="3" width="10" height="18" rx="5" /><path d="M12 6.5v3M10 13l2 2 2-2" /></>,
  'bluetooth': <path d="M7 7l10 10-5 4V3l5 4L7 17" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'space': <path d="M4 10v4h16v-4" />,
  'backspace': <><path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></>,
}

export type IconName = keyof typeof P

export const ICON_NAMES = Object.keys(P)

export function Icon({ name, size = '1em', title, style }: { name: string; size?: number | string; title?: string; style?: React.CSSProperties }) {
  const body = P[name]
  if (!body) return <>{name}</>
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      style={{ verticalAlign: '-0.14em', flex: 'none', ...style }}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  )
}

/** Spoken/plain form of each icon token, for tooltips, <option>s and text exports. */
const WORDS: Record<string, string> = {
  'play': 'Play', 'pause': 'Pause', 'play-pause': 'Play/Pause', 'stop': 'Stop', 'record': 'Rec', 'next': 'Next',
  'prev': 'Prev', 'ff': 'FF', 'rw': 'Rew', 'eject': 'Eject', 'power': 'Power', 'sun': 'Bright', 'up': 'Up',
  'down': 'Down', 'left': 'Left', 'right': 'Right', 'first': 'First', 'last': 'Last', 'enter': 'Enter',
  'globe': 'Globe', 'trans': 'Trans', 'none': 'None', 'check': 'OK', 'x': 'X', 'cycle': 'Cycle', 'mouse': 'Mouse',
  'wheel': 'Wheel', 'bluetooth': 'BT', 'space': 'Space', 'backspace': 'Bksp',
}

const TOKEN = /\{([a-z-]+)\}/g

/** Legend strings may embed icons as {name} tokens, e.g. "RGB {power}". */
export function Legend({ text }: { text: string }) {
  if (!text.includes('{')) return <>{text}</>
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    out.push(<Icon key={m.index} name={m[1]} size="1.3em" />)
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.12em' }}>{out}</span>
}

/** Legend as plain text (icon tokens become words). */
export function legendText(text: string): string {
  return text.replace(TOKEN, (_, n: string) => WORDS[n] ?? n).replace(/\s+/g, ' ').trim()
}

/** Visual length of a legend, counting each icon as one character (for font sizing). */
export function legendLength(text: string): number {
  return [...text.replace(TOKEN, '#')].length
}
