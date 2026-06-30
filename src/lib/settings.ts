import type { ProviderId } from './types'

// All enrichment-related settings live in the browser's localStorage only.
// API keys are never sent anywhere except directly to the model provider.

const LS = {
  provider: 'tn.enrich.provider',
  anthropicKey: 'tn.key.anthropic',
  groqKey: 'tn.key.groq',
  geminiKey: 'tn.key.gemini',
  anthropicModel: 'tn.model.anthropic',
  groqModel: 'tn.model.groq',
  geminiModel: 'tn.model.gemini',
} as const

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-5',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  groq: 'Groq',
  gemini: 'Google Gemini',
}

export interface EnrichSettings {
  provider: ProviderId
  keys: Record<ProviderId, string>
  models: Record<ProviderId, string>
}

function read(key: string): string {
  return (localStorage.getItem(key) ?? '').trim()
}

export function loadSettings(): EnrichSettings {
  const provider = (read(LS.provider) || 'anthropic') as ProviderId
  return {
    provider: (['anthropic', 'groq', 'gemini'].includes(provider) ? provider : 'anthropic'),
    keys: {
      anthropic: read(LS.anthropicKey),
      groq: read(LS.groqKey),
      gemini: read(LS.geminiKey),
    },
    models: {
      anthropic: read(LS.anthropicModel) || DEFAULT_MODELS.anthropic,
      groq: read(LS.groqModel) || DEFAULT_MODELS.groq,
      gemini: read(LS.geminiModel) || DEFAULT_MODELS.gemini,
    },
  }
}

export function saveSettings(s: EnrichSettings) {
  localStorage.setItem(LS.provider, s.provider)
  localStorage.setItem(LS.anthropicKey, s.keys.anthropic.trim())
  localStorage.setItem(LS.groqKey, s.keys.groq.trim())
  localStorage.setItem(LS.geminiKey, s.keys.gemini.trim())
  localStorage.setItem(LS.anthropicModel, s.models.anthropic.trim() || DEFAULT_MODELS.anthropic)
  localStorage.setItem(LS.groqModel, s.models.groq.trim() || DEFAULT_MODELS.groq)
  localStorage.setItem(LS.geminiModel, s.models.gemini.trim() || DEFAULT_MODELS.gemini)
}

// The active provider's key, or '' if not set yet.
export function activeKey(s: EnrichSettings): string {
  return s.keys[s.provider]
}

// Speaker labeling is offered only when a Gemini key is present (per the
// product decision to use Gemini for best-effort diarization on text).
export function canLabelSpeakers(s: EnrichSettings): boolean {
  return Boolean(s.keys.gemini)
}
