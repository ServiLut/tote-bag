'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Loader2, Pencil, Check, X, Sparkles, DollarSign, Layers,
  Plus, Trash2, AlertTriangle,
  ChevronDown, ChevronUp, Maximize, Box, MousePointer2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

import Image from 'next/image';

type WizardCategory = 'LINE' | 'DIMENSION' | 'MATERIAL' | 'QUALITY' | 'TECHNIQUE';

interface WizardOption {
  id: string;
  category: WizardCategory;
  name: string;
  code: string;
  description?: string;
  basePriceModifier: number;
  isActive: boolean;
  sortOrder: number;
  allowedMaterialValues: string[];
  imageUrl?: string;
}

interface FormData {
  name: string;
  category: WizardCategory;
  description: string;
  basePriceModifier: number;
  sortOrder: number;
  allowedMaterialValues: string[];
  imageUrl: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  category: 'TECHNIQUE',
  description: '',
  basePriceModifier: 0,
  sortOrder: 0,
  allowedMaterialValues: [],
  imageUrl: '',
};

const CATEGORIES: { id: WizardCategory; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'LINE', label: 'Líneas de Producción', icon: Box, desc: 'Define las categorías principales de fabricación (ECO, Premium, etc.)' },
  { id: 'DIMENSION', label: 'Dimensiones / Tamaños', icon: Maximize, desc: 'Gestiona las medidas disponibles para las tote bags.' },
  { id: 'MATERIAL', label: 'Materiales y Telas', icon: Layers, desc: 'Administra los tipos de tela y texturas base.' },
  { id: 'QUALITY', label: 'Calidad de Confección', icon: Sparkles, desc: 'Niveles de refuerzo y acabados técnicos.' },
  { id: 'TECHNIQUE', label: 'Técnicas de Marcado', icon: MousePointer2, desc: 'Métodos de personalización (Estampado, Bordado, etc.)' },
];

export default function WizardConfigManager() {
  const [options, setOptions] = useState<WizardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<WizardCategory | null>('LINE');

  // Modal & Form state
  const [showModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showConfirmDeleteId, setShowConfirmDeleteId] = useState<string | null>(null);

  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setOptions([]);
        return;
      }

      const res = await fetch(`${API_URL}/wizard-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        setOptions([]);
        return;
      }

      if (!res.ok) throw new Error(`Error al cargar opciones (${res.status})`);

      const resBody = await res.json();
      setOptions(resBody.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('No se pudieron cargar las configuraciones');
    } finally {
      setLoading(false);
    }
  }, [API_URL, supabase]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const openCreate = (category: WizardCategory) => {
    setEditingId(null);
    setFormData({ ...INITIAL_FORM, category });
    setShowFormModal(true);
  };

  const openEdit = (option: WizardOption) => {
    setEditingId(option.id);
    setFormData({
      name: option.name,
      category: option.category,
      description: option.description || '',
      basePriceModifier: option.basePriceModifier,
      sortOrder: option.sortOrder,
      allowedMaterialValues: option.allowedMaterialValues || [],
      imageUrl: option.imageUrl || '',
    });
    setShowFormModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `wizard/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-assets').upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('product-assets').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
      toast.success('Imagen de lienzo cargada');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Error al subir la imagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const url = editingId ? `${API_URL}/wizard-options/${editingId}` : `${API_URL}/wizard-options`;
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.status === 401 || res.status === 403) {
        toast.error('No tienes permisos para guardar opciones');
        return;
      }

      if (!res.ok) throw new Error(`Error al guardar (${res.status})`);

      toast.success(editingId ? 'Actualizado correctamente' : 'Creado correctamente');
      setShowFormModal(false);
      fetchOptions();
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await fetch(`${API_URL}/wizard-options/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        toast.error('No tienes permisos para eliminar opciones');
        return;
      }

      if (!res.ok) throw new Error(`Error al eliminar (${res.status})`);
      toast.success('Eliminado correctamente');
      setOptions(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('No se pudo eliminar');
    } finally {
      setIsDeletingId(null);
      setShowConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted font-black uppercase tracking-[0.2em] text-[10px]">Sincronizando configurador...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-primary tracking-tight">Centro de Control Técnico</h2>
          <p className="text-sm text-muted font-medium">Gestiona dinámicamente todas las opciones que aparecen en el configurador del cliente.</p>
        </div>
      </div>

      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const catOptions = options.filter(o => o.category === cat.id);
          const isExpanded = expandedCategory === cat.id;

          return (
            <div key={cat.id} className={cn(
              "border border-theme rounded-3xl overflow-hidden transition-all duration-300 bg-surface",
              isExpanded ? "ring-1 ring-primary/10 shadow-xl" : "hover:bg-base/30"
            )}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                className="w-full flex items-center justify-between p-6 text-left group"
              >
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    isExpanded ? "bg-primary text-white" : "bg-base text-primary group-hover:bg-primary/10"
                  )}>
                    <cat.icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-primary uppercase tracking-tight">{cat.label}</h3>
                    <p className="text-[10px] text-muted font-bold tracking-widest uppercase">{catOptions.length} elementos configurados</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
              </button>

              {isExpanded && (
                <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-5 bg-base/40 rounded-2xl border border-theme/50 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <p className="text-xs text-muted font-medium max-w-xl">{cat.desc}</p>
                    <button
                      onClick={() => openCreate(cat.id)}
                      className="flex-none flex items-center gap-2 bg-primary text-base-color px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-95"
                    >
                      <Plus size={14} />
                      Añadir {cat.id === 'LINE' ? 'Línea' : cat.id === 'DIMENSION' ? 'Tamaño' : cat.id === 'MATERIAL' ? 'Material' : cat.id === 'QUALITY' ? 'Calidad' : 'Técnica'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catOptions.length === 0 ? (
                      <div className="col-span-full py-12 text-center border-2 border-dashed border-theme rounded-3xl bg-base/20">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted italic">No hay opciones registradas en esta categoría</p>
                      </div>
                    ) : (
                      catOptions.map((opt) => (
                        <div key={opt.id} className="p-5 bg-base/30 border border-theme rounded-2xl group hover:border-primary/30 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex gap-4">
                              {opt.imageUrl && (
                                <div className="w-10 h-10 rounded-lg bg-white border border-theme overflow-hidden flex-shrink-0 relative">
                                  <Image src={opt.imageUrl} alt={opt.name} fill className="object-cover" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-black text-primary text-sm uppercase tracking-tight">{opt.name}</h4>
                                <p className="text-[10px] text-muted font-mono">{opt.code}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(opt)} className="p-2 text-muted hover:text-primary transition-colors"><Pencil size={14}/></button>
                              <button onClick={() => setShowConfirmDeleteId(opt.id)} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                            </div>
                          </div>

                          <p className="text-[11px] text-muted line-clamp-2 mb-4 h-8">{opt.description || 'Sin descripción'}</p>

                          <div className="flex items-center justify-between pt-4 border-t border-theme/50">
                            <div className="flex items-center gap-1.5 text-primary font-black">
                              <DollarSign size={12} className="text-secondary" />
                              <span className="text-xs">+{opt.basePriceModifier.toLocaleString()}</span>
                            </div>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                              opt.isActive ? "bg-secondary/10 text-secondary" : "bg-red-50 text-red-500"
                            )}>
                              {opt.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shared Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmit}>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-primary tracking-tight">
                    {editingId ? 'Editar Opción' : 'Nueva Opción'}
                  </h3>
                  <button type="button" onClick={() => setShowFormModal(false)} className="p-2 text-muted hover:text-primary"><X size={24}/></button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted">Nombre</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-base border border-theme rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted">Precio Extra</label>
                      <input
                        type="number"
                        onKeyDown={(e) => { if (['e', '+'].includes(e.key)) e.preventDefault(); }}
                        value={formData.basePriceModifier}
                        onChange={e => setFormData({ ...formData, basePriceModifier: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-base border border-theme rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción (Para el Wizard)</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full bg-base border border-theme rounded-xl p-4 font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Orden de Aparición</label>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => { if (['-', 'e', '+'].includes(e.key)) e.preventDefault(); }}
                      value={formData.sortOrder}
                      onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full bg-base border border-theme rounded-xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  {formData.category === 'MATERIAL' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted block">Imagen del Mockup (Lienzo)</label>
                      <div className="flex items-center gap-4">
                        {formData.imageUrl && (
                          <div className="w-20 h-20 rounded-2xl bg-white border border-theme overflow-hidden relative group">
                            <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                              className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                        <label className="flex-1 cursor-pointer">
                          <div className="border-2 border-dashed border-theme rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-all">
                            <Layers size={20} className="text-muted" />
                            <span className="text-[10px] font-black uppercase text-primary">Subir Lienzo</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {formData.category === 'TECHNIQUE' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-2">Materiales Permitidos</label>
                      <div className="grid grid-cols-2 gap-3">
                        {options
                          .filter(o => o.category === 'MATERIAL')
                          .map((mat) => {
                            const isSelected = formData.allowedMaterialValues.includes(mat.name);
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => {
                                  const updated = isSelected
                                    ? formData.allowedMaterialValues.filter(v => v !== mat.name)
                                    : [...formData.allowedMaterialValues, mat.name];
                                  setFormData({ ...formData, allowedMaterialValues: updated });
                                }}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                  isSelected ? "bg-primary/5 border-primary text-primary" : "bg-base border-theme text-muted"
                                )}
                              >
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                  isSelected ? "bg-primary border-primary" : "border-theme"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 text-base-color" />}
                                </div>
                                <span className="text-xs font-bold">{mat.name}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-base/30 flex gap-3 border-t border-theme">
                <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-primary border border-theme rounded-2xl hover:bg-base">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? 'Guardar Cambios' : 'Crear Opción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showConfirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-3xl border border-theme p-8 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto"><AlertTriangle size={32}/></div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-primary tracking-tight">¿Eliminar esta opción?</h3>
              <p className="text-sm text-muted font-medium">Esta opción desaparecerá del configurador público inmediatamente.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmDeleteId(null)} className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary border border-theme rounded-xl hover:bg-base">Cancelar</button>
              <button onClick={() => handleDelete(showConfirmDeleteId)} disabled={isDeletingId === showConfirmDeleteId} className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isDeletingId === showConfirmDeleteId ? <Loader2 size={16} className="animate-spin"/> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
