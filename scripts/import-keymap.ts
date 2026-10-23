// Import a .keymap (and optional .conf) into a layout JSON.
//
//   npx tsx scripts/import-keymap.ts <keyboard-id> <file.keymap> [file.conf] > layout.json
import { readFileSync } from 'node:fs'
import { importConf, importKeymap } from '../src/zmk/importKeymap.ts'
import { getKeyboard } from '../src/data/keyboards.ts'

const [kbId, keymapFile, confFile] = process.argv.slice(2)
const kb = kbId ? getKeyboard(kbId) : undefined
if (!kb || !keymapFile) {
  console.error('usage: tsx scripts/import-keymap.ts <keyboard-id> <file.keymap> [file.conf]')
  process.exit(2)
}
const { layout, warnings } = importKeymap(readFileSync(keymapFile, 'utf8'), kb)
if (confFile) layout.settings = importConf(readFileSync(confFile, 'utf8'), layout.settings, { split: kb.split })
for (const w of warnings) console.error(`warning: ${w}`)
console.log(JSON.stringify(layout, null, 2))
