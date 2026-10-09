import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

type DemoRequest = {
  /** Shown in the dialog title and used as the mail subject. */
  title: string
  /** Prefilled into the message field, editable — e.g. the calculator's chosen rooms/channels/billing. */
  message: string
}

type ChromeState = {
  /** The full-screen mobile menu (below lg), toggled from the floating nav's × button. */
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  /** Set by a full-screen section that carries its own top row, e.g. the flow stage. */
  navHidden: boolean
  setNavHidden: Dispatch<SetStateAction<boolean>>
  /** The "Request a demo" / "Talk to us" dialog, opened from any CTA on either page. */
  demoRequest: DemoRequest | null
  openDemoRequest: (request?: Partial<DemoRequest>) => void
  closeDemoRequest: () => void
  demoAccessOpen: boolean
  openDemoAccess: () => void
  closeDemoAccess: () => void
}

/** Page chrome state, shared by the floating nav and full-screen sections. */
export const MenuContext = createContext<ChromeState>({
  open: false,
  setOpen: () => {},
  navHidden: false,
  setNavHidden: () => {},
  demoRequest: null,
  openDemoRequest: () => {},
  closeDemoRequest: () => {},
  demoAccessOpen: false,
  openDemoAccess: () => {},
  closeDemoAccess: () => {},
})

export function useMenu() {
  return useContext(MenuContext)
}
