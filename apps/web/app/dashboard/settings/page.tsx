'use client';

import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Loader2,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Save,
  Building2,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { SettingsTabs } from '@/components/dashboard/SettingsTabs';
import { isDashboardReadOnlyRole } from '@/lib/frontend-routing';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

interface ProfileData {
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
  departmentId: string;
  municipality: string;
  municipalityId: string;
  neighborhood: string;
  address: string;
}

interface Department {
  id: string;
  name: string;
}

interface Municipality {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [formData, setFormData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phone: '',
    department: '',
    departmentId: '',
    municipality: '',
    municipalityId: '',
    neighborhood: '',
    address: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const { role } = useDashboardAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const supabase = createClient();

  const isReadOnly = isDashboardReadOnlyRole(role);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const headers = await getAuthHeaders();

        // Fetch profile and departments in parallel
        const [profileRes, departmentsRes] = await Promise.all([
          apiFetch('/profiles/me', { headers }),
          apiFetch('/locations/departments', { headers })
        ]);

        if (profileRes.ok) {
          const { data } = await profileRes.json();
          if (data) {
            setFormData({
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              phone: data.phone || '',
              department: data.department || '',
              departmentId: data.departmentId || '',
              municipality: data.municipality || '',
              municipalityId: data.municipalityId || '',
              neighborhood: data.neighborhood || '',
              address: data.address || '',
            });
            setEmail(data.email || '');
          }
        }

        if (departmentsRes.ok) {
          const { data } = await departmentsRes.json();
          setDepartments(data || []);
        }

      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [supabase.auth]);

  // Handle department change to fetch municipalities
  useEffect(() => {
    if (!formData.departmentId) {
      setMunicipalities([]);
      return;
    }

    const fetchMuncipalities = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await apiFetch(`/locations/municipalities/${formData.departmentId}`, {
          headers,
        });
        if (res.ok) {
          const { data } = await res.json();
          const nextMunicipalities = data || [];
          setMunicipalities(nextMunicipalities);
          setFormData((current) => {
            if (
              current.municipalityId &&
              !nextMunicipalities.some(
                (municipality: Municipality) =>
                  municipality.id === current.municipalityId,
              )
            ) {
              return {
                ...current,
                municipality: '',
                municipalityId: '',
              };
            }

            if (!current.municipalityId && current.municipality) {
              const matchedMunicipality = nextMunicipalities.find(
                (municipality: Municipality) =>
                  municipality.name === current.municipality,
              );

              if (matchedMunicipality) {
                return {
                  ...current,
                  municipality: matchedMunicipality.name,
                  municipalityId: matchedMunicipality.id,
                };
              }
            }

            return current;
          });
        }
      } catch (error) {
        console.error('Error fetching municipalities:', error);
      }
    };

    fetchMuncipalities();
  }, [formData.departmentId, supabase.auth]);

  useEffect(() => {
    if (!departments.length || formData.departmentId || !formData.department) {
      return;
    }

    const matchedDepartment = departments.find(
      (department) => department.name === formData.department,
    );

    if (!matchedDepartment) {
      return;
    }

    setFormData((current) => ({
      ...current,
      department: matchedDepartment.name,
      departmentId: matchedDepartment.id,
    }));
  }, [departments, formData.department, formData.departmentId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'departmentId') {
      const selectedDepartment =
        departments.find((department) => department.id === value) ?? null;

      setFormData((prev) => ({
        ...prev,
        department: selectedDepartment?.name ?? '',
        departmentId: selectedDepartment?.id ?? '',
        municipality: '',
        municipalityId: '',
      }));
      return;
    }

    if (name === 'municipalityId') {
      const selectedMunicipality =
        municipalities.find((municipality) => municipality.id === value) ?? null;

      setFormData((prev) => ({
        ...prev,
        municipality: selectedMunicipality?.name ?? '',
        municipalityId: selectedMunicipality?.id ?? '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const headers = await getAuthHeaders();
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        department: formData.department,
        departmentId: formData.departmentId || null,
        municipality: formData.municipality,
        municipalityId: formData.municipalityId || null,
        neighborhood: formData.neighborhood,
        address: formData.address,
      };
      const res = await apiFetch('/profiles/me', {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Perfil actualizado correctamente');
      } else {
        throw new Error('Failed to update');
      }
    } catch {
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-primary">Configuración de Perfil</h1>
        <p className="mt-2 text-muted font-medium">
          Administra tu información personal y datos de contacto.
        </p>
      </div>

      <SettingsTabs />

      <div className="bg-surface rounded-3xl border border-theme shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">

          {/* Email (Read Only) */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Mail className="w-3.5 h-3.5" /> Cuenta
            </h3>
            <div className="p-4 bg-base/40 rounded-2xl border border-theme flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-base border border-theme flex items-center justify-center text-muted">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted tracking-widest">Email (No editable)</p>
                <p className="text-sm font-bold text-primary opacity-60">{email}</p>
              </div>
            </div>
          </div>

          <hr className="border-theme" />

          {/* Personal Info */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <UserIcon className="w-3.5 h-3.5" /> Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Nombre</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full p-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Apellido</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full p-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Tu apellido"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Ej. 300 123 4567"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-theme" />

          {/* Location Info */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <MapPin className="w-3.5 h-3.5" /> Ubicación y Entrega
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Departamento</label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="w-full p-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer appearance-none"
                >
                  <option value="">Selecciona departamento</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Municipio</label>
                <select
                  name="municipalityId"
                  value={formData.municipalityId}
                  onChange={handleChange}
                  disabled={!formData.departmentId}
                  className="w-full p-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer appearance-none disabled:opacity-50"
                >
                  <option value="">Selecciona municipio</option>
                  {municipalities.map(muni => (
                    <option key={muni.id} value={muni.id}>{muni.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Barrio</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    name="neighborhood"
                    value={formData.neighborhood}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Nombre del barrio"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Dirección Exacta</label>
                <div className="relative">
                  <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-theme bg-base text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Calle, carrera, apto..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving || isReadOnly}
              className="flex items-center gap-2 px-10 py-4 bg-primary text-base-color font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isReadOnly ? 'Modo Lectura' : saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
