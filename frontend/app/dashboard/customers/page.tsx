'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserCircle, ShoppingBag, Calendar } from 'lucide-react';
import { ApiResponse } from '@/types/api';

interface Profile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  municipality: string | null;
  address: string | null;
  role: 'ADMIN' | 'CUSTOMER';
  createdAt: string;
  _count: {
    orders: number;
  };
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch(`${API_URL}/profiles?role=CUSTOMER`);
        if (res.ok) {
          const response: ApiResponse<Profile[]> = await res.json();
          setProfiles(response.data);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [API_URL]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Clientes</h1>
        <p className="mt-2 text-zinc-500">
          Listado de clientes registrados en la tienda.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-900">Cliente</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Contacto</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Ubicación</th>
                <th className="px-6 py-4 font-semibold text-zinc-900">Fecha Registro</th>
                <th className="px-6 py-4 font-semibold text-zinc-900 text-center">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No hay clientes registrados aún.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
