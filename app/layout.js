import Providers from '@/components/Providers';
import './globals.css';

export const metadata = {
  title: 'Mixer',
  description: 'Your music, everywhere you sign in.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#141414',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
