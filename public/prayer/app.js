import { computePrayerTimes, formatMinutes, PRAYERS } from "./prayertimes.js";

const NAMES = {
  fajr: { ar: "الفجر", en: "Fajr" },
  sunrise: { ar: "الشروق", en: "Shuruq" },
  dhuhr: { ar: "الظهر", en: "Dhuhr" },
  asr: { ar: "العصر", en: "Asr" },
  maghrib: { ar: "المغرب", en: "Maghrib" },
  isha: { ar: "العشاء", en: "Isha" },
};
const ADHAN_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const STORAGE_KEY = "prayer-settings-v1";
const GH_EDIT_URL =
  "https://github.com/mustafaalbaree-uky/therapy-notes/edit/main/public/prayer/config.json";

let defaults = null; // config.json as shipped
let cfg = null; // defaults deep-merged with localStorage overrides

const $ = (id) => document.getElementById(id);

function deepMerge(base, over) {
  if (over === undefined || over === null) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

// ---------- time helpers (all in the configured UTC offset) ----------

function localNow() {
  // A Date whose UTC fields hold the wall-clock time at the configured offset.
  return new Date(Date.now() + cfg.location.utcOffset * 3600e3);
}

function timesForDate(d) {
  // d: Date from localNow() (read via UTC getters)
  return computePrayerTimes({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    latitude: cfg.location.latitude,
    longitude: cfg.location.longitude,
    utcOffset: cfg.location.utcOffset,
    fajrAngle: cfg.calculation.fajrAngle,
    ishaAngle: cfg.calculation.ishaAngle,
    asrFactor: cfg.calculation.asrFactor,
    adjustments: cfg.calculation.adjustments,
  });
}

function epochAt(d, minutes) {
  // real epoch ms of `minutes after local midnight` on local date d
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    cfg.location.utcOffset * 3600e3 +
    minutes * 60e3
  );
}

// Ordered adhan/iqama events for today + tomorrow's fajr.
function buildEvents() {
  const today = localNow();
  const tomorrow = new Date(today.getTime() + 864e5);
  const tToday = timesForDate(today);
  const tTomorrow = timesForDate(tomorrow);
  const events = [];
  for (const p of ADHAN_PRAYERS) {
    const adhan = epochAt(today, tToday[p]);
    events.push({ prayer: p, kind: "adhan", epoch: adhan, minutes: tToday[p] });
    events.push({
      prayer: p,
      kind: "iqama",
      epoch: adhan + cfg.iqama[p] * 60e3,
      minutes: tToday[p] + cfg.iqama[p],
    });
  }
  const fajrT = epochAt(tomorrow, tTomorrow.fajr);
  events.push({ prayer: "fajr", kind: "adhan", epoch: fajrT, minutes: tTomorrow.fajr, tomorrow: true });
  events.push({
    prayer: "fajr",
    kind: "iqama",
    epoch: fajrT + cfg.iqama.fajr * 60e3,
    minutes: tTomorrow.fajr + cfg.iqama.fajr,
    tomorrow: true,
  });
  return { events, tToday };
}

// ---------- rendering ----------

function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}

let cache = { events: null, tToday: null, day: null, cfgStamp: null };

function refreshModel() {
  const day = localNow().getUTCDate();
  const cfgStamp = JSON.stringify(cfg);
  if (!cache.events || cache.day !== day || cache.cfgStamp !== cfgStamp) {
    const { events, tToday } = buildEvents();
    cache = { events, tToday, day, cfgStamp };
    renderGrid();
  }
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  for (const p of PRAYERS) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.prayer = p;
    const adhan = formatMinutes(cache.tToday[p], { meridiem: false });
    const iqama =
      p === "sunrise"
        ? `<span>—</span>`
        : `iqama <span>${formatMinutes(cache.tToday[p] + cfg.iqama[p], { meridiem: false })}</span>`;
    cell.innerHTML = `
      <div class="nameAr ar">${NAMES[p].ar}</div>
      <div class="nameEn">${NAMES[p].en}</div>
      <div class="adhan">${adhan}</div>
      <div class="iqama">${iqama}</div>`;
    grid.appendChild(cell);
  }
}

function tick() {
  refreshModel();
  const now = Date.now();
  const events = cache.events;
  const next = events.find((e) => e.epoch > now);
  if (!next) return;

  const idx = events.indexOf(next);
  const prevEpoch = idx > 0 ? events[idx - 1].epoch : now - 1;
  const name = NAMES[next.prayer];

  $("heroPrayerAr").textContent = name.ar;
  $("heroPrayerEn").textContent =
    name.en + (next.tomorrow ? " · tomorrow" : "");
  $("heroCountdown").textContent = fmtCountdown(next.epoch - now);

  if (next.kind === "adhan") {
    $("heroKicker").textContent = "UNTIL ADHAN · حتى الأذان";
    $("heroSub").innerHTML = `Adhan at <b>${formatMinutes(next.minutes)}</b> · Iqama at <b>${formatMinutes(next.minutes + cfg.iqama[next.prayer])}</b>`;
  } else {
    $("heroKicker").textContent = "UNTIL IQAMA · حتى الإقامة";
    $("heroSub").innerHTML = `Adhan was at <b>${formatMinutes(next.minutes - cfg.iqama[next.prayer])}</b> · Iqama at <b>${formatMinutes(next.minutes)}</b>`;
  }

  const span = next.epoch - prevEpoch;
  $("progressBar").style.width =
    Math.min(100, Math.max(0, ((now - prevEpoch) / span) * 100)) + "%";

  // header clock + dates
  const ln = localNow();
  $("nowTime").textContent = `${formatMinutes(ln.getUTCHours() * 60 + ln.getUTCMinutes(), { meridiem: false })}:${String(ln.getUTCSeconds()).padStart(2, "0")} ${ln.getUTCHours() < 12 ? "AM" : "PM"}`;
  const civil = new Date(Date.UTC(ln.getUTCFullYear(), ln.getUTCMonth(), ln.getUTCDate()));
  $("dateLine").textContent = civil.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  try {
    $("hijriLine").textContent = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(civil);
  } catch { /* hijri calendar unsupported */ }

  // highlight grid
  const activePrayer = next.prayer === "fajr" && next.tomorrow ? null : next.prayer;
  for (const cell of document.querySelectorAll(".cell")) {
    const p = cell.dataset.prayer;
    cell.classList.toggle("active", p === activePrayer);
    const pastEpoch =
      p === "sunrise"
        ? epochAt(localNow(), cache.tToday.sunrise)
        : epochAt(localNow(), cache.tToday[p]) + cfg.iqama[p] * 60e3;
    cell.classList.toggle("past", pastEpoch < now && p !== activePrayer);
  }
}

// ---------- settings ----------

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function buildAdjustRows() {
  $("adjRows").innerHTML = PRAYERS.map(
    (p) =>
      `<div class="row"><label>${NAMES[p].en} <span class="ar">${NAMES[p].ar}</span></label><input type="number" id="adj_${p}" /></div>`
  ).join("");
  $("iqamaRows").innerHTML = ADHAN_PRAYERS.map(
    (p) =>
      `<div class="row"><label>${NAMES[p].en} <span class="ar">${NAMES[p].ar}</span></label><input type="number" min="0" id="iq_${p}" /></div>`
  ).join("");
  $("prayerToggles").innerHTML = ADHAN_PRAYERS.map(
    (p) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:.85rem"><input type="checkbox" id="np_${p}" />${NAMES[p].en}</label>`
  ).join("");
}

function settingsToForm() {
  $("s_name").value = cfg.location.name;
  $("s_lat").value = cfg.location.latitude;
  $("s_lng").value = cfg.location.longitude;
  $("s_utc").value = cfg.location.utcOffset;
  $("s_fajrAngle").value = cfg.calculation.fajrAngle;
  $("s_ishaAngle").value = cfg.calculation.ishaAngle;
  $("s_asrFactor").value = String(cfg.calculation.asrFactor);
  for (const p of PRAYERS) $(`adj_${p}`).value = cfg.calculation.adjustments[p] ?? 0;
  for (const p of ADHAN_PRAYERS) {
    $(`iq_${p}`).value = cfg.iqama[p];
    $(`np_${p}`).checked = cfg.bark.prayers[p];
  }
  $("s_barkKey").value = cfg.bark.key;
  $("s_barkServer").value = cfg.bark.server;
  $("s_barkSound").value = cfg.bark.sound;
  $("s_timeSensitive").checked = cfg.bark.timeSensitive;
  const n = cfg.bark.notifications;
  $("s_nBeforeAdhan").checked = n.beforeAdhan.enabled;
  $("s_nBeforeAdhanMin").value = n.beforeAdhan.minutes;
  $("s_nAtAdhan").checked = n.atAdhan.enabled;
  $("s_nBeforeIqama").checked = n.beforeIqama.enabled;
  $("s_nBeforeIqamaMin").value = n.beforeIqama.minutes;
  $("s_nAtIqama").checked = n.atIqama.enabled;
}

function formToSettings() {
  const num = (id, fallback) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : fallback;
  };
  const s = {
    location: {
      name: $("s_name").value.trim() || defaults.location.name,
      latitude: num("s_lat", defaults.location.latitude),
      longitude: num("s_lng", defaults.location.longitude),
      utcOffset: num("s_utc", defaults.location.utcOffset),
    },
    calculation: {
      fajrAngle: num("s_fajrAngle", 18),
      ishaAngle: num("s_ishaAngle", 18),
      asrFactor: parseInt($("s_asrFactor").value, 10) || 1,
      adjustments: {},
    },
    iqama: {},
    bark: {
      key: $("s_barkKey").value.trim(),
      server: $("s_barkServer").value.trim() || defaults.bark.server,
      sound: $("s_barkSound").value.trim() || defaults.bark.sound,
      timeSensitive: $("s_timeSensitive").checked,
      notifications: {
        beforeAdhan: { enabled: $("s_nBeforeAdhan").checked, minutes: num("s_nBeforeAdhanMin", 15) },
        atAdhan: { enabled: $("s_nAtAdhan").checked },
        beforeIqama: { enabled: $("s_nBeforeIqama").checked, minutes: num("s_nBeforeIqamaMin", 5) },
        atIqama: { enabled: $("s_nAtIqama").checked },
      },
      prayers: {},
    },
  };
  for (const p of PRAYERS) s.calculation.adjustments[p] = num(`adj_${p}`, 0);
  for (const p of ADHAN_PRAYERS) {
    s.iqama[p] = num(`iq_${p}`, defaults.iqama[p]);
    s.bark.prayers[p] = $(`np_${p}`).checked;
  }
  return s;
}

function wireUi() {
  const dlg = $("settings");
  const open = () => {
    settingsToForm();
    dlg.showModal();
  };
  $("gearBtn").addEventListener("click", open);
  $("footSettings").addEventListener("click", (e) => { e.preventDefault(); open(); });
  $("closeBtn").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $("ghEdit").href = GH_EDIT_URL;

  $("saveBtn").addEventListener("click", () => {
    const s = formToSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    cfg = deepMerge(defaults, s);
    applyHeader();
    tick();
    dlg.close();
    toast("Saved on this device ✓");
  });

  $("resetBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    cfg = deepMerge(defaults, {});
    settingsToForm();
    applyHeader();
    tick();
    toast("Reset to defaults");
  });

  $("copyCfg").addEventListener("click", async () => {
    const json = JSON.stringify(deepMerge(defaults, formToSettings()), null, 2) + "\n";
    try {
      await navigator.clipboard.writeText(json);
      toast("Config copied — paste it into the GitHub file");
    } catch {
      prompt("Copy this JSON into public/prayer/config.json on GitHub:", json);
    }
  });

  $("testBark").addEventListener("click", () => {
    const s = formToSettings();
    if (!s.bark.key) return toast("Enter your Bark key first");
    const url =
      `${s.bark.server.replace(/\/+$/, "")}/${encodeURIComponent(s.bark.key)}/` +
      `${encodeURIComponent("🕌 مواقيت الصلاة")}/${encodeURIComponent("Test notification — Bark is connected ✓")}` +
      `?group=prayer&sound=${encodeURIComponent(s.bark.sound)}` +
      (s.bark.timeSensitive ? "&level=timeSensitive" : "");
    fetch(url, { mode: "no-cors" })
      .then(() => toast("Test sent — check your iPhone"))
      .catch(() => toast("Could not reach Bark server"));
  });
}

function applyHeader() {
  $("locName").textContent = cfg.location.name.toUpperCase().replaceAll(",", " ·");
}

async function main() {
  const res = await fetch("./config.json", { cache: "no-cache" });
  defaults = await res.json();
  cfg = deepMerge(defaults, loadSettings());
  buildAdjustRows();
  wireUi();
  applyHeader();
  tick();
  setInterval(tick, 250);
}

main();
