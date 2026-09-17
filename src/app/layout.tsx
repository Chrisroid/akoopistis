import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AudioPlayerProvider } from '@/context/AudioPlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayerBar from '@/components/AudioPlayerBar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Henry Dimoko Ministries | Sermon Audio Archive',
  description:
    'Listen and download data-friendly sermon audios from Henry Dimoko Ministries livestreams. Fast, low data consumption, and built for offline playback.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 selection:bg-amber-500 selection:text-neutral-950">
        <AudioPlayerProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
          <AudioPlayerBar />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
