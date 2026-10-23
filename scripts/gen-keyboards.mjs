#!/usr/bin/env node
// Generates src/data/keyboards.json from a ZMK firmware checkout.
//
//   node scripts/gen-keyboards.mjs <path-to-zmk-clone> [out.json]
//
// The clone is treated as data only: we read *.zmk.yml metadata, devicetree
// (.dts/.dtsi/.overlay) and .keymap files with a tiny hand-rolled parser and
// never execute anything from it.
//
// For every shield/board whose metadata lists the `keys` feature we:
//   1. preprocess the entry devicetree file (left half for splits), resolving
//      `#include "..."` relative to the file and `#include <layouts/...>`
//      against app/dts/;
//   2. parse the devicetree into nodes, applying `&label { ... }` overrides;
//   3. emit one KeyboardDef per `zmk,physical-layout` node that has a matrix
//      transform (the chosen one first, using the plain id);
//   4. if there is no physical layout, derive a grid from the default matrix
//      transform's RC(row, col) entries.
// Key order is the order of the physical layout's `keys` (which ZMK requires
// to match the transform's `map`, i.e. the binding order in the keymap).

import fs from 'node:fs'
import path from 'node:path'

const zmkRoot = process.argv[2]
const outFile = process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'data', 'keyboards.json')
if (!zmkRoot) {
  console.error('usage: node scripts/gen-keyboards.mjs <zmk-clone> [out.json]')
  process.exit(1)
}
const APP = path.join(zmkRoot, 'app')
const DTS_INCLUDE = path.join(APP, 'dts')

// Shields/boards with the `keys` feature that are not real keyboards.
const EXCLUDE = new Set(['zmk_uno', 'tester_pro_micro', 'tester_xiao', 'minivan_studio_tester', 'settings_reset'])

// Popular boards first (by id), everything else alphabetical by name.
const POPULAR = [
  'corne', 'corne_5col', 'sofle', 'lily58', 'kyria', 'kyria_5col', 'kyria_rev2', 'kyria_rev2_5col', 'kyria_rev3',
  'glove80', 'cradio', 'ferris_rev02', 'adv360pro', 'corneish_zen_v2', 'corneish_zen_v1', 'lotus58',
  'splitkb_aurora_corne', 'splitkb_aurora_corne_5col', 'splitkb_aurora_sofle', 'splitkb_aurora_lily58',
  'splitkb_aurora_sweep', 'reviung41', 'nice60', 'planck_rev6', 'bt60_v1', 'bt60_v1_hs', 'bt60_v2', 'jorne',
  'microdox', 'microdox_v2', 'iris', 'chalice', 'osprette',
]

// Pro Micro / XIAO / M.2 interconnect -> default controller board at this ZMK ref.
const DEFAULT_CONTROLLER = {
  pro_micro: 'nice_nano_v2',
  seeed_xiao: 'seeeduino_xiao_ble',
  makerdiary_nrf52840_m2: 'nrf52840_m2',
}

const warnings = []
const warn = (m) => { warnings.push(m); console.warn('warn:', m) }

// ---------------------------------------------------------------- utilities

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** Minimal YAML reader for the flat zmk.yml metadata format. */
function readZmkYml(file) {
  const out = {}
  let listKey = null
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.replace(/\s+#.*$/, '')
    if (!line.trim()) continue
    const item = line.match(/^\s+-\s*(.+)$/)
    if (item && listKey) { out[listKey].push(unquote(item[1].trim())); continue }
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!kv) continue
    const [, k, v] = kv
    if (v === '') { out[k] = []; listKey = k; continue }
    listKey = null
    const inline = v.match(/^\[(.*)\]$/)
    out[k] = inline ? inline[1].split(',').map((s) => unquote(s.trim())).filter(Boolean) : unquote(v.trim())
  }
  return out
}
const unquote = (s) => s.replace(/^["']|["']$/g, '')

function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '"') {
      const j = src.indexOf('"', i + 1)
      const end = j < 0 ? src.length : j + 1
      out += src.slice(i, end)
      i = end
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2)
      const chunk = src.slice(i, j < 0 ? src.length : j + 2)
      out += chunk.replace(/[^\n]/g, '') // keep line count
      i = j < 0 ? src.length : j + 2
    } else {
      out += c
      i++
    }
  }
  return out
}

/**
 * Minimal C preprocessor: resolves the includes we care about, records
 * object-like and function-like #defines, and honours simple conditionals
 * (#ifdef/#ifndef/#if defined(X)/#elif/#else/#endif).
 */
function preprocess(file, seen = new Set(), defines = new Map()) {
  if (seen.has(file)) return ''
  seen.add(file)
  const src = stripComments(fs.readFileSync(file, 'utf8')).replace(/\\\n/g, ' ')
  let out = ''
  const stack = [] // { active, taken }
  const active = () => stack.every((f) => f.active)
  for (const line of src.split('\n')) {
    const d = line.match(/^\s*#\s*(\w+)\s*(.*?)\s*$/)
    if (d) {
      const [, dir, arg] = d
      if (dir === 'ifdef' || dir === 'ifndef') {
        const v = defines.has(arg) === (dir === 'ifdef')
        stack.push({ active: v, taken: v })
        continue
      }
      if (dir === 'if') { const v = evalCond(arg, defines, file); stack.push({ active: v, taken: v }); continue }
      if (dir === 'elif') {
        const top = stack[stack.length - 1]
        if (top) { const v = !top.taken && evalCond(arg, defines, file); top.active = v; top.taken ||= v }
        continue
      }
      if (dir === 'else') { const top = stack[stack.length - 1]; if (top) { top.active = !top.taken; top.taken = true } continue }
      if (dir === 'endif') { stack.pop(); continue }
      if (!active()) continue
      if (dir === 'include') {
        const inc = arg.match(/^([<"])([^>"]+)[>"]/)
        if (!inc) continue
        const [, kind, name] = inc
        const candidates = kind === '"'
          ? [path.join(path.dirname(file), name)]
          : name.startsWith('layouts/') ? [path.join(DTS_INCLUDE, name)] : []
        const hit = candidates.find((p) => fs.existsSync(p))
        if (hit) out += preprocess(hit, seen, defines) + '\n'
        continue
      }
      if (dir === 'define') {
        const fn = arg.match(/^([A-Za-z_]\w*)\(([^)]*)\)\s*(.*)$/)
        if (fn) defines.set(fn[1], { params: fn[2].split(',').map((x) => x.trim()).filter(Boolean), body: fn[3] })
        else {
          const obj = arg.match(/^([A-Za-z_]\w*)\s*(.*)$/)
          if (obj) defines.set(obj[1], obj[2])
        }
        continue
      }
      if (dir === 'undef') { defines.delete(arg); continue }
      continue // other directives ignored
    }
    if (active()) out += line + '\n'
  }
  return out
}

function evalCond(expr, defines, file) {
  const e = expr
    .replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => (defines.has(n) ? '1' : '0'))
    .replace(/defined\s+(\w+)/g, (_, n) => (defines.has(n) ? '1' : '0'))
    .replace(/\b[A-Za-z_]\w*\b/g, (n) => (typeof defines.get(n) === 'string' && /^\d+$/.test(defines.get(n)) ? defines.get(n) : '0'))
  if (!/^[\d\s()!&|<>=+\-*/]+$/.test(e)) { warn(`${file}: cannot evaluate #if ${expr}, assuming true`); return true }
  return Boolean(Function(`"use strict"; return (${e})`)())
}

function expandDefines(text, defines) {
  if (!defines.size) return text
  for (let pass = 0; pass < 8; pass++) {
    let next = ''
    let i = 0
    const re = /\b[A-Za-z_]\w*\b/g
    let m
    while ((m = re.exec(text))) {
      const def = defines.get(m[0])
      if (def === undefined) continue
      if (typeof def === 'string') {
        next += text.slice(i, m.index) + def
        i = m.index + m[0].length
        continue
      }
      // function-like: needs "(" args ")"
      let j = m.index + m[0].length
      while (/\s/.test(text[j] ?? '')) j++
      if (text[j] !== '(') continue
      let depth = 0
      let k = j
      const args = []
      let cur = ''
      for (; k < text.length; k++) {
        const c = text[k]
        if (c === '(') { if (depth++ === 0) continue }
        if (c === ')') { if (--depth === 0) break }
        if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue }
        cur += c
      }
      args.push(cur.trim())
      let body = def.body
      def.params.forEach((p, idx) => { body = body.replace(new RegExp(`\\b${p}\\b`, 'g'), args[idx] ?? '') })
      next += text.slice(i, m.index) + body
      i = k + 1
      re.lastIndex = i
    }
    next += text.slice(i)
    if (next === text) break
    text = next
  }
  return text
}

// ------------------------------------------------------- devicetree parser

/**
 * Parses devicetree source into { nodes: Map<labelOrPath, node>, chosen }.
 * node = { name, label, props: {name: raw}, children: [] }
 */
function parseDts(src) {
  let i = 0
  const labels = new Map()
  const root = { name: '/', props: {}, children: [] }
  const overrides = []

  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++ }
  const readUntilTop = (stopChars) => {
    // read raw text until one of stopChars at depth 0 (outside <> "" () [])
    let depth = 0
    let s = ''
    while (i < src.length) {
      const c = src[i]
      if (c === '"') {
        const j = src.indexOf('"', i + 1)
        s += src.slice(i, j + 1)
        i = j + 1
        continue
      }
      if (c === '<' || c === '(' || c === '[') depth++
      else if (c === '>' || c === ')' || c === ']') depth--
      else if (depth === 0 && stopChars.includes(c)) break
      s += c
      i++
    }
    return s
  }

  function parseBody(node) {
    // assumes we are just after '{'
    for (;;) {
      ws()
      if (i >= src.length) return
      if (src[i] === '}') { i++; ws(); if (src[i] === ';') i++; return }
      if (src[i] === ';') { i++; continue }
      const head = readUntilTop(['{', ';', '='])
      const c = src[i]
      if (c === '=') {
        i++
        const value = readUntilTop([';'])
        i++
        node.props[head.trim()] = value.trim()
      } else if (c === ';') {
        i++
        const h = head.trim()
        if (h.startsWith('/delete-')) continue
        if (h) node.props[h] = true
      } else if (c === '{') {
        i++
        const child = makeNode(head.trim())
        node.children.push(child)
        parseBody(child)
      } else return
    }
  }

  function makeNode(head) {
    // "label: name@addr" or "label1: label2: name"
    const parts = head.split(':').map((s) => s.trim())
    const name = parts.pop()
    const node = { name, labels: parts, props: {}, children: [] }
    for (const l of parts) labels.set(l, node)
    return node
  }

  while (i < src.length) {
    ws()
    if (i >= src.length) break
    if (src.startsWith('/dts-v1/', i)) { readUntilTop([';']); i++; continue }
    if (src[i] === '/' && src.slice(i).match(/^\/\s*\{/)) {
      i = src.indexOf('{', i) + 1
      parseBody(root)
      continue
    }
    if (src[i] === '&') {
      const m = src.slice(i).match(/^&([A-Za-z_][\w]*)\s*\{/)
      if (m) {
        i += m[0].length
        const node = { name: m[1], labels: [], props: {}, children: [] }
        parseBody(node)
        overrides.push({ label: m[1], node })
        continue
      }
    }
    if (src.startsWith('/delete-node/', i) || src.startsWith('/omit-if-no-ref/', i)) {
      readUntilTop([';', '{'])
      if (src[i] === '{') { i++; parseBody({ props: {}, children: [] }) } else i++
      continue
    }
    // unknown top-level token: skip to next ';'
    readUntilTop([';', '{'])
    if (src[i] === '{') { i++; parseBody({ props: {}, children: [] }) } else i++
  }

  // merge duplicate root-level nodes with the same name (multiple `/ {}` blocks)
  const all = []
  const visit = (n) => { all.push(n); n.children.forEach(visit) }
  visit(root)
  for (const { label, node } of overrides) {
    const target = labels.get(label)
    if (!target) continue
    Object.assign(target.props, node.props)
    target.children.push(...node.children)
    node.children.forEach(visit)
  }
  const chosen = {}
  for (const n of all) if (n.name === 'chosen') Object.assign(chosen, n.props)
  return { all, labels, chosen }
}

const compatibleOf = (n) => (typeof n.props.compatible === 'string' ? n.props.compatible.replace(/"/g, '') : '')
const refOf = (v) => (typeof v === 'string' ? (v.match(/&([A-Za-z_]\w*)/) || [])[1] : undefined)
const labelOf = (n) => n.labels?.[0] ?? n.name

function evalNum(expr) {
  const e = expr.trim().replace(/(^|[^\w.])0+(\d)/g, '$1$2') // "000"/"03": decimal intent
  if (!/^[\d\s+\-*/()xa-fA-F]+$/.test(e)) throw new Error(`non-numeric cell: ${e}`)
  // only digits/operators/parens remain, safe to evaluate
  return Function(`"use strict"; return (${e})`)()
}

/** Split the inside of a <...> cell list into top-level tokens. */
function cellTokens(s) {
  const toks = []
  let depth = 0
  let cur = ''
  for (const c of s) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (/\s/.test(c) && depth === 0) { if (cur) toks.push(cur); cur = '' } else cur += c
  }
  if (cur) toks.push(cur)
  return toks
}

function parseKeys(raw) {
  const keys = []
  const re = /<\s*&key_physical_attrs([^>]*)>/g
  let m
  while ((m = re.exec(raw))) {
    const nums = cellTokens(m[1]).map(evalNum)
    if (nums.length !== 7) throw new Error(`expected 7 cells, got ${nums.length}: ${m[1]}`)
    const [w, h, x, y, r, rx, ry] = nums
    keys.push({ w, h, x, y, r, rx, ry })
  }
  return keys
}

function parseMap(raw) {
  const out = []
  const re = /RC\(\s*(\d+)\s*,\s*(\d+)\s*\)/g
  let m
  while ((m = re.exec(raw))) out.push({ r: +m[1], c: +m[2] })
  return out
}

function cellInt(v) {
  if (typeof v !== 'string') return undefined
  const m = v.match(/<\s*([^>]+)>/)
  return m ? evalNum(m[1]) : undefined
}

function loadDts(file) {
  const defines = new Map()
  const src = preprocess(file, new Set(), defines)
  return parseDts(expandDefines(src, defines))
}

// ---------------------------------------------------------- keymap check

function countBindings(keymapFile) {
  if (!keymapFile || !fs.existsSync(keymapFile)) return undefined
  const defines = new Map()
  const src = preprocess(keymapFile, new Set(), defines)
  const dt = parseDts(expandDefines(src, defines))
  const km = dt.all.find((n) => compatibleOf(n) === 'zmk,keymap')
  const layer = km?.children.find((c) => typeof c.props.bindings === 'string')
  if (!layer) return undefined
  return (layer.props.bindings.match(/&/g) || []).length
}

function countSensorBindings(keymapFile) {
  if (!keymapFile || !fs.existsSync(keymapFile)) return 0
  const defines = new Map()
  const src = preprocess(keymapFile, new Set(), defines)
  const dt = parseDts(expandDefines(src, defines))
  const km = dt.all.find((n) => compatibleOf(n) === 'zmk,keymap')
  const layer = km?.children.find((c) => typeof c.props['sensor-bindings'] === 'string')
  return layer ? (layer.props['sensor-bindings'].match(/&/g) || []).length : 0
}

// ------------------------------------------------------------- geometry

const round = (v) => Math.round(v * 1000) / 1000

function keyCenter(k) {
  const cx = k.x + (k.w ?? 1) / 2
  const cy = k.y + (k.h ?? 1) / 2
  if (!k.r) return [cx, cy]
  const a = (k.r * Math.PI) / 180
  const dx = cx - (k.rx ?? 0)
  const dy = cy - (k.ry ?? 0)
  return [(k.rx ?? 0) + dx * Math.cos(a) - dy * Math.sin(a), (k.ry ?? 0) + dx * Math.sin(a) + dy * Math.cos(a)]
}

function normalize(rawKeys) {
  // raw values are centi-units; convert, then shift so the min corner is 0
  const keys = rawKeys.map((k) => ({
    x: k.x / 100, y: k.y / 100, w: k.w / 100, h: k.h / 100, r: k.r / 100, rx: k.rx / 100, ry: k.ry / 100,
  }))
  const minX = Math.min(...keys.map((k) => k.x))
  const minY = Math.min(...keys.map((k) => k.y))
  return keys.map((k) => {
    const o = { x: round(k.x - minX), y: round(k.y - minY) }
    if (k.w !== 1) o.w = round(k.w)
    if (k.h !== 1) o.h = round(k.h)
    if (k.r) {
      o.r = round(k.r)
      o.rx = round(k.rx - minX)
      o.ry = round(k.ry - minY)
    }
    return o
  })
}

function handsByMidpoint(keys) {
  const xs = keys.map((k) => keyCenter(k)[0])
  const sorted = [...xs].sort((a, b) => a - b)
  // split at the largest gap between neighbouring key centers if there is a clear one,
  // otherwise at the midpoint of the extent
  let mid = (sorted[0] + sorted[sorted.length - 1]) / 2
  let best = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1]
    const center = (sorted[i] + sorted[i - 1]) / 2
    const lo = sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * 0.3
    const hi = sorted[0] + (sorted[sorted.length - 1] - sorted[0]) * 0.7
    if (gap > best && center > lo && center < hi) { best = gap; if (gap > 1.2) mid = center }
  }
  return xs.map((x) => (x < mid ? 'L' : 'R'))
}

// -------------------------------------------------------------- main

const ymls = walk(path.join(APP, 'boards')).filter((f) => f.endsWith('.zmk.yml'))
const metas = ymls.map((f) => ({ file: f, ...readZmkYml(f) }))

// Board dirs with a keymap but no keys-feature metadata (e.g. dz60rgb).
const covered = new Set(metas.filter((m) => m.type === 'board').map((m) => path.dirname(m.file)))
for (const dir of fs.readdirSync(path.join(APP, 'boards', 'arm'))) {
  const d = path.join(APP, 'boards', 'arm', dir)
  if (covered.has(d)) continue
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith('.dts')) continue
    const board = f.slice(0, -4)
    if (fs.existsSync(path.join(d, `${board}.keymap`))) {
      metas.push({ file: path.join(d, `${board}.zmk.yml`), id: board, name: board, type: 'board', features: ['keys'], synthesized: true })
    }
  }
}
const NAME_OVERRIDES = { dz60rgb_rev1: 'DZ60RGB Rev1' }

const controllers = metas
  .filter((m) => m.type === 'board' && Array.isArray(m.exposes) && m.exposes.some((e) => e in DEFAULT_CONTROLLER))
  .map((m) => ({ id: m.id, name: m.name, interconnect: m.exposes.find((e) => e in DEFAULT_CONTROLLER) }))

const defs = []
const skipped = []

for (const meta of metas) {
  if (!['shield', 'board'].includes(meta.type)) continue
  if (!(meta.features ?? []).includes('keys')) continue
  if (EXCLUDE.has(meta.id)) { skipped.push(`${meta.id} (excluded: test/dev shield)`); continue }
  const dir = path.dirname(meta.file)
  const rel = (p) => path.relative(zmkRoot, p)
  const siblings = Array.isArray(meta.siblings) && meta.siblings.length ? meta.siblings : [meta.id]
  const split = siblings.length > 1
  const ext = meta.type === 'shield' ? '.overlay' : '.dts'
  const entryFiles = siblings.map((s) => path.join(dir, s + ext))
  const missing = entryFiles.filter((f) => !fs.existsSync(f))
  if (missing.length) { skipped.push(`${meta.id} (missing ${missing.map(rel).join(', ')})`); continue }

  let dt
  try { dt = loadDts(entryFiles[0]) } catch (e) { skipped.push(`${meta.id} (parse error: ${e.message})`); continue }

  // right-half column offset, for hand detection
  let colOffset
  if (split) {
    try {
      const rdt = loadDts(entryFiles[entryFiles.length - 1])
      for (const n of rdt.all) {
        if (compatibleOf(n) === 'zmk,matrix-transform' && n.props['col-offset']) {
          colOffset ??= {}
          colOffset[labelOf(n)] = cellInt(n.props['col-offset'])
        }
      }
    } catch (e) { warn(`${meta.id}: right half parse error ${e.message}`) }
  }

  const transforms = new Map()
  for (const n of dt.all) {
    if (compatibleOf(n) === 'zmk,matrix-transform') transforms.set(labelOf(n), { node: n, map: parseMap(String(n.props.map ?? '')) })
  }
  const layouts = dt.all.filter((n) => compatibleOf(n) === 'zmk,physical-layout')
  const chosenLayout = refOf(dt.chosen['zmk,physical-layout'])
  const chosenTransform = refOf(dt.chosen['zmk,matrix-transform'])

  const zmkName = meta.type === 'shield' ? meta.id : split ? path.basename(dir) : meta.id
  const keymapFile = [zmkName, meta.id, siblings[0], path.basename(dir)]
    .map((n) => path.join(dir, `${n}.keymap`))
    .find((f) => fs.existsSync(f))
  const bindingCount = countBindings(keymapFile)
  // rotary encoders: entries of the zmk,keymap-sensors node, else the stock keymap's sensor-bindings
  const sensorsNode = dt.all.find((n) => compatibleOf(n) === 'zmk,keymap-sensors')
  const encoders = (sensorsNode && typeof sensorsNode.props.sensors === 'string'
    ? (sensorsNode.props.sensors.match(/&/g) || []).length
    : 0) || countSensorBindings(keymapFile)
  const baseName = NAME_OVERRIDES[meta.id] ?? meta.name
  const common = {
    zmkName,
    kind: meta.type,
    ...(meta.type === 'shield'
      ? { shields: siblings, defaultController: DEFAULT_CONTROLLER[(meta.requires ?? [])[0]] ?? 'nice_nano_v2' }
      : { boards: siblings }),
    split,
    ...(encoders ? { encoders } : {}),
  }

  const hands = (keys, map, transformLabel) => {
    if (split && colOffset && map?.length === keys.length) {
      const off = colOffset[transformLabel] ?? Object.values(colOffset)[0]
      if (off !== undefined) return map.map(({ c }) => (c >= off ? 'R' : 'L'))
    }
    return handsByMidpoint(keys)
  }

  if (layouts.length) {
    // chosen layout first, then the rest in file order
    const ordered = [...layouts].sort((a, b) => (labelOf(b) === chosenLayout) - (labelOf(a) === chosenLayout))
    const defaultLabel = labelOf(ordered[0])
    if (!chosenLayout && layouts.length > 1) warn(`${meta.id}: no chosen physical layout, using ${defaultLabel}`)
    for (const node of ordered) {
      const label = labelOf(node)
      const isDefault = label === defaultLabel
      let tLabel = refOf(node.props.transform)
      if (!tLabel && layouts.length === 1) tLabel = chosenTransform ?? (transforms.size === 1 ? [...transforms.keys()][0] : undefined)
      const t = tLabel ? transforms.get(tLabel) : undefined
      if (!t) {
        skipped.push(`${meta.id}/${label} (physical layout without a matrix transform)`)
        continue
      }
      let raw
      try { raw = parseKeys(String(node.props.keys ?? '')) } catch (e) { skipped.push(`${meta.id}/${label} (${e.message})`); continue }
      if (!raw.length) { skipped.push(`${meta.id}/${label} (no keys)`); continue }
      let keys = normalize(raw)
      let fromGrid = false
      if (t.map.length && t.map.length !== raw.length) {
        // upstream data bug: key order can't be trusted, fall back to the transform grid
        warn(`${meta.id}/${label}: ${raw.length} physical keys but transform ${tLabel} has ${t.map.length}; using transform grid`)
        keys = textGridKeys(t.node.props.map, t.map.length) ?? gridKeys(t.map, split ? colOffsetFor(tLabel) : undefined)
        fromGrid = true
      }
      if (isDefault && bindingCount !== undefined && bindingCount !== keys.length) {
        warn(`${meta.id}/${label}: ${keys.length} keys but default keymap has ${bindingCount} bindings`)
      }
      const displayName = String(node.props['display-name'] ?? '').replace(/"/g, '')
      const suffix = isDefault ? '' : variantSuffix(label, displayName)
      defs.push({
        id: isDefault ? meta.id : `${meta.id}_${suffix}`,
        name: isDefault ? baseName : `${baseName} (${displayName || suffix})`,
        ...common,
        keys,
        hands: hands(keys, t.map, tLabel),
        ...(isDefault ? {} : { notes: `/ { chosen { zmk,physical-layout = &${label}; }; };` }),
        source: rel((fromGrid ? sourceFileOf(entryFiles[0], tLabel) : sourceFileOf(entryFiles[0], label)) ?? entryFiles[0]),
        layoutLabel: label,
        keymapBindings: bindingCount,
        gridFromTransform: fromGrid,
      })
    }
  } else {
    const tLabel = chosenTransform ?? [...transforms.keys()][0]
    const t = tLabel ? transforms.get(tLabel) : undefined
    let keys
    let source
    let map
    if (t && t.map.length) {
      keys = textGridKeys(t.node.props.map, t.map.length) ?? gridKeys(t.map, split ? colOffsetFor(tLabel) : undefined)
      map = t.map
      source = sourceFileOf(entryFiles[0], tLabel)
    } else {
      // no transform: ZMK maps kscan positions row-major (row * columns + col)
      const ks = dt.all.find((n) => /^zmk,kscan-gpio-(matrix|direct)$/.test(compatibleOf(n)) &&
        (refOf(dt.chosen['zmk,kscan']) ? (n.labels ?? []).includes(refOf(dt.chosen['zmk,kscan'])) : true))
      const count = (v) => (typeof v === 'string' ? (v.match(/&/g) || []).length : 0)
      if (ks && compatibleOf(ks) === 'zmk,kscan-gpio-matrix') {
        const rows = count(ks.props['row-gpios'])
        const cols = count(ks.props['col-gpios'])
        map = []
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) map.push({ r, c })
      } else if (ks) {
        map = Array.from({ length: count(ks.props['input-gpios']) }, (_, c) => ({ r: 0, c }))
      }
      if (!map || !map.length) { skipped.push(`${meta.id} (no physical layout, matrix transform or kscan)`); continue }
      keys = gridKeys(map)
      source = sourceFileOf(entryFiles[0], labelOf(ks))
    }
    if (bindingCount !== undefined && bindingCount !== keys.length) {
      skipped.push(`${meta.id} (derived grid has ${keys.length} keys but keymap has ${bindingCount} bindings)`)
      continue
    }
    defs.push({
      id: meta.id,
      name: baseName,
      ...common,
      keys,
      hands: hands(keys, map, tLabel),
      source: rel(source ?? entryFiles[0]),
      gridFromTransform: true,
      keymapBindings: bindingCount,
    })
  }

  function colOffsetFor(tLabel) {
    return colOffset ? colOffset[tLabel] ?? Object.values(colOffset)[0] : undefined
  }
}

/**
 * Grid geometry from how the transform's `map` is laid out as text: authors
 * format it to look like the keyboard (one line per row, gaps and indentation
 * for splits/thumbs), which is far closer to the physical shape than matrix
 * RC coordinates. Returns undefined if the text doesn't look like a layout.
 */
function textGridKeys(rawMap, expected) {
  if (typeof rawMap !== 'string') return undefined
  const body = rawMap.replace(/^\s*</, '').replace(/>\s*$/, '')
  const lines = body.split('\n').filter((l) => /RC\(/.test(l))
  if (lines.length < 2) return undefined
  const minIndent = Math.min(...lines.map((l) => l.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length))
  const rows = lines.map((l) => {
    const line = l.replace(/\t/g, '    ')
    return [...line.matchAll(/RC\(\s*\d+\s*,\s*\d+\s*\)/g)].map((m) => ({ start: m.index - minIndent, end: m.index - minIndent + m[0].length }))
  })
  // typical pitch between adjacent tokens
  const pitches = rows.flatMap((r) => r.slice(1).map((t, i) => t.start - r[i].start)).sort((a, b) => a - b)
  const unit = pitches[Math.floor(pitches.length / 4)] || 8
  const out = []
  const seen = new Set()
  rows.forEach((r, y) => {
    let x = -1
    let prevEnd = 0
    r.forEach((t, i) => {
      const gap = t.start - (i === 0 ? 0 : prevEnd)
      x = i === 0 ? Math.round(t.start / unit) : x + 1 + Math.max(0, Math.round((gap - (unit - (prevEnd - r[i - 1].start))) / unit))
      prevEnd = t.end
      out.push({ w: 100, h: 100, x: x * 100, y: y * 100, r: 0, rx: 0, ry: 0 })
      seen.add(`${x},${y}`)
    })
  })
  if (out.length !== expected || seen.size !== out.length) return undefined
  return normalize(out)
}

/** Grid geometry from RC(row, col) entries; split halves get a 1u gap at col-offset. */
function gridKeys(map, off) {
  const raw = map.map(({ r, c }) => ({ w: 100, h: 100, x: (c + (off !== undefined && c >= off ? 1 : 0)) * 100, y: r * 100, r: 0, rx: 0, ry: 0 }))
  return normalize(raw)
}

function variantSuffix(label, displayName) {
  const fromDisplay = displayName.toLowerCase()
    .replace(/(\d+)\s*column(s)?/, '$1col')
    .replace(/^\d+%\s*/, '') // "60% ISO" -> "iso"
    .replace(/\blayout\b/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  if (fromDisplay) return fromDisplay
  return label.replace(/_layout$/, '')
}

/** Find which file (following includes) defines `label:`. */
function sourceFileOf(entry, label, seen = new Set()) {
  if (seen.has(entry) || !fs.existsSync(entry)) return undefined
  seen.add(entry)
  const src = stripComments(fs.readFileSync(entry, 'utf8'))
  if (new RegExp(`(^|\\s)${label}\\s*:`).test(src)) return entry
  for (const m of src.matchAll(/^\s*#\s*include\s*([<"])([^>"]+)[>"]/gm)) {
    const p = m[1] === '"' ? path.join(path.dirname(entry), m[2]) : m[2].startsWith('layouts/') ? path.join(DTS_INCLUDE, m[2]) : undefined
    const hit = p && sourceFileOf(p, label, seen)
    if (hit) return hit
  }
  return undefined
}

// Grid-derived splits: make sure there is a visible gap between the halves.
for (const d of defs) {
  if (!d.gridFromTransform || !d.split || !d.hands) continue
  const rows = new Map()
  d.keys.forEach((k, i) => {
    const r = rows.get(k.y) ?? { l: -Infinity, r: Infinity }
    if (d.hands[i] === 'L') r.l = Math.max(r.l, k.x + (k.w ?? 1))
    else r.r = Math.min(r.r, k.x)
    rows.set(k.y, r)
  })
  const minGap = Math.min(...[...rows.values()].map((r) => r.r - r.l))
  if (minGap < 1) d.keys.forEach((k, i) => { if (d.hands[i] === 'R') k.x = round(k.x + 1 - Math.max(0, minGap)) })
}

// dedupe ids
const seenIds = new Map()
for (const d of defs) {
  const n = seenIds.get(d.id) ?? 0
  seenIds.set(d.id, n + 1)
  if (n) d.id = `${d.id}_${n + 1}`
}

const rank = (id) => { const i = POPULAR.indexOf(id); return i < 0 ? Infinity : i }
defs.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id))

// strip generator-only fields
const GENERATOR_ONLY = ["layoutLabel", "keymapBindings", "gridFromTransform"]
const out = defs.map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !GENERATOR_ONLY.includes(k))))
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n')

console.log(`wrote ${out.length} keyboards to ${outFile}`)
console.log('controller boards at this ref (keep CONTROLLERS in src/data/keyboards.ts in sync):\n  ' + controllers.map((c) => `${c.id} [${c.interconnect}] ${c.name}`).join('\n  '))
console.log('grid-derived (no physical layout):', defs.filter((d) => d.gridFromTransform).map((d) => d.id).join(', ') || 'none')
if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '))
if (warnings.length) console.log(`${warnings.length} warnings`)
