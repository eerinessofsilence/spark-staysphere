import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { THEME_BOOTSTRAP } from '@/lib/theme';
import './globals.css';

/**
 * Type system: the platform's own interface face — San Francisco on Apple
 * devices, reached through `-apple-system` in the stack rather than shipped,
 * because Apple's licence does not allow serving the file. Inter is the
 * fallback that carries the same character to Windows and Android, and an
 * italic serif is kept for single emphasised phrases.
 */
const body = Inter({
  variable: '--font-ui-family',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const accent = Instrument_Serif({
  variable: '--font-accent-family',
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
});

export const metadata: Metadata = {
  title: 'SPARK StaySphere 360 — Asteria Cove',
  description: 'See the stay. Book the room. A white-label 3D hotel booking demo for Asteria Cove.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `.dark` re-scopes every token from the document root down, so a sheet
    // portalled to `document.body` from any route picks up the scheme the
    // same way its opener did, with nothing extra to carry it across. Day
    // is what the server renders — the site's default — and the script
    // below adds the class before the first paint if this visitor chose
    // night instead, so `suppressHydrationWarning` covers exactly that one
    // attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${body.variable} ${accent.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
