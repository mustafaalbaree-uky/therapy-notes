# Therapy Notes

A calm, private journal for recording, transcribing, and enriching therapy
sessions over time.

You press the iPhone Action Button to record a session as a native Voice Memo,
share the memo to an iOS Shortcut that transcribes it (Groq Whisper) and saves
the transcript to a database, and then read and reflect in this web app, which
adds AI generated titles, summaries, takeaways, next steps, and reflections.

The data is therapy transcripts, so privacy is a first-class requirement.
Transcripts stay private via database access control, not obscurity.

---

## How it fits together

| Piece | Job |
| --- | --- |
| **iOS Action Button** | Native Voice Memo recording that survives calls & screen lock |
| **"Log Therapy Session" shortcut** | Transcribes the shared memo (Groq Whisper) and writes the row to Supabase. Holds the `service_role` key, on-device only. |
| **Supabase** | Postgres table `sessions` + Auth + Row Level Security |
| **This web app** | Login, browse, read, and AI-enrich sessions. Read and enrich layer only. It never records audio. |

Audio never leaves the phone except to Groq for transcription. No audio is
stored in the database; the original `m4a` stays in Voice Memos as your backup.

---

## Security

1. **The web app is publicly hosted on GitHub Pages.** Anyone can load the page.
2. Transcripts are kept private by **Supabase Auth + Row Level Security**, not by
   the page being hard to find. Without a logged-in session, the anon key can
   read nothing.
3. The **Supabase URL and anon key are safe to commit / expose** (the anon key is
   meant to be public when RLS is on).
4. The **`service_role` key lives only inside the iOS shortcut on your device.**
   It must never appear in this web app or repository. Never share or export the
   shortcut.
5. **Enrichment API keys** (Anthropic / Groq / Gemini) are stored only in your
   browser's `localStorage` and sent directly to the provider you choose. None
   are hardcoded.

---

## One-time setup

### 1. Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (creates the
   `sessions` table and RLS policies).
3. Enable **Email** auth and create your single user account
   (Authentication → Users → Add user).
4. Note these four values:
   - Project URL, for the web app
   - **anon** public key, for the web app
   - **service_role** key, for the shortcut only
   - your user's **UID**, for the shortcut's `user_id`

### 2. API keys

- A **Groq** API key (for Whisper transcription in the shortcut).
- At least one **enrichment** key, entered in the app's Settings:
  - **Anthropic** (Claude): highest quality
  - **Groq**: free tier
  - **Google Gemini**: also unlocks best effort speaker labeling

### 3. The shortcut

Build it by hand following [`docs/SHORTCUT.md`](docs/SHORTCUT.md), and set the
Action Button to the native Voice Memo function. Record a short test memo, share
it to the shortcut, and confirm a row appears in the web app. This is the golden
loop. Get it rock solid first.

### 4. The web app

Configure Supabase one of two ways:

- **In-app (no rebuild):** deploy as-is and paste your Project URL + anon key on
  the one-time setup screen. They're stored in `localStorage`.
- **At build time:** copy `.env.example` to `.env` (local) or set repo
  *Variables* `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Actions), and the
  setup screen is skipped.

---

## Running locally

```bash
npm install
npm run dev
```

Then open the printed URL. Build with `npm run build`, preview with
`npm run preview`.

## Deploying to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and deploys on every push to `main`. It calls `actions/configure-pages`
with `enablement: true`, so it turns Pages on (source = GitHub Actions) by
itself, so no manual repo setting is needed. The app publishes at
`https://<you>.github.io/therapy-notes/`.

The Supabase URL + anon key for the provisioned `therapy-notes` project are
baked into [`src/lib/config.ts`](src/lib/config.ts) (both are public-safe), so
the deployed site works with no setup screen. To point at a different project,
set repo **Variables** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, which
override the baked defaults.

`vite.config.ts` sets `base` to `/therapy-notes/` and the app uses hash-based
routing, so refreshing a deep link won't 404 on Pages. If you rename the repo,
update `VITE_BASE`.

---

## Using the app

- **Session list**: newest first, with title, date, and a one-line preview.
- **Session detail**: full transcript with a Copy button. AI insights
  (summary, takeaways, next steps, reflections) generate on demand and are
  **editable** and **regenerable**; results save back and mark the session
  `enriched` so they aren't recomputed every visit. Enrichment auto-runs the
  first time you open a not-yet-enriched session if a key is set.
- **Add**: paste an older transcript with a date to backfill (`source = manual`),
  then enrich it the same way.
- **Settings**: choose your enrichment provider and paste API keys.
- **Speaker labeling**: with a Gemini key set, label the transcript into
  **You** / **Marty** turns (best effort, text based, stored separately so the
  raw transcript is never altered).

---

## Tech

React + Vite + TypeScript, `@supabase/supabase-js`, `react-router-dom`
(hash routing), `react-markdown`. Styling is hand-written CSS with a light/dark
theme tuned for long-form reading.
