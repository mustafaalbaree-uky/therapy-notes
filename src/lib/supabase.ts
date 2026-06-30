import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './config'

let client: SupabaseClient | null = null

// Lazily build the client so the app can render its setup screen first when no
// config exists yet. Once config is saved the page reloads and this resolves.
export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const cfg = getSupabaseConfig()
  if (!cfg) return null
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No URL-based auth flows (magic links / OAuth) are used, so leave the
      // hash for the app's own HashRouter.
      detectSessionInUrl: false,
    },
  })
  return client
}
