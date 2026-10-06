import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

type Props = {
  as?: 'h1' | 'h2' | 'p'
  id?: string
  className?: string
  /** Plain text. Any *asterisks* are stripped and ignored. */
  text: string
  /** Delay before the first word starts, in ms. */
  delay?: number
  /** Delay between words, in ms. */
  stagger?: number
}

/**
 * Framer-style "text appear": each word rises from below with a soft blur
 * and fades in, staggered word by word. Plays once when the heading enters
 * the viewport. Respects prefers-reduced-motion (handled in CSS).
 */
export function AnimatedHeading({ as: Tag = 'h2', id, className = '', text, delay = 0, stagger = 45 }: Props) {
  const ref = useRef<HTMLHeadingElement | HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('is-in')
            io.disconnect()
          }
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const words: ReactNode[] = []
  let i = 0
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const clean = raw.replace(/\*/g, '')
    const style = { '--word-delay': `${delay + i * stagger}ms` } as CSSProperties
    words.push(
      <span key={i} className="word-mask" aria-hidden>
        <span className="word" style={style}>
          {clean}
        </span>
      </span>,
      ' ',
    )
    i++
  }

  return (
    <Tag ref={ref as never} id={id} className={`split-heading ${className}`}>
      <span className="sr-only">{text.replace(/\*/g, '')}</span>
      {words}
    </Tag>
  )
}
