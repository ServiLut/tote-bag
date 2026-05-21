'use client';

import ProductsTable from '@/components/dashboard/ProductsTable';
import CollectionsManager from '@/components/dashboard/CollectionsManager';
import WizardConfigManager from '@/components/dashboard/WizardConfigManager';
import FabricCompatibilityMatrix from '@/components/dashboard/FabricCompatibilityMatrix';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { isDashboardReadOnlyRole } from '@/lib/frontend-routing';

export default function ProductsDashboardPage() {
  const { role } = useDashboardAuth();

  const isReadOnly = isDashboardReadOnlyRole(role);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-5 sm:px-6 md:p-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-primary md:text-3xl">Gestión de productos</h1>
          <p className="mt-2 text-muted font-medium max-w-2xl">
            Administra el catálogo, precios y estados. Las alertas visuales indican márgenes reducidos.
          </p>
        </div>
        {!isReadOnly && (
          <Link
            href="/dashboard/products/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-base-color shadow-lg shadow-primary/10 transition-all hover:opacity-90 active:scale-95 sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nuevo producto
          </Link>
        )}
      </div>

      <Tabs defaultValue="productos" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto whitespace-nowrap rounded-2xl border border-theme bg-surface p-1">
          <TabsTrigger value="productos">Catálogo</TabsTrigger>
          <TabsTrigger value="colecciones">Colecciones</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración técnica</TabsTrigger>
          <TabsTrigger value="matriz">Matriz de compatibilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="bg-surface dark-surface-gradient-soft rounded-3xl border border-theme shadow-sm overflow-hidden">
          <ProductsTable />
        </TabsContent>

        <TabsContent value="colecciones" className="bg-surface dark-surface-gradient-soft rounded-3xl border border-theme shadow-sm overflow-hidden">
          <CollectionsManager />
        </TabsContent>

        <TabsContent value="configuracion" className="bg-surface dark-surface-gradient-soft rounded-3xl border border-theme shadow-sm overflow-hidden p-4 md:p-8">
          <WizardConfigManager />
        </TabsContent>

        <TabsContent value="matriz" className="bg-surface dark-surface-gradient-soft rounded-3xl border border-theme shadow-sm overflow-hidden p-4 md:p-8">
          <FabricCompatibilityMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
