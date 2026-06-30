import { getSupabase } from './supabase'
import type { Enrichment, Session } from './types'

function client() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured.')
  return c
}

export async function listSessions(): Promise<Session[]> {
  const { data, error } = await client()
    .from('sessions')
    .select('*')
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Session[]
}

export async function getSession(id: string): Promise<Session> {
  const { data, error } = await client().from('sessions').select('*').eq('id', id).single()
  if (error) throw error
  return data as Session
}

export async function createManualSession(args: {
  userId: string
  transcript: string
  recordedAt: string
}): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .insert({
      user_id: args.userId,
      transcript_raw: args.transcript,
      recorded_at: args.recordedAt,
      source: 'manual',
      status: 'transcribed',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Session
}

export async function saveEnrichment(id: string, e: Enrichment): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .update({
      title: e.title || null,
      summary: e.summary || null,
      takeaways: e.takeaways || null,
      next_steps: e.next_steps || null,
      reflections: e.reflections || null,
      status: 'enriched',
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Session
}

export async function saveLabeledTranscript(id: string, labeled: string): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .update({ transcript_labeled: labeled })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Session
}

export async function updateFields(id: string, fields: Partial<Session>): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Session
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await client().from('sessions').delete().eq('id', id)
  if (error) throw error
}
