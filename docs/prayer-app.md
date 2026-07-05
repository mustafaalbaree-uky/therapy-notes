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
