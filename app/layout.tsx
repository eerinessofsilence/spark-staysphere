import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Serif, Onest } from 'next/font/google';
import './globals.css';

/**
 * Type system: a characterful grotesk for display, a quiet humanist sans for
 * body, and an italic serif reserved for single emphasised phrases. All three
 * are self-hosted at build time; see DESIGN_SYSTEM.md before adding a fourth.
 */
const display = Bricolage_Grotesque({
  variable: '--font-display-family',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const body = Onest({
  variable: '--font-body-family',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
      <body className={`${display.variable} ${body.variable} ${accent.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
