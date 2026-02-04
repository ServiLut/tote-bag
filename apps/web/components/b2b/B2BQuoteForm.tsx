'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Loader2, QrCode, Zap, Briefcase, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { cn } from '@/utils/cn';

interface Department {
  id: string;
  name: string;
}

interface Municipality {
  id: string;
  name: string;
}

type PackageType = 'Starter' | 'Pro' | 'Evento';

const PACKAGES = [
  { 
    id: 'Starter', 
    label: 'Starter', 
    min: 12, 
    icon: Zap, 
    activeClass: 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-600 dark:ring-blue-500',
    iconClass: 'text-blue-600 dark:text-blue-400',
    textClass: 'text-blue-700 dark:text-blue-300'
  },
  { 
    id: 'Pro', 
    label: 'Pro', 
    min: 50, 
    icon: Briefcase, 
    activeClass: 'bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-600 dark:ring-purple-500',
    iconClass: 'text-purple-600 dark:text-purple-400',
    textClass: 'text-purple-700 dark:text-purple-300'
  },
  { 
    id: 'Evento', 
    label: 'Evento', 
    min: 200, 
    icon: Crown, 
    activeClass: 'bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-600 dark:ring-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-700 dark:text-amber-300'
  },
] as const;

export default function B2BQuoteForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<{
    businessName: string;
    quantity: string | number;
    department: string;
    municipality: string;
    neighborhood: string;
    address: string;
    contactPhone: string;
    qrType: string;
    qrData: string;
    package: PackageType;
  }>({
    businessName: '',
    quantity: 12,
    department: '',
    municipality: '',
    neighborhood: '',
    address: '',
    contactPhone: '',
    qrType: 'WHATSAPP',
    qrData: '',
    package: 'Starter',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Locations State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    // Fetch departments on load
    const fetchDepartments = async () => {
      try {
        const res = await fetch(`${API_URL}/locations/departments`);
        if (res.ok) {
          const resJson = await res.json();
          setDepartments(resJson.data || []);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepartments();
  }, [API_URL]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePackageChange = (pkgId: PackageType) => {
    const pkg = PACKAGES.find(p => p.id === pkgId);
    if (!pkg) return;

    let newQuantity = Number(formData.quantity);
    if (newQuantity < pkg.min) {
      newQuantity = pkg.min;
    }

    setFormData(prev => ({
      ...prev,
      package: pkgId,
      quantity: newQuantity
    }));
  };

  const handleDepartmentChange = async (deptId: string, deptName: string) => {
    setSelectedDeptId(deptId);
    setFormData({ ...formData, department: deptName, municipality: '' });
    setMunicipalities([]);

    if (deptId) {
      try {
        const res = await fetch(`${API_URL}/locations/municipalities/${deptId}`);
        if (res.ok) {
          const resJson = await res.json();
          setMunicipalities(resJson.data || []);
        }
      } catch (err) {
        console.error('Error fetching municipalities:', err);
      }
    }
  };

  const handleMunicipalityChange = (muniName: string) => {
    setFormData({ ...formData, municipality: muniName });
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

    const currentPkg = PACKAGES.find(p => p.id === formData.package);
    if (currentPkg && Number(formData.quantity) < currentPkg.min) {
      toast.error(`La cantidad mínima para el paquete ${currentPkg.label} es ${currentPkg.min} unidades.`);
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append('businessName', formData.businessName);
      data.append('quantity', String(formData.quantity));
      data.append('department', formData.department);
      data.append('municipality', formData.municipality);
      data.append('neighborhood', formData.neighborhood);
      data.append('address', formData.address);
      data.append('contactPhone', formData.contactPhone);
      data.append('qrType', formData.qrType);
      data.append('qrData', formData.qrData);
      data.append('package', formData.package);
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
          onClick={() => { 
            setSuccess(false); 
            setFormData({ businessName: '', quantity: 12, department: '', municipality: '', neighborhood: '', address: '', contactPhone: '', qrType: 'WHATSAPP', qrData: '', package: 'Starter' }); 
            setLogoFile(null);
            setSelectedDeptId('');
            setMunicipalities([]);
          }}
          className="mt-6 text-sm font-bold underline text-green-700 hover:text-green-900"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  const currentMin = PACKAGES.find(p => p.id === formData.package)?.min || 12;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-surface p-8 rounded-2xl shadow-sm border border-theme">
      
      {/* Package Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">Selecciona tu Paquete</label>
        <div className="grid grid-cols-3 gap-3">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const isSelected = formData.package === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handlePackageChange(pkg.id as PackageType)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/5",
                  isSelected 
                    ? `border-transparent ${pkg.activeClass}`
                    : "border-theme bg-surface hover:bg-base"
                )}
              >
                <Icon className={cn("w-6 h-6 mb-2", isSelected ? pkg.iconClass : "text-muted")} />
                <span className={cn("text-xs font-bold", isSelected ? pkg.textClass : "text-muted")}>{pkg.label}</span>
                <span className="text-[10px] text-muted font-medium">Min. {pkg.min}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Nombre de la Empresa</label>
          <input
            type="text"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
            className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
            placeholder="Ej. Tech Solutions SAS"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Cantidad (Unidades)</label>
          <div className="relative">
            <input
              type="number"
              name="quantity"
              min={currentMin}
              value={formData.quantity}
              onChange={handleChange}
              required
              className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
              placeholder={`Mínimo ${currentMin} unidades`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
              Min: {currentMin}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Teléfono de Contacto</label>
          <input
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            required
            className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
            placeholder="+57 300 123 4567"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Departamento</label>
          <Combobox
            options={departments.map(d => ({ value: d.id, label: d.name }))}
            value={selectedDeptId}
            onChange={handleDepartmentChange}
            placeholder="Selecciona un departamento"
            searchPlaceholder="Buscar departamento..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Municipio</label>
          <Combobox
            options={municipalities.map(m => ({ value: m.name, label: m.name }))}
            value={formData.municipality}
            onChange={(val) => handleMunicipalityChange(val)}
            disabled={!selectedDeptId}
            placeholder="Selecciona un municipio"
            searchPlaceholder="Buscar municipio..."
            emptyMessage={!selectedDeptId ? 'Selecciona primero un departamento' : 'No se encontraron municipios'}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Barrio</label>
          <input
            type="text"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            required
            className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
            placeholder="Ej. Chapinero Alto"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Dirección Exacta</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
            placeholder="Ej. Calle 123 # 45 - 67, Apto 301"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-theme">
        <h4 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
          <QrCode className="w-4 h-4" /> Personalización Inteligente
        </h4>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted">Tipo de Destino QR</label>
              <select
                name="qrType"
                value={formData.qrType}
                onChange={handleChange}
                className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none appearance-none cursor-pointer text-primary"
              >
                <option value="WHATSAPP">WhatsApp Business</option>
                <option value="INSTAGRAM">Perfil de Instagram</option>
                <option value="WEB">Sitio Web Corporativo</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted">Link o Número del QR</label>
              <input
                type="text"
                name="qrData"
                value={formData.qrData}
                onChange={handleChange}
                required
                className="w-full p-3 bg-base/50 border border-theme rounded-lg focus:ring-2 focus:ring-primary focus:bg-surface transition-all outline-none text-primary placeholder:text-muted/50"
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
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Logo Corporativo (Alta Calidad)</label>
            <div className="relative group">
              <input
                type="file"
                accept="image/png, image/jpeg, image/svg+xml"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={cn(
                "w-full p-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-3 transition-colors",
                logoFile 
                  ? 'border-secondary bg-secondary/5 text-secondary' 
                  : 'border-theme bg-base/50 text-muted group-hover:border-primary group-hover:text-primary'
              )}>
                <UploadCloud className="w-5 h-5" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {logoFile ? logoFile.name : 'Haz clic para subir tu logo'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted">Formatos: PNG, JPG, SVG. Fondo transparente recomendado.</p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-primary text-base-color font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-lg hover:shadow-xl translate-y-0 hover:-translate-y-1 duration-300"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Solicitar Cotización Corporativa'}
      </button>

      <p className="text-center text-xs text-muted/60 mt-4">
        Al enviar este formulario aceptas nuestra política de tratamiento de datos personales para fines comerciales.
      </p>
    </form>
  );
}