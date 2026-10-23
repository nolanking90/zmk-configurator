import { useEffect, useState } from 'react'

let push: ((msg: string) => void) | null = null

export function toast(msg: string) {
  push?.(msg)
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    push = (m) => {
      setMsg(m)
      clearTimeout(t)
      t = setTimeout(() => setMsg(null), 2200)
    }
    return () => { push = null }
  }, [])
  return msg ? <div className="toast">{msg}</div> : null
}
