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
