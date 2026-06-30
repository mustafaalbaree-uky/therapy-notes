import { useState } from 'react'
import { saveSupabaseConfig } from '../lib/config'

// Shown only when no Supabase URL / anon key were provided at build time.
// Saves the two public-safe values to localStorage and reloads.
export function Setup() {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [err, setErr] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    const k = anonKey.trim()
    if (!u || !k) {
      setErr('Both fields are required.')
      return
    }
    if (!/^https?:\/\//.test(u)) {
      setErr('The project URL should start with https://')
      return
    }
    saveSupabaseConfig({ url: u, anonKey: k })
    window.location.reload()
  }

  return (
    <div className="center-screen">
      <form className="panel" onSubmit={submit}>
        <h1>Connect Supabase</h1>
        <p className="sub">
          Paste your project URL and the <strong>anon</strong> public key. Both are safe to store
          here — Row Level Security keeps your data private.
        </p>

        <label className="field">
          <span className="lbl">Project URL</span>
          <input
            type="text"
            inputMode="url"
            placeholder="https://YOUR_PROJECT.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="lbl">Anon public key</span>
          <input
            type="text"
            placeholder="eyJhbGciOi…"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </label>

        <p className="note">
          Never paste the <strong>service_role</strong> key here. That key belongs only inside your
          iOS shortcut.
        </p>

        {err && <p className="error">{err}</p>}

        <div style={{ marginTop: 18 }}>
          <button className="btn primary" type="submit">
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
