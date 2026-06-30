// Supabase connection config.
//
// Resolution order:
//   1. Build-time env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
//   2. Values saved at runtime via the in-app setup screen (localStorage)
//
// Both the URL and the anon key are public-safe (RLS gates all access), so
// storing them in localStorage or committing them is fine.

const LS_URL = 'tn.supabase.url'
const LS_ANON = 'tn.supabase.anonKey'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = envUrl || (localStorage.getItem(LS_URL) ?? '').trim()
  const anonKey = envAnon || (localStorage.getItem(LS_ANON) ?? '').trim()
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
