import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createManualSession } from '../lib/sessions'
import { toLocalInputValue } from '../lib/format'

// Backfill an older session by pasting its transcript. Enrichment is then run
// from the session detail page, exactly like a shortcut-created session.
export function ManualAddPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transcript, setTranscript] = useState('')
  const [when, setWhen] = useState(() => toLocalInputValue(new Date()))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const text = transcript.trim()
    if (!text) {
      setErr('Please paste a transcript.')
      return
    }
    setErr('')
    setBusy(true)
    try {
      const recordedAt = new Date(when).toISOString()
      const created = await createManualSession({
        userId: user.id,
        transcript: text,
        recordedAt,
      })
      navigate(`/session/${created.id}`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 style={{ fontSize: '1.5rem', marginTop: 0 }}>Add a session</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Paste a transcript you already have. You can enrich it on the next screen.
      </p>

      <label className="field">
        <span className="lbl">Session date</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </label>

      <label className="field">
        <span className="lbl">Transcript</span>
        <textarea
          rows={16}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the session transcript here…"
          autoFocus
        />
      </label>

      {err && <p className="error">{err}</p>}

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Save session'}
        </button>
        <button className="btn ghost" type="button" onClick={() => navigate('/')}>
          Cancel
        </button>
      </div>
    </form>
  )
}
