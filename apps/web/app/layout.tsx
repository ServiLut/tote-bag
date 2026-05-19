import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { getPublicAppBaseUrl } from '@/lib/env';

const metadataBase = getPublicAppBaseUrl();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: "Tote Bag Shop | Bolsos Artesanales y Personalizados en Colombia",
    template: "%s | Tote Bag Shop"
  },
  description: "Descubre nuestra colección de tote bags artesanales, ecológicos y personalizables. Hechos en Colombia con materiales premium. Envíos a todo el país.",
  keywords: ["tote bags", "bolsos de tela", "personalización", "bolsos artesanales", "Colombia", "moda sostenible"],
  authors: [{ name: "Tote Bag Shop Team" }],
  creator: "Tote Bag Shop",
  publisher: "Tote Bag Shop",
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
    title: 'Tote Bag Shop | Bolsos Artesanales y Personalizados',
    description: 'Bolsos artesanales y ecológicos creados para durar. Personaliza tu estilo hoy.',
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
    title: 'Tote Bag Shop | Bolsos Artesanales',
    description: 'Bolsos artesanales y ecológicos creados para durar.',
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

import { I18nProvider } from "@/components/I18nProvider";

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
