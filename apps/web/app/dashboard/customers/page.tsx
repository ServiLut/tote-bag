'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, UserCircle, ShoppingBag, Eye, X, Mail, Phone, MapPin, Hash, Clock, Database, FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Profile {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  department: string | null;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  role: 'ADMIN' | 'CUSTOMER';
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  _count: {
    orders: number;
  };
}

interface Department {
  id: string;
  name: string;
}

interface Municipality {
  id: string;
  name: string;
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtros Geográficos
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedMuni, setSelectedMuni] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = {
          'Authorization': `Bearer ${session?.access_token}`,
        };

        const [profilesRes, departmentsRes] = await Promise.all([
          fetch(`${API_URL}/profiles?role=CUSTOMER`, { headers }),
          fetch(`${API_URL}/locations/departments`, { headers })
        ]);

        if (profilesRes.ok) {
          const response = await profilesRes.json();
          setProfiles(response.data || []);
        } else {
          console.error('Failed to fetch profiles:', profilesRes.statusText);
        }

        if (departmentsRes.ok) {
          const response = await departmentsRes.json();
          setDepartments(response.data || []);
        } else {
          console.error('Failed to fetch departments:', departmentsRes.statusText);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL, supabase.auth]);

  useEffect(() => {
    if (!selectedDept) {
      setMunicipalities([]);
      setSelectedMuni('');
      return;
    }

    const fetchMunicipalities = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_URL}/locations/municipalities/${selectedDept}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          }
        });
        if (res.ok) {
          const response = await res.json();
          setMunicipalities(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching municipalities:', error);
      }
    };

    fetchMunicipalities();
    setSelectedMuni('');
  }, [selectedDept, API_URL, supabase.auth]);

  // Filter Logic
  const filteredProfiles = profiles.filter((profile) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.toLowerCase();
    const phone = (profile.phone || '').toLowerCase();
    const email = profile.email.toLowerCase();

    const matchesSearch = fullName.includes(query) || phone.includes(query) || email.includes(query);
    
    // Filtrado por Dpto/Mpio (comparando nombres ya que los perfiles actuales tienen strings)
    const deptName = departments.find(d => d.id === selectedDept)?.name;
    const muniName = municipalities.find(m => m.id === selectedMuni)?.name;

    const matchesDept = !selectedDept || profile.department === deptName;
    const matchesMuni = !selectedMuni || profile.municipality === muniName;

    return matchesSearch && matchesDept && matchesMuni;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProfiles.length / ITEMS_PER_PAGE);
  const paginatedProfiles = filteredProfiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedMuni]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-none mb-8">
        <h1 className="text-3xl font-black tracking-tight text-primary">Clientes</h1>
        <p className="mt-2 text-muted font-medium">
          Listado de clientes registrados en la tienda.
        </p>
      </div>

      {/* Sección de Filtros */}
      <div className="flex-none flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-theme rounded-xl bg-surface text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm text-primary font-medium"
          />
        </div>

        {/* Filtro Departamento */}
        <select
          value={selectedDept}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedDept(e.target.value)}
          className="px-4 py-2.5 border border-theme rounded-xl bg-surface text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm min-w-[180px] appearance-none cursor-pointer"
        >
          <option value="">Departamentos</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>

        {/* Filtro Municipio */}
        <select
          value={selectedMuni}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedMuni(e.target.value)}
          disabled={!selectedDept}
          className="px-4 py-2.5 border border-theme rounded-xl bg-surface text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm min-w-[180px] disabled:opacity-50 appearance-none cursor-pointer"
        >
          <option value="">Municipios</option>
          {municipalities.map(muni => (
            <option key={muni.id} value={muni.id}>{muni.name}</option>
          ))}
        </select>

        {(selectedDept || searchQuery) && (
          <button 
            onClick={() => {
              setSelectedDept('');
              setSelectedMuni('');
              setSearchQuery('');
            }}
            className="text-xs font-black uppercase tracking-widest text-muted hover:text-primary transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 bg-surface rounded-2xl shadow-sm border border-theme overflow-hidden flex flex-col">
        {/* Table Container with Scroll */}
        <div className="flex-1 overflow-y-auto relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-base/50 border-b border-theme sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Cliente</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Contacto</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest">Ubicación</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest text-center">Pedidos</th>
                <th className="px-6 py-4 font-black text-primary uppercase text-[10px] tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {paginatedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted font-medium bg-surface">
                    {searchQuery || selectedDept ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
                  </td>
                </tr>
              ) : (
                paginatedProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-base/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-base-color shadow-sm">
                          <UserCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-primary tracking-tight">
                            {profile.firstName || profile.lastName 
                              ? `${profile.firstName || ''} ${profile.lastName || ''}`
                              : 'Sin Nombre'}
                          </p>
                          <p className="text-[10px] text-muted font-medium">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       {profile.phone ? (
                         <span className="text-primary font-medium text-xs">{profile.phone}</span>
                       ) : (
                         <span className="text-muted text-[10px] italic font-bold uppercase tracking-tighter">No registrado</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                      {profile.municipality || profile.address ? (
                         <div className="flex flex-col">
                           <span className="font-bold text-primary text-xs uppercase tracking-tight">{profile.municipality}</span>
                           <span className="text-[10px] text-muted font-medium truncate max-w-[150px]" title={profile.address || ''}>
                             {profile.address}
                           </span>
                         </div>
                       ) : (
                         <span className="text-muted text-[10px] italic font-bold uppercase tracking-tighter">Sin dirección</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-base text-primary font-black text-xs border border-theme shadow-sm">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {profile._count.orders}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedCustomer(profile)}
                        className="p-2.5 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
                        title="Ver detalles"
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
            Mostrando <span className="text-primary">{paginatedProfiles.length}</span> de <span className="text-primary">{filteredProfiles.length}</span>
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl border border-theme bg-surface text-muted hover:text-primary hover:bg-base disabled:opacity-30 transition-all active:scale-90 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1; 
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all active:scale-90 ${
                      currentPage === pageNum 
                        ? 'bg-primary text-base-color shadow-md shadow-primary/10' 
                        : 'bg-surface border border-theme text-muted hover:text-primary hover:bg-base'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

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
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col border border-theme">
            <div className="flex items-center justify-between p-6 border-b border-theme bg-base/50 flex-shrink-0">
              <h2 className="text-xl font-black text-primary tracking-tight">Detalles del Cliente</h2>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar bg-surface">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-8 border-b border-theme">
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-base-color shadow-lg shadow-primary/10 shrink-0">
                  <UserCircle className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-primary tracking-tighter leading-none">
                    {selectedCustomer.firstName || selectedCustomer.lastName 
                      ? `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`
                      : 'Sin Nombre'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base border border-theme text-muted text-[10px] font-black uppercase tracking-widest">
                      <Hash className="w-3 h-3" />
                      ID: {selectedCustomer.id.substring(0, 8)}...
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base border border-theme text-muted text-[10px] font-black uppercase tracking-widest">
                      <Database className="w-3 h-3" />
                      UID: {selectedCustomer.userId.substring(0, 8)}...
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <FileText className="w-3.5 h-3.5" /> Personal
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Nombre</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.firstName || '-'}</p>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Apellido</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.lastName || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <Phone className="w-3.5 h-3.5" /> Contacto
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-base/40 rounded-2xl border border-theme">
                      <Mail className="w-4 h-4 text-muted" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted tracking-widest">Email</p>
                        <p className="text-sm font-bold text-primary break-all">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-base/40 rounded-2xl border border-theme">
                      <Phone className="w-4 h-4 text-muted" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted tracking-widest">Teléfono</p>
                        <p className="text-sm font-bold text-primary">{selectedCustomer.phone || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <MapPin className="w-3.5 h-3.5" /> Ubicación
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Departamento</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.department || '-'}</p>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Municipio</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.municipality || '-'}</p>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Barrio</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.neighborhood || '-'}</p>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Dirección Exacta</p>
                      <p className="text-sm font-bold text-primary">{selectedCustomer.address || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                    <Clock className="w-3.5 h-3.5" /> Actividad
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Registro</p>
                      <p className="text-sm font-bold text-primary">
                        {new Date(selectedCustomer.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-base/40 rounded-2xl border border-theme">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Última Actualización</p>
                      <p className="text-sm font-bold text-primary">
                        {new Date(selectedCustomer.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {selectedCustomer.metadata && Object.keys(selectedCustomer.metadata).length > 0 && (
                  <div className="space-y-4 md:col-span-2">
                    <h4 className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                      <Database className="w-3.5 h-3.5" /> Info Adicional
                    </h4>
                    <div className="bg-base/40 rounded-2xl border border-theme overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-base text-muted font-black text-[9px] uppercase tracking-[0.2em] border-b border-theme">
                          <tr>
                            <th className="px-5 py-3">Dato</th>
                            <th className="px-5 py-3">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/50">
                          {Object.entries(selectedCustomer.metadata).map(([key, value]) => {
                            const translateKey = (k: string) => {
                              const dictionary: Record<string, string> = {
                                last_sign_in_at: 'Último acceso',
                                created_at: 'Fecha de creación',
                                email_verified: 'Email verificado',
                                phone_verified: 'Teléfono verificado',
                                provider: 'Proveedor',
                                full_name: 'Nombre completo',
                                last_ip: 'Última IP',
                                user_agent: 'Dispositivo',
                                terms_accepted: 'Términos Aceptados',
                                registration_ip: 'IP de Registro',
                                terms_accepted_at: 'Fecha Aceptación Términos',
                                termsaccepted: 'Términos Aceptados',
                                registrationip: 'IP de Registro',
                                termsacceptedat: 'Fecha Aceptación Términos',
                                sub: 'ID Suscriptor'
                              };
                              return dictionary[k.toLowerCase()] || k.replace(/[_-]/g, ' ').toLowerCase();
                            };

                            const renderValue = (val: unknown) => {
                              if (typeof val === 'boolean') {
                                return val 
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-green-500/10 text-green-600 uppercase">Sí</span> 
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-red-500/10 text-red-600 uppercase">No</span>;
                              }
                              
                              if (typeof val === 'string' && !isNaN(Date.parse(val)) && val.includes('T')) {
                                return <span className="font-bold text-primary">{new Date(val).toLocaleString()}</span>;
                              }

                              return <span className="font-bold text-primary">{String(val ?? '-')}</span>;
                            };

                            return (
                              <tr key={key} className="hover:bg-surface transition-colors">
                                <td className="px-5 py-3 font-black text-muted uppercase text-[9px] tracking-widest w-1/3">
                                  {translateKey(key)}
                                </td>
                                <td className="px-5 py-3 text-sm">
                                  {renderValue(value)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-base/50 border-t border-theme flex justify-end flex-shrink-0">
              <button 
                onClick={() => setSelectedCustomer(null)}
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