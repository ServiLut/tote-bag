'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Pencil, Check, X, Sparkles, DollarSign, Layers, AlertCircle, RefreshCw } from 'lucide-react';
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

export default function PersonalizationManager() {
  const [options, setOptions] = useState<PersonalizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonalizationOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.NEXT_PUBLIC_API_URL}/personalizations`;
      console.log('Fetching personalizations from:', url);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      console.log('Fetch response status:', res.status);
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

  const toggleMaterial = (material: string) => {
    if (!editForm) return;
    const current = editForm.allowedMaterialValues || [];
    const updated = current.includes(material)
      ? current.filter(m => m !== material)
      : [...current, material];
    setEditForm({ ...editForm, allowedMaterialValues: updated });
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted font-medium">Cargando personalizaciones...</p>
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
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
                          onClick={() => toggleMaterial(material)}
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
                <button 
                  onClick={() => startEditing(option)}
                  className="p-2.5 rounded-xl border border-theme bg-base hover:border-primary/30 hover:text-primary transition-all active:scale-95 group"
                >
                  <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                </button>
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
  );
}
