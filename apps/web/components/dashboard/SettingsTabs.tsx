'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { User, Users, Shield } from 'lucide-react';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';

export function SettingsTabs() {
  const pathname = usePathname();
  const { role } = useDashboardAuth();
  const isAdmin = role === 'ADMIN';

  const tabs = [
    {
      label: 'Perfil',
      href: '/dashboard/settings',
      icon: User,
      active: pathname === '/dashboard/settings',
    },
    ...(isAdmin ? [{
      label: 'Usuarios y Roles',
      href: '/dashboard/settings/users',
      icon: Users,
      active: pathname === '/dashboard/settings/users',
    }] : []),
  ];

  return (
    <div className="flex items-center gap-1.5 bg-surface p-2 rounded-[22px] border border-theme w-fit shadow-sm mb-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2.5 px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-95',
              tab.active
                ? 'bg-primary text-base-color shadow-xl shadow-primary/10'
                : 'text-muted hover:text-primary hover:bg-base/50'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', tab.active ? 'text-base-color' : 'text-muted')} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
