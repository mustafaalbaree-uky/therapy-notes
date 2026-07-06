# Prayer Times & Bark Notifications

A self-contained static app served alongside the main site at
**`/prayer/`** (https://mustafaalbaree-uky.github.io/therapy-notes/prayer/).
It shares nothing with the Therapy Notes app — it lives entirely in
`public/prayer/` and is copied verbatim into the Pages build.

## What it does

- **Live countdown** to the next adhan, then to the iqama, calculated on the
  device (no network needed after load). Defaults are tuned to match the
  Jordanian mosque clock: Fajr 18°, Isha 18°, standard Asr, with small
  per-prayer minute adjustments.
- **Bark push notifications** to an iPhone, sent by the
  `Prayer Bark notifications` GitHub Actions workflow every 5 minutes:
  - "X minutes until adhan" (default 15 before)
  - at adhan time
  - "X minutes until iqama" (default 5 before)
  - at iqama time (off by default)

## Bark setup (one time)

1. Install **Bark** from the App Store and open it once. Allow notifications.
2. Copy your key — the code in the URL Bark shows you,
   `https://api.day.app/YOURKEY/...`.
3. Give the key to the sender, either way works:
   - **Recommended:** repo → Settings → Secrets and variables → Actions →
     *New repository secret* named `BARK_KEY` with the key as value.
   - **Simpler:** edit [`public/prayer/config.json`](../public/prayer/config.json)
     and put the key in `bark.key`. (The repo is public, so anyone who finds
     the key could send you notifications — the secret avoids that.)
4. Test it: Actions → *Prayer Bark notifications* → *Run workflow* → tick
   *Send a test notification*.

## Changing notification settings

Everything lives in [`public/prayer/config.json`](../public/prayer/config.json):
lead times, which alerts are on, which prayers, iqama offsets, sound,
time-sensitive level, location and calculation method.

Easiest flow from the phone: open the app → ⚙ settings → adjust → **Copy
config for GitHub** → **Open GitHub config ↗** → select all, paste, commit.
Display-only changes (how the page shows times) apply instantly without any
of that — they save to the device.

## iPhone home-screen widget (Scriptable)

A home-screen widget shows the next prayer without opening anything. It's
built with **Scriptable** — a free app that runs your own JavaScript as a
widget (the widget-world equivalent of Bark). The real code lives in
[`public/prayer/widget.js`](../public/prayer/widget.js) and is loaded from
the deployed site, so it always matches your `config.json` and any later
change ships automatically — you never re-paste.

One-time setup (~2 min):

1. Install **Scriptable** from the App Store.
2. Open it → tap **+** (top-right) to make a new script.
3. Delete the placeholder and paste this **loader** exactly:

   ```js
   const url = "https://raw.githubusercontent.com/mustafaalbaree-uky/therapy-notes/main/public/prayer/widget.js";
   const code = await new Request(url).loadString();
   if (!code.includes("computePrayerTimes")) throw new Error("Couldn't load widget code — got: " + code.slice(0, 40));
   await new Function("return (async () => {" + code + "})()")();
   ```

   (It loads from `raw.githubusercontent.com`, not GitHub Pages, so it gets
   the real file the moment it's on `main` — GitHub Pages can briefly serve
   an HTML error page for a `.js` file right after a deploy, which caused the
   old `SyntaxError: Unexpected token '<'`. The guard line turns any odd
   response into a clear message instead of that cryptic error.)

4. Tap the script's name at the top, rename it to **Prayer Times**, tap Done.
   (Tap ▶ to preview it right there.)
5. Go to your home screen → long-press → **+** → search **Scriptable** →
   pick a size (medium shows the full timetable) → **Add Widget**.
6. Long-press the new widget → **Edit Widget** → set **Script** to
   *Prayer Times*. Leave "When Interacting" as *Run Script* (or set it to
   open the URL). Done.

The widget shows the next adhan (or the iqama once the adhan has passed)
with a countdown, plus today's five prayer times on the medium/large sizes.
Tapping it opens the full web app. iOS decides how often widgets refresh
(usually every several minutes), so the countdown updates in steps, not by
the second.

## Notes

- GitHub cron isn't exact — pushes can arrive a few minutes late at busy
  times. The sender looks back 14 minutes and dedupes, so alerts aren't
  doubled or silently dropped.
- The schedule covers 03:00–22:59 Jordan time, which spans all prayer
  moments year-round. If you change `utcOffset` to a very different
  timezone, widen the `cron` window in
  `.github/workflows/prayer-notifications.yml`.
- GitHub pauses scheduled workflows after ~60 days with no repo activity;
  any commit re-arms them.
