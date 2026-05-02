import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ModalsProvider } from '@/components/modals/ModalsProvider';

const karnak = localFont({
  src: '../public/fonts/karnakcondensed-normal-700.ttf',
  weight: '700',
  variable: '--font-karnak',
});

const franklin = localFont({
  src: '../public/fonts/franklin-normal-700.ttf',
  weight: '700',
  variable: '--font-franklin',
});

export const metadata: Metadata = {
  title: 'Connections',
  description: 'Group words that share a common thread.',
  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/favicon/apple-touch-icon.png' },
  },
  manifest: '/favicon/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${karnak.variable} ${franklin.variable}`}>
      <body>
        <ThemeProvider>
          <ModalsProvider>{children}</ModalsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
