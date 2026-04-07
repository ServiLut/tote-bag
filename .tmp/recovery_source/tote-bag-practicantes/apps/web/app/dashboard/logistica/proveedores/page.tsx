'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Loader2,
  ShieldCheck,
  Edit,
  Trash2,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

interface ShippingProvider {
  id: string;
  name: string;
  contact: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ShippingProvidersPage() {
  const supabase = createClient();
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Form
  const [formData, setFormData] = useState({
    name: '', contact: '', isActive: true
  });

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {};
    }

    return { Authorization: `Bearer ${session.access_token}` };
  }, [supabase.auth]);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch('/shipping/providers', {
        headers: authHeaders,
      });
      if (res.ok) {
        const result = await res.json();
        setProviders(result.data || []);
      } else {
        setProviders([]);
        setError('No fue posible cargar los proveedores de envio.');
      }
    } catch (err) {
      console.error(err);
      setProviders([]);
      setError('No fue posible conectar con la API de envios.');
    }
    finally { setLoading(false); }
  }, [getAuthHeaders]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleCreateOrUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch(
        selectedProviderId
          ? `/shipping/providers/${selectedProviderId}`
          : '/shipping/providers',
        {
          method: selectedProviderId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify(formData),
        },
      );
      if (res.ok) {
        setIsModalOpen(false);
        setSelectedProviderId(null);
        setFormData({ name: '', contact: '', isActive: true });
        await fetchProviders();
      } else {
        const body = await res.json().catch(() => null);
        setError(
          body?.message ||
            body?.error ||
            `No fue posible ${selectedProviderId ? 'actualizar' : 'guardar'} el proveedor.`,
        );
      }
    } catch (err) {
      console.error(err);
      setError(`No fue posible ${selectedProviderId ? 'actualizar' : 'guardar'} el proveedor.`);
    }
    finally { setSubmitting(false); }
  };

  const handleEdit = (provider: ShippingProvider) => {
    setSelectedProviderId(provider.id);
    setFormData({
      name: provider.name,
      contact: provider.contact || '',
      isActive: provider.isActive,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
    try {
      setError(null);
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch(`/shipping/providers/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        await fetchProviders();
      } else {
        setError('No fue posible eliminar el proveedor.');
      }
    } catch (err) {
      console.error(err);
      setError('No fue posible eliminar el proveedor.');
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [provider.name, provider.contact || '', provider.id]
      .some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
              <Truck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Proveedores de Envío</h1>
          </div>
          <p className="text-muted font-medium">Gestiona las empresas de mensajería y sus credenciales de API.</p>
        </div>
        <button
          onClick={() => {
            setSelectedProviderId(null);
            setFormData({ name: '', contact: '', isActive: true });
            setError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-base-color font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nuevo Proveedor
        </button>
      </div>

      {/* List */}
      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-theme bg-base/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:max-w-md md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor..."
                className="w-full pl-10 pr-4 py-2.5 bg-base border border-theme rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            {error ? (
              <p className="text-sm font-semibold text-rose-600">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-8 py-4">Nombre / Empresa</th>
                <th className="px-8 py-4">Contacto</th>
                <th className="px-8 py-4">Estado</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
              ) : filteredProviders.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-12 text-center text-muted font-medium">{providers.length === 0 ? 'No hay proveedores registrados.' : 'No hay resultados para la busqueda actual.'}</td></tr>
              ) : filteredProviders.map((p) => (
                <tr key={p.id} className="hover:bg-primary/5 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">{p.name}</span>
                      <span className="text-[10px] font-black text-muted uppercase tracking-widest">ID: {p.id.split('-')[0]}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-muted">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {p.contact || 'No asignado'}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      p.isActive 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {p.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-2 rounded-lg bg-base border border-theme hover:bg-primary hover:text-base-color transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)}
                        className="p-2 rounded-lg bg-base border border-theme hover:bg-rose-500 hover:text-white transition-all text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="relative p-8 border-b border-theme bg-primary text-base-color">
              <h2 className="text-2xl font-black">{selectedProviderId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <p className="text-base-color/60 text-sm font-medium">Configura una empresa de mensajería logística.</p>
            </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-6 top-6 rounded-xl p-2 transition-colors hover:bg-white/10"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            <form onSubmit={handleCreateOrUpdateProvider} className="p-8 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Nombre de la Empresa</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Servientrega, Interrapidísimo" className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Contacto / Teléfono</label>
                  <input value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.isActive} 
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-5 h-5 rounded-lg border-theme text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-primary">Este proveedor está activo para nuevos envíos</label>
                </div>
              </div>
              {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-base border border-theme rounded-2xl font-bold text-muted">Cancelar</button>
                <button disabled={submitting} className="flex-[2] px-6 py-4 bg-primary text-base-color font-black rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-primary/20">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {selectedProviderId ? 'Actualizar' : 'Guardar'} Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
