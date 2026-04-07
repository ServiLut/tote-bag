import { createClient } from '@supabase/supabase-js';

const url = '"https://supabase.servilutioncrm.cloud"';
const key = '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpY..."';

try {
  const supabase = createClient(url, key);
  console.log('Client created with quotes');
  // It won't actually fail until we use it.
} catch (e) {
  console.error('Failed to create client:', e);
}
