import type { Enrichment, ProviderId } from './types'
import { type EnrichSettings } from './settings'

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const ENRICH_INSTRUCTIONS = `You are helping someone keep a reflective journal of their therapy sessions.
You are given the raw transcript of one session. Produce a JSON object with exactly these string fields:

- "title": a short, evocative title (3-7 words) drawn from what the session was actually about. No quotes, no trailing punctuation.
- "summary": a few plain sentences capturing what happened and what mattered.
- "takeaways": the main themes or insights, written as a short markdown bulleted list.
- "next_steps": concrete things to try or practice before the next session, as a short markdown bulleted list.
- "reflections": open questions to sit with or look inward about, as a short markdown bulleted list.

Write warmly and directly to the person ("you"). Do not invent facts that aren't supported by the transcript.
Return ONLY the JSON object, no preamble, no code fences.`

function labelInstructions(): string {
  return `You are given the raw transcript of a therapy session between two people: the client (refer to them as "You") and their therapist (refer to them as "Marty").
Rewrite the transcript attributing each turn to the correct speaker, using markdown bold labels like "**You:**" and "**Marty:**" at the start of each turn, with a blank line between turns.
This is best effort: infer who is speaking from context. Do not add, remove, or summarize content. Only attribute the existing words.
Return ONLY the labeled transcript text, no preamble, no code fences.`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripFences(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '')
  }
  return t.trim()
}

// Pull the first balanced JSON object out of a model response, tolerating any
// stray prose the model may wrap around it.
function extractJsonObject(text: string): string {
  const t = stripFences(text)
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Model did not return a JSON object.')
  }
  return t.slice(start, end + 1)
}

function coerceEnrichment(raw: unknown): Enrichment {
  const o = (raw ?? {}) as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    title: s(o.title),
    summary: s(o.summary),
    takeaways: s(o.takeaways),
    next_steps: s(o.next_steps),
    reflections: s(o.reflections),
  }
}

async function asError(res: Response, provider: ProviderId): Promise<Error> {
  let detail = ''
  try {
    detail = await res.text()
  } catch {
    /* ignore */
  }
  const label = provider.charAt(0).toUpperCase() + provider.slice(1)
  return new Error(`${label} request failed (${res.status}): ${detail.slice(0, 400)}`)
}

// ---------------------------------------------------------------------------
// Per-provider raw text completion
// ---------------------------------------------------------------------------

interface CallOpts {
  system: string
  user: string
  // Ask for JSON output where the provider supports a structured mode.
  json: boolean
}

async function callAnthropic(s: EnrichSettings, opts: CallOpts): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.keys.anthropic,
      'anthropic-version': '2023-06-01',
      // Required to call the Messages API directly from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: s.models.anthropic,
      max_tokens: 2048,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  })
  if (!res.ok) throw await asError(res, 'anthropic')
  const data = await res.json()
  const parts = Array.isArray(data?.content) ? data.content : []
  return parts.map((p: { text?: string }) => p?.text ?? '').join('').trim()
}

async function callGroq(s: EnrichSettings, opts: CallOpts): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${s.keys.groq}`,
    },
    body: JSON.stringify({
      model: s.models.groq,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw await asError(res, 'groq')
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

async function callGemini(s: EnrichSettings, opts: CallOpts): Promise<string> {
  const model = encodeURIComponent(s.models.gemini)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    s.keys.gemini,
  )}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        maxOutputTokens: 4096,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  })
  if (!res.ok) throw await asError(res, 'gemini')
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p: { text?: string }) => p?.text ?? '').join('').trim()
}

async function complete(s: EnrichSettings, provider: ProviderId, opts: CallOpts): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return callAnthropic(s, opts)
    case 'groq':
      return callGroq(s, opts)
    case 'gemini':
      return callGemini(s, opts)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enrichTranscript(
  transcript: string,
  s: EnrichSettings,
): Promise<Enrichment> {
  if (!s.keys[s.provider]) {
    throw new Error(`No API key set for ${s.provider}. Open Settings to add one.`)
  }
  const text = await complete(s, s.provider, {
    system: ENRICH_INSTRUCTIONS,
    user: `Transcript:\n\n${transcript}`,
    json: true,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonObject(text))
  } catch (e) {
    throw new Error(
      `Could not parse the model's response as JSON. ${(e as Error).message}`,
    )
  }
  return coerceEnrichment(parsed)
}

// Best-effort speaker attribution. Gemini-only by product decision.
export async function labelSpeakers(
  transcript: string,
  s: EnrichSettings,
): Promise<string> {
  if (!s.keys.gemini) {
    throw new Error('Speaker labeling requires a Google Gemini API key. Add one in Settings.')
  }
  const labelOnly: EnrichSettings = { ...s, provider: 'gemini' }
  const text = await complete(labelOnly, 'gemini', {
    system: labelInstructions(),
    user: `Transcript:\n\n${transcript}`,
    json: false,
  })
  return stripFences(text)
}
