import type { Mod } from '../model/types'

export interface Shortcut {
  os: 'win' | 'mac'
  name: string
  label: string
  code: string
  mods: Mod[]
}

const C: Mod[] = ['LCTRL']
const CS: Mod[] = ['LCTRL', 'LSHIFT']
const G: Mod[] = ['LGUI']
const GS: Mod[] = ['LGUI', 'LSHIFT']

export const SHORTCUTS: Shortcut[] = [
  { os: 'win', name: 'Copy', label: 'Copy', code: 'C', mods: C },
  { os: 'win', name: 'Cut', label: 'Cut', code: 'X', mods: C },
  { os: 'win', name: 'Paste', label: 'Paste', code: 'V', mods: C },
  { os: 'win', name: 'Undo', label: 'Undo', code: 'Z', mods: C },
  { os: 'win', name: 'Redo', label: 'Redo', code: 'Y', mods: C },
  { os: 'win', name: 'Select all', label: 'All', code: 'A', mods: C },
  { os: 'win', name: 'Save', label: 'Save', code: 'S', mods: C },
  { os: 'win', name: 'Find', label: 'Find', code: 'F', mods: C },
  { os: 'win', name: 'New tab', label: 'New tab', code: 'T', mods: C },
  { os: 'win', name: 'Close tab', label: 'Close', code: 'W', mods: C },
  { os: 'win', name: 'Reopen tab', label: 'Reopen', code: 'T', mods: CS },
  { os: 'win', name: 'Next tab', label: 'Tab →', code: 'TAB', mods: C },
  { os: 'win', name: 'Previous tab', label: 'Tab ←', code: 'TAB', mods: CS },
  { os: 'win', name: 'Switch app', label: 'Alt-Tab', code: 'TAB', mods: ['LALT'] },
  { os: 'win', name: 'Lock screen', label: 'Lock', code: 'L', mods: G },
  { os: 'win', name: 'Screenshot', label: 'Snip', code: 'S', mods: GS },
  { os: 'win', name: 'Task manager', label: 'TaskMgr', code: 'ESC', mods: CS },
  { os: 'win', name: 'Word left', label: 'Word ←', code: 'LEFT', mods: C },
  { os: 'win', name: 'Word right', label: 'Word →', code: 'RIGHT', mods: C },

  { os: 'mac', name: 'Copy', label: 'Copy', code: 'C', mods: G },
  { os: 'mac', name: 'Cut', label: 'Cut', code: 'X', mods: G },
  { os: 'mac', name: 'Paste', label: 'Paste', code: 'V', mods: G },
  { os: 'mac', name: 'Undo', label: 'Undo', code: 'Z', mods: G },
  { os: 'mac', name: 'Redo', label: 'Redo', code: 'Z', mods: GS },
  { os: 'mac', name: 'Select all', label: 'All', code: 'A', mods: G },
  { os: 'mac', name: 'Save', label: 'Save', code: 'S', mods: G },
  { os: 'mac', name: 'Find', label: 'Find', code: 'F', mods: G },
  { os: 'mac', name: 'New tab', label: 'New tab', code: 'T', mods: G },
  { os: 'mac', name: 'Close tab', label: 'Close', code: 'W', mods: G },
  { os: 'mac', name: 'Reopen tab', label: 'Reopen', code: 'T', mods: GS },
  { os: 'mac', name: 'Spotlight', label: 'Spotlight', code: 'SPACE', mods: G },
  { os: 'mac', name: 'Switch app', label: '⌘-Tab', code: 'TAB', mods: G },
  { os: 'mac', name: 'Lock screen', label: 'Lock', code: 'Q', mods: ['LCTRL', 'LGUI'] },
  { os: 'mac', name: 'Screenshot area', label: 'Shot', code: 'N4', mods: GS },
  { os: 'mac', name: 'Word left', label: 'Word ←', code: 'LEFT', mods: ['LALT'] },
  { os: 'mac', name: 'Word right', label: 'Word →', code: 'RIGHT', mods: ['LALT'] },
  { os: 'mac', name: 'Line start', label: 'Line ←', code: 'LEFT', mods: G },
  { os: 'mac', name: 'Line end', label: 'Line →', code: 'RIGHT', mods: G },
]
