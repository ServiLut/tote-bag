'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, UserCircle2, Loader2, Plus, CheckCircle2 } from 'lucide-react';
import Script from 'next/script';
import { Combobox } from '@/components/ui/Combobox';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

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

interface LocationItem {
  id: string;
  name: string;
}

interface Address {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  department: { name: string };
  municipalityId: string;
  municipality: { name: string };
  address: string;
  neighborhood?: string;
  additionalInfo?: string;
  isDefault: boolean;
}

interface OrderPayload {
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  department: string;
  city: string;
  shippingAddress: {
    city: string;
    address: string;
    phone: string;
  };
  items: {
    productId: string;
    variantId?: string;
    sku: string;
    quantity: number;
    price: number;
  }[];
}

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const router = useRouter();
  const supabase = createClient();
  const [authStep, setAuthStep] = useState<'CHOICE' | 'GUEST_FORM' | 'AUTHENTICATED'>('CHOICE');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Auth State
  const [accessToken, setAccessToken] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  // Form State (for guests or new addresses)
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

  const [departments, setDepartments] = useState<LocationItem[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationItem[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Check Session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setAccessToken(session.access_token);
        setAuthStep('AUTHENTICATED');
        setFormData(prev => ({ ...prev, email: session.user.email || '' }));
        
        // Fetch addresses for authenticated user
        try {
          const res = await fetch(`${apiUrl}/addresses`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const result = await res.json();
            const addrList = result.data || [];
            setAddresses(addrList);
            const defaultAddr = addrList.find((a: Address) => a.isDefault) || addrList[0];
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          }
        } catch (error) {
          console.error('Error fetching addresses:', error);
        }
      }
      setIsInitializing(false);
    };
    checkSession();
  }, [supabase, apiUrl]);

  // If cart is empty, redirect to catalog
  useEffect(() => {
    if (!isInitializing && items.length === 0) {
      router.push('/catalog');
    }
  }, [items, router, isInitializing]);

  // Fetch Departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch(`${apiUrl}/locations/departments`);
        if (res.ok) {
          const result = await res.json();
          setDepartments(Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        setDepartments([]);
      }
    };
    fetchDepts();
  }, [apiUrl]);

  // Fetch Municipalities when department changes
  useEffect(() => {
    if (!selectedDeptId) {
      setMunicipalities([]);
      return;
    }

    const fetchMunis = async () => {
      try {
        const res = await fetch(`${apiUrl}/locations/municipalities/${selectedDeptId}`);
        if (res.ok) {
          const result = await res.json();
          setMunicipalities(Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.error('Error fetching municipalities:', error);
        setMunicipalities([]);
      }
    };
    fetchMunis();
  }, [selectedDeptId, apiUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeptChange = (id: string, name: string) => {
    setSelectedDeptId(id);
    setSelectedCityId('');
    setFormData(prev => ({ ...prev, department: name, city: '' }));
  };

  const handleCityChange = (id: string, name: string) => {
    setSelectedCityId(id);
    setFormData(prev => ({ ...prev, city: name }));
  };

  const processCheckout = async (payload: OrderPayload) => {
    setIsLoading(true);
    try {
      // 1. Create Order
      const res = await fetch(`${apiUrl}/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error creando la orden');
      }
      
      const orderResult = await res.json();
      const orderId = orderResult.data?.id || orderResult.id; 

      if (!orderId) throw new Error('No se recibió el ID de la orden');

      // 2. Get Payment Signature
      const signRes = await fetch(`${apiUrl}/payments/wompi/signature/${orderId}`);
      if (!signRes.ok) throw new Error('Error obteniendo firma de pago');
      
      const signResult = await signRes.json();
      const signData = signResult.data;

      // 3. Open Wompi Widget
      const checkout = new window.WidgetCheckout({
        currency: signData.currency,
        amountInCents: signData.amountInCents,
        reference: signData.reference,
        publicKey: signData.publicKey,
        signature: { integrity: signData.signature },
        redirectUrl: `${window.location.origin}/dashboard/orders`,
        customerData: {
          email: payload.customerEmail,
          fullName: `${payload.firstName} ${payload.lastName}`,
          phoneNumber: payload.customerPhone,
          phoneNumberPrefix: '+57',
          legalId: '123456789',
          legalIdType: 'CC'
        }
      });

      checkout.open((result: WompiResult) => {
        console.log('Transaction Result:', result.transaction);
      });

    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Error al procesar el pedido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department || !formData.city) {
      toast.error('Por favor selecciona departamento y municipio');
      return;
    }

    const payload = {
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
        variantId: item.variant.id,
        sku: item.variant.sku,
        quantity: item.quantity,
        price: item.product.basePrice,
      })),
    };

    await processCheckout(payload);
  };

  const handleAuthenticatedCheckout = async () => {
    const selectedAddress = addresses.find(a => a.id === selectedAddressId);
    if (!selectedAddress) {
      toast.error('Por favor selecciona una dirección de envío');
      return;
    }

    const payload = {
      firstName: selectedAddress.firstName,
      lastName: selectedAddress.lastName,
      customerEmail: formData.email,
      customerPhone: selectedAddress.phone,
      department: selectedAddress.department.name,
      city: selectedAddress.municipality.name,
      shippingAddress: {
        city: selectedAddress.municipality.name,
        address: `${selectedAddress.address}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''}`,
        phone: selectedAddress.phone,
      },
      items: items.map(item => ({
        productId: item.product.id,
        variantId: item.variant.id,
        sku: item.variant.sku,
        quantity: item.quantity,
        price: item.product.basePrice,
      })),
    };

    await processCheckout(payload);
  };

  if (isInitializing || items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.wompi.co/widget.js" strategy="lazyOnload" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-serif font-bold text-primary mb-8">Finalizar Compra</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-7 space-y-8">
            
            {authStep === 'CHOICE' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-6 text-primary">¿Cómo quieres continuar?</h2>
                <div className="grid gap-6">
                  <div className="border border-theme rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group" onClick={() => router.push('/login?redirect=/checkout')}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">Ya soy cliente</h3>
                        <p className="text-sm text-muted">Inicia sesión para usar tus direcciones guardadas.</p>
                      </div>
                    </div>
                  </div>
                  <div onClick={() => setAuthStep('GUEST_FORM')} className="border border-theme rounded-lg p-6 hover:border-primary transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-base transition-colors">
                        <UserCircle2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-primary">Continuar como invitado</h3>
                        <p className="text-sm text-muted">No necesitas crear una cuenta.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {authStep === 'AUTHENTICATED' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Dirección de Envío</h2>
                  <button 
                    onClick={() => router.push('/profile')}
                    className="text-sm text-accent hover:opacity-80 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Gestionar Direcciones
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-theme rounded-lg">
                    <p className="text-muted mb-4 text-sm">No tienes direcciones guardadas.</p>
                    <button 
                      onClick={() => router.push('/profile')}
                      className="px-6 py-2 bg-primary text-base-color font-bold text-xs uppercase tracking-widest rounded-sm"
                    >
                      Ir a mi Perfil
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {addresses.map((address) => (
                      <div 
                        key={address.id} 
                        onClick={() => setSelectedAddressId(address.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all relative ${
                          selectedAddressId === address.id 
                            ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                            : 'border-theme bg-base/10 hover:border-accent/30'
                        }`}
                      >
                        {selectedAddressId === address.id && (
                          <div className="absolute top-4 right-4 text-accent">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="pr-10">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">
                            {address.title} {address.isDefault && '(Predeterminada)'}
                          </span>
                          <p className="text-sm font-bold text-primary mb-1">
                            {address.firstName} {address.lastName}
                          </p>
                          <p className="text-xs text-muted leading-relaxed">
                            {address.address}<br />
                            {address.neighborhood && `${address.neighborhood}, `}
                            {address.municipality.name}, {address.department.name}
                          </p>
                          <p className="text-xs text-muted mt-2 font-medium">Tél: {address.phone}</p>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={handleAuthenticatedCheckout}
                      disabled={isLoading || !selectedAddressId}
                      className="mt-6 w-full py-4 bg-primary text-base-color font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
                    >
                      {isLoading ? 'Procesando...' : 'Pagar con Wompi'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {authStep === 'GUEST_FORM' && (
              <div className="bg-surface p-8 rounded-lg shadow-sm border border-theme animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Datos de Envío</h2>
                  <button onClick={() => setAuthStep('CHOICE')} className="text-sm text-muted hover:text-primary underline" type="button">Volver</button>
                </div>
                <form onSubmit={handleGuestCheckout} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Correo Electrónico</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" placeholder="tu@email.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Teléfono</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" placeholder="+57 300..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Nombres</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Apellidos</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Departamento</label>
                    <Combobox options={(departments || []).map(d => ({ value: d.id, label: d.name }))} value={selectedDeptId} onChange={handleDeptChange} placeholder="Seleccionar departamento" searchPlaceholder="Buscar departamento..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Municipio / Ciudad</label>
                    <Combobox options={(municipalities || []).map(m => ({ value: m.id, label: m.name }))} value={selectedCityId} onChange={handleCityChange} placeholder="Seleccionar municipio" searchPlaceholder="Buscar municipio..." disabled={!selectedDeptId} emptyMessage={selectedDeptId ? "No se encontraron municipios." : "Selecciona un departamento primero."} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Barrio</label>
                    <input type="text" name="neighborhood" required value={formData.neighborhood} onChange={handleInputChange} className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-xs font-bold uppercase text-muted">Dirección Exacta</label>
                    <input type="text" name="address" required value={formData.address} onChange={handleInputChange} className="w-full p-3 bg-base border border-theme rounded outline-none focus:border-primary text-primary" placeholder="Calle 123 # 45-67, Apto 101" />
                  </div>
                  <div className="col-span-full pt-4">
                    <button type="submit" disabled={isLoading} className="w-full py-4 btn-primary font-bold uppercase tracking-widest rounded-sm disabled:opacity-50">
                      {isLoading ? 'Procesando...' : 'Continuar a Pago con Wompi'}
                    </button>
                    <p className="text-center text-xs text-muted mt-4">Serás redirigido a la pasarela de pagos segura de Wompi Bancolombia.</p>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="bg-surface p-6 rounded-lg shadow-sm border border-theme sticky top-24">
              <h3 className="font-bold text-lg mb-4 text-primary">Resumen de Compra</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-theme">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-16 h-20 bg-base rounded overflow-hidden shrink-0 border border-theme">
                      <Image src={item.variant.imageUrl || item.product.images[0]?.url || '/placeholder.svg'} alt={item.product.name} fill className="object-cover" />
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
                <div className="flex justify-between text-sm"><span className="text-muted">Subtotal</span><span className="text-primary">${subtotal.toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">Envío</span><span className="text-muted/60 text-xs italic">Por calcular</span></div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-theme mt-2 text-primary"><span>Total</span><span>${subtotal.toLocaleString('es-CO')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
