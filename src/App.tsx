import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { useStore } from './store/store'
import { Home } from './pages/Home'
import { NewLayout } from './pages/NewLayout'
import { Editor } from './pages/Editor'
import { Print } from './pages/Print'
import { SharePage } from './pages/SharePage'
import { Train } from './pages/Train'
import { ToastHost } from './ui/Toast'
import { applyTheme } from './ui/ThemeToggle'

export default function App() {
  const route = useRoute()
  const init = useStore((s) => s.init)
  useEffect(() => {
    applyTheme()
    init()
  }, [init])

  let page: React.ReactNode
  const [a, b, c] = route
  if (a === 'new') page = <NewLayout />
  else if (a === 'layout' && b && c === 'train') page = <Train id={b} />
  else if (a === 'layout' && b && c === 'print') page = <Print id={b} />
  else if (a === 'layout' && b) page = <Editor id={b} view={c} />
  else if (a === 'share' && b) page = <SharePage data={b} />
  else if (a === 'gist' && b) page = <SharePage gist={b} />
  else page = <Home />

  return (
    <>
      {page}
      <ToastHost />
    </>
  )
}
