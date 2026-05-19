import { createClient } from '@/utils/supabase/client';

/**
 * Hook or Utility to handle MFA enrollment and verification.
 * Prepares the structure for 2FA in the dashboard.
 */
export async function enrollMFA() {
  const supabase = createClient();
  
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  });

  if (error) throw error;
  return data;
}

export async function unenrollMFA(factorId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.unenroll({
    factorId,
  });
  if (error) throw error;
  return data;
}

export async function listMFAFactors() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

export async function challengeAndVerifyMFA(factorId: string, code: string) {
  const supabase = createClient();
  
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });

  if (verify.error) throw verify.error;
  return verify.data;
}

/**
 * Helper to check if the current session is LOA3 (Assurance Level 3 - MFA verified)
 */
export async function getAAL() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}
