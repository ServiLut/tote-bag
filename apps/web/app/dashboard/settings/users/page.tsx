'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Loader2, 
  Users as UsersIcon, 
  Shield, 
  Search,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell,
  Select,
  Badge,
  Skeleton
} from '@tote-bag/ui';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { useRouter } from 'next/navigation';
import { SettingsTabs } from '@/components/dashboard/SettingsTabs';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CUSTOMER' | 'VIEWER' | 'ADVISOR';
  isActive: boolean;
  createdAt: string;
  profile?: {
    firstName: string | null;
    lastName: string | null;
  };
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const { role: currentUserRole } = useDashboardAuth();
  const router = useRouter();
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api/v1';
  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Error al cargar usuarios');
      
      const response = await res.json();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [API_URL, supabase.auth]);

  useEffect(() => {
    if (currentUserRole !== 'ADMIN') {
      toast.error('Acceso denegado. Solo administradores.');
      router.push('/dashboard');
      return;
    }
    fetchUsers();
  }, [currentUserRole, fetchUsers, router]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingId(userId);
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${API_URL}/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error('Error al actualizar rol');
      
      toast.success(`Rol actualizado a ${newRole} correctamente`);
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Error al actualizar el rol del usuario');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(user => 
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.profile?.firstName?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (user.profile?.lastName?.toLowerCase() || '').includes(search.toLowerCase())
  );

  if (currentUserRole !== 'ADMIN') return null;

  return (
    <div className="p-8 md:p-12 space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Gestión de Usuarios</h1>
          <p className="mt-2 text-muted font-medium">
            Controla los accesos y roles de todo el equipo de Tote Bag.
          </p>
        </div>

        <SettingsTabs />
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input 
            type="text"
            placeholder="Buscar por email o nombre..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-theme bg-surface font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-surface rounded-3xl border border-theme shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-muted/30" />
            <p className="text-muted font-bold">No se encontraron usuarios</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol Actual</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-black text-primary">
                        {user.profile?.firstName || user.profile?.lastName 
                          ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
                          : 'Sin nombre'}
                      </span>
                      <span className="text-[10px] font-mono text-muted uppercase">ID: {user.id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-muted">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {updatingId === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <Select
                          className="w-36 p-2 rounded-xl border border-theme bg-base text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADVISOR">ADVISOR</option>
                          <option value="VIEWER">VIEWER</option>
                          <option value="CUSTOMER">CUSTOMER</option>
                        </Select>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
        <Shield className="w-6 h-6 text-primary shrink-0" />
        <p className="text-xs font-bold text-primary/70 leading-relaxed">
          <span className="font-black">Zona de Seguridad:</span> Los cambios en los roles afectan inmediatamente los permisos del usuario en la plataforma. Asegúrate de verificar la identidad del usuario antes de otorgar privilegios de administrador.
        </p>
      </div>
    </div>
  );
}
