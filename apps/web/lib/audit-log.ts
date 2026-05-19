import { createServerClient } from '@supabase/ssr';
import { getSupabaseEnv } from '@/lib/env';

export interface AuditLogPayload {
  action: string;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  previousData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Server-side audit logger.
 * Can be called from API routes or the Proxy.
 */
export async function logAuditRecord(data: AuditLogPayload, requestId?: string) {
  const env = getSupabaseEnv();
  if (!env) return;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: () => {} }
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('audit_logs').insert({
      action: data.action,
      entity: data.entity,
      entity_id: data.entityId,
      payload: data.payload,
      previous_data: data.previousData,
      user_id: user?.id || null,
      request_id: requestId || null,
      metadata: {
        ...data.metadata,
        timestamp_utc: new Date().toISOString(),
      }
    });

    if (error) {
      console.error('[AuditLog] Error inserting log:', error);
    }
  } catch (err) {
    console.error('[AuditLog] Unexpected error:', err);
  }
}

/**
 * Critical System Alert Logger.
 */
export async function logSystemAlert(level: 'CRITICAL' | 'WARNING', message: string, context?: unknown) {
  const env = getSupabaseEnv();
  if (!env) return;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: () => {} }
  });

  try {
    await supabase.from('system_alerts').insert({
      level,
      message,
      context,
      is_resolved: false,
    });
    
    // Aquí se podría integrar con un servicio externo de notificaciones (e.g. Slack/Email)
    console.warn(`[ALERT][${level}] ${message}`, context);
  } catch (err) {
    console.error('[SystemAlert] Error logging alert:', err);
  }
}
