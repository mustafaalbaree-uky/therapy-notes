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
