import { motion, useScroll, useTransform, type MotionProps } from 'motion/react'
import { useRef, type ReactNode } from 'react'

export const ease = [0.22, 1, 0.36, 1] as const

/** Fade + rise into view. Plays once. */
export function FadeIn({
  children,
  delay = 0,
  y = 24,
  className = '',
  ...rest
}: { children: ReactNode; delay?: number; y?: number; className?: string } & MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, ease, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * Framer's signature panel treatment: the block sits dimmed and slightly
 * scaled down until it scrolls into the middle of the viewport, then
 * brightens to full. Scroll-linked, so it reverses when you scroll back.
 */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 95%', 'start 45%'] })
  const opacity = useTransform(scrollYProgress, [0, 1], [0.18, 1])
  const scale = useTransform(scrollYProgress, [0, 1], [0.965, 1])
  const y = useTransform(scrollYProgress, [0, 1], [32, 0])
  return (
    <motion.div ref={ref} style={{ opacity, scale, y }} className={className}>
      {children}
    </motion.div>
  )
}

/** Image that drifts slightly slower than the page. */
export function Parallax({ children, amount = 40, className = '' }: { children: ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount])
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}
