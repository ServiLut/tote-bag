'use client';

import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import CartDrawer from '@/components/store/CartDrawer';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />
      <CartDrawer />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        {children}
      </main>
      <Footer />
    </div>
  );
}
