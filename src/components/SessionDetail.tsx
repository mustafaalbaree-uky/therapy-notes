import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  deleteSession,
  getSession,
  saveEnrichment,
  saveLabeledTranscript,
} from '../lib/sessions'
import { enrichTranscript, labelSpeakers } from '../lib/enrich'
import { canLabelSpeakers, loadSettings, PROVIDER_LABELS } from '../lib/settings'
import { formatDateTime } from '../lib/format'
import { Markdown } from './Markdown'
import type { Enrichment, Session } from '../lib/types'

function toDraft(s: Session): Enrichment {
  return {
    title: s.title ?? '',
    summary: s.summary ?? '',
    takeaways: s.takeaways ?? '',
    next_steps: s.next_steps ?? '',
    reflections: s.reflections ?? '',
  }
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [actionErr, setActionErr] = useState('')

  const [enriching, setEnriching] = useState(false)
  const [labeling, setLabeling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Enrichment | null>(null)
  const [showLabeled, setShowLabeled] = useState(false)
  const [copied, setCopied] = useState(false)

  const autoRan = useRef(false)

  const runEnrichment = useCallback(async (s: Session) => {
    setActionErr('')
    setEnriching(true)
    try {
      const result = await enrichTranscript(s.transcript_raw, loadSettings())
      const saved = await saveEnrichment(s.id, result)
      setSession(saved)
      setDraft(toDraft(saved))
    } catch (e) {
      setActionErr((e as Error).message)
    } finally {
      setEnriching(false)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    getSession(id)
      .then((s) => {
        setSession(s)
        setDraft(toDraft(s))
      })
      .catch((e) => setLoadErr((e as Error).message))
  }, [id])

  // Auto-run enrichment once, the first time a not-yet-enriched session is
  // opened and a key is available.
  useEffect(() => {
    if (autoRan.current || !session) return
    if (session.status === 'transcribed') {
      const s = loadSettings()
      if (s.keys[s.provider]) {
        autoRan.current = true
        runEnrichment(session)
      }
    }
  }, [session, runEnrichment])

  if (loadErr) return <p className="error">{loadErr}</p>
  if (!session || !draft) {
    return (
      <div className="empty">
        <span className="spinner" />
      </div>
    )
  }

  const settings = loadSettings()
  const hasKey = Boolean(settings.keys[settings.provider])
  const hasEnrichment = Boolean(
    session.summary || session.takeaways || session.next_steps || session.reflections,
  )
  const transcriptToShow =
    showLabeled && session.transcript_labeled ? session.transcript_labeled : session.transcript_raw

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcriptToShow)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setActionErr('Could not copy to clipboard.')
    }
  }

  const saveEdits = async () => {
    setSaving(true)
    setActionErr('')
    try {
      const saved = await saveEnrichment(session.id, draft)
      setSession(saved)
      setDraft(toDraft(saved))
      setEditing(false)
    } catch (e) {
      setActionErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const runLabeling = async () => {
    setLabeling(true)
    setActionErr('')
    try {
      const labeled = await labelSpeakers(session.transcript_raw, settings)
      const saved = await saveLabeledTranscript(session.id, labeled)
      setSession(saved)
      setShowLabeled(true)
    } catch (e) {
      setActionErr((e as Error).message)
    } finally {
      setLabeling(false)
    }
  }

  const removeSession = async () => {
    if (!confirm('Delete this session permanently? This cannot be undone.')) return
    try {
      await deleteSession(session.id)
      navigate('/')
    } catch (e) {
      setActionErr((e as Error).message)
    }
  }

  const field = (key: keyof Enrichment, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  return (
    <div>
      <button className="btn ghost small" onClick={() => navigate('/')}>
        ← All sessions
      </button>

      <div className="detail-header" style={{ marginTop: 12 }}>
        <h1>{session.title || formatDateTime(session.recorded_at)}</h1>
        <div className="meta">
          <span>{formatDateTime(session.recorded_at)}</span>
          <span>·</span>
          <span>{session.source === 'manual' ? 'Pasted in' : 'From shortcut'}</span>
          {session.status === 'enriched' && (
            <>
              <span>·</span>
              <span>enriched</span>
            </>
          )}
        </div>
      </div>

      {/* ---- Enrichment controls ---- */}
      <div className="toolbar" style={{ marginTop: 18 }}>
        {!hasEnrichment ? (
          <button className="btn primary" onClick={() => runEnrichment(session)} disabled={enriching || !hasKey}>
            {enriching ? <span className="spinner" /> : 'Generate insights'}
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => runEnrichment(session)} disabled={enriching}>
              {enriching ? <span className="spinner" /> : 'Regenerate'}
            </button>
            {!editing ? (
              <button className="btn ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <>
                <button className="btn primary" onClick={saveEdits} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save edits'}
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setDraft(toDraft(session))
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </>
        )}
        {!hasKey && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Add a {PROVIDER_LABELS[settings.provider]} key in Settings to enable this.
          </span>
        )}
      </div>

      {actionErr && <p className="error">{actionErr}</p>}

      {/* ---- Enrichment content ---- */}
      {editing ? (
        <div style={{ marginTop: 24 }}>
          <label className="field">
            <span className="lbl">Title</span>
            <input type="text" value={draft.title} onChange={(e) => field('title', e.target.value)} />
          </label>
          {(['summary', 'takeaways', 'next_steps', 'reflections'] as const).map((k) => (
            <label className="field" key={k}>
              <span className="lbl">{k.replace('_', ' ')}</span>
              <textarea rows={k === 'summary' ? 4 : 5} value={draft[k]} onChange={(e) => field(k, e.target.value)} />
            </label>
          ))}
        </div>
      ) : (
        hasEnrichment && (
          <>
            {session.summary && (
              <section className="section">
                <h2>Summary</h2>
                <div className="prose">
                  <p>{session.summary}</p>
                </div>
              </section>
            )}
            {session.takeaways && (
              <section className="section">
                <h2>Takeaways</h2>
                <Markdown>{session.takeaways}</Markdown>
              </section>
            )}
            {session.next_steps && (
              <section className="section">
                <h2>Next steps</h2>
                <Markdown>{session.next_steps}</Markdown>
              </section>
            )}
            {session.reflections && (
              <section className="section">
                <h2>Reflections</h2>
                <Markdown>{session.reflections}</Markdown>
              </section>
            )}
          </>
        )
      )}

      {/* ---- Transcript ---- */}
      <section className="section">
        <div className="between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Transcript</h2>
          <div className="toolbar">
            {session.transcript_labeled && (
              <button className="btn ghost small" onClick={() => setShowLabeled((v) => !v)}>
                {showLabeled ? 'Show raw' : 'Show labeled'}
              </button>
            )}
            {canLabelSpeakers(settings) && (
              <button className="btn ghost small" onClick={runLabeling} disabled={labeling}>
                {labeling ? <span className="spinner" /> : session.transcript_labeled ? 'Re-label speakers' : 'Label speakers'}
              </button>
            )}
            <button className="btn small" onClick={copyTranscript}>
              {copied ? 'Copied ✓' : 'Copy transcript'}
            </button>
          </div>
        </div>
        {showLabeled && session.transcript_labeled ? (
          <Markdown>{session.transcript_labeled}</Markdown>
        ) : (
          <div className="transcript">{session.transcript_raw}</div>
        )}
      </section>

      <hr className="soft" />
      <button className="btn danger small" onClick={removeSession}>
        Delete session
      </button>
    </div>
  )
}
