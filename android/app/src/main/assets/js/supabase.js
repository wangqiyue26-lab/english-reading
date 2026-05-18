/* ============================================
   Supabase Client Initialization
   ============================================ */

const SUPABASE_CONFIG = {
  // Replace these with your own Supabase project credentials
  // Get them from: https://app.supabase.com → Your Project → Settings → API
  url: 'https://grhoyqiikkfzbtjnazwb.supabase.co',
  anonKey: 'sb_publishable_kAbdOEen6J8bMURBhEKzWA_E0g5oU_R'
};

console.log('supabase.js: SDK loaded, creating client...');
const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

window.supabaseClient = supabaseClient;
