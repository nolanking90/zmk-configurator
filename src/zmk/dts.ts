// Minimal devicetree source parser (input must already be preprocessed).
// Supports root nodes, labels, `&label { }` overrides, properties with
// `< >` cell arrays, strings, phandles and byte strings, /delete-*/ directives.

export type PropValue =
  | { kind: 'cells'; cells: string[] }
  | { kind: 'string'; value: string }
  | { kind: 'ref'; ref: string }
  | { kind: 'bytes'; raw: string }

export interface DtNode {
  name: string
  labels: string[]
  /** empty array = boolean property */
  props: Map<string, PropValue[]>
  children: DtNode[]
  /** node is only an override of a label we have not seen defined */
  parent?: DtNode
}

export interface DtTree {
  root: DtNode
  labels: Map<string, DtNode>
  /** overrides of labels not defined in this file (e.g. &mt from behaviors.dtsi) */
  externalOverrides: Map<string, DtNode>
  /** order in which external overrides appeared */
  warnings: string[]
}

export const newNode = (name: string, parent?: DtNode): DtNode => ({ name, labels: [], props: new Map(), children: [], parent })

const NAME_CH = /[A-Za-z0-9_,.+\-#@?]/

class Parser {
  i = 0
  readonly src: string
  readonly tree: DtTree
  constructor(src: string) {
    this.src = src
    this.tree = { root: newNode('/'), labels: new Map(), externalOverrides: new Map(), warnings: [] }
  }

  warn(msg: string) {
    if (!this.tree.warnings.includes(msg)) this.tree.warnings.push(msg)
  }

  ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++
  }

  peek(s: string) {
    return this.src.startsWith(s, this.i)
  }

  eat(s: string) {
    this.ws()
    if (this.peek(s)) {
      this.i += s.length
      return true
    }
    return false
  }

  name(): string {
    this.ws()
    const st = this.i
    while (this.i < this.src.length && NAME_CH.test(this.src[this.i])) this.i++
    return this.src.slice(st, this.i)
  }

  /** skip a broken statement: up to the next `;` at depth 0 (balanced braces) */
  skipStatement() {
    let depth = 0
    while (this.i < this.src.length) {
      const c = this.src[this.i++]
      if (c === '"') {
        while (this.i < this.src.length && this.src[this.i] !== '"') this.i += this.src[this.i] === '\\' ? 2 : 1
        this.i++
      } else if (c === '{' || c === '(') depth++
      else if (c === '}' || c === ')') {
        depth--
        if (depth < 0) {
          this.i--
          return
        }
        if (depth === 0 && c === '}') {
          this.eat(';')
          return
        }
      } else if (c === ';' && depth === 0) return
    }
  }

  excerpt() {
    return this.src.slice(this.i, this.i + 40).replace(/\s+/g, ' ').trim()
  }

  parseFile() {
    for (;;) {
      this.ws()
      if (this.i >= this.src.length) break
      if (this.eat(';')) continue
      if (this.eat('/dts-v1/') || this.eat('/plugin/')) {
        this.eat(';')
        continue
      }
      if (this.eat('/omit-if-no-ref/')) continue
      if (this.eat('/delete-node/')) {
        this.ws()
        if (this.eat('&')) {
          const l = this.name()
          const n = this.tree.labels.get(l)
          if (n?.parent) n.parent.children = n.parent.children.filter((c) => c !== n)
        } else this.name()
        this.eat(';')
        continue
      }
      if (this.peek('/') && !this.peek('/ {') && !/^\/\s*\{/.test(this.src.slice(this.i, this.i + 10))) {
        this.warn(`Unsupported top-level directive near "${this.excerpt()}"`)
        this.skipStatement()
        continue
      }
      const labels: string[] = []
      for (;;) {
        this.ws()
        const save = this.i
        const n = this.name()
        if (n && this.eat(':')) labels.push(n)
        else {
          this.i = save
          break
        }
      }
      if (this.eat('/')) {
        if (!this.eat('{')) {
          this.warn(`Expected { after / near "${this.excerpt()}"`)
          this.skipStatement()
          continue
        }
        this.body(this.tree.root)
        this.eat(';')
        continue
      }
      if (this.eat('&')) {
        let target: DtNode | undefined
        let label = ''
        if (this.eat('{')) {
          const end = this.src.indexOf('}', this.i)
          const path = this.src.slice(this.i, end).trim()
          this.i = end + 1
          target = this.byPath(path)
          label = path
        } else {
          label = this.name()
          target = this.tree.labels.get(label)
        }
        if (!this.eat('{')) {
          this.warn(`Expected { after &${label}`)
          this.skipStatement()
          continue
        }
        if (!target) {
          target = this.tree.externalOverrides.get(label)
          if (!target) {
            target = newNode(label)
            this.tree.externalOverrides.set(label, target)
          }
        }
        this.body(target)
        this.eat(';')
        continue
      }
      this.warn(`Could not parse near "${this.excerpt()}"; skipped`)
      this.skipStatement()
    }
    return this.tree
  }

  byPath(path: string): DtNode | undefined {
    let n: DtNode | undefined = this.tree.root
    for (const part of path.split('/').filter(Boolean)) n = n?.children.find((c) => c.name === part)
    return n
  }

  /** parse node contents after `{`, consuming the closing `}` */
  body(node: DtNode) {
    for (;;) {
      this.ws()
      if (this.i >= this.src.length) {
        this.warn('Unexpected end of file (missing "}")')
        return
      }
      if (this.eat('}')) return
      if (this.eat(';')) continue
      if (this.eat('/delete-property/')) {
        node.props.delete(this.name())
        this.eat(';')
        continue
      }
      if (this.eat('/delete-node/')) {
        const n = this.name()
        node.children = node.children.filter((c) => c.name !== n)
        this.eat(';')
        continue
      }
      if (this.eat('/omit-if-no-ref/')) continue
      const labels: string[] = []
      let name = ''
      for (;;) {
        name = this.name()
        if (!name) break
        this.ws()
        // `label:` (but not part of a property like `zmk,foo`)
        if (this.peek(':')) {
          this.i++
          labels.push(name)
          continue
        }
        break
      }
      if (!name) {
        this.warn(`Unexpected "${this.excerpt()}" inside node ${node.name}`)
        this.skipStatement()
        continue
      }
      if (this.eat('{')) {
        let child = node.children.find((c) => c.name === name)
        if (!child) {
          child = newNode(name, node)
          node.children.push(child)
        }
        for (const l of labels) {
          if (!child.labels.includes(l)) child.labels.push(l)
          this.tree.labels.set(l, child)
          const ext = this.tree.externalOverrides.get(l)
          if (ext) {
            mergeInto(child, ext)
            this.tree.externalOverrides.delete(l)
          }
        }
        this.body(child)
        this.eat(';')
        continue
      }
      if (this.eat(';')) {
        node.props.set(name, [])
        continue
      }
      if (this.eat('=')) {
        node.props.set(name, this.values())
        continue
      }
      this.warn(`Unexpected "${this.excerpt()}" after ${name} in node ${node.name}`)
      this.skipStatement()
    }
  }

  values(): PropValue[] {
    const out: PropValue[] = []
    for (;;) {
      this.ws()
      // skip labels inside values (rare)
      if (this.eat('<')) out.push({ kind: 'cells', cells: this.cells() })
      else if (this.peek('"')) out.push({ kind: 'string', value: this.string() })
      else if (this.eat('[')) {
        const end = this.src.indexOf(']', this.i)
        out.push({ kind: 'bytes', raw: this.src.slice(this.i, end).trim() })
        this.i = end + 1
      } else if (this.eat('&')) {
        if (this.eat('{')) {
          const end = this.src.indexOf('}', this.i)
          out.push({ kind: 'ref', ref: `{${this.src.slice(this.i, end)}}` })
          this.i = end + 1
        } else out.push({ kind: 'ref', ref: this.name() })
      } else {
        this.warn(`Unexpected property value near "${this.excerpt()}"`)
        this.skipStatement()
        return out
      }
      if (this.eat(',')) continue
      if (this.eat(';')) return out
      this.warn(`Expected , or ; near "${this.excerpt()}"`)
      this.skipStatement()
      return out
    }
  }

  string(): string {
    let j = this.i + 1
    let s = ''
    while (j < this.src.length && this.src[j] !== '"') {
      if (this.src[j] === '\\') {
        const n = this.src[j + 1]
        s += n === 'n' ? '\n' : n === 't' ? '\t' : n
        j += 2
      } else s += this.src[j++]
    }
    this.i = j + 1
    return s
  }

  /** cell list up to the matching `>`; parenthesised expressions stay one cell */
  cells(): string[] {
    const cells: string[] = []
    for (;;) {
      this.ws()
      if (this.i >= this.src.length) return cells
      if (this.peek('>')) {
        this.i++
        return cells
      }
      const st = this.i
      if (this.peek('(')) this.group()
      else {
        while (this.i < this.src.length && !/[\s<>()]/.test(this.src[this.i])) this.i++
        while (this.peek('(')) this.group()
        if (this.i === st) this.i++ // stray char
      }
      cells.push(this.src.slice(st, this.i).replace(/\s+/g, ''))
    }
  }

  group() {
    let depth = 0
    while (this.i < this.src.length) {
      const c = this.src[this.i++]
      if (c === '(') depth++
      else if (c === ')' && --depth === 0) return
    }
  }
}

export function mergeInto(target: DtNode, src: DtNode) {
  for (const [k, v] of src.props) target.props.set(k, v)
  for (const c of src.children) {
    const ex = target.children.find((x) => x.name === c.name)
    if (ex) mergeInto(ex, c)
    else {
      c.parent = target
      target.children.push(c)
    }
  }
}

export function parseDts(src: string): DtTree {
  return new Parser(src).parseFile()
}

// ---- helpers ------------------------------------------------------------------

export function propCells(n: DtNode, name: string): string[] | undefined {
  const v = n.props.get(name)
  if (!v) return undefined
  return v.flatMap((x) => (x.kind === 'cells' ? x.cells : x.kind === 'ref' ? [`&${x.ref}`] : []))
}

export function propString(n: DtNode, name: string): string | undefined {
  const v = n.props.get(name)?.find((x) => x.kind === 'string')
  return v && v.kind === 'string' ? v.value : undefined
}

export function propInt(n: DtNode, name: string): number | undefined {
  const c = propCells(n, name)
  if (!c || !c.length) return undefined
  return cellToInt(c[0])
}

export function cellToInt(c: string): number | undefined {
  const s = c.replace(/^\((.*)\)$/, '$1').trim()
  if (/^-?\d+$/.test(s)) return parseInt(s, 10)
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16)
  return undefined
}

/** Split a bindings cell list into individual bindings (each starts with &label). */
export function splitBindings(cells: string[]): { ref: string; params: string[] }[] {
  const out: { ref: string; params: string[] }[] = []
  for (const c of cells) {
    if (c.startsWith('&')) out.push({ ref: c.slice(1), params: [] })
    else if (out.length) out[out.length - 1].params.push(c)
    else out.push({ ref: '', params: [c] })
  }
  return out
}

export function findNodes(n: DtNode, pred: (n: DtNode) => boolean, acc: DtNode[] = []): DtNode[] {
  if (pred(n)) acc.push(n)
  for (const c of n.children) findNodes(c, pred, acc)
  return acc
}

// ---- writer ---------------------------------------------------------------------

function valueText(v: PropValue): string {
  switch (v.kind) {
    case 'cells': return `<${v.cells.join(' ')}>`
    case 'string': return `"${v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    case 'ref': return `&${v.ref}`
    case 'bytes': return `[${v.raw}]`
  }
}

export function writeNode(n: DtNode, indent = '', withLabels = true): string {
  const I = '    '
  const head = `${indent}${withLabels && n.labels.length ? n.labels.map((l) => `${l}: `).join('') : ''}${n.name} {`
  const lines = [head]
  for (const [k, v] of n.props) lines.push(v.length ? `${indent}${I}${k} = ${v.map(valueText).join(', ')};` : `${indent}${I}${k};`)
  for (const c of n.children) lines.push(writeNode(c, indent + I, withLabels))
  lines.push(`${indent}};`)
  return lines.join('\n')
}
