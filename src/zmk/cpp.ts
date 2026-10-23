// A small C preprocessor, sufficient for ZMK keymaps: comments, line splices,
// #define (object- and function-like, variadic, # and ##), #undef,
// #if/#ifdef/#ifndef/#elif/#else/#endif and #include via a resolver.
// Rescanning uses per-token hide sets (Prosser's algorithm, simplified).

export interface CppOptions {
  /** returns the text of an included file, or undefined if unavailable */
  resolveInclude?: (path: string, system: boolean) => string | undefined
  /** predefined object-like macros */
  defines?: Record<string, string>
  warn?: (msg: string) => void
}

interface Tok {
  t: 'id' | 'num' | 'str' | 'ws' | 'nl' | 'p'
  v: string
  hide?: Set<string>
}

interface MacroDef {
  name: string
  fn: boolean
  params: string[]
  variadic: boolean
  body: Tok[]
}

/** Remove comments and line splices, keeping newlines (and string literals) intact. */
export function stripComments(src: string): string {
  src = src.replace(/\\\r?\n/g, '')
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      out += src.slice(i, j + 1)
      i = j + 1
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const chunk = end < 0 ? src.slice(i) : src.slice(i, end + 2)
      out += chunk.includes('\n') ? chunk.replace(/[^\n]/g, '') : ' '
      i = end < 0 ? src.length : end + 2
    } else {
      out += c
      i++
    }
  }
  return out
}

function tokenize(s: string): Tok[] {
  const toks: Tok[] = []
  const re = /([A-Za-z_][A-Za-z0-9_]*)|(\.?[0-9](?:[eEpP][+-]|[A-Za-z0-9_.])*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\n)|([ \t\r\f\v]+)|(##|#|.)/gs
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m[1]) toks.push({ t: 'id', v: m[1] })
    else if (m[2]) toks.push({ t: 'num', v: m[2] })
    else if (m[3]) toks.push({ t: 'str', v: m[3] })
    else if (m[4]) toks.push({ t: 'nl', v: '\n' })
    else if (m[5]) toks.push({ t: 'ws', v: ' ' })
    else toks.push({ t: 'p', v: m[6] })
  }
  return toks
}

const isWs = (t: Tok | undefined) => !!t && (t.t === 'ws' || t.t === 'nl')

function trimWs(toks: Tok[]): Tok[] {
  let a = 0
  let b = toks.length
  while (a < b && isWs(toks[a])) a++
  while (b > a && isWs(toks[b - 1])) b--
  return toks.slice(a, b)
}

const text = (toks: Tok[]) => toks.map((t) => t.v).join('')

export class Preprocessor {
  macros = new Map<string, MacroDef>()
  private includeDepth = 0
  private opts: CppOptions
  constructor(opts: CppOptions = {}) {
    this.opts = opts
    for (const [k, v] of Object.entries(opts.defines ?? {})) this.define(`${k} ${v}`)
  }

  private warn(msg: string) {
    this.opts.warn?.(msg)
  }

  isDefined(name: string): boolean {
    return this.macros.has(name)
  }

  define(rest: string) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?/.exec(rest)
    if (!m) {
      this.warn(`Malformed #define: ${rest.trim()}`)
      return
    }
    const name = m[1]
    let params: string[] = []
    let variadic = false
    if (m[2] !== undefined) {
      params = m[3].split(',').map((p) => p.trim()).filter(Boolean)
      if (params.length && params[params.length - 1].endsWith('...')) {
        variadic = true
        const last = params.pop()!.replace('...', '').trim()
        params.push(last || '__VA_ARGS__')
      }
    }
    const body = trimWs(tokenize(rest.slice(m[0].length)).map((t) => (t.t === 'nl' ? { t: 'ws', v: ' ' } as Tok : t)))
    this.macros.set(name, { name, fn: m[2] !== undefined, params, variadic, body })
  }

  /** Preprocess a whole file. */
  run(src: string): string {
    const lines = stripComments(src).split('\n')
    const out: string[] = []
    // conditional stack: [active, anyBranchTaken, parentActive]
    const cond: { active: boolean; taken: boolean; parent: boolean }[] = []
    const active = () => (cond.length ? cond[cond.length - 1].active : true)
    let chunk: string[] = []
    const flush = () => {
      if (chunk.length) out.push(this.expandText(chunk.join('\n')))
      chunk = []
    }
    for (const line of lines) {
      const d = /^\s*#\s*([a-z_]+)\b(.*)$/.exec(line)
      const directive = d && /^(include|define|undef|if|ifdef|ifndef|elif|else|endif|pragma|error|warning|line|include_next)$/.test(d[1])
      if (!directive) {
        if (active()) chunk.push(line)
        else chunk.push('')
        continue
      }
      flush()
      const [, name, restRaw] = d!
      const rest = restRaw.trim()
      out.push('')
      switch (name) {
        case 'ifdef': case 'ifndef': {
          const parent = active()
          const def = this.isDefined(rest.split(/\s+/)[0])
          const on = parent && (name === 'ifdef' ? def : !def)
          cond.push({ active: on, taken: on, parent })
          break
        }
        case 'if': {
          const parent = active()
          const on = parent && this.evalIf(rest)
          cond.push({ active: on, taken: on, parent })
          break
        }
        case 'elif': {
          const c = cond[cond.length - 1]
          if (!c) break
          if (c.taken || !c.parent) c.active = false
          else {
            c.active = this.evalIf(rest)
            c.taken = c.active
          }
          break
        }
        case 'else': {
          const c = cond[cond.length - 1]
          if (!c) break
          c.active = c.parent && !c.taken
          c.taken = true
          break
        }
        case 'endif':
          cond.pop()
          break
        default:
          if (!active()) break
          if (name === 'define') this.define(rest)
          else if (name === 'undef') this.macros.delete(rest.split(/\s+/)[0])
          else if (name === 'include' || name === 'include_next') {
            const im = /^([<"])([^>"]+)[>"]/.exec(rest)
            if (!im) break
            const inc = this.opts.resolveInclude?.(im[2], im[1] === '<')
            if (inc !== undefined && this.includeDepth < 20) {
              this.includeDepth++
              out.push(this.run(inc))
              this.includeDepth--
            }
          } else if (name === 'error') this.warn(`#error ${rest}`)
          break
      }
    }
    flush()
    return out.join('\n')
  }

  // ---- expansion ------------------------------------------------------------

  expandText(s: string): string {
    return text(this.expand(tokenize(s)))
  }

  private expand(input: Tok[]): Tok[] {
    const toks = input.slice()
    const out: Tok[] = []
    let i = 0
    let guard = 0
    while (i < toks.length) {
      const t = toks[i]
      const m = t.t === 'id' ? this.macros.get(t.v) : undefined
      if (!m || t.hide?.has(m.name)) {
        out.push(t)
        i++
        continue
      }
      if (++guard > 200000) {
        this.warn('Macro expansion limit reached')
        out.push(...toks.slice(i))
        break
      }
      const hs = new Set(t.hide ?? [])
      hs.add(m.name)
      if (!m.fn) {
        const repl = this.subst(m, [], hs)
        toks.splice(i, 1, ...repl)
        continue
      }
      let j = i + 1
      while (isWs(toks[j])) j++
      if (toks[j]?.v !== '(' || toks[j]?.t !== 'p') {
        out.push(t)
        i++
        continue
      }
      // collect arguments
      const args: Tok[][] = [[]]
      let depth = 0
      let k = j + 1
      for (; k < toks.length; k++) {
        const a = toks[k]
        if (a.t === 'p' && a.v === '(') depth++
        else if (a.t === 'p' && a.v === ')') {
          if (depth === 0) break
          depth--
        } else if (a.t === 'p' && a.v === ',' && depth === 0) {
          args.push([])
          continue
        }
        args[args.length - 1].push(a)
      }
      if (k >= toks.length) {
        // unterminated invocation: leave as is
        out.push(t)
        i++
        continue
      }
      const repl = this.subst(m, args.map(trimWs), hs)
      toks.splice(i, k - i + 1, ...repl)
    }
    return out
  }

  private subst(m: MacroDef, rawArgs: Tok[][], hs: Set<string>): Tok[] {
    const argOf = new Map<string, Tok[]>()
    if (m.fn) {
      const n = m.params.length
      let args = rawArgs
      if (n === 0 && args.length === 1 && args[0].length === 0) args = []
      if (m.variadic) {
        const fixed = args.slice(0, n - 1)
        const rest = args.slice(n - 1)
        const va: Tok[] = []
        rest.forEach((a, i) => {
          if (i) va.push({ t: 'p', v: ',' }, { t: 'ws', v: ' ' })
          va.push(...a)
        })
        args = [...fixed, va]
      }
      m.params.forEach((p, i) => argOf.set(p, args[i] ?? []))
    }
    const expanded = new Map<string, Tok[]>()
    const expArg = (p: string) => {
      let e = expanded.get(p)
      if (!e) {
        e = this.expand(argOf.get(p)!)
        expanded.set(p, e)
      }
      return e
    }
    const body = m.body
    // first pass: stringify and parameter substitution, marking paste operands
    const res: (Tok | 'PASTE')[] = []
    for (let i = 0; i < body.length; i++) {
      const b = body[i]
      if (m.fn && b.t === 'p' && b.v === '#') {
        let j = i + 1
        while (isWs(body[j])) j++
        const nb = body[j]
        if (nb && nb.t === 'id' && argOf.has(nb.v)) {
          const s = text(argOf.get(nb.v)!).replace(/\s+/g, ' ').trim()
          res.push({ t: 'str', v: JSON.stringify(s) })
          i = j
          continue
        }
      }
      if (b.t === 'p' && b.v === '##') {
        while (res.length && isWs(res[res.length - 1] as Tok)) res.pop()
        res.push('PASTE')
        while (isWs(body[i + 1])) i++
        continue
      }
      if (b.t === 'id' && argOf.has(b.v)) {
        let pj = i - 1
        while (isWs(body[pj])) pj--
        let nj = i + 1
        while (isWs(body[nj])) nj++
        const pasted = body[pj]?.v === '##' || body[nj]?.v === '##'
        const arg = pasted ? argOf.get(b.v)! : expArg(b.v)
        if (pasted && arg.length === 0) res.push({ t: 'p', v: '' }) // placemarker
        else res.push(...arg.map((x) => ({ ...x })))
        continue
      }
      res.push({ ...b })
    }
    // second pass: token pasting
    const out: Tok[] = []
    for (let i = 0; i < res.length; i++) {
      const r = res[i]
      if (r === 'PASTE') {
        const left = out.pop()
        const right = res[i + 1] as Tok | undefined
        i++
        const joined = (left?.v ?? '') + (right && right !== ('PASTE' as unknown) ? right.v : '')
        const nt = tokenize(joined)
        out.push(...(nt.length ? nt : [{ t: 'p', v: '' } as Tok]))
        continue
      }
      out.push(r)
    }
    return out.filter((t) => !(t.t === 'p' && t.v === '')).map((t) => {
      const h = new Set(t.hide ?? [])
      for (const x of hs) h.add(x)
      return { ...t, hide: h }
    })
  }

  // ---- #if ---------------------------------------------------------------------

  private evalIf(expr: string): boolean {
    // resolve defined(X) / defined X before expansion
    const pre = expr.replace(/\bdefined\s*\(\s*([A-Za-z_]\w*)\s*\)|\bdefined\s+([A-Za-z_]\w*)/g, (_, a, b) =>
      this.isDefined(a ?? b) ? '1' : '0')
    const expanded = this.expandText(pre).replace(/\b[A-Za-z_]\w*\b/g, '0')
    try {
      return evalExpr(expanded) !== 0
    } catch {
      this.warn(`Could not evaluate #if ${expr}`)
      return false
    }
  }
}

/** Integer constant-expression evaluator for #if. */
export function evalExpr(src: string): number {
  const toks = src.match(/0x[0-9a-fA-F]+|\d+|&&|\|\||==|!=|<=|>=|<<|>>|[-+*/%()!~<>&|^?:]/g) ?? []
  let p = 0
  const peek = () => toks[p]
  const next = () => toks[p++]
  const prec: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
  }
  const unary = (): number => {
    const t = next()
    if (t === undefined) throw new Error('eof')
    if (t === '(') {
      const v = ternary()
      if (next() !== ')') throw new Error('paren')
      return v
    }
    if (t === '!') return unary() ? 0 : 1
    if (t === '~') return ~unary()
    if (t === '-') return -unary()
    if (t === '+') return unary()
    const n = Number(t)
    if (Number.isNaN(n)) throw new Error(`bad token ${t}`)
    return n
  }
  const binary = (minPrec: number): number => {
    let lhs = unary()
    for (;;) {
      const op = peek()
      const pr = op !== undefined ? prec[op] : undefined
      if (pr === undefined || pr < minPrec) return lhs
      next()
      const rhs = binary(pr + 1)
      switch (op) {
        case '||': lhs = lhs || rhs ? 1 : 0; break
        case '&&': lhs = lhs && rhs ? 1 : 0; break
        case '|': lhs |= rhs; break
        case '^': lhs ^= rhs; break
        case '&': lhs &= rhs; break
        case '==': lhs = lhs === rhs ? 1 : 0; break
        case '!=': lhs = lhs !== rhs ? 1 : 0; break
        case '<': lhs = lhs < rhs ? 1 : 0; break
        case '>': lhs = lhs > rhs ? 1 : 0; break
        case '<=': lhs = lhs <= rhs ? 1 : 0; break
        case '>=': lhs = lhs >= rhs ? 1 : 0; break
        case '<<': lhs <<= rhs; break
        case '>>': lhs >>= rhs; break
        case '+': lhs += rhs; break
        case '-': lhs -= rhs; break
        case '*': lhs *= rhs; break
        case '/': lhs = rhs ? Math.trunc(lhs / rhs) : 0; break
        case '%': lhs = rhs ? lhs % rhs : 0; break
      }
    }
  }
  const ternary = (): number => {
    const c = binary(1)
    if (peek() === '?') {
      next()
      const a = ternary()
      if (next() !== ':') throw new Error('ternary')
      const b = ternary()
      return c ? a : b
    }
    return c
  }
  const v = ternary()
  if (p !== toks.length) throw new Error('trailing')
  return v
}
