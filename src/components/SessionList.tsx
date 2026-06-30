import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSessions } from '../lib/sessions'
import { formatDate, preview } from '../lib/format'
import type { Session } from '../lib/types'

export function SessionListPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setErr((e as Error).message))
  }, [])

  if (err) return <p className="error">{err}</p>
  if (!sessions) {
    return (
      <div className="empty">
        <span className="spinner" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p>No sessions yet.</p>
        <p className="muted">
          Share a Voice Memo to the shortcut, or <Link to="/new">paste one in</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="session-list">
      {sessions.map((s) => (
        <Link key={s.id} to={`/session/${s.id}`} className="session-card">
          <div className="meta">
            <span>{formatDate(s.recorded_at)}</span>
            {s.source === 'manual' && <span className="badge manual">manual</span>}
            {s.status === 'transcribed' && <span className="badge">not enriched</span>}
          </div>
          <h3>{s.title || formatDate(s.recorded_at)}</h3>
          <p className="preview">{s.summary || preview(s.transcript_raw)}</p>
        </Link>
      ))}
    </div>
  )
}
