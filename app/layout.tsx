import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
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
    <html lang="en">
      <body className={`${body.variable} ${accent.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
