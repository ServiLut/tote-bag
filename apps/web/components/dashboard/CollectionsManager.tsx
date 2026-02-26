'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, AlertTriangle, X, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

interface Collection {
  id: string;
  name: string;
  slug: string;
  _count: {
    products: number;
  };
}

interface CollectionFormData {
  name: string;
  slug: string;
}

const INITIAL_FORM: CollectionFormData = {
  name: '',
  slug: '',
};

export default function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showConfirmId, setShowConfirmId] = useState<string | null>(null);

  // Form Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<CollectionFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const supabase = createClient();

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/collections`);
      if (res.ok) {
        const resBody = await res.json();
        setCollections(resBody.data || []);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
      toast.error('Error al cargar colecciones');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setShowFormModal(true);
  };

  const openEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setFormData({ name: collection.name, slug: collection.slug });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = editingId 
        ? `${API_URL}/collections/${editingId}` 
        : `${API_URL}/collections`;
      
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingId ? 'Colección actualizada' : 'Colección creada');
        setShowFormModal(false);
        fetchCollections();
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Error al procesar la solicitud');
      }
    } catch (err) {
      console.error('Form submit error:', err);
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${API_URL}/collections/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (res.ok) {
        toast.success('Colección eliminada exitosamente');
        setCollections(prev => prev.filter(c => c.id !== id));
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Error al eliminar colección');
      }
    } catch (err) {
      console.error('Error deleting collection:', err);
      toast.error('Error de conexión al eliminar');
    } finally {
      setIsDeletingId(null);
      setShowConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted">Cargando colecciones...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header Actions */}
      <div className="p-6 border-b border-theme flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-base-color px-6 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva Colección
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-theme bg-base/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary">Nombre</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary">Slug</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary text-center">Productos</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {collections.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-muted font-medium italic">
                  No hay colecciones registradas.
                </td>
              </tr>
            ) : (
              collections.map((coll) => (
                <tr key={coll.id} className="hover:bg-base/20 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-primary">{coll.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-[10px] font-mono bg-base px-2 py-1 rounded border border-theme text-muted">
                      {coll.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      coll._count.products > 0 
                        ? 'bg-secondary/10 text-secondary border border-secondary/20' 
                        : 'bg-base text-muted border border-theme'
                    }`}>
                      {coll._count.products}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(coll)}
                        className="p-2 text-muted hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                        title="Editar colección"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => setShowConfirmId(coll.id)}
                        className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                        title="Eliminar colección"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal (Create/Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleFormSubmit}>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-primary tracking-tight">
                    {editingId ? 'Editar Colección' : 'Nueva Colección'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="p-2 text-muted hover:text-primary transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Nombre</label>
                    <input
                      type="text"
                      placeholder="Ej. Verano 2026"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full bg-base border border-theme rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Slug (URL)</label>
                    <input
                      type="text"
                      placeholder="verano-2026"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full bg-base border border-theme rounded-xl p-4 font-mono text-sm text-muted focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-base/30 flex gap-3 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-primary border border-theme rounded-2xl hover:bg-base transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    editingId ? 'Guardar Cambios' : 'Crear Colección'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-3xl border border-theme shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <button 
                  onClick={() => setShowConfirmId(null)}
                  className="p-2 text-muted hover:text-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-black text-primary tracking-tight mb-2">¿Confirmas la eliminación?</h3>
              <p className="text-sm text-muted font-medium leading-relaxed">
                Estás a punto de eliminar la colección <span className="text-primary font-bold">&quot;{collections.find(c => c.id === showConfirmId)?.name}&quot;</span>. Esta acción no se puede deshacer.
              </p>
              
              {(collections.find(c => c.id === showConfirmId)?._count?.products ?? 0) > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                  <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
                    Aviso: Esta colección tiene productos asociados y el sistema impedirá su borrado hasta que sean reasignados.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-base/30 flex gap-3 border-t border-theme">
              <button
                onClick={() => setShowConfirmId(null)}
                className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-primary border border-theme rounded-xl hover:bg-base transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showConfirmId)}
                disabled={isDeletingId === showConfirmId}
                className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingId === showConfirmId ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
