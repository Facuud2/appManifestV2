import type { Metadata, Viewport } from 'next';
import { MotionConfig } from 'framer-motion';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manifest Sanctuary — Santuario de Manifestación & Rampage de Voz',
  description:
    'Santuario íntimo de manifestación con voz calibrada, afirmaciones subliminales y registro de sincronías.',
  manifest: '/manifest.json',
  applicationName: 'Manifest Sanctuary',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7fd' },
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
      <body className="antialiased text-swiss-ink selection:bg-swiss-control dark:selection:bg-swiss-control">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
