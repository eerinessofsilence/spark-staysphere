import type { CSSProperties, ReactNode } from 'react'

type RevealProps = { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'figure' | 'p' | 'h2' | 'header' }

/** Wraps children in a scroll-reveal container. */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: RevealProps) {
  const style = { '--reveal-delay': `${delay}ms` } as CSSProperties
  return (
    <Tag className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  )
}

type ButtonProps = {
  /** Either a destination (renders an `<a>`) or `onClick` (renders a `<button>`) — never both. */
  href?: string
  onClick?: () => void
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'inverse' | 'ghost' | 'ghost-inverse'
  size?: 'md' | 'lg'
  external?: boolean
  className?: string
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-ink text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-card text-ink shadow-soft hover:bg-stone',
  inverse: 'bg-[#F7F5F0] text-[#161616] hover:bg-white',
  ghost: 'bg-transparent text-ink hover:bg-stone/60',
  /** Outlined button for photography and ink backgrounds: frosted at rest so it never dissolves. */
  'ghost-inverse': 'border border-white/35 bg-white/10 text-[#F7F5F0] backdrop-blur-md hover:bg-white/20 hover:border-white/50',
}

export function Button({ href, onClick, children, variant = 'primary', size = 'md', external, className = '' }: ButtonProps) {
  const sizing = size === 'lg' ? 'min-h-12 px-6 text-base' : 'min-h-11 px-5 text-sm'
  const cls = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-200 ${sizing} ${variants[variant]} ${className}`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    )
  }
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className={cls}>
      {children}
    </a>
  )
}

export function ArrowRight({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function ArrowUpRight({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M6 14 14 6m0 0H7.5M14 6v6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function Globe({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h14M10 3c2.2 2 3.3 4.5 3.3 7s-1.1 5-3.3 7c-2.2-2-3.3-4.5-3.3-7s1.1-5 3.3-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

/** A product screenshot presented as a layout element. */
export function Shot({
  src,
  alt,
  className = '',
  tile,
  flat,
  width,
  height,
  loading = 'lazy',
}: {
  src: string
  alt: string
  className?: string
  tile?: boolean
  flat?: boolean
  width?: number
  height?: number
  loading?: 'lazy' | 'eager'
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={`shot ${tile ? 'shot-tile' : ''} ${flat ? 'shot-flat' : ''} ${className}`}
    />
  )
}

/** Small tinted chip in the site's tint palette. */
export function Chip({ tone = 'stone', children }: { tone?: 'stone' | 'sage' | 'clay' | 'sand' | 'rose'; children: ReactNode }) {
  const tones = {
    stone: 'bg-stone text-[#5f5e58]',
    sage: 'bg-tint-sage text-tint-sage-ink',
    clay: 'bg-tint-clay text-tint-clay-ink',
    sand: 'bg-tint-sand text-tint-sand-ink',
    rose: 'bg-tint-rose text-tint-rose-ink',
  }
  return <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}
