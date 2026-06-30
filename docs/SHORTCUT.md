# Building the "Log Therapy Session" iOS Shortcut

This is built by hand in the **Shortcuts** app. It is intentionally minimal: it
transcribes a shared Voice Memo with Groq Whisper and writes the transcript to
your Supabase database. Enrichment (titles, summaries, reflections) happens
later in the web app, not here.

> The shortcut holds your Supabase **service_role** key. Keep it on the device
> and **never share or export the shortcut.** See the README "Security" section.

## A1. Action Button (one-time, no build)

Settings → **Action Button** → set it to the built-in **Voice Memo** function.
This is native iOS — one press starts recording, one press stops, and it keeps
running in the background through calls and screen lock. Do **not** use a
shortcut's "Record Audio" action for this.

## A2. The shortcut

Create a new shortcut. In its settings (ⓘ):

- Enable **Show in Share Sheet**.
- Set **Accepted Types** to **Audio** and **Media** only.

Then add these actions in order:

1. **Receive** Audio and Media input from **Share Sheet**.
   (The shared Voice Memo arrives as *Shortcut Input*.)

2. **Encode Media** — input: *Shortcut Input*.
   - Turn **Audio Only** ON.
   - Set a **lower audio quality**.
   - This keeps the file under Groq's 25 MB upload limit even for a ~50 min
     session. Not optional.

3. **Get Contents of URL** (transcribe with Groq):
   - URL: `https://api.groq.com/openai/v1/audio/transcriptions`
   - Method: **POST**
   - Headers:
     - `Authorization` = `Bearer YOUR_GROQ_KEY`
   - Request Body: **Form**
     - `file` (File) = the **Encoded Media** from step 2 — the field name must be exactly `file`
     - `model` (Text) = `whisper-large-v3-turbo`
     - `response_format` (Text) = `text`
     - `language` (Text) = `en` *(optional)*
   - With `response_format = text`, the response **is** the plain transcript.
     Save it to a variable named **Transcript**.

4. **Get Current Date** → **Format Date** as **ISO 8601**.
   Save to a variable named **RecordedAt**.

5. **Get Contents of URL** (save to Supabase):
   - URL: `https://YOUR_PROJECT.supabase.co/rest/v1/sessions`
   - Method: **POST**
   - Headers:
     - `apikey` = `YOUR_SUPABASE_SERVICE_ROLE_KEY`
     - `Authorization` = `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
     - `Content-Type` = `application/json`
     - `Prefer` = `return=minimal`
   - Request Body: **JSON**
     - `user_id` = `YOUR_USER_UID` (your Supabase Auth user id — a fixed value)
     - `transcript_raw` = the **Transcript** variable
     - `recorded_at` = the **RecordedAt** variable
     - `source` = `shortcut`

6. **Copy to Clipboard** = the **Transcript** variable.

7. **Show Notification** = a short confirmation (optionally include the first
   100 characters of **Transcript**).

## A3. Daily use

1. Press the Action Button → Voice Memo starts recording in the background.
2. Have your session. Pocket/lock is fine.
3. Press the Action Button again to stop.
4. Open the memo in Voice Memos → **Share** → **Log Therapy Session**.
5. The transcript lands on your clipboard, a notification confirms it saved, and
   the session appears in the web app.

If a transcription ever fails, the original `m4a` is still in Voice Memos — just
re-share it.

## A3 note — file size

Groq's free tier caps direct uploads at 25 MB. The Encode Media step keeps every
session comfortably under that. For much longer or higher-quality recordings,
options are a Groq paid tier (100 MB via URL) or splitting the audio.

## Why the service_role key here

The shortcut needs to insert a row tagged with your `user_id` while bypassing
the read protections (RLS) that keep strangers out of the web app's data. The
service_role key does exactly that and lives only inside this shortcut on your
device. It must never appear in the web app or this repository.

---

# Variant — "Log Therapy Session (Gemini)" — real speaker labeling

Groq Whisper produces a flat transcript with no idea who is speaking. Gemini is
multimodal, so it can **listen to the audio itself** and attribute each turn to
a speaker. Because the audio only exists on the phone (it never reaches the web
app or the database), this has to happen **in the shortcut**.

Duplicate the Groq shortcut (or build fresh) and call it **Log Therapy Session
(Gemini)**. Same Share Sheet settings (Audio + Media). One Gemini call replaces
the Groq call; the result is stored already speaker-labeled.

Get a **Google Gemini API key** from <https://aistudio.google.com/apikey>.

### Actions

1. **Receive** Audio and Media from **Share Sheet** (Shortcut Input).

2. **Encode Media** — input *Shortcut Input*; **Audio Only** ON; **lowest**
   quality. (Critical here: Gemini takes inline audio only up to ~20 MB of
   request, and base64 inflates size ~33%, so keep it small.)

3. **Base64 Encode** — input the **Encoded Media**; **Line Breaks: None**.
   Set variable **AudioB64** to the result.

4. **Text** — paste this exactly, then replace the bracketed part with the
   **AudioB64** variable (delete `PASTE_AudioB64_VARIABLE_HERE` and insert the
   variable in its place, keeping the surrounding quotes):

   ```json
   {
     "contents": [
       {
         "parts": [
           { "text": "You are given the audio of a therapy session between two people: the client (label as You) and the therapist (label as Marty). Transcribe the entire conversation verbatim in English. Attribute every turn to the correct speaker using markdown bold labels **You:** and **Marty:** at the start of each turn, with a blank line between turns. Output only the transcript, no preamble." },
           { "inline_data": { "mime_type": "audio/mp4", "data": "PASTE_AudioB64_VARIABLE_HERE" } }
         ]
       }
     ]
   }
   ```

5. **Get Contents of URL** (Gemini):
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_GEMINI_KEY`
   - Method: **POST**
   - Headers: `Content-Type` = `application/json`
   - Request Body: **File**, and select the **Text** from step 4. (Choosing
     "File" with a Text value sends the raw JSON as the body — easier than
     hand-building deeply nested JSON in the dictionary editor.)

6. Parse Gemini's reply (it returns JSON `{ candidates: [ { content: { parts: [ { text } ] } } ] }`):
   - **Get Dictionary Value** → key `candidates` → from **Contents of URL**
   - **Get Item from List** → **First Item**
   - **Get Dictionary Value** → key `content`
   - **Get Dictionary Value** → key `parts`
   - **Get Item from List** → **First Item**
   - **Get Dictionary Value** → key `text`
   - **Set Variable** **Transcript** = that text.

7. **Current Date** → **Format Date** ISO 8601 → **Set Variable** **RecordedAt**.

8. **Get Contents of URL** (save to Supabase) — same as the Groq shortcut's
   step 5, but store the labeled text in **both** transcript columns so the app
   shows it labeled by default:
   - URL: `https://YOUR_PROJECT.supabase.co/rest/v1/sessions`
   - Headers: `apikey`, `Authorization: Bearer <service_role>`,
     `Content-Type: application/json`, `Prefer: return=minimal`
   - JSON body:
     - `user_id` = your full user UID
     - `transcript_raw` = **Transcript**
     - `transcript_labeled` = **Transcript**
     - `recorded_at` = **RecordedAt**
     - `source` = `shortcut`

9. **Copy to Clipboard** = **Transcript**.
10. **Show Notification** = **Transcript** (while testing, set this to the raw
    **Contents of URL** from step 5 instead — if Gemini errored, you'll see its
    error message here instead of an empty result).

### Notes / gotchas

- **MIME type:** Encode Media outputs `.m4a`. Try `audio/mp4` first; if Gemini
  replies with an "unsupported mime type" error, change step 4's `mime_type` to
  `audio/aac`.
- **Length limit:** inline audio must fit the ~20 MB request cap. The low-quality
  encode keeps normal sessions under it; a very long session can exceed it, in
  which case Gemini returns a size error (visible via the step-10 testing tip).
  The fix for that case is Gemini's File API (a multi-step upload) — ask if you
  want that version.
- The app renders `transcript_labeled` as markdown and, when present, shows it by
  default — so these sessions open already attributed to **You** / **Marty**.
