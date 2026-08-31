/*
 * Widget registry shared by the display board (display.js) and the admin
 * editor (admin.js). To add a new widget type, add an entry here with:
 *   - label:            shown in the admin "add widget" dropdown
 *   - defaultSettings(): fresh settings object for a newly-added widget
 *   - renderDisplay(settings): returns an HTML string for the board
 *   - renderAdminForm(settings): returns an HTML string of form fields
 *   - readAdminForm(container): reads the form fields back into a settings object
 * Nothing else in the app needs to change.
 */

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_LABELS = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" };

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const WidgetTypes = {
  "dinner-menu": {
    label: "What's for Lunch",

    defaultSettings() {
      return { menu: { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "" } };
    },

    renderDisplay(settings) {
      const menu = settings?.menu || {};
      const now = new Date();
      const todayIdx = now.getDay(); // 0=Sun..6=Sat
      const todayKey = DAYS[todayIdx - 1]; // undefined on weekends

      if (!todayKey) {
        return `<div class="widget-body dinner-widget">
          <p class="dinner-empty">No school lunch today &mdash; enjoy the weekend! 🎉</p>
        </div>`;
      }

      const todayText = menu[todayKey] && menu[todayKey].trim();
      const rows = DAYS.map((d) => {
        const isToday = d === todayKey;
        const text = menu[d] && menu[d].trim() ? escapeHtml(menu[d]) : "<span class=\"dinner-tbd\">Not set</span>";
        return `<li class="dinner-day-row${isToday ? " dinner-today" : ""}">
          <span class="dinner-day-label">${DAY_LABELS[d]}</span>
          <span class="dinner-day-text">${text}</span>
        </li>`;
      }).join("");

      return `<div class="widget-body dinner-widget">
        <p class="dinner-today-headline">${todayText ? escapeHtml(todayText) : "<span class=\"dinner-tbd\">Not set yet</span>"}</p>
        <ul class="dinner-week-list">${rows}</ul>
      </div>`;
    },

    renderAdminForm(settings) {
      const menu = settings?.menu || {};
      return DAYS.map((d) => `
        <label class="field">
          <span>${DAY_LABELS[d]}</span>
          <textarea data-field="menu.${d}" rows="2" placeholder="e.g. Pizza, salad, fresh fruit">${escapeHtml(menu[d] || "")}</textarea>
        </label>
      `).join("");
    },

    readAdminForm(container) {
      const menu = {};
      DAYS.forEach((d) => {
        const el = container.querySelector(`[data-field="menu.${d}"]`);
        menu[d] = el ? el.value : "";
      });
      return { menu };
    },
  },

  "announcements": {
    label: "Announcements",

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
