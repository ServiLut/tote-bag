import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { ApiResponse } from '@/types/api';
import type { DashboardRole } from '@/components/dashboard/DashboardAuthContext';

interface ProfileMeResponse {
  user?: {
    role?: DashboardRole;
  };
}

async function getCurrentRole(apiUrl: string, accessToken: string): Promise<DashboardRole | null> {
  try {
    const res = await fetch(`${apiUrl}/profiles/me`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;

    const body: ApiResponse<ProfileMeResponse> = await res.json();
    return body?.data?.user?.role ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const role = await getCurrentRole(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api/v1',
    session.access_token,
  );

  if (!role || !['ADMIN', 'MANAGER', 'ADVISOR', 'VIEWER'].includes(role)) {
    redirect('/catalog');
  }

  return (
    <DashboardLayoutClient userEmail={session.user.email} role={role}>
      {children}
    </DashboardLayoutClient>
  );
}
