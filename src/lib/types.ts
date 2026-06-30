export type SessionStatus = 'transcribed' | 'enriched'
export type SessionSource = 'shortcut' | 'manual'

export interface Session {
  id: string
  user_id: string
  recorded_at: string
  title: string | null
  transcript_raw: string
  transcript_labeled: string | null
  summary: string | null
  takeaways: string | null
  next_steps: string | null
  reflections: string | null
  notes: string | null
  source: SessionSource
  status: SessionStatus
  duration_seconds: number | null
  created_at: string
}

// The structured result the enrichment model is asked to produce.
export interface Enrichment {
  title: string
  summary: string
  takeaways: string
  next_steps: string
  reflections: string
}

export type ProviderId = 'anthropic' | 'groq' | 'gemini'
