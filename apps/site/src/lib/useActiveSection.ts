import { useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'

/**
 * Which of the given section anchors is under the reading line (40% down the
 * viewport). Undefined between sections, so the nav only lights a link while
 * its section is really on screen.
 */
export function useActiveSection(hrefs: readonly string[]) {
  const [active, setActive] = useState<string | undefined>()
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', () => {
    const line = window.innerHeight * 0.4
    let hit: string | undefined
    for (const href of hrefs) {
      const el = document.querySelector<HTMLElement>(href)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top <= line && r.bottom > line) {
        hit = href
        break
      }
    }
    setActive((prev) => (prev === hit ? prev : hit))
  })
  return active
}
