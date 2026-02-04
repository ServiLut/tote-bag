'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { Loader2, UserCircle, ShoppingBag, Calendar, Eye, X, Mail, Phone, MapPin, Hash, Clock, Database, FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profilesRes, departmentsRes] = await Promise.all([
          fetch(`${API_URL}/profiles?role=CUSTOMER`),
          fetch(`${API_URL}/locations/departments`)
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
  }, [API_URL]);

  useEffect(() => {
    if (!selectedDept) {
      setMunicipalities([]);
      setSelectedMuni('');
      return;
    }

    const fetchMunicipalities = async () => {
      try {
        const res = await fetch(`${API_URL}/locations/municipalities/${selectedDept}`);
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
  }, [selectedDept, API_URL]);

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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Clientes</h1>
        <p className="mt-2 text-zinc-500">
          Listado de clientes registrados en la tienda.
        </p>
      </div>

      {/* Sección de Filtros */}
      <div className="flex-none flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, correo o teléfono..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-xl bg-white text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all shadow-sm"
          />
        </div>

        {/* Filtro Departamento */}
        <select
          value={selectedDept}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedDept(e.target.value)}
          className="px-4 py-2 border border-zinc-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm min-w-[180px]"
        >
          <option value="">Todos los Departamentos</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>

        {/* Filtro Municipio */}
        <select
          value={selectedMuni}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedMuni(e.target.value)}
          disabled={!selectedDept}
          className="px-4 py-2 border border-zinc-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm min-w-[180px] disabled:opacity-50 disabled:bg-zinc-50"
        >
          <option value="">Todos los Municipios</option>
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
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
        {/* Table Container with Scroll */}
        <div className="flex-1 overflow-y-auto relative">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-900">Cliente</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Contacto</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Ubicación</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Fecha Registro</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 text-center">Pedidos</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {paginatedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    {searchQuery || selectedDept ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'No hay clientes registrados aún.'}
                  </td>
                </tr>
              ) : (
                paginatedProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                          <UserCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">
                            {profile.firstName || profile.lastName 
                              ? `${profile.firstName || ''} ${profile.lastName || ''}`
                              : 'Sin Nombre'}
                          </p>
                          <p className="text-zinc-500">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       {profile.phone ? (
                         <span className="text-zinc-700">{profile.phone}</span>
                       ) : (
                         <span className="text-zinc-400 text-xs italic">No registrado</span>
                       )}
                    </td>
                    <td className="px-6 py-4">
                      {profile.municipality || profile.address ? (
                         <div className="flex flex-col">
                           <span className="font-medium text-zinc-900">{profile.municipality}</span>
                           <span className="text-xs text-zinc-500 truncate max-w-[150px]" title={profile.address || ''}>
                             {profile.address}
                           </span>
                         </div>
                       ) : (
                         <span className="text-zinc-400 text-xs italic">Sin dirección</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-100 text-zinc-700 font-medium">
                        <ShoppingBag className="w-4 h-4" />
                        {profile._count.orders}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedCustomer(profile)}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
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
        <div className="border-t border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Mostrando <span className="font-medium text-zinc-900">{paginatedProfiles.length}</span> de <span className="font-medium text-zinc-900">{filteredProfiles.length}</span> resultados
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum 
                        ? 'bg-zinc-900 text-white' 
                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-2 text-zinc-400">...</span>}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <h2 className="text-xl font-bold text-zinc-900">Detalles del Cliente</h2>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-zinc-100">
                <div className="w-20 h-20 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-inner shrink-0">
                  <UserCircle className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-zinc-900">
                    {selectedCustomer.firstName || selectedCustomer.lastName 
                      ? `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`
                      : 'Sin Nombre'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold font-mono">
                      <Hash className="w-3 h-3" />
                      ID: {selectedCustomer.id}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold font-mono">
                      <Database className="w-3 h-3" />
                      UID: {selectedCustomer.userId}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <FileText className="w-4 h-4" /> Información Personal
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Nombre</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.firstName || '-'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Apellido</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.lastName || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <Phone className="w-4 h-4" /> Contacto
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <Mail className="w-4 h-4 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Email</p>
                        <p className="text-sm font-medium text-zinc-900 break-all">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <Phone className="w-4 h-4 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Teléfono</p>
                        <p className="text-sm font-medium text-zinc-900">{selectedCustomer.phone || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <MapPin className="w-4 h-4" /> Ubicación
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Departamento</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.department || '-'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Municipio</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.municipality || '-'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Barrio</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.neighborhood || '-'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Dirección Exacta</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedCustomer.address || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <Clock className="w-4 h-4" /> Actividad
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Fecha de Registro</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {new Date(selectedCustomer.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-500 mb-1">Última Actualización</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {new Date(selectedCustomer.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {selectedCustomer.metadata && Object.keys(selectedCustomer.metadata).length > 0 && (
                  <div className="space-y-4 md:col-span-2">
                    <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <Database className="w-4 h-4" /> Información Adicional
                    </h4>
                    <div className="bg-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-100/50 text-zinc-500 font-medium text-xs uppercase tracking-wider border-b border-zinc-100">
                          <tr>
                            <th className="px-4 py-3">Dato</th>
                            <th className="px-4 py-3">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {Object.entries(selectedCustomer.metadata).map(([key, value]) => {
                            // Helper para traducir claves comunes
                            const translateKey = (k: string) => {
                              const dictionary: Record<string, string> = {
                                last_sign_in_at: 'Último inicio de sesión',
                                created_at: 'Fecha de creación',
                                email_verified: 'Email verificado',
                                phone_verified: 'Teléfono verificado',
                                sub: 'ID Suscriptor',
                                iss: 'Emisor',
                                provider: 'Proveedor',
                                full_name: 'Nombre completo',
                                avatar_url: 'URL Avatar',
                                picture: 'Foto',
                                name: 'Nombre',
                                last_ip: 'Última IP',
                                user_agent: 'Dispositivo/Navegador',
                                terms_accepted: 'Términos Aceptados',
                                registration_ip: 'IP de Registro',
                                terms_accepted_at: 'Fecha Aceptación Términos',
                                TermsAccepted: 'Términos Aceptados',
                                RegistrationIp: 'IP de Registro',
                                TermsAcceptedAt: 'Fecha Aceptación Términos',
                                termsAccepted: 'Términos Aceptados',
                                registrationIp: 'IP de Registro',
                                termsAcceptedAt: 'Fecha Aceptación Términos'
                              };
                              return dictionary[k] || k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').toLowerCase();
                            };

                            // Helper para formatear valores
                            const renderValue = (val: unknown) => {
                              if (typeof val === 'boolean') {
                                return val 
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Sí</span> 
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">No</span>;
                              }
                              
                              // Detectar fechas (ISO strings o timestamps)
                              if (typeof val === 'string' && (val.includes('T') || val.includes('-')) && !isNaN(Date.parse(val))) {
                                try {
                                  return new Date(val).toLocaleString('es-CO', { 
                                    timeZone: 'America/Bogota', 
                                    dateStyle: 'long', 
                                    timeStyle: 'medium' 
                                  });
                                } catch {
                                  return val;
                                }
                              }

                              if (typeof val === 'object' && val !== null) {
                                return <pre className="text-xs font-mono bg-white p-2 rounded border border-zinc-100 whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>;
                              }

                              return String(val ?? '-');
                            };

                            return (
                              <tr key={key} className="hover:bg-white transition-colors">
                                <td className="px-4 py-3 font-medium text-zinc-700 capitalize">
                                  {translateKey(key)}
                                </td>
                                <td className="px-4 py-3 text-zinc-600">
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

            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end flex-shrink-0">
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 active:scale-95 transition-all shadow-lg shadow-zinc-200"
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