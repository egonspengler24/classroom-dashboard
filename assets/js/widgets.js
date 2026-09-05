/*
 * Widget registry shared by the display board (display.js) and the admin
 * editor (admin.js). To add a new widget type, add an entry here with:
 *   - label:            shown in the admin "add widget" dropdown
 *   - icon:             (optional) inline SVG string shown next to the title
 *   - defaultSettings(): fresh settings object for a newly-added widget
 *   - renderDisplay(settings): returns an HTML string for the board
 *   - renderAdminForm(settings): returns an HTML string of form fields
 *   - readAdminForm(container): reads the form fields back into a settings object
 *
 * Most widgets are stateless: renderDisplay() is called fresh on every poll
 * and its returned HTML fully replaces the widget's body. A widget that
 * needs to keep running state across those re-renders (e.g. a countdown
 * timer) should instead provide:
 *   - mount(container, settings): builds its own DOM into `container` once
 *     and wires up any interactivity/timers itself. display.js calls this
 *     exactly once per widget instance and never touches `container` again
 *     afterwards, so the widget's live state survives the board's periodic
 *     re-renders. May return `{ dispose() {...} }` to clean up (e.g. clear
 *     an interval) if the widget is later removed or scheduled out.
 *     Such widgets should still provide renderDisplay() for the admin
 *     page's (non-interactive) live preview.
 *   - initAdminForm(container, ctx): for a widget whose configuration is
 *     files rather than form fields (e.g. Start of the Day's images),
 *     builds interactivity into the already-inserted renderAdminForm()
 *     markup. Called once per widget instance after admin.js renders the
 *     widget list. `ctx` provides `commitFile(path, base64Content, message)`
 *     and `getLastCommitDate(path)` (both backed by the GitHub API using
 *     the admin's saved token) and `imageUrl(path)` (a cache-busted URL for
 *     previewing a file already published to the repo). Such a widget's
 *     readAdminForm() typically just returns {}, since nothing it manages
 *     is stored in config.json.
 * Nothing else in the app needs to change.
 */

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABELS = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" };

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Small line-icon set shown next to each widget's title. Kept as plain
// inline SVG (currentColor stroke) so there's no external asset or font
// dependency and icons always match the widget-title color.
const HeaderIcons = {
  plate: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/></svg>`,
  sunCloud: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="7" r="2.6"/><path d="M8 2.3v1M8 12v1M3 7h1M13 7h1M4.6 3.6l.7.7M11.4 3.6l-.7.7"/><path d="M9.5 16.5a4 4 0 0 1 .3-8 5 5 0 0 1 9 2.2 3.5 3.5 0 0 1-.8 6.8H9.5Z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-1.5-1.5-4-2-8-2v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2V4c-4 0-6.5.5-8 2Z"/><path d="M12 6v14"/></svg>`,
  timer: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6"/><path d="M12 2v2"/><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18h16"/><path d="M6 15a6 6 0 0 1 12 0"/><path d="M12 4v3"/><path d="M4.5 8.5l1.8 1.8"/><path d="M19.5 8.5l-1.8 1.8"/></svg>`,
};

const WidgetTypes = {
  "announcements": {
    label: "Announcements",
    icon: HeaderIcons.speaker,

    defaultSettings() {
      return { items: [] };
    },

    renderDisplay(settings) {
      const items = Array.isArray(settings?.items) ? settings.items.filter((i) => i && i.trim()) : [];
      if (!items.length) {
        return `<div class="widget-body announcements-widget"><p class="announcements-empty">No announcements right now.</p></div>`;
      }
      const lis = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
      return `<div class="widget-body announcements-widget"><ul class="announcements-list">${lis}</ul></div>`;
    },

    renderAdminForm(settings) {
      const items = Array.isArray(settings?.items) ? settings.items : [];
      return `
        <label class="field">
          <span>One announcement per line</span>
          <textarea data-field="items" rows="6" placeholder="Remember PE kits tomorrow!&#10;Book fair this Friday">${escapeHtml(items.join("\n"))}</textarea>
        </label>
      `;
    },

    readAdminForm(container) {
      const el = container.querySelector('[data-field="items"]');
      const items = (el ? el.value : "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return { items };
    },
  },
};

// ---- Weather widget helpers ----

const WEATHER_CACHE = {}; // key `${lat},${lon}` -> { data, fetchedAt, error, inFlight }
const WEATHER_STALE_MS = 20 * 60 * 1000; // refetch after 20 min
const WEATHER_RETRY_MS = 5 * 60 * 1000; // back off 5 min after a failed fetch

function weatherCacheKey(lat, lon) {
  return `${lat},${lon}`;
}

function clampHour(value, fallback) {
  const n = Number.isFinite(value) ? value : fallback;
  return Math.min(23, Math.max(0, n));
}

function fetchWeatherIfNeeded(lat, lon) {
  const key = weatherCacheKey(lat, lon);
  const entry = WEATHER_CACHE[key];
  const now = Date.now();
  if (entry) {
    if (entry.inFlight) return;
    if (entry.data && now - entry.fetchedAt < WEATHER_STALE_MS) return;
    if (entry.error && now - entry.fetchedAt < WEATHER_RETRY_MS) return;
  }
  WEATHER_CACHE[key] = { ...(entry || {}), inFlight: true };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,is_day&timezone=${encodeURIComponent("Europe/London")}&forecast_days=1`;
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      WEATHER_CACHE[key] = { data: json, fetchedAt: Date.now(), inFlight: false };
    })
    .catch((err) => {
      WEATHER_CACHE[key] = { error: String(err), fetchedAt: Date.now(), inFlight: false };
    });
}

function weatherCategory(code) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "cloudy";
}

function weatherIconSvg(category, isDay) {
  const open = 'viewBox="0 0 48 48" width="36" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  switch (category) {
    case "clear":
      return isDay
        ? `<svg ${open}><circle cx="24" cy="24" r="10" fill="#f5a623"/><g stroke="#f5a623" stroke-width="3" stroke-linecap="round"><line x1="24" y1="2" x2="24" y2="9"/><line x1="24" y1="39" x2="24" y2="46"/><line x1="2" y1="24" x2="9" y2="24"/><line x1="39" y1="24" x2="46" y2="24"/><line x1="8" y1="8" x2="13" y2="13"/><line x1="35" y1="35" x2="40" y2="40"/><line x1="8" y1="40" x2="13" y2="35"/><line x1="35" y1="13" x2="40" y2="8"/></g></svg>`
        : `<svg ${open}><path d="M32 8a16 16 0 1 0 8 29.7A13 13 0 0 1 32 8z" fill="#9fb3c8"/></svg>`;
    case "partly-cloudy":
      return `<svg ${open}><circle cx="18" cy="17" r="8" fill="#f5a623"/><path d="M14 34a9 9 0 0 1 1-18 11 11 0 0 1 21 4 8 8 0 0 1-2 14H14z" fill="#c9d4de"/></svg>`;
    case "fog":
      return `<svg ${open}><g stroke="#aebccb" stroke-width="3" stroke-linecap="round"><line x1="6" y1="16" x2="42" y2="16"/><line x1="10" y1="24" x2="38" y2="24"/><line x1="6" y1="32" x2="42" y2="32"/></g></svg>`;
    case "rain":
      return `<svg ${open}><path d="M12 26a9 9 0 0 1 1-18 11 11 0 0 1 21 4 8 8 0 0 1-2 14H12z" fill="#9aa9b8"/><g stroke="#4a90d9" stroke-width="3" stroke-linecap="round"><line x1="16" y1="34" x2="13" y2="42"/><line x1="24" y1="34" x2="21" y2="42"/><line x1="32" y1="34" x2="29" y2="42"/></g></svg>`;
    case "snow":
      return `<svg ${open}><path d="M12 26a9 9 0 0 1 1-18 11 11 0 0 1 21 4 8 8 0 0 1-2 14H12z" fill="#b8c6d4"/><g stroke="#7fb3e0" stroke-width="3" stroke-linecap="round"><line x1="16" y1="34" x2="16" y2="42"/><line x1="24" y1="34" x2="24" y2="42"/><line x1="32" y1="34" x2="32" y2="42"/></g></svg>`;
    case "thunderstorm":
      return `<svg ${open}><path d="M12 24a9 9 0 0 1 1-18 11 11 0 0 1 21 4 8 8 0 0 1-2 14H12z" fill="#7c8ba1"/><polygon points="24,30 18,40 23,40 20,46 30,34 25,34" fill="#f5c542"/></svg>`;
    case "cloudy":
    default:
      return `<svg ${open}><path d="M12 34a9 9 0 0 1 1-18 11 11 0 0 1 21 4 8 8 0 0 1-2 14H12z" fill="#aebccb"/></svg>`;
  }
}

WidgetTypes.weather = {
  label: "Weather",
  icon: HeaderIcons.sunCloud,

  defaultSettings() {
    return { locationName: "Morecambe, UK", latitude: 54.07, longitude: -2.86, startHour: 8, endHour: 18 };
  },

  renderDisplay(settings) {
    const lat = settings?.latitude ?? 54.07;
    const lon = settings?.longitude ?? -2.86;
    const locationName = settings?.locationName || "Morecambe, UK";
    const startHour = clampHour(settings?.startHour, 8);
    const endHour = clampHour(settings?.endHour, 18);

    fetchWeatherIfNeeded(lat, lon);
    const entry = WEATHER_CACHE[weatherCacheKey(lat, lon)];

    if (!entry || (!entry.data && !entry.error)) {
      return `<div class="widget-body weather-widget"><p class="weather-status">Loading weather for ${escapeHtml(locationName)}&hellip;</p></div>`;
    }
    if (entry.error || !entry.data?.hourly?.time) {
      return `<div class="widget-body weather-widget"><p class="weather-status weather-error">Couldn't load weather right now.</p></div>`;
    }

    const hourly = entry.data.hourly;
    const slots = [];
    for (let h = startHour; h <= endHour; h += 2) {
      const idx = hourly.time.findIndex((t) => parseInt(t.slice(11, 13), 10) === h);
      if (idx === -1) continue;
      const temp = Math.round(hourly.temperature_2m[idx]);
      const category = weatherCategory(hourly.weathercode[idx]);
      const isDay = hourly.is_day ? hourly.is_day[idx] === 1 : true;
      slots.push(`<div class="weather-slot">
        <span class="weather-time">${h.toString().padStart(2, "0")}:00</span>
        <span class="weather-icon">${weatherIconSvg(category, isDay)}</span>
        <span class="weather-temp">${temp}&deg;</span>
      </div>`);
    }

    if (!slots.length) {
      return `<div class="widget-body weather-widget"><p class="weather-status">No forecast hours in that range.</p></div>`;
    }

    return `<div class="widget-body weather-widget">
      <p class="weather-location">${escapeHtml(locationName)}</p>
      <div class="weather-slots">${slots.join("")}</div>
    </div>`;
  },

  renderAdminForm(settings) {
    return `
      <label class="field">
        <span>Location name (label only)</span>
        <input type="text" data-field="locationName" value="${escapeHtml(settings?.locationName ?? "Morecambe, UK")}">
      </label>
      <div class="row">
        <label class="field">
          <span>Latitude</span>
          <input type="text" data-field="latitude" value="${escapeHtml(settings?.latitude ?? 54.07)}">
        </label>
        <label class="field">
          <span>Longitude</span>
          <input type="text" data-field="longitude" value="${escapeHtml(settings?.longitude ?? -2.86)}">
        </label>
      </div>
      <div class="row">
        <label class="field">
          <span>Start hour (0-22)</span>
          <input type="number" min="0" max="22" data-field="startHour" value="${settings?.startHour ?? 8}">
        </label>
        <label class="field">
          <span>End hour (0-23)</span>
          <input type="number" min="1" max="23" data-field="endHour" value="${settings?.endHour ?? 18}">
        </label>
      </div>
      <p class="hint">Weather data from Open-Meteo (no API key needed), refreshed roughly every 20 minutes.</p>
    `;
  },

  readAdminForm(container) {
    const get = (f) => container.querySelector(`[data-field="${f}"]`)?.value;
    return {
      locationName: get("locationName") || "Morecambe, UK",
      latitude: parseFloat(get("latitude")) || 54.07,
      longitude: parseFloat(get("longitude")) || -2.86,
      startHour: clampHour(parseInt(get("startHour"), 10), 8),
      endHour: clampHour(parseInt(get("endHour"), 10), 18),
    };
  },
};

// ---- Lunch menu (Red/Green/Blue) widget helpers ----

const LUNCH_MENU_URL = "data/lunch-menu.json";
const LUNCH_MENU_STALE_MS = 60 * 60 * 1000; // refetch at most once an hour
const LUNCH_MENU_RETRY_MS = 5 * 60 * 1000; // back off 5 min after a failed fetch
let LUNCH_MENU_CACHE = null; // { data, fetchedAt, error, inFlight }

function fetchLunchMenuIfNeeded() {
  const now = Date.now();
  if (LUNCH_MENU_CACHE) {
    if (LUNCH_MENU_CACHE.inFlight) return;
    if (LUNCH_MENU_CACHE.data && now - LUNCH_MENU_CACHE.fetchedAt < LUNCH_MENU_STALE_MS) return;
    if (LUNCH_MENU_CACHE.error && now - LUNCH_MENU_CACHE.fetchedAt < LUNCH_MENU_RETRY_MS) return;
  }
  LUNCH_MENU_CACHE = { ...(LUNCH_MENU_CACHE || {}), inFlight: true };
  fetch(`${LUNCH_MENU_URL}?_=${now}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      LUNCH_MENU_CACHE = { data, fetchedAt: Date.now(), inFlight: false };
    })
    .catch((err) => {
      LUNCH_MENU_CACHE = { error: String(err), fetchedAt: Date.now(), inFlight: false };
    });
}

// Works out which day-key (monday..friday, or null on a weekend) and which
// week of the repeating cycle applies to `date`, purely from the cycle's
// anchor date -- so it needs no stored "current week" and extrapolates
// indefinitely in both directions (before the anchor and beyond however
// many weeks are listed in the source document).
function lunchMenuForDate(cycle, date) {
  const dayKey = DAYS[date.getDay() - 1];
  if (!dayKey) return { dayKey: null, options: null };
  if (!cycle?.cycleAnchorDate || !Array.isArray(cycle.weeks) || !cycle.weeks.length) {
    return { dayKey, options: null };
  }
  const anchor = new Date(`${cycle.cycleAnchorDate}T00:00:00`);
  const todayMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const anchorMidnight = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const diffDays = Math.round((todayMidnight - anchorMidnight) / 86400000);
  const cycleWeeks = cycle.cycleLengthWeeks || cycle.weeks.length;
  const weeksSinceAnchor = Math.floor(diffDays / 7);
  const weekIndex = ((weeksSinceAnchor % cycleWeeks) + cycleWeeks) % cycleWeeks;
  return { dayKey, options: cycle.weeks[weekIndex]?.[dayKey] || null };
}

const LUNCH_OPTION_COLORS = ["red", "green", "blue"];

WidgetTypes["dinner-menu"] = {
  label: "What's for Lunch",
  icon: HeaderIcons.plate,

  defaultSettings() {
    return {};
  },

  renderDisplay() {
    fetchLunchMenuIfNeeded();
    const entry = LUNCH_MENU_CACHE;

    if (!entry || (!entry.data && !entry.error)) {
      return `<div class="widget-body dinner-widget"><p class="dinner-status">Loading today's menu&hellip;</p></div>`;
    }
    if (entry.error) {
      return `<div class="widget-body dinner-widget"><p class="dinner-status dinner-error">Couldn't load the lunch menu.</p></div>`;
    }

    const { dayKey, options } = lunchMenuForDate(entry.data, new Date());
    if (!dayKey) {
      return `<div class="widget-body dinner-widget"><p class="dinner-empty">No school lunch today &mdash; enjoy the weekend! 🎉</p></div>`;
    }
    if (!options) {
      return `<div class="widget-body dinner-widget"><p class="dinner-status dinner-error">No menu set for ${DAY_LABELS[dayKey]}.</p></div>`;
    }

    const rows = LUNCH_OPTION_COLORS.map((color) => {
      const text = options[color] && options[color].trim();
      if (!text) return "";
      return `<div class="dinner-option dinner-option-${color}">
        <span class="dinner-option-badge">${color.charAt(0).toUpperCase()}${color.slice(1)}</span>
        <span class="dinner-option-text">${escapeHtml(text)}</span>
      </div>`;
    }).join("");

    return `<div class="widget-body dinner-widget">
      <p class="dinner-day-heading">${DAY_LABELS[dayKey]}</p>
      <div class="dinner-options">${rows}</div>
    </div>`;
  },

  renderAdminForm() {
    return `<p class="hint">No setup needed &mdash; each day's Red/Green/Blue choices are read automatically from <code>data/lunch-menu.json</code> in the repo, based on a repeating 3-week cycle. To update the menu, edit that file on GitHub.</p>`;
  },

  readAdminForm() {
    return {};
  },
};

// ---- Word of the Week widget helpers ----

const WORD_LIST_URL = "data/word-of-the-week.json";
const WORD_LIST_STALE_MS = 60 * 60 * 1000; // refetch at most once an hour
const WORD_LIST_RETRY_MS = 5 * 60 * 1000; // back off 5 min after a failed fetch
let WORD_LIST_CACHE = null; // { data, fetchedAt, error, inFlight }

function fetchWordListIfNeeded() {
  const now = Date.now();
  if (WORD_LIST_CACHE) {
    if (WORD_LIST_CACHE.inFlight) return;
    if (WORD_LIST_CACHE.data && now - WORD_LIST_CACHE.fetchedAt < WORD_LIST_STALE_MS) return;
    if (WORD_LIST_CACHE.error && now - WORD_LIST_CACHE.fetchedAt < WORD_LIST_RETRY_MS) return;
  }
  WORD_LIST_CACHE = { ...(WORD_LIST_CACHE || {}), inFlight: true };
  fetch(`${WORD_LIST_URL}?_=${now}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      WORD_LIST_CACHE = { data, fetchedAt: Date.now(), inFlight: false };
    })
    .catch((err) => {
      WORD_LIST_CACHE = { error: String(err), fetchedAt: Date.now(), inFlight: false };
    });
}

// ISO-8601 week number (1-53), so the chosen word changes every Monday and
// is identical across every device without needing any shared "current
// word" state -- it's purely a function of the date and the word list.
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

WidgetTypes["word-of-the-week"] = {
  label: "Word of the Week",
  icon: HeaderIcons.book,

  defaultSettings() {
    return {};
  },

  renderDisplay() {
    fetchWordListIfNeeded();
    const entry = WORD_LIST_CACHE;

    if (!entry || (!entry.data && !entry.error)) {
      return `<div class="widget-body word-widget"><p class="word-status">Loading word of the week&hellip;</p></div>`;
    }
    if (entry.error || !Array.isArray(entry.data) || !entry.data.length) {
      return `<div class="widget-body word-widget"><p class="word-status word-error">Couldn't load the word list.</p></div>`;
    }

    const list = entry.data;
    const item = list[isoWeekNumber(new Date()) % list.length];

    return `<div class="widget-body word-widget">
      <p class="word-headline">${escapeHtml(item.word || "")}</p>
      ${item.definition ? `<p class="word-definition">${escapeHtml(item.definition)}</p>` : ""}
      ${item.example ? `<p class="word-example">&ldquo;${escapeHtml(item.example)}&rdquo;</p>` : ""}
    </div>`;
  },

  renderAdminForm() {
    return `<p class="hint">No setup needed &mdash; a new word is chosen automatically every week from <code>data/word-of-the-week.json</code> in the repo, cycling through the list. To change the vocabulary, edit that file on GitHub.</p>`;
  },

  readAdminForm() {
    return {};
  },
};

// ---- Countdown widget helpers ----

const COUNTDOWN_DEFAULT_PRESETS = [60, 120, 180, 300, 420]; // 1:00, 2:00, 3:00, 5:00, 7:00

// "00:00" (zero-padded minutes) for the big digital readout.
function formatCountdownFull(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// "1:00" (no leading zero on minutes) for the small preset buttons.
function formatCountdownShort(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function parseCountdownInput(str, fallbackSeconds) {
  const match = /^(\d{1,3}):([0-5]?\d)$/.exec(String(str ?? "").trim());
  if (!match) return fallbackSeconds;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function countdownPresets(settings) {
  return Array.isArray(settings?.presets) && settings.presets.length === 5
    ? settings.presets
    : COUNTDOWN_DEFAULT_PRESETS;
}

WidgetTypes.countdown = {
  label: "Countdown Timer",
  icon: HeaderIcons.timer,

  defaultSettings() {
    return { presets: [...COUNTDOWN_DEFAULT_PRESETS] };
  },

  // Static snapshot, used only for the admin page's live preview -- the
  // real interactive version is built by mount() below.
  renderDisplay(settings) {
    const buttons = countdownPresets(settings)
      .map((secs) => `<span class="countdown-preset countdown-preset-static">${formatCountdownShort(secs)}</span>`)
      .join("");
    return `<div class="widget-body countdown-widget">
      <div class="countdown-display">00:00</div>
      <div class="countdown-presets">${buttons}</div>
    </div>`;
  },

  renderAdminForm(settings) {
    const inputs = countdownPresets(settings)
      .map((secs, i) => `
        <label class="field" style="max-width:110px;">
          <span>Button ${i + 1}</span>
          <input type="text" data-field="preset.${i}" value="${escapeHtml(formatCountdownShort(secs))}" placeholder="M:SS">
        </label>
      `)
      .join("");
    return `
      <div class="row">${inputs}</div>
      <p class="hint">Each button is minutes:seconds, e.g. <code>2:00</code> or <code>0:30</code>. Tapping a button on the board instantly starts (or restarts) the countdown from that value.</p>
    `;
  },

  readAdminForm(container) {
    const presets = [0, 1, 2, 3, 4].map((i) => {
      const el = container.querySelector(`[data-field="preset.${i}"]`);
      return parseCountdownInput(el?.value, COUNTDOWN_DEFAULT_PRESETS[i]);
    });
    return { presets };
  },

  // Built once by display.js and left alone on every later re-render, so
  // an in-progress countdown survives the board's periodic refresh.
  mount(container, settings) {
    const presets = countdownPresets(settings);
    container.className = "widget-body countdown-widget";
    container.innerHTML = `
      <div class="countdown-display">00:00</div>
      <div class="countdown-presets">
        ${presets.map((secs) => `<button type="button" class="countdown-preset" data-seconds="${secs}">${formatCountdownShort(secs)}</button>`).join("")}
        <button type="button" class="countdown-reset" title="Reset" aria-label="Reset">&#8635;</button>
      </div>
    `;

    const displayEl = container.querySelector(".countdown-display");
    let intervalHandle = null;
    let endTime = null;

    function render(totalSeconds) {
      displayEl.textContent = formatCountdownFull(totalSeconds);
    }

    function stop(resetDisplay) {
      if (intervalHandle) clearInterval(intervalHandle);
      intervalHandle = null;
      endTime = null;
      container.classList.remove("countdown-running", "countdown-done");
      if (resetDisplay) render(0);
    }

    function tick() {
      const remainingMs = endTime - Date.now();
      const remaining = Math.max(0, Math.round(remainingMs / 1000));
      render(remaining);
      if (remainingMs <= 0) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        container.classList.remove("countdown-running");
        container.classList.add("countdown-done");
      }
    }

    function start(totalSeconds) {
      if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return;
      stop(false);
      endTime = Date.now() + totalSeconds * 1000;
      container.classList.add("countdown-running");
      container.classList.remove("countdown-done");
      tick();
      intervalHandle = setInterval(tick, 250);
    }

    container.querySelectorAll(".countdown-preset").forEach((btn) => {
      btn.addEventListener("click", () => start(parseInt(btn.dataset.seconds, 10)));
    });
    container.querySelector(".countdown-reset").addEventListener("click", () => stop(true));

    return {
      dispose() {
        if (intervalHandle) clearInterval(intervalHandle);
      },
    };
  },
};

// ---- Start of the Day widget helpers ----

const SOTD_DIR = "data/sotd";
const SOTD_IMAGE_STALE_MS = 5 * 60 * 1000; // don't re-fetch the board's image more than this often

function sotdImagePath(dayKey) {
  return `${SOTD_DIR}/${dayKey}.png`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

function sotdRelativeTime(iso) {
  if (!iso) return { text: "Never uploaded", cls: "stale" };
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return { text: "Updated just now", cls: "fresh" };
  if (mins < 60) return { text: `Updated ${mins} min${mins === 1 ? "" : "s"} ago`, cls: "fresh" };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { text: `Updated ${hrs} hour${hrs === 1 ? "" : "s"} ago`, cls: "fresh" };
  const days = Math.floor(hrs / 24);
  if (days === 1) return { text: "Updated yesterday", cls: "aging" };
  if (days < 14) return { text: `Updated ${days} days ago`, cls: "aging" };
  return { text: `Updated ${days} days ago`, cls: "stale" };
}

function handleSotdImageError(imgEl, dayLabel) {
  const wrap = imgEl.closest(".sotd-widget");
  if (wrap) wrap.innerHTML = `<p class="sotd-empty">No activity image uploaded for ${dayLabel} yet.</p>`;
}

WidgetTypes["start-of-day"] = {
  label: "Start of the Day",
  icon: HeaderIcons.sunrise,

  defaultSettings() {
    return {};
  },

  // Real board rendering: today's image, cache-busted in 5-minute buckets so
  // repeated re-renders don't force a re-download but a fresh upload still
  // shows up within a few minutes.
  renderDisplay() {
    const dayKey = DAYS[new Date().getDay() - 1];
    if (!dayKey) {
      return `<div class="widget-body sotd-widget"><p class="sotd-empty">No activity today &mdash; enjoy the weekend! 🎉</p></div>`;
    }
    const bucket = Math.floor(Date.now() / SOTD_IMAGE_STALE_MS);
    const url = `${sotdImagePath(dayKey)}?v=${bucket}`;
    return `<div class="widget-body sotd-widget">
      <img class="sotd-image" src="${url}" alt="Start of the day activity for ${DAY_LABELS[dayKey]}" onerror="handleSotdImageError(this, '${DAY_LABELS[dayKey]}')">
    </div>`;
  },

  // Admin form: a static skeleton: initAdminForm() below wires it up to the
  // real GitHub-backed uploads once it's in the DOM.
  renderAdminForm() {
    const dayCards = DAYS.map((d) => `
      <div class="day-card" data-day="${d}">
        <span class="day-name">${DAY_LABELS[d]}</span>
        <div class="day-thumb" data-role="thumb"><p class="sotd-form-status">Checking&hellip;</p></div>
        <span class="day-updated" data-role="updated">&nbsp;</span>
        <button type="button" class="day-replace" data-role="replace">Replace image&hellip;</button>
      </div>
    `).join("");

    return `
      <div class="batch-zone" data-role="batchZone">
        <div class="batch-zone-text">
          <strong>Upload a whole week</strong>
          <span>Choose (or drop) up to 5 images &mdash; they'll fill Monday &rarr; Friday in order.</span>
        </div>
        <button type="button" class="btn-secondary btn-small" data-role="batchBtn">Choose images&hellip;</button>
        <input type="file" accept="image/*" multiple data-role="batchInput" style="display:none;">
      </div>
      <div class="sotd-day-grid" data-role="dayGrid">${dayCards}</div>
      <p class="hint">Each upload saves straight to GitHub as soon as you pick a file &mdash; there's no separate save step for images. Export slides from PowerPoint as PNG (File &rarr; Export &rarr; Change File Type &rarr; PNG &rarr; Save Every Slide).</p>
    `;
  },

  readAdminForm() {
    return {};
  },

  initAdminForm(container, ctx) {
    const grid = container.querySelector('[data-role="dayGrid"]');
    const batchZone = container.querySelector('[data-role="batchZone"]');
    const batchBtn = container.querySelector('[data-role="batchBtn"]');
    const batchInput = container.querySelector('[data-role="batchInput"]');

    const dayCard = (key) => grid.querySelector(`.day-card[data-day="${key}"]`);
    const setThumb = (key, html) => {
      const el = dayCard(key)?.querySelector('[data-role="thumb"]');
      if (el) el.innerHTML = html;
    };
    const setUpdated = (key, text, cls) => {
      const el = dayCard(key)?.querySelector('[data-role="updated"]');
      if (el) { el.textContent = text; el.className = `day-updated ${cls}`; }
    };

    async function refreshDay(key) {
      const path = sotdImagePath(key);
      const exists = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = ctx.imageUrl(path);
      });
      setThumb(key, exists ? `<img src="${ctx.imageUrl(path)}" alt="">` : `<p class="sotd-form-status">No image yet</p>`);
      try {
        const iso = await ctx.getLastCommitDate(path);
        const rel = sotdRelativeTime(iso);
        setUpdated(key, rel.text, rel.cls);
      } catch {
        setUpdated(key, "Couldn't check", "stale");
      }
    }

    async function uploadDay(key, file) {
      setThumb(key, `<img src="${URL.createObjectURL(file)}" alt="">`);
      setUpdated(key, "Uploading&hellip;", "aging");
      try {
        const base64 = await readFileAsBase64(file);
        await ctx.commitFile(sotdImagePath(key), base64, `Update Start of the Day image: ${DAY_LABELS[key]}`);
        setUpdated(key, "Updated just now", "fresh");
      } catch (err) {
        setUpdated(key, `Upload failed: ${err.message}`, "stale");
      }
    }

    async function uploadBatch(files) {
      const list = Array.from(files).slice(0, 5);
      for (let i = 0; i < list.length; i++) {
        await uploadDay(DAYS[i], list[i]);
      }
    }

    grid.querySelectorAll('[data-role="replace"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.closest(".day-card").dataset.day;
        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/*";
        picker.onchange = () => { if (picker.files[0]) uploadDay(key, picker.files[0]); };
        picker.click();
      });
    });

    batchBtn.addEventListener("click", () => batchInput.click());
    batchInput.addEventListener("change", () => uploadBatch(batchInput.files));
    ["dragenter", "dragover"].forEach((evt) =>
      batchZone.addEventListener(evt, (e) => { e.preventDefault(); batchZone.classList.add("drag-over"); })
    );
    ["dragleave", "drop"].forEach((evt) =>
      batchZone.addEventListener(evt, (e) => { e.preventDefault(); batchZone.classList.remove("drag-over"); })
    );
    batchZone.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) uploadBatch(e.dataTransfer.files);
    });

    DAYS.forEach(refreshDay);
  },
};

function widgetIsVisibleNow(widget, now = new Date()) {
  const sched = widget.schedule || {};
  if (!sched.start && !sched.end) return true;
  const hhmm = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  if (sched.start && hhmm < sched.start) return false;
  if (sched.end && hhmm >= sched.end) return false;
  return true;
}

if (typeof module !== "undefined") {
  module.exports = { WidgetTypes, widgetIsVisibleNow, DAYS, DAY_LABELS, escapeHtml };
}
