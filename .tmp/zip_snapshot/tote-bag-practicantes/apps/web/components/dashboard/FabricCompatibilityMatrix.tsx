'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Loader2,
  Check,
  Layers,
  MousePointer2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { apiFetch } from '@/utils/api';

interface WizardOption {
  id: string;
  category: 'LINE' | 'DIMENSION' | 'MATERIAL' | 'QUALITY' | 'TECHNIQUE';
  name: string;
  code: string;
  allowedMaterialValues: string[];
  isActive: boolean;
}

export default function FabricCompatibilityMatrix() {
  const [materials, setMaterials] = useState<WizardOption[]>([]);
  const [techniques, setTechniques] = useState<WizardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMaterials([]);
        setTechniques([]);
        return;
      }

      const res = await apiFetch('/wizard-options', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        setMaterials([]);
        setTechniques([]);
        return;
      }

      if (!res.ok) throw new Error(`Error al cargar datos (${res.status})`);

      const resBody = await res.json();
      const allOptions: WizardOption[] = resBody.data || [];

      setMaterials(allOptions.filter(o => o.category === 'MATERIAL' && o.isActive));
      setTechniques(allOptions.filter(o => o.category === 'TECHNIQUE' && o.isActive));
    } catch {
      toast.error('No se pudo cargar la matriz de compatibilidad');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCompatibility = async (technique: WizardOption, materialName: string) => {
    const isCompatible = technique.allowedMaterialValues.includes(materialName);
    const newAllowedMaterials = isCompatible
      ? technique.allowedMaterialValues.filter(m => m !== materialName)
      : [...technique.allowedMaterialValues, materialName];

    setUpdatingId(`${technique.id}-${materialName}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await apiFetch(`/wizard-options/${technique.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allowedMaterialValues: newAllowedMaterials }),
      });

      if (res.status === 401 || res.status === 403) {
        toast.error('No tienes permisos para actualizar la matriz');
        return;
      }

      if (!res.ok) throw new Error(`Error al actualizar (${res.status})`);

      // Update local state
      setTechniques(prev => prev.map(t =>
        t.id === technique.id
          ? { ...t, allowedMaterialValues: newAllowedMaterials }
          : t
      ));

      toast.success(`Regla actualizada: ${technique.name} ${isCompatible ? 'deshabilitado' : 'habilitado'} para ${materialName}`);
    } catch {
      toast.error('Error al guardar el cambio');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted font-black uppercase tracking-[0.2em] text-[10px]">Generando matriz...</p>
      </div>
    );
  }

  if (materials.length === 0 || techniques.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 bg-base/20 border-2 border-dashed border-theme rounded-3xl">
        <AlertCircle className="w-12 h-12 text-muted" />
        <div className="text-center space-y-1">
          <p className="font-black text-primary uppercase tracking-tight">Faltan datos base</p>
          <p className="text-xs text-muted font-medium">Debes configurar al menos un Material y una Técnica para ver la matriz.</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-all">
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Matriz de Compatibilidad</h2>
        <p className="text-sm text-muted font-medium mt-1">Habilita o deshabilita qué técnicas de marcado son posibles según el material base de la tote bag.</p>
      </div>

      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-base/50 border-b border-theme">
                <th className="p-6 text-left border-r border-theme min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Layers size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Material / Técnica</span>
                  </div>
                </th>
                {techniques.map(tech => (
                  <th key={tech.id} className="p-6 text-center min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <MousePointer2 size={14} className="text-secondary mb-1" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">{tech.name}</span>
                      <code className="text-[8px] font-mono text-muted">{tech.code}</code>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {materials.map(mat => (
                <tr key={mat.id} className="hover:bg-base/20 transition-colors">
                  <td className="p-6 border-r border-theme bg-base/10">
                    <span className="text-sm font-bold text-primary">{mat.name}</span>
                  </td>
                  {techniques.map(tech => {
                    const isCompatible = tech.allowedMaterialValues.includes(mat.name);
                    const isUpdating = updatingId === `${tech.id}-${mat.name}`;

                    return (
                      <td key={tech.id} className="p-6 text-center">
                        <button
                          onClick={() => toggleCompatibility(tech, mat.name)}
                          disabled={isUpdating}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-50",
                            isCompatible ? "bg-secondary" : "bg-theme"
                          )}
                        >
                          <span className="sr-only">Toggle compatibility</span>
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                              isCompatible ? "translate-x-6" : "translate-x-1"
                            )}
                          >
                            {isUpdating && <Loader2 size={10} className="animate-spin text-secondary absolute inset-0 m-auto" />}
                          </span>
                        </button>
                        <p className={cn(
                          "text-[8px] font-black uppercase tracking-tighter mt-2",
                          isCompatible ? "text-secondary" : "text-muted opacity-50"
                        )}>
                          {isCompatible ? 'Habilitado' : 'Bloqueado'}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-3 p-5 bg-secondary/5 border border-secondary/20 rounded-2xl">
        <Check size={18} className="text-secondary shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          <strong className="text-primary font-black uppercase tracking-widest text-[10px] block mb-1">Nota de Sincronización:</strong>
          Los cambios realizados en esta matriz se reflejan en tiempo real en el configurador que ven los clientes.
          Si una técnica está bloqueada para un material, no aparecerá como opción cuando el cliente seleccione dicho material.
        </p>
      </div>
    </div>
  );
}

