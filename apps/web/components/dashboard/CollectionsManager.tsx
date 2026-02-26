'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react';
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

export default function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showConfirmId, setShowConfirmId] = useState<string | null>(null);

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
                    <button
                      onClick={() => setShowConfirmId(coll.id)}
                      className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                      title="Eliminar colección"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Confirmation Modal */}
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
