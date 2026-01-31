'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { Upload, Smartphone, Globe, Instagram, Send, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiResponse } from '@/types/api';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type QrType = 'WHATSAPP' | 'WEB' | 'INSTAGRAM';

interface FormData {
  businessName: string;
  quantity: number;
  city: string;
  contactPhone: string;
  qrType: QrType;
  logo: File | null;
}

const INITIAL_STATE: FormData = {
  businessName: '',
  quantity: 50,
  city: '',
  contactPhone: '',
  qrType: 'WHATSAPP',
  logo: null,
};

export const B2BQuoteForm = () => {
  const [formData, setFormData] = useState<FormData>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getPackageInfo = (qty: number) => {
    if (qty < 50) return { name: 'Starter', desc: 'Ideal para pruebas o pequeños equipos.', color: 'bg-gray-100 text-gray-800' };
    if (qty <= 200) return { name: 'Pro', desc: 'El favorito de las marcas en crecimiento.', color: 'bg-black text-white' };
    return { name: 'Evento', desc: 'Para grandes activaciones y campañas masivas.', color: 'bg-gray-800 text-white' };
  };

  const currentPackage = getPackageInfo(formData.quantity);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({ ...prev, logo: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.logo) {
      alert('Por favor adjunta tu logo para continuar.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const data = new FormData();
      data.append('businessName', formData.businessName);
      data.append('quantity', formData.quantity.toString());
      data.append('city', formData.city);
      data.append('contactPhone', formData.contactPhone);
      data.append('qrType', formData.qrType);
      data.append('logo', formData.logo);

      // Enviar datos al backend NestJS
      const response = await fetch('http://localhost:4000/b2b/quote', {
        method: 'POST',
        body: data,
      });

      if (!response.ok) throw new Error('Error al enviar la solicitud');

      const responseBody: ApiResponse<{ whatsappPayload: { message: string } }> = await response.json();
      const result = responseBody.data;
      
      // WhatsApp Redirection
      const whatsappUrl = `https://wa.me/573000000000?text=${encodeURIComponent(result.whatsappPayload.message)}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (error) {
      console.error('Submission error:', error);
      alert('Hubo un error al procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-8 bg-white text-[#171717] rounded-xl shadow-lg font-sans border border-gray-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-3">Cotiza tus Tote Bags Corporativas</h2>
        <p className="text-gray-600">Personalización de alto nivel para tu marca. Incluye 1 ronda de diseño.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Package Indicator */}
        <div className={cn("p-4 rounded-lg flex items-center justify-between transition-colors duration-300", currentPackage.color)}>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold opacity-80">Paquete Sugerido</span>
            <h3 className="text-xl font-bold">{currentPackage.name}</h3>
          </div>
          <div className="text-right text-sm opacity-90 max-w-[50%]">
            {currentPackage.desc}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre de la Marca / Empresa</label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cantidad de Unidades</label>
            <input
              type="number"
              name="quantity"
              min="1"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
           <div className="space-y-2">
            <label className="text-sm font-medium">Ciudad de Envío</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium">Teléfono de Contacto</label>
             <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="+57..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium block">Tipo de QR Inteligente</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'WHATSAPP', icon: Smartphone, label: 'WhatsApp' },
              { id: 'WEB', icon: Globe, label: 'Sitio Web' },
              { id: 'INSTAGRAM', icon: Instagram, label: 'Instagram' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, qrType: type.id as QrType }))}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 gap-2",
                  formData.qrType === type.id
                    ? "border-black bg-black text-white shadow-md"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <type.icon size={20} />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Info size={12} />
            El QR será impreso en una etiqueta de alta durabilidad.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Adjuntar Logo (Vector o Alta Calidad)</label>
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer group text-center">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.pdf,.ai"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-black">
              <Upload size={24} />
              <span className="text-sm font-medium">
                {formData.logo ? formData.logo.name : 'Haz clic para subir tu archivo'}
              </span>
              {!formData.logo && <span className="text-xs text-gray-400">PDF, AI, PNG, SVG (Máx 10MB)</span>}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 p-4 bg-black text-white font-bold rounded-lg hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isSubmitting ? (
              'Procesando...'
            ) : (
              <>
                Solicitar Cotización <Send size={18} />
              </>
            )}
          </button>
          <p className="text-xs text-center text-gray-500 mt-3">
            Al enviar, serás redirigido a WhatsApp para finalizar los detalles con un asesor.
          </p>
        </div>
      </form>
    </div>
  );
};
