// Bundles each catalog keyboard's stock ZMK keymap so new layouts can start from it.
// usage: node scripts/gen-default-keymaps.mjs <zmk-clone> [out.json]
import fs from 'node:fs'
import path from 'node:path'

const zmk = process.argv[2]
const out = process.argv[3] ?? 'src/data/defaultKeymaps.json'
const kbs = JSON.parse(fs.readFileSync('src/data/keyboards.json', 'utf8'))

const all = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.keymap')) all.push(p)
  }
}
walk(path.join(zmk, 'app/boards'))

const result = {}
for (const kb of kbs) {
  const names = [kb.zmkName, ...(kb.boards ?? []), ...(kb.shields ?? [])]
  const src = kb.source ? path.dirname(path.join(zmk, kb.source)) : null
  let hit = null
  for (const n of names) {
    const cands = all.filter((f) => path.basename(f) === `${n}.keymap`)
    hit = cands.find((f) => src && f.startsWith(src)) ?? cands[0]
    if (hit) break
  }
  if (hit) result[kb.id] = fs.readFileSync(hit, 'utf8')
  else console.warn('no default keymap for', kb.id)
}
fs.writeFileSync(out, JSON.stringify(result))
console.log(`${Object.keys(result).length}/${kbs.length} keymaps, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`)
