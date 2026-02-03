'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import Image from 'next/image';
import { User, UserCircle2 } from 'lucide-react';
import Script from 'next/script';

// Type for Wompi Widget
interface WompiWidgetOptions {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl: string;
  customerData: {
    email: string;
    fullName: string;
    phoneNumber: string;
    phoneNumberPrefix: string;
    legalId?: string;
    legalIdType?: string;
  };
}

interface WompiResult {
  transaction: {
    status: string;
    id: string;
    reference: string;
    [key: string]: unknown;
  };
}

interface WompiWidgetInstance {
  open: (callback: (result: WompiResult) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout: new (options: WompiWidgetOptions) => WompiWidgetInstance;
  }
}

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const router = useRouter();
  const [authStep, setAuthStep] = useState<'CHOICE' | 'GUEST_FORM' | 'LOGIN'>('CHOICE');
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    department: '',
    city: '',
    neighborhood: '',
    address: '',
  });

  // If cart is empty, redirect to catalog
  useEffect(() => {
    if (items.length === 0) {
      router.push('/catalog');
    }
  }, [items, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      // 1. Create Order
      const orderPayload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        department: formData.department,
        city: formData.city,
                shippingAddress: {
                  city: formData.city,
                  address: `${formData.address} - ${formData.neighborhood}`,
                  phone: formData.phone,
                },
                items: items.map(item => ({
                  productId: item.product.id,
                  variantId: item.variant.id, // Assuming variant has ID, checking interface below
                  sku: item.variant.sku,
                  quantity: item.quantity,
                  price: item.product.basePrice,
                })),
              };
        
              const res = await fetch(`${apiUrl}/orders`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) throw new Error('Error creando la orden');
      
      const orderData = await res.json();
      // Adjust depending on backend response structure (NestJS might wrap in data or not)
      // Assuming it returns the Order object directly or inside data
      const orderId = orderData.id || orderData.data?.id; 

      if (!orderId) throw new Error('No se recibió el ID de la orden');

      // 2. Get Payment Signature
      const signRes = await fetch(`${apiUrl}/payments/wompi/signature/${orderId}`);
      if (!signRes.ok) throw new Error('Error obteniendo firma de pago');
      
      const signData = await signRes.json(); // { reference, amountInCents, currency, signature, publicKey }

      // 3. Open Wompi Widget
      const checkout = new window.WidgetCheckout({
        currency: signData.currency,
        amountInCents: signData.amountInCents,
        reference: signData.reference,
        publicKey: signData.publicKey,
        signature: { integrity: signData.signature }, // New format often requires integrity object
        redirectUrl: `${window.location.origin}/dashboard/orders`, // Redirect after payment
        customerData: {
          email: formData.email,
          fullName: `${formData.firstName} ${formData.lastName}`,
          phoneNumber: formData.phone,
          phoneNumberPrefix: '+57',
          legalId: '123456789', // Optional or ask user
          legalIdType: 'CC' // Optional
        }
      });

      checkout.open((result: WompiResult) => {
        const transaction = result.transaction;
        console.log('Transaction Result:', transaction);
        // We rely on the redirectUrl for success flow usually, 
        // or we can handle it here if not redirecting.
      });

    } catch (error) {
      console.error(error);
      alert('Hubo un error al procesar el pedido. Por favor intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-base transition-colors duration-300">
      <Navbar />
      <Script src="https://checkout.wompi.co/widget.js" strategy="lazyOnload" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-serif font-bold text-primary mb-8">Finalizar Compra</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Auth / Forms */}
          <div className="lg:col-span-7 space-y-8">
            
            {authStep === 'CHOICE' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-6 text-primary">¿Cómo quieres continuar?</h2>
                
                <div className="grid gap-6">
                  {/* Option 1: Login */}
                  <div className="border border-theme rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group" onClick={() => router.push('/login?redirect=/checkout')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">Ya soy cliente</h3>
                        <p className="text-sm text-muted">Inicia sesión para usar tus direcciones guardadas y acumular puntos.</p>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Guest */}
                  <div 
                    onClick={() => setAuthStep('GUEST_FORM')}
                    className="border border-theme rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <UserCircle2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">Continuar como invitado</h3>
                        <p className="text-sm text-muted">No necesitas crear una cuenta. Solo te pediremos los datos necesarios para el envío.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {authStep === 'GUEST_FORM' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Datos de Envío</h2>
                  <button 
                    onClick={() => setAuthStep('CHOICE')}
                    className="text-sm text-muted hover:text-primary underline"
                    type="button"
                  >
                    Volver
                  </button>
                </div>

                <form onSubmit={handleGuestCheckout} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Correo Electrónico</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required 
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                      placeholder="tu@email.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Teléfono</label>
                    <input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required 
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                      placeholder="+57 300..." 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Nombres</label>
                    <input 
                      type="text" 
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required 
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Apellidos</label>
                    <input 
                      type="text" 
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required 
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Departamento</label>
                    <input 
                      type="text" 
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required 
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Municipio / Ciudad</label>
                    <input 
                      type="text" 
                      name="city"
                      required 
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Barrio</label>
                    <input 
                      type="text" 
                      name="neighborhood"
                      required 
                      value={formData.neighborhood}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                    />
                  </div>

                  <div className="col-span-full space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Dirección Exacta</label>
                    <input 
                      type="text" 
                      name="address"
                      required 
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" 
                      placeholder="Calle 123 # 45-67, Apto 101" 
                    />
                  </div>

                  <div className="col-span-full pt-4">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-4 btn-primary font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
                    >
                      {isLoading ? 'Procesando...' : 'Continuar a Pago con Wompi'}
                    </button>
                    <p className="text-center text-xs text-muted mt-4">
                      Serás redirigido a la pasarela de pagos segura de Wompi Bancolombia.
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface p-6 rounded-lg shadow-sm border border-theme sticky top-24">
              <h3 className="font-bold text-lg mb-4 text-primary">Resumen de Compra</h3>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-theme">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-16 h-20 bg-base rounded overflow-hidden shrink-0 border border-theme">
                      <Image
                        src={item.variant.imageUrl || item.product.images[0]?.url || '/placeholder.svg'}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                      <span className="absolute top-0 right-0 bg-primary/10 backdrop-blur-sm text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-bl">x{item.quantity}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium line-clamp-2 text-primary">{item.product.name}</h4>
                      <p className="text-xs text-muted">{item.variant.color}</p>
                      <p className="text-sm font-semibold mt-1 text-primary">${(item.product.basePrice * item.quantity).toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-theme pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-primary">${subtotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Envío</span>
                  <span className="text-muted/60 text-xs italic">Por calcular</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-theme mt-2 text-primary">
                  <span>Total</span>
                  <span>${subtotal.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}
