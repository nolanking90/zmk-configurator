// Legend strings may embed icons as {name} tokens, e.g. "RGB {power}" (rendered by ui/Icon.tsx).

export const TOKEN = /\{([a-z-]+)\}/g

/** Spoken/plain form of each icon token, for tooltips, <option>s and text exports. */
const WORDS: Record<string, string> = {
  'play': 'Play', 'pause': 'Pause', 'play-pause': 'Play/Pause', 'stop': 'Stop', 'record': 'Rec', 'next': 'Next',
  'prev': 'Prev', 'ff': 'FF', 'rw': 'Rew', 'eject': 'Eject', 'power': 'Power', 'sun': 'Bright', 'up': 'Up',
  'down': 'Down', 'left': 'Left', 'right': 'Right', 'first': 'First', 'last': 'Last', 'enter': 'Enter',
  'globe': 'Globe', 'trans': 'Trans', 'none': 'None', 'check': 'OK', 'x': 'X', 'cycle': 'Cycle', 'mouse': 'Mouse',
  'wheel': 'Wheel', 'bluetooth': 'BT', 'space': 'Space', 'backspace': 'Bksp',
}


/** Legend as plain text (icon tokens become words). */
export function legendText(text: string): string {
  return text.replace(TOKEN, (_, n: string) => WORDS[n] ?? n).replace(/\s+/g, ' ').trim()
}

/** Visual length of a legend, counting each icon as one character (for font sizing). */
export function legendLength(text: string): number {
  return [...text.replace(TOKEN, '#')].length
}
