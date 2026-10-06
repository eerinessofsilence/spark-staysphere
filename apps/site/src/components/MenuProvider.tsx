import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { MenuContext } from '../lib/menu'
import { DemoAccessDialog } from './DemoAccessDialog'

const DEFAULT_TITLE = 'Request a demo'

export function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [demoRequest, setDemoRequest] = useState<{ title: string; message: string } | null>(null)
  const [demoAccessOpen, setDemoAccessOpen] = useState(false)
  const closeDemoAccess = useCallback(() => setDemoAccessOpen(false), [])
  const openDemoAccess = useCallback(() => {
    setDemoRequest(null)
    setDemoAccessOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      navHidden,
      setNavHidden,
      demoRequest,
      demoAccessOpen,
      openDemoAccess,
      closeDemoAccess,
      openDemoRequest: (request?: { title?: string; message?: string }) =>
        setDemoRequest({ title: request?.title ?? DEFAULT_TITLE, message: request?.message ?? '' }),
      closeDemoRequest: () => setDemoRequest(null),
    }),
    [open, navHidden, demoRequest, demoAccessOpen, openDemoAccess, closeDemoAccess],
  )
  return <MenuContext.Provider value={value}>{children}<DemoAccessDialog /></MenuContext.Provider>
}
