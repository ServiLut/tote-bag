'use client';

import { useEffect, useState, ChangeEvent, useCallback, FormEvent } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { Loader2, UserCircle, ShoppingBag, Eye, X, Mail, Phone, MapPin, Hash, Clock, Database, FileText, Search, ChevronLeft, ChevronRight, UserPlus, Save, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@tote-bag/ui';
import { getAuthHeaders } from '@/utils/supabase/auth';
import { apiFetch } from '@/utils/api';

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
  departmentId: string | null;
  municipalityId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  user: {
    role: 'ADMIN' | 'CUSTOMER' | 'MANAGER';
    isActive: boolean;
  };
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

interface ProfilesListPayload {
  items: Profile[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ManualCustomerFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  municipalityId: string;
  neighborhood: string;
  address: string;
}

interface EditCustomerFormState {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  municipalityId: string;
  neighborhood: string;
  address: string;
}

const INITIAL_MANUAL_CUSTOMER_FORM: ManualCustomerFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  departmentId: '',
  municipalityId: '',
  neighborhood: '',
  address: '',
};

const INITIAL_EDIT_CUSTOMER_FORM: EditCustomerFormState = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  departmentId: '',
  municipalityId: '',
  neighborhood: '',
  address: '',
};

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    const payload = body as Record<string, unknown>;
    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (typeof payload.error === 'string') {
      return payload.error;
    }
  }

  return fallback;
}

function buildEditCustomerForm(profile: Profile): EditCustomerFormState {
  return {
    email: profile.email,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phone: profile.phone || '',
    departmentId: profile.departmentId || '',
    municipalityId: profile.municipalityId || '',
    neighborhood: profile.neighborhood || '',
    address: profile.address || '',
  };
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerActionError, setCustomerActionError] = useState<string | null>(null);
  const [activeCustomerActionId, setActiveCustomerActionId] = useState<string | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<string | null>(null);
  const [createCustomerForm, setCreateCustomerForm] = useState<ManualCustomerFormState>(INITIAL_MANUAL_CUSTOMER_FORM);
  const [createCustomerMunicipalities, setCreateCustomerMunicipalities] = useState<Municipality[]>([]);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Profile | null>(null);
  const [editCustomerSubmitting, setEditCustomerSubmitting] = useState(false);
  const [editCustomerError, setEditCustomerError] = useState<string | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState<EditCustomerFormState>(INITIAL_EDIT_CUSTOMER_FORM);
  const [editCustomerMunicipalities, setEditCustomerMunicipalities] = useState<Municipality[]>([]);

  // Filtros Geográficos
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedMuni, setSelectedMuni] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const supabase = createClient();

  const closeCreateCustomerModal = useCallback((options?: { force?: boolean }) => {
    if (createCustomerSubmitting && !options?.force) {
      return;
    }

    setShowCreateCustomerModal(false);
    setCreateCustomerError(null);
    setCreateCustomerForm(INITIAL_MANUAL_CUSTOMER_FORM);
    setCreateCustomerMunicipalities([]);
  }, [createCustomerSubmitting]);

  const closeEditCustomerModal = useCallback((options?: { force?: boolean }) => {
    if (editCustomerSubmitting && !options?.force) {
      return;
    }

    setShowEditCustomerModal(false);
    setEditingCustomer(null);
    setEditCustomerError(null);
    setEditCustomerForm(INITIAL_EDIT_CUSTOMER_FORM);
    setEditCustomerMunicipalities([]);
  }, [editCustomerSubmitting]);

  const syncProfileInState = useCallback((updatedProfile: Profile) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.userId === updatedProfile.userId ? updatedProfile : profile,
      ),
    );
    setSelectedCustomer((current) =>
      current?.userId === updatedProfile.userId ? updatedProfile : current,
    );
    setEditingCustomer((current) =>
      current?.userId === updatedProfile.userId ? updatedProfile : current,
    );
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setProfiles([]);
        setDepartments([]);
        setTotalProfiles(0);
        setTotalPages(1);
        return;
      }

      const params = new URLSearchParams({
        role: 'CUSTOMER',
        page: String(currentPage),
        pageSize: String(ITEMS_PER_PAGE),
      });

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const selectedDepartment = departments.find((dept) => dept.id === selectedDept);
      if (selectedDepartment?.name) {
        params.set('department', selectedDepartment.name);
      }

      const selectedMunicipality = municipalities.find((muni) => muni.id === selectedMuni);
      if (selectedMunicipality?.name) {
        params.set('municipality', selectedMunicipality.name);
      }

      const profilesRes = await apiFetch(`/profiles?${params.toString()}`, {
        headers,
        signal,
      });

      if (profilesRes.ok) {
        const response = await profilesRes.json();
        const payload = response.data as ProfilesListPayload | undefined;
        setProfiles(payload?.items || []);
        setTotalProfiles(payload?.pagination?.total || 0);
        setTotalPages(payload?.pagination?.totalPages || 1);
      } else {
        console.error('Failed to fetch profiles:', profilesRes.statusText);
        setProfiles([]);
        setTotalProfiles(0);
        setTotalPages(1);
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching data:', error);
      setProfiles([]);
      setTotalProfiles(0);
      setTotalPages(1);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [
    currentPage,
    departments,
    municipalities,
    searchQuery,
    selectedDept,
    selectedMuni,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token) {
          setProfiles([]);
          setDepartments([]);
          setLoading(false);
          setTotalProfiles(0);
          setTotalPages(1);
          return;
        }

        void fetchData();
      },
    );

    return () => {
      controller.abort();
      subscription.unsubscribe();
    };
  }, [fetchData, supabase.auth]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDepartments = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          setDepartments([]);
          return;
        }

        const response = await apiFetch('/locations/departments', {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error('Failed to fetch departments:', response.statusText);
          setDepartments([]);
          return;
        }

        const body = await response.json();
        setDepartments(body.data || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching departments:', error);
        setDepartments([]);
      }
    };

    void fetchDepartments();

    return () => {
      controller.abort();
    };
  }, [supabase.auth]);

  useEffect(() => {
    if (!selectedDept) {
      setMunicipalities([]);
      setSelectedMuni('');
      return;
    }

    const controller = new AbortController();

    const fetchMunicipalities = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          setMunicipalities([]);
          return;
        }

        const res = await apiFetch(`/locations/municipalities/${selectedDept}`, {
          headers,
          signal: controller.signal,
        });
        if (res.ok) {
          const response = await res.json();
          setMunicipalities(response.data || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching municipalities:', error);
      }
    };

    void fetchMunicipalities();
    setSelectedMuni('');

    return () => {
      controller.abort();
    };
  }, [selectedDept, supabase.auth]);

  useEffect(() => {
    if (!showCreateCustomerModal || !createCustomerForm.departmentId) {
      setCreateCustomerMunicipalities([]);
      return;
    }

    const controller = new AbortController();

    const fetchCreateMunicipalities = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          setCreateCustomerMunicipalities([]);
          return;
        }

        const response = await apiFetch(
          `/locations/municipalities/${createCustomerForm.departmentId}`,
          {
            headers,
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setCreateCustomerMunicipalities([]);
          return;
        }

        const body = await response.json();
        setCreateCustomerMunicipalities(body.data || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching municipalities for manual customer:', error);
        setCreateCustomerMunicipalities([]);
      }
    };

    void fetchCreateMunicipalities();

    return () => {
      controller.abort();
    };
  }, [createCustomerForm.departmentId, showCreateCustomerModal]);

  useEffect(() => {
    if (!showEditCustomerModal || !editCustomerForm.departmentId) {
      setEditCustomerMunicipalities([]);
      return;
    }

    const controller = new AbortController();

    const fetchEditMunicipalities = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          setEditCustomerMunicipalities([]);
          return;
        }

        const response = await apiFetch(
          `/locations/municipalities/${editCustomerForm.departmentId}`,
          {
            headers,
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setEditCustomerMunicipalities([]);
          return;
        }

        const body = await response.json();
        setEditCustomerMunicipalities(body.data || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching municipalities for edit customer:', error);
        setEditCustomerMunicipalities([]);
      }
    };

    void fetchEditMunicipalities();

    return () => {
      controller.abort();
    };
  }, [editCustomerForm.departmentId, showEditCustomerModal]);

  const handleCreateCustomerFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;

    setCreateCustomerForm((current) => {
      if (name === 'departmentId') {
        return {
          ...current,
          departmentId: value,
          municipalityId: '',
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const handleEditCustomerFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;

    setEditCustomerForm((current) => {
      if (name === 'departmentId') {
        return {
          ...current,
          departmentId: value,
          municipalityId: '',
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const handleCreateCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateCustomerError(null);
    setCreateCustomerSubmitting(true);

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch('/users/customers', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createCustomerForm.email.trim(),
          password: createCustomerForm.password,
          firstName: createCustomerForm.firstName.trim(),
          lastName: createCustomerForm.lastName.trim(),
          phone: createCustomerForm.phone.trim() || undefined,
          departmentId: createCustomerForm.departmentId || undefined,
          municipalityId: createCustomerForm.municipalityId || undefined,
          neighborhood: createCustomerForm.neighborhood.trim() || undefined,
          address: createCustomerForm.address.trim() || undefined,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `No se pudo crear el cliente (${response.status}).`),
        );
      }

      closeCreateCustomerModal({ force: true });
      await fetchData();
    } catch (error) {
      console.error('Error creating manual customer:', error);
      setCreateCustomerError(
        error instanceof Error
          ? error.message
          : 'No se pudo crear el cliente manualmente.',
      );
    } finally {
      setCreateCustomerSubmitting(false);
    }
  };

  const openEditCustomerModal = (profile: Profile) => {
    setCustomerActionError(null);
    setEditCustomerError(null);
    setEditingCustomer(profile);
    setEditCustomerForm(buildEditCustomerForm(profile));
    setShowEditCustomerModal(true);
  };

  const handleEditCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingCustomer) {
      setEditCustomerError('No se encontro el cliente a editar.');
      return;
    }

    setEditCustomerError(null);
    setEditCustomerSubmitting(true);

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch(`/users/customers/${editingCustomer.userId}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: editCustomerForm.email.trim(),
          firstName: editCustomerForm.firstName.trim(),
          lastName: editCustomerForm.lastName.trim(),
          phone: editCustomerForm.phone.trim() || undefined,
          departmentId: editCustomerForm.departmentId || undefined,
          municipalityId: editCustomerForm.municipalityId || undefined,
          neighborhood: editCustomerForm.neighborhood.trim() || undefined,
          address: editCustomerForm.address.trim() || undefined,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `No se pudo actualizar el cliente (${response.status}).`),
        );
      }

      const updatedProfile = (body?.data?.profile ?? null) as Profile | null;
      if (updatedProfile) {
        syncProfileInState(updatedProfile);
      } else {
        await fetchData();
      }

      closeEditCustomerModal({ force: true });
    } catch (error) {
      console.error('Error updating customer:', error);
      setEditCustomerError(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el cliente.',
      );
    } finally {
      setEditCustomerSubmitting(false);
    }
  };

  const handleToggleCustomerStatus = async (profile: Profile) => {
    const nextIsActive = !profile.user.isActive;
    setCustomerActionError(null);
    setActiveCustomerActionId(profile.userId);

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch(`/users/customers/${profile.userId}/status`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: nextIsActive,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `No se pudo actualizar el estado del cliente (${response.status}).`),
        );
      }

      const updatedProfile = (body?.data?.profile ?? null) as Profile | null;
      if (updatedProfile) {
        syncProfileInState(updatedProfile);
      } else {
        syncProfileInState({
          ...profile,
          user: {
            ...profile.user,
            isActive: nextIsActive,
          },
        });
      }
    } catch (error) {
      console.error('Error updating customer status:', error);
      setCustomerActionError(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el estado del cliente.',
      );
    } finally {
      setActiveCustomerActionId(null);
    }
  };

  const handleDeleteCustomer = async (profile: Profile) => {
    const confirmed = window.confirm(
      `Vas a eliminar a ${profile.firstName || profile.email}. Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setCustomerActionError(null);
    setActiveCustomerActionId(profile.userId);

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
      }

      const response = await apiFetch(`/users/customers/${profile.userId}`, {
        method: 'DELETE',
        headers,
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `No se pudo eliminar el cliente (${response.status}).`),
        );
      }

      if (selectedCustomer?.userId === profile.userId) {
        setSelectedCustomer(null);
      }

      if (editingCustomer?.userId === profile.userId) {
        closeEditCustomerModal({ force: true });
      }

      await fetchData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setCustomerActionError(
        error instanceof Error
          ? error.message
          : 'No se pudo eliminar el cliente.',
      );
    } finally {
      setActiveCustomerActionId(null);
    }
  };

  const paginationWindowStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => paginationWindowStart + index,
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedMuni]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-none mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Clientes</h1>
          <p className="mt-2 text-muted font-medium">
            Listado de clientes registrados en la tienda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateCustomerError(null);
            setShowCreateCustomerModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          Registrar cliente manual
        </button>
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

        {(selectedDept || selectedMuni || searchQuery) && (
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

      {customerActionError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {customerActionError}
        </div>
      ) : null}

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
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted font-medium bg-surface">
                    {searchQuery || selectedDept || selectedMuni ? 'No se encontraron clientes.' : 'No hay clientes registrados.'}
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] text-muted font-medium">{profile.email}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                profile.user.isActive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-zinc-200 text-zinc-600'
                              }`}
                            >
                              {profile.user.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
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
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => void handleToggleCustomerStatus(profile)}
                          disabled={activeCustomerActionId === profile.userId}
                          className="inline-flex items-center gap-2 rounded-2xl border border-theme bg-base px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all disabled:opacity-50"
                          title={profile.user.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                        >
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              profile.user.isActive ? 'bg-emerald-500' : 'bg-zinc-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                profile.user.isActive ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </span>
                          {activeCustomerActionId === profile.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <span>{profile.user.isActive ? 'Activo' : 'Inactivo'}</span>
                          )}
                        </button>

                        <Popover
                          open={activeActionMenu === profile.userId}
                          onOpenChange={(open) =>
                            setActiveActionMenu(open ? profile.userId : null)
                          }
                        >
                          <PopoverTrigger>
                            <button
                              type="button"
                              className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary transition-colors hover:bg-primary/5"
                              aria-label={`Acciones para ${profile.firstName || profile.email}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="end"
                            className="w-56 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenu(null);
                                setSelectedCustomer(profile);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                            >
                              <Eye className="h-4 w-4" />
                              Ver detalles
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenu(null);
                                openEditCustomerModal(profile);
                              }}
                              disabled={activeCustomerActionId === profile.userId}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil className="h-4 w-4" />
                              Editar cliente
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenu(null);
                                void handleDeleteCustomer(profile);
                              }}
                              disabled={activeCustomerActionId === profile.userId}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar cliente
                            </button>
                          </PopoverContent>
                        </Popover>
                      </div>
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
            Mostrando <span className="text-primary">{profiles.length}</span> de <span className="text-primary">{totalProfiles}</span>
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
              {visiblePages.map((pageNum) => {
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

      {showCreateCustomerModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => closeCreateCustomerModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-customer-title"
            className="w-full max-w-3xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleCreateCustomer}>
              <div className="flex items-start justify-between gap-4 border-b border-theme bg-base/50 px-6 py-5">
                <div className="space-y-1">
                  <h2 id="manual-customer-title" className="text-2xl font-black tracking-tight text-primary">
                    Registrar cliente manual
                  </h2>
                  <p className="text-sm font-medium text-muted">
                    Crea la cuenta del cliente y deja su perfil base listo desde el dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => closeCreateCustomerModal()}
                  disabled={createCustomerSubmitting}
                  className="rounded-full bg-base/80 p-2 text-muted transition-all hover:bg-base hover:text-primary disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Nombre
                    </label>
                    <input
                      name="firstName"
                      value={createCustomerForm.firstName}
                      onChange={handleCreateCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Apellido
                    </label>
                    <input
                      name="lastName"
                      value={createCustomerForm.lastName}
                      onChange={handleCreateCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Correo
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={createCustomerForm.email}
                      onChange={handleCreateCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Contrasena temporal
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={createCustomerForm.password}
                      onChange={handleCreateCustomerFormChange}
                      minLength={6}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Telefono
                    </label>
                    <input
                      name="phone"
                      value={createCustomerForm.phone}
                      onChange={handleCreateCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Departamento
                    </label>
                    <select
                      name="departmentId"
                      value={createCustomerForm.departmentId}
                      onChange={handleCreateCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecciona departamento</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Municipio
                    </label>
                    <select
                      name="municipalityId"
                      value={createCustomerForm.municipalityId}
                      onChange={handleCreateCustomerFormChange}
                      disabled={!createCustomerForm.departmentId}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    >
                      <option value="">Selecciona municipio</option>
                      {createCustomerMunicipalities.map((muni) => (
                        <option key={muni.id} value={muni.id}>{muni.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Barrio
                    </label>
                    <input
                      name="neighborhood"
                      value={createCustomerForm.neighborhood}
                      onChange={handleCreateCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Direccion
                    </label>
                    <textarea
                      name="address"
                      value={createCustomerForm.address}
                      onChange={handleCreateCustomerFormChange}
                      rows={3}
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {createCustomerError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {createCustomerError}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-theme bg-base/30 px-6 py-4 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => closeCreateCustomerModal()}
                  disabled={createCustomerSubmitting}
                  className="inline-flex items-center justify-center rounded-xl border border-theme px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-base disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCustomerSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  {createCustomerSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Crear cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEditCustomerModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => closeEditCustomerModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-customer-title"
            className="w-full max-w-3xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleEditCustomer}>
              <div className="flex items-start justify-between gap-4 border-b border-theme bg-base/50 px-6 py-5">
                <div className="space-y-1">
                  <h2 id="edit-customer-title" className="text-2xl font-black tracking-tight text-primary">
                    Editar cliente
                  </h2>
                  <p className="text-sm font-medium text-muted">
                    Actualiza la informacion base del cliente registrado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => closeEditCustomerModal()}
                  disabled={editCustomerSubmitting}
                  className="rounded-full bg-base/80 p-2 text-muted transition-all hover:bg-base hover:text-primary disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Nombre
                    </label>
                    <input
                      name="firstName"
                      value={editCustomerForm.firstName}
                      onChange={handleEditCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Apellido
                    </label>
                    <input
                      name="lastName"
                      value={editCustomerForm.lastName}
                      onChange={handleEditCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Correo
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editCustomerForm.email}
                      onChange={handleEditCustomerFormChange}
                      required
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Telefono
                    </label>
                    <input
                      name="phone"
                      value={editCustomerForm.phone}
                      onChange={handleEditCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Departamento
                    </label>
                    <select
                      name="departmentId"
                      value={editCustomerForm.departmentId}
                      onChange={handleEditCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecciona departamento</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Municipio
                    </label>
                    <select
                      name="municipalityId"
                      value={editCustomerForm.municipalityId}
                      onChange={handleEditCustomerFormChange}
                      disabled={!editCustomerForm.departmentId}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    >
                      <option value="">Selecciona municipio</option>
                      {editCustomerMunicipalities.map((muni) => (
                        <option key={muni.id} value={muni.id}>{muni.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Barrio
                    </label>
                    <input
                      name="neighborhood"
                      value={editCustomerForm.neighborhood}
                      onChange={handleEditCustomerFormChange}
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted">
                      Direccion
                    </label>
                    <textarea
                      name="address"
                      value={editCustomerForm.address}
                      onChange={handleEditCustomerFormChange}
                      rows={3}
                      className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {editCustomerError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {editCustomerError}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-theme bg-base/30 px-6 py-4 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => closeEditCustomerModal()}
                  disabled={editCustomerSubmitting}
                  className="inline-flex items-center justify-center rounded-xl border border-theme px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-base disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editCustomerSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  {editCustomerSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Detail Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col border border-theme"
            onClick={(event) => event.stopPropagation()}
          >
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
