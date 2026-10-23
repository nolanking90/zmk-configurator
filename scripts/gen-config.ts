// Write a generated zmk-config repository to disk.
//
//   npx tsx scripts/gen-config.ts <out-dir> <keyboard-id> [layout.json]
//
// Without a layout file the built-in "kitchen sink" test layout is used.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { generateConfigRepo, compileKeymap } from '../src/zmk/compile.ts'
import { getKeyboard } from '../src/data/keyboards.ts'
import { kitchenSinkLayout } from '../src/zmk/fixtures/kitchenSink.ts'
import type { Layout } from '../src/model/types.ts'

const [out, kbId, layoutFile] = process.argv.slice(2)
if (!out || !kbId) {
  console.error('usage: tsx scripts/gen-config.ts <out-dir> <keyboard-id> [layout.json]')
  process.exit(2)
}
const kb = getKeyboard(kbId)
if (!kb) {
  console.error(`unknown keyboard ${kbId}`)
  process.exit(2)
}
const layout: Layout = layoutFile ? JSON.parse(readFileSync(layoutFile, 'utf8')) : kitchenSinkLayout(kb.id, kb.keys.length)
if (process.env.SETTINGS) Object.assign(layout.settings, JSON.parse(process.env.SETTINGS))

rmSync(out, { recursive: true, force: true })
const files = generateConfigRepo(layout, kb)
for (const [path, content] of Object.entries(files)) {
  const p = join(out, path)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
}
for (const w of compileKeymap(layout, kb).warnings) console.warn(`warning: ${w}`)
console.log(Object.keys(files).join('\n'))
