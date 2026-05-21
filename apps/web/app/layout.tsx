import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider } from '@/components/theme-provider';
import { CookieConsent } from '@/components/ui/CookieConsent';
import { getPublicAppBaseUrl } from '@/lib/env';
import { I18nProvider } from '@/components/I18nProvider';

const metadataBase =
  getPublicAppBaseUrl() ?? new URL('https://www.totebagbolsadetela.com');

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: 'Tote Bag Shop | Tote bags personalizables en Colombia',
    template: '%s | Tote Bag Shop',
  },
  description:
    'Descubre tote bags funcionales, personalizables y producidas en Colombia para compra inmediata, marcas y eventos.',
  keywords: ['tote bags', 'bolsos de tela', 'personalizacion', 'Colombia', 'regalos empresariales'],
  authors: [{ name: 'Tote Bag Shop Team' }],
  creator: 'Tote Bag Shop',
  publisher: 'Tote Bag Shop',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: metadataBase?.toString() || 'https://totebag.shop',
    siteName: 'Tote Bag Shop',
    title: 'Tote Bag Shop | Tote bags personalizables en Colombia',
    description:
      'Tote bags funcionales, personalizables y listas para compra inmediata o cotizacion.',
    images: [
      {
        url: '/tote_bag_lifestyle.png',
        width: 1200,
        height: 630,
        alt: 'Tote Bag Shop Lifestyle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tote Bag Shop | Tote bags personalizables',
    description:
      'Tote bags funcionales, personalizables y listas para compra inmediata o cotizacion.',
    images: ['/tote_bag_lifestyle.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-base text-body`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <CartProvider>
              <Toaster position="top-right" richColors closeButton />
              <CookieConsent />
              {children}
            </CartProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
