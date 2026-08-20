// Supabase connection config.
//
// Resolution order (highest priority first):
//   1. Build-time env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
//   2. Values saved at runtime via the in-app setup screen (localStorage)
//   3. The baked-in defaults below
//
// Both the URL and the anon key are public-safe (RLS gates all access), so
// committing them is fine: without a logged-in session they can read no rows.
// The `service_role` key is NOT here. It lives only in the iOS shortcut.

const LS_URL = 'tn.supabase.url'
const LS_ANON = 'tn.supabase.anonKey'

// Default project ("therapy-notes"). Safe to commit; see note above.
const DEFAULT_URL = 'https://kbxsvwblhwwfwyeesiwi.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtieHN2d2JsaHd3Znd5ZWVzaXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDU4ODcsImV4cCI6MjA5ODQyMTg4N30.rM0V4JHquqV_J3G8qYypXwAlFlA6SxoDwnGnbv_kbL8'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = envUrl || (localStorage.getItem(LS_URL) ?? '').trim() || DEFAULT_URL
  const anonKey = envAnon || (localStorage.getItem(LS_ANON) ?? '').trim() || DEFAULT_ANON
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function saveSupabaseConfig(cfg: SupabaseConfig) {
  localStorage.setItem(LS_URL, cfg.url.trim())
  localStorage.setItem(LS_ANON, cfg.anonKey.trim())
}

// True when config came from build-time env vars; the setup screen is then
// purely informational and cannot be overridden at runtime.
export const isConfiguredFromEnv = Boolean(envUrl && envAnon)
