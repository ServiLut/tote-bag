'use client';

import { useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

export default function B2BQuoteForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    quantity: '',
    department: '',
    municipality: '',
    neighborhood: '',
    address: '',
    contactPhone: '',
    qrType: 'WHATSAPP',
    qrData: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoFile) {
      toast.error('Por favor sube tu logo');
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('businessName', formData.businessName);
      data.append('quantity', formData.quantity);
      data.append('department', formData.department);
      data.append('municipality', formData.municipality);
      data.append('neighborhood', formData.neighborhood);
      data.append('address', formData.address);
      data.append('contactPhone', formData.contactPhone);
      data.append('qrType', formData.qrType);
      data.append('qrData', formData.qrData);
      data.append('logo', logoFile);

      const res = await fetch(`${API_URL}/b2b/quote`, {
        method: 'POST',
        body: data,
      });

      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.message || 'Error al enviar cotización');
      }

      setSuccess(true);
      toast.success('Solicitud enviada correctamente');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Hubo un error al enviar tu solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-12 px-6 bg-green-50 rounded-2xl border border-green-100">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
        </div>
        <h3 className="text-2xl font-serif font-bold text-green-900 mb-2">¡Solicitud Recibida!</h3>
        <p className="text-green-800 max-w-md mx-auto">
          Hemos recibido tu solicitud B2B. Nuestro equipo comercial te contactará al <strong>{formData.contactPhone}</strong> en menos de 24 horas para finalizar los detalles de tu pedido corporativo.
        </p>
        <button 
          onClick={() => { setSuccess(false); setFormData({ businessName: '', quantity: '', department: '', municipality: '', neighborhood: '', address: '', contactPhone: '', qrType: 'WHATSAPP', qrData: '' }); setLogoFile(null); }}
          className="mt-6 text-sm font-bold underline text-green-700 hover:text-green-900"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Nombre de la Empresa</label>
          <input
            type="text"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Ej. Tech Solutions SAS"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Cantidad (Unidades)</label>
          <input
            type="number"
            name="quantity"
            min="12"
            value={formData.quantity}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Mínimo 12 unidades"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Teléfono de Contacto</label>
          <input
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="+57 300 123 4567"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Departamento</label>
          <input
            type="text"
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Ej. Cundinamarca"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Municipio</label>
          <input
            type="text"
            name="municipality"
            value={formData.municipality}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Ej. Bogotá D.C."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Barrio</label>
          <input
            type="text"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Ej. Chapinero Alto"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Dirección Exacta</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
            placeholder="Ej. Calle 123 # 45 - 67, Apto 301"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-sm font-bold text-black mb-4 flex items-center gap-2">
          <QrCode className="w-4 h-4" /> Personalización Inteligente
        </h4>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de Destino QR</label>
              <select
                name="qrType"
                value={formData.qrType}
                onChange={handleChange}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="WHATSAPP">WhatsApp Business</option>
                <option value="INSTAGRAM">Perfil de Instagram</option>
                <option value="WEB">Sitio Web Corporativo</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Link o Número del QR</label>
              <input
                type="text"
                name="qrData"
                value={formData.qrData}
                onChange={handleChange}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:bg-white transition-all outline-none"
                placeholder={
                  formData.qrType === 'WHATSAPP' 
                    ? 'Ej. +57 300 123 4567' 
                    : formData.qrType === 'INSTAGRAM' 
                      ? 'Ej. @tu_marca o link de perfil' 
                      : 'Ej. https://www.tuempresa.com'
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Logo Corporativo (Alta Calidad)</label>
            <div className="relative group">
              <input
                type="file"
                accept="image/png, image/jpeg, image/svg+xml"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`w-full p-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-3 transition-colors ${logoFile ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 text-gray-500 group-hover:border-black group-hover:text-black'}`}>
                <UploadCloud className="w-5 h-5" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {logoFile ? logoFile.name : 'Haz clic para subir tu logo'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500">Formatos: PNG, JPG, SVG. Fondo transparente recomendado.</p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-lg hover:shadow-xl translate-y-0 hover:-translate-y-1 duration-300"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Solicitar Cotización Corporativa'}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Al enviar este formulario aceptas nuestra política de tratamiento de datos personales para fines comerciales.
      </p>
    </form>
  );
}