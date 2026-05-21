'use client';

import { useEffect, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  QrCode,
  Briefcase,
  CalendarRange,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Combobox } from '@/components/ui/Combobox';
import { cn } from '@/utils/cn';
import { sanitizeIntegerInput } from '@/lib/numeric-input';
import { apiFetch } from '@/utils/api';
import { translateStoreValue } from '@/lib/storefront-translations';

const SHOW_QR_PERSONALIZATION_SECTION = false;
const B2B_MINIMUM_QUANTITY = 50;

interface Department {
  id: string;
  name: string;
}

interface Municipality {
  id: string;
  name: string;
}

type PackageType = 'Empresa' | 'Evento';

const PACKAGES = [
  {
    id: 'Empresa',
    min: B2B_MINIMUM_QUANTITY,
    icon: Briefcase,
    activeClass:
      'bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-600 dark:ring-purple-500',
    iconClass: 'text-purple-600 dark:text-purple-400',
    textClass: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'Evento',
    min: 100,
    icon: CalendarRange,
    activeClass:
      'bg-amber-50 dark:bg-amber-900/30 ring-2 ring-amber-600 dark:ring-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
] as const;

const B2B_FORM_COPY = {
  es: {
    packageLabel: 'Selecciona tu paquete',
    packageCompany: 'Empresa',
    packageEvent: 'Evento',
    businessName: 'Nombre de la empresa',
    businessNamePlaceholder: 'Ej. Tech Solutions SAS',
    quantity: 'Cantidad (unidades)',
    quantityPlaceholder: 'Mínimo {{min}} unidades',
    contactPhone: 'Teléfono de contacto',
    department: 'Departamento',
    departmentPlaceholder: 'Selecciona un departamento',
    departmentSearch: 'Buscar departamento...',
    municipality: 'Municipio',
    municipalityPlaceholder: 'Selecciona un municipio',
    municipalitySearch: 'Buscar municipio...',
    municipalitySelectDepartment: 'Selecciona primero un departamento',
    municipalityEmpty: 'No se encontraron municipios',
    neighborhood: 'Barrio',
    neighborhoodPlaceholder: 'Ej. Chapinero Alto',
    address: 'Dirección exacta',
    addressPlaceholder: 'Ej. Calle 123 # 45 - 67, Apto 301',
    size: 'Tamaño / dimensión',
    sizeLoading: 'Cargando tamaños...',
    sizePlaceholder: 'Selecciona el tamaño',
    sizeSearch: 'Buscar tamaño...',
    sizeEmpty: 'No se encontraron tamaños',
    material: 'Material / tela',
    materialLoading: 'Cargando materiales...',
    materialPlaceholder: 'Selecciona el material',
    materialSearch: 'Buscar material...',
    materialEmpty: 'No se encontraron materiales',
    logo: 'Logo corporativo (alta calidad)',
    logoUpload: 'Haz clic para subir tu logo',
    logoFormats: 'Formatos: PNG, JPG, SVG. Fondo transparente recomendado.',
    submit: 'Solicitar cotización corporativa',
    consent:
      'Al enviar este formulario aceptas nuestra política de tratamiento de datos personales para fines comerciales.',
    uploadLogoError: 'Por favor sube tu logo',
    minQuantityError:
      'La cantidad mínima para el paquete {{label}} es {{min}} unidades.',
    submitError: 'Hubo un error al enviar tu solicitud',
    submitSuccess: 'Solicitud enviada correctamente',
    receivedTitle: 'Solicitud recibida',
    receivedDescription:
      'Hemos recibido tu solicitud B2B. Nuestro equipo comercial te contactará al {{phone}} en menos de 24 horas para finalizar los detalles de tu pedido corporativo.',
    submitAnother: 'Enviar otra solicitud',
  },
  en: {
    packageLabel: 'Select your package',
    packageCompany: 'Business',
    packageEvent: 'Event',
    businessName: 'Company name',
    businessNamePlaceholder: 'Ex. Tech Solutions LLC',
    quantity: 'Quantity (units)',
    quantityPlaceholder: 'Minimum {{min}} units',
    contactPhone: 'Contact phone',
    department: 'Department',
    departmentPlaceholder: 'Select a department',
    departmentSearch: 'Search department...',
    municipality: 'Municipality',
    municipalityPlaceholder: 'Select a municipality',
    municipalitySearch: 'Search municipality...',
    municipalitySelectDepartment: 'Select a department first',
    municipalityEmpty: 'No municipalities found',
    neighborhood: 'Neighborhood',
    neighborhoodPlaceholder: 'Ex. Chapinero Alto',
    address: 'Exact address',
    addressPlaceholder: 'Ex. 123 Main St, Apt 301',
    size: 'Size / dimensions',
    sizeLoading: 'Loading sizes...',
    sizePlaceholder: 'Select a size',
    sizeSearch: 'Search size...',
    sizeEmpty: 'No sizes found',
    material: 'Material / fabric',
    materialLoading: 'Loading materials...',
    materialPlaceholder: 'Select a material',
    materialSearch: 'Search material...',
    materialEmpty: 'No materials found',
    logo: 'Corporate logo (high quality)',
    logoUpload: 'Click to upload your logo',
    logoFormats: 'Formats: PNG, JPG, SVG. Transparent background recommended.',
    submit: 'Request corporate quote',
    consent:
      'By sending this form you accept our personal data processing policy for commercial purposes.',
    uploadLogoError: 'Please upload your logo',
    minQuantityError:
      'The minimum quantity for the {{label}} package is {{min}} units.',
    submitError: 'There was an error sending your request',
    submitSuccess: 'Request sent successfully',
    receivedTitle: 'Request received',
    receivedDescription:
      'We received your B2B request. Our commercial team will contact you at {{phone}} within 24 hours to finalize your corporate order details.',
    submitAnother: 'Send another request',
  },
} as const;

interface WizardOption {
  id?: string;
  name?: string;
  value?: string;
  category?: string;
  type?: string;
}

interface GroupedWizardOptions {
  DIMENSION?: WizardOption[];
  SIZE?: WizardOption[];
  MATERIAL?: WizardOption[];
  [key: string]: WizardOption[] | undefined;
}

export default function B2BQuoteForm() {
  const { t, i18n } = useTranslation();
  const copy = (i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? B2B_FORM_COPY.en
    : B2B_FORM_COPY.es;
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
    size: string;
    material: string;
  }>({
    businessName: '',
    quantity: B2B_MINIMUM_QUANTITY,
    department: '',
    municipality: '',
    neighborhood: '',
    address: '',
    contactPhone: '',
    qrType: 'WHATSAPP',
    qrData: '',
    package: 'Empresa',
    size: '',
    material: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [options, setOptions] = useState<{
    sizes: { id: string; name: string }[];
    materials: { id: string; name: string }[];
  }>({ sizes: [], materials: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await apiFetch('/locations/departments');
        if (res.ok) {
          const resJson = await res.json();
          setDepartments(resJson.data || []);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const res = await apiFetch('/wizard-options/grouped');
        if (res.ok) {
          const responseData = await res.json();
          const data = (responseData.data || responseData) as
            | GroupedWizardOptions
            | WizardOption[];

          let sizesArr: WizardOption[] = [];
          let materialsArr: WizardOption[] = [];

          if (Array.isArray(data)) {
            sizesArr = data.filter(
              (item) =>
                item.category === 'DIMENSION'
                || item.category === 'SIZE'
                || item.type === 'SIZE',
            );
            materialsArr = data.filter(
              (item) =>
                item.category === 'MATERIAL' || item.type === 'MATERIAL',
            );
          } else {
            sizesArr = data.DIMENSION || data.SIZE || [];
            materialsArr = data.MATERIAL || [];
          }

          setOptions({
            sizes: sizesArr.map((option) => ({
              id: (option.name || option.value) as string,
              name: (option.name || option.value) as string,
            })),
            materials: materialsArr.map((option) => ({
              id: (option.name || option.value) as string,
              name: (option.name || option.value) as string,
            })),
          });
        }
      } catch (err) {
        console.error('Error fetching options B2B:', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    void fetchDepartments();
    void fetchOptions();
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeIntegerInput(event.target.value);

    if (sanitizedValue === null) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      quantity: sanitizedValue,
    }));
  };

  const handleQuantityBlur = () => {
    const currentPkg = PACKAGES.find((pkg) => pkg.id === formData.package);
    const minimumQuantity = currentPkg?.min ?? B2B_MINIMUM_QUANTITY;
    const quantity = Number(formData.quantity || 0);

    if (quantity < minimumQuantity) {
      setFormData((prev) => ({
        ...prev,
        quantity: String(minimumQuantity),
      }));
    }
  };

  const handlePackageChange = (pkgId: PackageType) => {
    const pkg = PACKAGES.find((item) => item.id === pkgId);
    if (!pkg) return;

    let newQuantity = Number(formData.quantity || 0);
    if (newQuantity < pkg.min) {
      newQuantity = pkg.min;
    }

    setFormData((prev) => ({
      ...prev,
      package: pkgId,
      quantity: String(newQuantity),
    }));
  };

  const handleDepartmentChange = async (deptId: string, deptName: string) => {
    setSelectedDeptId(deptId);
    setFormData({ ...formData, department: deptName, municipality: '' });
    setMunicipalities([]);

    if (!deptId) {
      return;
    }

    try {
      const res = await apiFetch(`/locations/municipalities/${deptId}`);
      if (res.ok) {
        const resJson = await res.json();
        setMunicipalities(resJson.data || []);
      }
    } catch (err) {
      console.error('Error fetching municipalities:', err);
    }
  };

  const handleMunicipalityChange = (muniName: string) => {
    setFormData({ ...formData, municipality: muniName });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setLogoFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!logoFile) {
      toast.error(copy.uploadLogoError);
      return;
    }

    const currentPkg = PACKAGES.find((pkg) => pkg.id === formData.package);
    if (currentPkg && Number(formData.quantity) < currentPkg.min) {
      toast.error(
        copy.minQuantityError
          .replace(
            '{{label}}',
            currentPkg.id === 'Empresa' ? copy.packageCompany : copy.packageEvent,
          )
          .replace('{{min}}', String(currentPkg.min)),
      );
      return;
    }

    setLoading(true);

    try {
      const qrType = SHOW_QR_PERSONALIZATION_SECTION
        ? formData.qrType
        : 'WHATSAPP';
      const qrData = SHOW_QR_PERSONALIZATION_SECTION
        ? formData.qrData
        : formData.contactPhone.trim();

      const data = new FormData();
      data.append('businessName', formData.businessName);
      data.append('quantity', String(formData.quantity));
      data.append('department', formData.department);
      data.append('municipality', formData.municipality);
      data.append('neighborhood', formData.neighborhood);
      data.append('address', formData.address);
      data.append('contactPhone', formData.contactPhone);
      data.append('qrType', qrType);
      data.append('qrData', qrData);
      data.append('package', formData.package);
      data.append('size', formData.size);
      data.append('material', formData.material);
      data.append('logo', logoFile);

      const res = await apiFetch('/b2b/quote', {
        method: 'POST',
        body: data,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || copy.submitError);
      }

      setSuccess(true);
      toast.success(copy.submitSuccess);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : copy.submitError);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 px-6 py-12 text-center">
        <div className="mb-4 flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        </div>
        <h3 className="mb-2 text-2xl font-serif font-bold text-green-900">
          {copy.receivedTitle}
        </h3>
        <p className="mx-auto max-w-md text-green-800">
          {copy.receivedDescription.replace('{{phone}}', formData.contactPhone)}
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setFormData({
              businessName: '',
              quantity: String(B2B_MINIMUM_QUANTITY),
              department: '',
              municipality: '',
              neighborhood: '',
              address: '',
              contactPhone: '',
              qrType: 'WHATSAPP',
              qrData: '',
              package: 'Empresa',
              size: '',
              material: '',
            });
            setLogoFile(null);
            setSelectedDeptId('');
            setMunicipalities([]);
          }}
          className="mt-6 text-sm font-bold text-green-700 underline hover:text-green-900"
        >
          {copy.submitAnother}
        </button>
      </div>
    );
  }

  const currentMin =
    PACKAGES.find((pkg) => pkg.id === formData.package)?.min
    || B2B_MINIMUM_QUANTITY;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-theme bg-surface p-8 shadow-sm"
    >
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">
          {copy.packageLabel}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const isSelected = formData.package === pkg.id;
            const label =
              pkg.id === 'Empresa' ? copy.packageCompany : copy.packageEvent;

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handlePackageChange(pkg.id as PackageType)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border p-3 outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/5',
                  isSelected
                    ? `border-transparent ${pkg.activeClass}`
                    : 'border-theme bg-surface hover:bg-base',
                )}
              >
                <Icon
                  className={cn(
                    'mb-2 h-6 w-6',
                    isSelected ? pkg.iconClass : 'text-muted',
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-bold',
                    isSelected ? pkg.textClass : 'text-muted',
                  )}
                >
                  {label}
                </span>
                <span className="text-[10px] font-medium text-muted">
                  Min. {pkg.min}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.businessName}
          </label>
          <input
            type="text"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-theme bg-base/50 p-3 text-primary outline-none transition-all placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-primary"
            placeholder={copy.businessNamePlaceholder}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.quantity}
          </label>
          <div className="relative">
            <input
              type="text"
              name="quantity"
              inputMode="numeric"
              value={formData.quantity}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              required
              className="w-full rounded-lg border border-theme bg-base/50 p-3 text-primary outline-none transition-all placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-primary"
              placeholder={copy.quantityPlaceholder.replace(
                '{{min}}',
                String(currentMin),
              )}
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              Min: {currentMin}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.contactPhone}
          </label>
          <input
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-theme bg-base/50 p-3 text-primary outline-none transition-all placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-primary"
            placeholder="+57 300 123 4567"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.department}
          </label>
          <Combobox
            options={departments.map((department) => ({
              value: department.id,
              label: department.name,
            }))}
            value={selectedDeptId}
            onChange={handleDepartmentChange}
            placeholder={copy.departmentPlaceholder}
            searchPlaceholder={copy.departmentSearch}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.municipality}
          </label>
          <Combobox
            options={municipalities.map((municipality) => ({
              value: municipality.name,
              label: municipality.name,
            }))}
            value={formData.municipality}
            onChange={(value) => handleMunicipalityChange(value)}
            disabled={!selectedDeptId}
            placeholder={copy.municipalityPlaceholder}
            searchPlaceholder={copy.municipalitySearch}
            emptyMessage={
              !selectedDeptId
                ? copy.municipalitySelectDepartment
                : copy.municipalityEmpty
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.neighborhood}
          </label>
          <input
            type="text"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-theme bg-base/50 p-3 text-primary outline-none transition-all placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-primary"
            placeholder={copy.neighborhoodPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.address}
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-theme bg-base/50 p-3 text-primary outline-none transition-all placeholder:text-muted/50 focus:bg-surface focus:ring-2 focus:ring-primary"
            placeholder={copy.addressPlaceholder}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-theme/50 pt-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.size}
          </label>
          <Combobox
            options={options.sizes.map((size) => ({
              value: size.name,
              label: size.name,
            }))}
            value={formData.size}
            onChange={(value) => setFormData({ ...formData, size: value })}
            placeholder={loadingOptions ? copy.sizeLoading : copy.sizePlaceholder}
            searchPlaceholder={copy.sizeSearch}
            emptyMessage={loadingOptions ? copy.sizeLoading : copy.sizeEmpty}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.material}
          </label>
          <Combobox
            options={options.materials.map((material) => ({
              value: material.name,
              label: translateStoreValue('material', material.name, t),
            }))}
            value={formData.material}
            onChange={(value) => setFormData({ ...formData, material: value })}
            placeholder={
              loadingOptions ? copy.materialLoading : copy.materialPlaceholder
            }
            searchPlaceholder={copy.materialSearch}
            emptyMessage={loadingOptions ? copy.materialLoading : copy.materialEmpty}
          />
        </div>
      </div>

      {SHOW_QR_PERSONALIZATION_SECTION ? (
        <div className="border-t border-theme pt-4">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-primary">
            <QrCode className="h-4 w-4" /> Personalización Inteligente
          </h4>
        </div>
      ) : null}

      <div className="border-t border-theme pt-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.logo}
          </label>
          <div className="group relative">
            <input
              type="file"
              accept="image/png, image/jpeg, image/svg+xml"
              onChange={handleFileChange}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className={cn(
                'flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors',
                logoFile
                  ? 'border-secondary bg-secondary/5 text-secondary'
                  : 'border-theme bg-base/50 text-muted group-hover:border-primary group-hover:text-primary',
              )}
            >
              <UploadCloud className="h-5 w-5" />
              <span className="max-w-[200px] truncate text-sm font-medium">
                {logoFile ? logoFile.name : copy.logoUpload}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted">{copy.logoFormats}</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 flex w-full translate-y-0 items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold uppercase tracking-widest text-base-color shadow-lg transition-all duration-300 hover:-translate-y-1 hover:opacity-90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : copy.submit}
      </button>

      <p className="mt-4 text-center text-xs text-muted/60">{copy.consent}</p>
    </form>
  );
}
