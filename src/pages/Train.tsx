import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { getKeyboard } from '../data/keyboards'
import type { KeyboardDef, Layout } from '../model/types'
import { KeyboardView } from '../ui/KeyboardView'
import { findChar } from '../lib/findChar'
import { WORDS } from '../data/words'

type Lesson = 'home' | 'top' | 'bottom' | 'letters' | 'words' | 'numbers' | 'symbols' | 'custom'

const LESSONS: { id: Lesson; name: string }[] = [
  { id: 'home', name: 'Home row' },
  { id: 'top', name: 'Top row' },
  { id: 'bottom', name: 'Bottom row' },
  { id: 'letters', name: 'All letters' },
  { id: 'words', name: 'Common words' },
  { id: 'numbers', name: 'Numbers' },
  { id: 'symbols', name: 'Symbols' },
  { id: 'custom', name: 'Custom text' },
]

/** letters on the base layer grouped into physical rows (top, home, bottom) */
function letterRows(layout: Layout, kb: KeyboardDef): string[] {
  const rows = new Map<number, string>()
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    const p = findChar(ch, layout, kb)
    if (!p || p.layer !== 0) continue
    const y = Math.round(kb.keys[p.key].y)
    rows.set(y, (rows.get(y) ?? '') + ch)
  }
  const ys = [...rows.keys()].sort((a, b) => a - b)
  // pick the three rows with the most letters, in physical order
  const top3 = [...ys].sort((a, b) => rows.get(b)!.length - rows.get(a)!.length).slice(0, 3).sort((a, b) => a - b)
  return top3.map((y) => rows.get(y)!)
}

function makeText(lesson: Lesson, layout: Layout, kb: KeyboardDef, custom: string): string {
  const rows = letterRows(layout, kb)
  const pickWords = (allowed: string, n = 14) => {
    const ok = WORDS.filter((w) => [...w].every((c) => allowed.includes(c)))
    if (ok.length >= 8) return Array.from({ length: n }, () => ok[Math.floor(Math.random() * ok.length)]).join(' ')
    // not enough real words: random clusters
    return Array.from({ length: n }, () =>
      Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => allowed[Math.floor(Math.random() * allowed.length)]).join(''),
    ).join(' ')
  }
  switch (lesson) {
    case 'home': return pickWords(rows[1] ?? 'asdfghjkl')
    case 'top': return pickWords((rows[0] ?? 'qwertyuiop') + (rows[1] ?? ''))
    case 'bottom': return pickWords((rows[2] ?? 'zxcvbnm') + (rows[1] ?? ''))
    case 'letters': return pickWords('abcdefghijklmnopqrstuvwxyz')
    case 'words': return Array.from({ length: 16 }, () => WORDS[Math.floor(Math.random() * 200)]).join(' ')
    case 'numbers': return Array.from({ length: 10 }, () => String(Math.floor(Math.random() * 100000))).join(' ')
    case 'symbols': {
      const s = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~'
      return Array.from({ length: 12 }, () => Array.from({ length: 3 }, () => s[Math.floor(Math.random() * s.length)]).join('')).join(' ')
    }
    case 'custom': return custom.trim() || 'Paste some text to practice.'
  }
}

export function Train({ id }: { id: string }) {
  const layout = useStore((s) => s.layouts[id])
  const kb = layout ? getKeyboard(layout.keyboard) : undefined
  if (!layout || !kb) return <div className="page muted">Layout not found.</div>
  return <Trainer layout={layout} kb={kb} />
}

function Trainer({ layout, kb }: { layout: Layout; kb: KeyboardDef }) {
  const [lesson, setLesson] = useState<Lesson>('home')
  const [custom, setCustom] = useState('')
  const [text, setText] = useState(() => makeText('home', layout, kb, ''))
  const [pos, setPos] = useState(0)
  const [errors, setErrors] = useState<Record<string, number>>({})
  const [wrong, setWrong] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [start, setStart] = useState<number | null>(null)
  const [done, setDone] = useState<{ wpm: number; acc: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const reset = (l = lesson, c = custom) => {
    setText(makeText(l, layout, kb, c))
    setPos(0); setMistakes(0); setStart(null); setDone(null); setWrong(false)
    boxRef.current?.focus()
  }

  const next = text[pos]
  const path = useMemo(() => (next ? findChar(next, layout, kb) : undefined), [next, layout, kb])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') return
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || done) return
      e.preventDefault()
      if (start === null) setStart(Date.now())
      if (e.key === text[pos]) {
        setWrong(false)
        const np = pos + 1
        setPos(np)
        if (np >= text.length) {
          const mins = (Date.now() - (start ?? Date.now())) / 60000
          setDone({ wpm: Math.round(text.length / 5 / Math.max(mins, 1 / 600)), acc: Math.round((100 * text.length) / (text.length + mistakes)) })
        }
      } else {
        setWrong(true)
        setMistakes((m) => m + 1)
        setErrors((er) => ({ ...er, [text[pos]]: (er[text[pos]] ?? 0) + 1 }))
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [text, pos, start, mistakes, done])

  const shownLayer = path?.layer ?? 0
  const highlight = path ? [path.key] : []
  const holdKeys = path?.layerKeys.map((k) => k.key) ?? []
  const elapsed = start ? (Date.now() - start) / 60000 : 0
  const wpm = start && pos > 0 ? Math.round(pos / 5 / Math.max(elapsed, 1 / 600)) : 0
  const worst = Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <>
      <div className="topbar">
        <a className="btn ghost" href={`#/layout/${layout.id}`}>← Back to editor</a>
        <h2 style={{ marginLeft: 8 }}>Train: {layout.name}</h2>
        <span className="spacer" />
        <select value={lesson} onChange={(e) => { const l = e.target.value as Lesson; setLesson(l); reset(l) }}>
          {LESSONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={() => reset()}>New text</button>
      </div>
      <div className="page col" style={{ gap: 18, maxWidth: 1300 }}>
        {lesson === 'custom' && (
          <textarea rows={3} placeholder="Paste text to practice" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => reset('custom', custom)} />
        )}
        <div ref={boxRef} tabIndex={0} className="card mono" style={{ fontSize: 24, lineHeight: 1.6, letterSpacing: '0.02em', outline: 'none', wordBreak: 'break-word' }}>
          <span style={{ color: 'var(--ok)' }}>{text.slice(0, pos)}</span>
          <span style={{ background: wrong ? 'var(--danger)' : 'var(--accent)', color: 'white', borderRadius: 3, padding: '0 1px' }}>
            {next === ' ' ? '␣' : next ?? ''}
          </span>
          <span className="muted">{text.slice(pos + 1)}</span>
        </div>
        <div className="row wrap" style={{ gap: 18 }}>
          <span><b>{wpm}</b> <span className="muted">WPM</span></span>
          <span><b>{mistakes}</b> <span className="muted">mistakes</span></span>
          <span className="muted small">
            {path
              ? `Next: “${next === ' ' ? 'space' : next}” on layer ${layout.layers[path.layer].name}${path.layerKeys.length ? ' (hold the highlighted layer key)' : ''}${path.shift ? ' + Shift' : ''}`
              : next ? `“${next}” isn't on this layout` : ''}
          </span>
        </div>
        {done && (
          <div className="card row" style={{ gap: 16 }}>
            <h2>Done! {done.wpm} WPM · {done.acc}% accuracy</h2>
            <button className="primary" onClick={() => reset()}>Next text</button>
          </div>
        )}
        <div className="kb-wrap">
          <KeyboardView fit kb={kb} layout={layout} layer={layout.layers[shownLayer]} selected={highlight} highlight={holdKeys} />
        </div>
        {worst.length > 0 && (
          <div className="small muted">Most missed: {worst.map(([c, n]) => `${c === ' ' ? '␣' : c} ×${n}`).join(' · ')}</div>
        )}
      </div>
    </>
  )
}
