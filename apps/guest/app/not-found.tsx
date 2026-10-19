import Link from 'next/link';
import { pill } from '@/lib/ui';
export default function NotFound() {
  return <main id="main" className="container-page flex min-h-[70dvh] flex-col items-center justify-center gap-5 text-center"><h1 className="text-display text-4xl">Page not found</h1><Link href="/rooms" className={pill('primary')}>Explore rooms</Link></main>;
}
