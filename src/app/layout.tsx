import type { Metadata, Viewport } from 'next';
import { MotionConfig } from 'framer-motion';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manifest Sanctuary — Santuario de Manifestación & Rampage de Voz',
  description:
    'Santuario íntimo de manifestación con voz calibrada, afirmaciones subliminales y registro de sincronías.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Manifest',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f3fb' },
    { media: '(prefers-color-scheme: dark)', color: '#17141d' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased text-swiss-ink selection:bg-swiss-control dark:selection:bg-swiss-control">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
