'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from '@/lib/env';
import { 
  FinanceDashboardQuery, 
  FinanceDashboardData 
} from '@/lib/finance-dashboard';
import { loadFinanceDashboardDataServer } from '@/lib/finance-server';
import { getAuthHeaders as getSharedAuthHeaders } from '@/utils/supabase/auth-server';

/**
 * Server Action to load finance dashboard data securely.
 */
export async function getFinanceDashboardData(query: FinanceDashboardQuery): Promise<FinanceDashboardData> {
  const env = getSupabaseEnv();
  if (!env) throw new Error('Supabase environment not configured');

  const cookieStore = await cookies();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(payload) {
        payload.forEach((cookie) => cookieStore.set(cookie.name, cookie.value, cookie.options));
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  // We use the shared auth headers which already handle the session mapping
  const authHeaders = await getSharedAuthHeaders();

  return loadFinanceDashboardDataServer({
    authHeaders,
    query,
  });
}
