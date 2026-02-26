'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Loader2, Pencil, Check, X, Sparkles, DollarSign, Layers, 
  AlertCircle, RefreshCw, Plus, Trash2, AlertTriangle 
} from 'lucide-react';
import { CATALOG_ATTRIBUTES } from '@/utils/catalog-constants';
import { toast } from 'sonner';

interface PersonalizationOption {
  id: string;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  allowedMaterialValues: string[];
}

interface CreateFormData {
  name: string;
  basePrice: number;
  allowedMaterialValues: string[];
}

const INITIAL_CREATE_FORM: CreateFormData = {
  name: '',
  basePrice: 0,
  allowedMaterialValues: [],
};

export default function PersonalizationManager() {
  const [options, setOptions] = useState<PersonalizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonalizationOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create & Delete states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>(INITIAL_CREATE_FORM);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showConfirmDeleteId, setShowConfirmDeleteId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.NEXT_PUBLIC_API_URL}/personalizations`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      if (!res.ok) throw new Error(`Error al conectar con el servidor (${res.status})`);
      const data = await res.json();
      setOptions(data.data || []);
    } catch (err) {
      console.error('Error fetching options:', err);
      setError('No se pudieron cargar las personalizaciones. Por favor, intenta de nuevo.');
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const startEditing = (option: PersonalizationOption) => {
    setEditingId(option.id);
    setEditForm({ ...option });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const toggleMaterialForEdit = (material: string) => {
    if (!editForm) return;
    const current = editForm.allowedMaterialValues || [];
    const updated = current.includes(material)
      ? current.filter(m => m !== material)
      : [...current, material];
    setEditForm({ ...editForm, allowedMaterialValues: updated });
  };

  const toggleMaterialForCreate = (material: string) => {
    const current = createForm.allowedMaterialValues;
    const updated = current.includes(material)
      ? current.filter(m => m !== material)
      : [...current, material];
    setCreateForm({ ...createForm, allowedMaterialValues: updated });
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/personalizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Error al crear');
      }
      
      toast.success('Nueva técnica agregada');
      setShowCreateModal(false);
      setCreateForm(INITIAL_CREATE_FORM);
      fetchOptions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!editForm) return;
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/personalizations/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error('Failed to update option');
      
      toast.success('Personalización actualizada');
      setEditingId(null);
      setEditForm(null);
      fetchOptions();
    } catch (err) {
      console.error('Error saving option:', err);
      toast.error('Error al guardar los cambios');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/personalizations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) throw new Error('No se pudo eliminar');
      
      toast.success('Técnica eliminada');
      setOptions(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      toast.error('Error al eliminar');
    } finally {
      setIsDeletingId(null);
      setShowConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted font-medium">Cargando personalizaciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary text-base-color px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Técnica
        </button>
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-20 gap-6 bg-surface border border-theme rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-black text-primary uppercase tracking-tight">Vaya, algo salió mal</p>
            <p className="text-sm text-muted font-medium max-w-xs mx-auto">{error}</p>
          </div>
          <button 
            onClick={fetchOptions}
            className="flex items-center gap-2 bg-primary text-base-color px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((option) => (
          <div 
            key={option.id}
            className={`bg-surface border rounded-2xl p-6 transition-all duration-300 ${
              editingId === option.id ? 'border-primary ring-1 ring-primary/20' : 'border-theme'
            }`}
          >
            {editingId === option.id ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-primary uppercase tracking-tight">{option.name}</h3>
                      <p className="text-[10px] text-muted font-bold tracking-widest uppercase">{option.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={cancelEditing}
                      className="p-2 rounded-lg border border-theme hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className="p-2 rounded-lg bg-primary text-base-color hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">
                      Precio Base
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                      <input
                        type="number"
                        value={editForm?.basePrice}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, basePrice: parseFloat(e.target.value) || 0 } : null)}
                        className="w-full bg-base border border-theme rounded-xl py-3 pl-8 pr-4 font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-3 block">
                      Materiales Permitidos
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {CATALOG_ATTRIBUTES.MATERIAL.map((material) => {
                        const isSelected = editForm?.allowedMaterialValues?.includes(material);
                        return (
                          <button
                            key={material}
                            type="button"
                            onClick={() => toggleMaterialForEdit(material)}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                              isSelected 
                                ? 'bg-primary/5 border-primary text-primary shadow-sm' 
                                : 'bg-base border-theme text-muted hover:border-primary/30'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-primary border-primary' : 'border-theme bg-surface'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-base-color" />}
                            </div>
                            <span className="text-xs font-bold">{material}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-primary/80 uppercase tracking-tight">{option.name}</h3>
                      <p className="text-[10px] text-muted font-bold tracking-widest uppercase">{option.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEditing(option)}
                      className="p-2.5 rounded-xl border border-theme bg-base hover:border-primary/30 hover:text-primary transition-all active:scale-95 group"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowConfirmDeleteId(option.id)}
                      className="p-2.5 rounded-xl border border-theme bg-base hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 group"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-base/50 rounded-xl p-3 border border-theme/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1">Precio Base</p>
                    <div className="flex items-center gap-1.5 text-primary font-black">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-sm">{option.basePrice.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-base/50 rounded-xl p-3 border border-theme/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1">Materiales</p>
                    <div className="flex items-center gap-1.5 text-primary font-black">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-sm">{option.allowedMaterialValues?.length || 0} habilitados</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {option.allowedMaterialValues?.map((material) => (
                    <span 
                      key={material}
                      className="px-2.5 py-1 bg-surface border border-theme rounded-full text-[9px] font-bold text-muted uppercase tracking-wider"
                    >
                      {material}
                    </span>
                  ))}
                  {(!option.allowedMaterialValues || option.allowedMaterialValues.length === 0) && (
                    <span className="text-[10px] font-bold text-red-500/70 italic uppercase">Sin materiales permitidos</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-primary tracking-tight">Nueva Personalización</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-muted hover:text-primary transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Nombre de la Técnica</label>
                  <input
                    type="text"
                    placeholder="Ej. Bordado Computarizado"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Precio Base</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={createForm.basePrice === 0 ? '' : createForm.basePrice}
                      onChange={(e) => setCreateForm({ ...createForm, basePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-base border border-theme rounded-xl py-4 pl-8 pr-4 font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-2">Telas/Materiales Permitidos</label>
                  <div className="grid grid-cols-2 gap-3">
                    {CATALOG_ATTRIBUTES.MATERIAL.map((material) => {
                      const isSelected = createForm.allowedMaterialValues.includes(material);
                      return (
                        <button
                          key={material}
                          type="button"
                          onClick={() => toggleMaterialForCreate(material)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            isSelected 
                              ? 'bg-primary/5 border-primary text-primary' 
                              : 'bg-base border-theme text-muted'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary border-primary' : 'border-theme'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-base-color" />}
                          </div>
                          <span className="text-xs font-bold">{material}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-primary border border-theme rounded-2xl hover:bg-base transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Crear Técnica'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showConfirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center text-red-600 mx-auto">
                <AlertTriangle size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-primary tracking-tight">¿Eliminar técnica?</h3>
                <p className="text-sm text-muted font-medium leading-relaxed">
                  Estás a punto de eliminar <span className="text-primary font-bold">&quot;{options.find(o => o.id === showConfirmDeleteId)?.name}&quot;</span>. Esta acción no se puede deshacer y dejará de estar disponible para nuevos productos.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmDeleteId(null)}
                  className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border border-theme rounded-xl hover:bg-base transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(showConfirmDeleteId)}
                  disabled={isDeletingId === showConfirmDeleteId}
                  className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingId === showConfirmDeleteId ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Eliminar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
