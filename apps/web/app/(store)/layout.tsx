'use client';

import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import CartDrawer from '@/components/store/CartDrawer';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-base transition-colors duration-300">
      <Navbar />
      <CartDrawer />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
