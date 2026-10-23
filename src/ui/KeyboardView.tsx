import { useMemo, useState } from 'react'
import type { KeyboardDef, Layer, Layout, PhysicalKey } from '../model/types'
import { actionLabel, keyShiftLabel, keyTargetLayer } from '../lib/labels'
import { contrastText } from '../lib/color'

export interface KeyboardViewProps {
  kb: KeyboardDef
  layout: Layout
  layer: Layer
  unit?: number
  selected?: number[]
  highlight?: number[]
  dimmed?: number[]
  pressed?: number[]
  onKeyClick?: (index: number, e: React.MouseEvent) => void
  onKeyDrop?: (from: number, to: number, copy: boolean) => void
  onKeyDoubleClick?: (index: number) => void
  compact?: boolean
}

function corners(k: PhysicalKey) {
  const w = k.w ?? 1
  const h = k.h ?? 1
  const pts = [
    [k.x, k.y],
    [k.x + w, k.y],
    [k.x, k.y + h],
    [k.x + w, k.y + h],
  ]
  if (!k.r) return pts
  const rx = k.rx ?? k.x
  const ry = k.ry ?? k.y
  const a = (k.r * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return pts.map(([x, y]) => [rx + (x - rx) * c - (y - ry) * s, ry + (x - rx) * s + (y - ry) * c])
}

export function keyboardBounds(kb: KeyboardDef) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const k of kb.keys)
    for (const [x, y] of corners(k)) {
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  if (!kb.keys.length) return { minX: 0, minY: 0, width: 1, height: 1 }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

export function KeyboardView(props: KeyboardViewProps) {
  const { kb, layout, layer, unit = 58, selected = [], highlight, dimmed, pressed, compact } = props
  const b = useMemo(() => keyboardBounds(kb), [kb])
  const [dragOver, setDragOver] = useState<number | null>(null)
  const layerColor = layer.color
  const tiny = unit < 26

  return (
    <div className="kb" style={{ width: b.width * unit, height: b.height * unit }}>
      {kb.keys.map((pk, i) => {
        const k = layer.keys[i] ?? {}
        const w = pk.w ?? 1
        const h = pk.h ?? 1
        const style: React.CSSProperties = {
          padding: tiny ? 1 : 2,
          left: (pk.x - b.minX) * unit,
          top: (pk.y - b.minY) * unit,
          width: w * unit,
          height: h * unit,
        }
        if (pk.r) {
          const rx = pk.rx ?? pk.x
          const ry = pk.ry ?? pk.y
          style.transformOrigin = `${(rx - pk.x) * unit}px ${(ry - pk.y) * unit}px`
          style.transform = `rotate(${pk.r}deg)`
        }
        const target = keyTargetLayer(k)
        const targetColor = target ? layout.layers.find((l) => l.id === target)?.color : undefined
        const bg = k.color ?? targetColor ?? (k.tap?.type === 'trans' ? undefined : layerColor)
        const innerStyle = bg
          ? ({ '--key-color': bg, '--key-fg': contrastText(bg) } as React.CSSProperties)
          : undefined

        const isTrans = k.tap?.type === 'trans' && !k.hold && !k.doubleTap && !k.tapHold
        const main = k.label || actionLabel(k.tap, layout)
        const shift =
          !compact && k.tap?.type === 'key' && !k.tap.mods?.length && !k.label
            ? keyShiftLabel(k.tap.code, layout.settings.locale)
            : undefined
        const hold = k.hold && k.hold.type !== 'none' ? actionLabel(k.hold, layout) : ''
        const dt = k.doubleTap ? actionLabel(k.doubleTap, layout) : ''
        const th = k.tapHold ? actionLabel(k.tapHold, layout) : ''
        const len = [...main].length
        const cls = [
          'key',
          selected[0] === i ? 'selected' : selected.includes(i) ? 'multi' : '',
          highlight?.includes(i) ? 'selected' : '',
          dimmed?.includes(i) ? 'dim' : '',
          pressed?.includes(i) ? 'pressed' : '',
          dragOver === i ? 'drag-over' : '',
        ].join(' ')
        return (
          <div
            key={i}
            className={cls}
            style={style}
            title={`Key ${i}`}
            draggable={!!props.onKeyDrop}
            onDragStart={(e) => e.dataTransfer.setData('text/x-key', String(i))}
            onDragOver={(e) => {
              if (props.onKeyDrop && e.dataTransfer.types.includes('text/x-key')) {
                e.preventDefault()
                setDragOver(i)
              }
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              setDragOver(null)
              const from = Number(e.dataTransfer.getData('text/x-key'))
              if (!Number.isNaN(from) && from !== i) props.onKeyDrop?.(from, i, e.altKey || e.ctrlKey || e.metaKey)
            }}
            onClick={(e) => props.onKeyClick?.(i, e)}
            onDoubleClick={() => props.onKeyDoubleClick?.(i)}
          >
            <div className="key-inner" style={{ ...innerStyle, ...(tiny ? { padding: 0, borderRadius: 3, fontSize: 0 } : {}) }}>
              {tiny ? null : (<>
              <div className="key-top">
                <span>{shift ?? ''}</span>
                <span className="key-dt">{dt ? '⋮⋮' + dt : ''}</span>
              </div>
              <div className={`key-main ${isTrans ? 'trans' : ''} ${len > 9 ? 'xlong' : len > 4 ? 'long' : ''}`}>
                {main}
              </div>
              {(hold || th) && !compact ? (
                <div className="key-hold" title={[hold && `Hold: ${hold}`, th && `Tap+hold: ${th}`].filter(Boolean).join('\n')}>
                  {hold}
                  {th ? ` · ${th}` : ''}
                </div>
              ) : (
                <div />
              )}
              </>)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
