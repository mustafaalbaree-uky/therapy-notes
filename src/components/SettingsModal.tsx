import { useState } from 'react'
import {
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  loadSettings,
  saveSettings,
  type EnrichSettings,
} from '../lib/settings'
import type { ProviderId } from '../lib/types'

const PROVIDERS: ProviderId[] = ['anthropic', 'groq', 'gemini']

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<EnrichSettings>(() => loadSettings())
  const [saved, setSaved] = useState(false)

  const update = (patch: Partial<EnrichSettings>) => {
    setS((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }
  const setKey = (p: ProviderId, v: string) =>
    update({ keys: { ...s.keys, [p]: v } })
  const setModel = (p: ProviderId, v: string) =>
    update({ models: { ...s.models, [p]: v } })

  const save = () => {
    saveSettings(s)
    setSaved(true)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <h2>Enrichment settings</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 18px' }}>
          Keys are stored only in this browser and sent directly to the provider you pick. Nothing
          is hardcoded or uploaded.
        </p>

        <label className="field">
          <span className="lbl">Active provider for enrichment</span>
          <select
            value={s.provider}
            onChange={(e) => update({ provider: e.target.value as ProviderId })}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <hr className="soft" />

        {PROVIDERS.map((p) => (
          <div key={p} style={{ marginBottom: 18 }}>
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="lbl">{PROVIDER_LABELS[p]} API key</span>
              <input
                type="password"
                placeholder={s.keys[p] ? '•••••• (saved)' : 'Paste key'}
                value={s.keys[p]}
                onChange={(e) => setKey(p, e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lbl">Model</span>
              <input
                type="text"
                placeholder={DEFAULT_MODELS[p]}
                value={s.models[p]}
                onChange={(e) => setModel(p, e.target.value)}
              />
            </label>
            {p === 'gemini' && (
              <p className="note" style={{ marginTop: 10 }}>
                A Gemini key also unlocks best-effort <strong>speaker labeling</strong> on the
                session page.
              </p>
            )}
          </div>
        ))}

        <div className="between" style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {saved ? 'Saved.' : ''}
          </span>
          <div className="row" style={{ flex: '0 0 auto' }}>
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
