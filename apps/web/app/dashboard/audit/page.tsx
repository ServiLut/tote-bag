'use client';

import { useEffect, useState, ChangeEvent, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Loader2, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  Clock, 
  User as UserIcon, 
  Tag, 
  Activity,
  Globe,
  Monitor,
  Database
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  previousData: Record<string, unknown> | null;
  userId: string | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  skip: number;
  take: number;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Filters
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;
      const params = new URLSearchParams({
        skip: skip.toString(),
        take: ITEMS_PER_PAGE.toString(),
        ...(selectedEntity && { entity: selectedEntity }),
        ...(selectedAction && { action: selectedAction }),
      });

      const res = await fetch(`${API_URL}/audit?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        const response = await res.json();
        // The interceptor wraps the result in { success, data, error, metadata }
        // Our service returns { data, meta }
        // So the final structure is response.data.data and response.data.meta
        const payload = response.data;
        if (payload && typeof payload === 'object') {
          setLogs(Array.isArray(payload.data) ? payload.data : []);
          setMeta(payload.meta || null);
        } else {
          setLogs([]);
          setMeta(null);
        }
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedEntity, selectedAction, API_URL, supabase.auth]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEntity, selectedAction]);

  const totalPages = meta ? Math.ceil(meta.total / ITEMS_PER_PAGE) : 0;

  const getActionColor = (action: string) => {
    switch (action) {
      case 'POST': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'PUT': 
      case 'PATCH': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'DELETE': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'POST': return 'CREAR';
      case 'PUT':
      case 'PATCH': return 'EDITAR';
      case 'DELETE': return 'ELIMINAR';
      default: return action;
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-none mb-8">
        <h1 className="text-3xl font-black tracking-tight text-primary">Auditoría de Sistema</h1>
        <p className="mt-2 text-muted font-medium">
          Registro histórico de acciones y cambios realizados en la plataforma.
        </p>
      </div>

      {/* Sección de Filtros */}
      <div className="flex-none flex flex-wrap items-center gap-4 mb-6">
        {/* Filtro Entidad */}
        <select
          value={selectedEntity}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedEntity(e.target.value)}
          className="px-4 py-2.5 border border-theme rounded-xl bg-surface text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm min-w-[180px] appearance-none cursor-pointer"
        >
          <option value="">Todas las Entidades</option>
          <option value="products">Productos</option>
          <option value="orders">Pedidos</option>
          <option value="profiles">Perfiles</option>
          <option value="b2b">B2B / Cotizaciones</option>
          <option value="auth">Autenticación</option>
        </select>

        {/* Filtro Acción */}
        <select
          value={selectedAction}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedAction(e.target.value)}
          className="px-4 py-2.5 border border-theme rounded-xl bg-surface text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm min-w-[180px] appearance-none cursor-pointer"
        >
          <option value="">Todas las Acciones</option>
          <option value="POST">Crear (POST)</option>
          <option value="PUT">Editar (PUT/PATCH)</option>
          <option value="DELETE">Eliminar (DELETE)</option>
        </select>

        {(selectedEntity || selectedAction) && (
          <button 
            onClick={() => {
              setSelectedEntity('');
              setSelectedAction('');
            }}
            className="text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      <div className="flex-1 bg-surface rounded-2xl shadow-sm border border-theme overflow-hidden flex flex-col">
        {/* Table Container with Scroll */}
        <div className="flex-1 overflow-y-auto relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-base/50 border-b border-theme sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Fecha y Hora</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Acción</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Entidad</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">ID Entidad</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Usuario</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest text-right">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {!Array.isArray(logs) || logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted font-medium bg-surface">
                    No se encontraron registros de auditoría.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-base/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted" />
                        <div>
                          <p className="font-bold text-primary text-xs">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-muted font-medium">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-muted" />
                        <span className="font-bold text-primary text-xs uppercase tracking-tight">{log.entity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-muted font-mono text-[10px]">{log.entityId ? log.entityId.substring(0, 18) : '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-base border border-theme flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-muted" />
                        </div>
                        <span className="text-primary font-medium text-xs truncate max-w-[120px]">
                          {log.user 
                            ? (log.user.firstName || log.user.lastName 
                                ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim()
                                : log.user.email)
                            : (log.userId ? log.userId.substring(0, 8) + '...' : 'Sistema')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-theme bg-base/50 p-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Total registros: <span className="text-primary">{meta?.total || 0}</span>
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl border border-theme bg-surface text-muted hover:text-primary hover:bg-base disabled:opacity-30 transition-all active:scale-90 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-[10px] font-black text-primary px-4">
              PÁGINA {currentPage} DE {totalPages || 1}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2.5 rounded-xl border border-theme bg-surface text-muted hover:text-primary hover:bg-base disabled:opacity-30 transition-all active:scale-90 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col border border-theme">
            <div className="flex items-center justify-between p-6 border-b border-theme bg-base/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${getActionColor(selectedLog.action)}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-primary tracking-tight">Detalle de Actividad</h2>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar bg-surface">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meta Info */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <Activity className="w-3.5 h-3.5" /> Contexto
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Acción</span>
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black tracking-widest ${getActionColor(selectedLog.action)}`}>
                        {getActionLabel(selectedLog.action)} ({selectedLog.action})
                      </span>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Entidad</span>
                      <span className="text-sm font-bold text-primary uppercase">{selectedLog.entity}</span>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Entidad ID</span>
                      <span className="text-[10px] font-mono font-bold text-primary">{selectedLog.entityId || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Connection Info */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <Globe className="w-3.5 h-3.5" /> Conexión
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Usuario</span>
                      <span className="text-xs font-bold text-primary truncate ml-4">
                        {selectedLog.user 
                          ? (selectedLog.user.firstName || selectedLog.user.lastName 
                              ? `${selectedLog.user.firstName || ''} ${selectedLog.user.lastName || ''}`.trim()
                              : selectedLog.user.email)
                          : (selectedLog.userId || 'Sistema')}
                      </span>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">IP Origen</span>
                      <span className="text-xs font-bold text-primary">{selectedLog.ip || 'Local'}</span>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-1.5">
                           <Monitor className="w-3 h-3" /> Dispositivo
                         </span>
                      </div>
                      <p className="text-[10px] text-primary font-medium leading-relaxed break-words opacity-80">
                        {selectedLog.userAgent || 'Desconocido'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payload / Data Change Table */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <Database className="w-3.5 h-3.5" /> Comparación de Datos
                  </h4>
                  <div className="bg-base/40 rounded-2xl border border-theme overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-base border-b border-theme">
                            <th className="px-6 py-3 text-[10px] font-black text-muted uppercase tracking-widest w-1/4">Campo</th>
                            <th className="px-6 py-3 text-[10px] font-black text-muted uppercase tracking-widest w-3/8">Valor Anterior</th>
                            <th className="px-6 py-3 text-[10px] font-black text-muted uppercase tracking-widest w-3/8">Valor Nuevo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/50">
                          {(() => {
                            const prev = selectedLog.previousData || {};
                            const curr = selectedLog.payload || {};
                            const allKeys = Array.from(new Set([
                              ...Object.keys(prev),
                              ...Object.keys(curr)
                            ])).sort();

                            if (allKeys.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={3} className="px-6 py-8 text-center text-xs text-muted font-medium italic">
                                    No hay datos detallados para esta acción.
                                  </td>
                                </tr>
                              );
                            }

                            const translateKey = (key: string) => {
                              const dictionary: Record<string, string> = {
                                name: 'Nombre',
                                description: 'Descripción',
                                basePrice: 'Precio Base',
                                minPrice: 'Precio Mínimo',
                                costPrice: 'Precio Costo',
                                comparePrice: 'Precio Anterior',
                                status: 'Estado',
                                collectionId: 'ID Colección',
                                collectionName: 'Colección',
                                slug: 'URL (Slug)',
                                deliveryTime: 'Entrega',
                                material: 'Material',
                                dimensions: 'Dimensiones',
                                careInstructions: 'Cuidado',
                                printType: 'Impresión',
                                isActive: 'Activo',
                                tags: 'Etiquetas',
                                variants: 'Variantes',
                                images: 'Imágenes',
                                sku: 'SKU',
                                color: 'Color',
                                stock: 'Inventario',
                                imageUrl: 'URL Imagen',
                                orderNumber: 'Nº Pedido',
                                customerEmail: 'Email Cliente',
                                customerPhone: 'Teléfono Cliente',
                                shippingAddress: 'Dirección Envío',
                                city: 'Ciudad',
                                totalAmount: 'Total',
                                currency: 'Moneda',
                                trackingNumber: 'Guía',
                                carrier: 'Transportadora',
                                isB2B: 'Venta B2B',
                                firstName: 'Nombre',
                                lastName: 'Apellido',
                                phone: 'Teléfono',
                                department: 'Departamento',
                                municipality: 'Municipio',
                                neighborhood: 'Barrio',
                                address: 'Dirección',
                                role: 'Rol',
                                businessName: 'Empresa',
                                quantity: 'Cantidad',
                                qrType: 'Tipo QR',
                                qrData: 'Datos QR',
                                logoUrl: 'URL Logo',
                                package: 'Paquete',
                                userId: 'ID Usuario',
                                id: 'ID Registro',
                                createdAt: 'Creado el',
                                updatedAt: 'Actualizado el'
                              };
                              return dictionary[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase();
                            };

                            const renderValue = (val: unknown): React.ReactNode => {
                              if (val === null || val === undefined) return <span className="text-muted/40 italic">nulo</span>;
                              
                              if (Array.isArray(val)) {
                                if (val.length === 0) return <span className="text-muted/40 italic">vacío</span>;
                                
                                // Check if it's an array of primitives
                                if (typeof val[0] !== 'object') {
                                  return <span className="font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-md">{val.join(', ')}</span>;
                                }

                                // Array of objects (like variants or images)
                                return (
                                  <div className="space-y-3">
                                    {val.map((item, i) => (
                                      <div key={i} className={`p-2 rounded-lg bg-base/30 border border-theme/20 ${i > 0 ? "mt-2" : ""}`}>
                                        {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                                          <div key={k} className="flex gap-2 text-[9px] mb-0.5">
                                            <span className="font-black text-muted uppercase shrink-0 w-20">{translateKey(k)}:</span>
                                            <span className="truncate font-bold text-primary">{v !== null && typeof v === 'object' ? '[Objeto]' : String(v ?? '-')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }

                              if (typeof val === 'object') {
                                return (
                                  <div className="space-y-1 p-2 rounded-lg bg-base/30 border border-theme/20">
                                    {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
                                      <div key={k} className="flex gap-2 text-[9px]">
                                        <span className="font-black text-muted uppercase shrink-0 w-24">{translateKey(k)}:</span>
                                        <span className="font-bold text-primary">{typeof v === 'object' ? '[Objeto]' : String(v ?? '-')}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }

                              if (typeof val === 'boolean') return val ? <span className="text-green-600 font-black">SÍ</span> : <span className="text-red-600 font-black">NO</span>;
                              
                              return <span className="font-medium">{String(val)}</span>;
                            };

                            return allKeys.map(key => {
                              const v1 = prev[key];
                              const v2 = curr[key];
                              const isDifferent = JSON.stringify(v1) !== JSON.stringify(v2);

                              return (
                                <tr key={key} className={`text-xs hover:bg-surface transition-colors ${isDifferent ? 'bg-primary/[0.02]' : ''}`}>
                                  <td className="px-6 py-4">
                                    <span className={`font-black uppercase text-[10px] tracking-tight ${isDifferent ? 'text-primary' : 'text-muted'}`}>
                                      {translateKey(key)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-muted">
                                    {renderValue(v1)}
                                  </td>
                                  <td className="px-6 py-4 font-mono text-primary">
                                    {renderValue(v2)}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-base/50 border-t border-theme flex justify-end flex-shrink-0">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-8 py-3 bg-primary text-base-color text-xs font-black uppercase tracking-widest rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
