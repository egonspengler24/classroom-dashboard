(function () {
  const classNameEl = document.getElementById("className");
  const clockEl = document.getElementById("clock");
  const mainEl = document.getElementById("boardMain");

  let currentConfig = null;
  let lastConfigJson = null;

  function updateClock() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}`;
  }

  function renderBoard(config) {
    classNameEl.textContent = config.className || "Our Class";
    document.documentElement.style.setProperty("--grid-columns", config.gridColumns || 3);

    const now = new Date();
    const widgets = (config.widgets || [])
      .filter((w) => w.enabled !== false)
      .filter((w) => widgetIsVisibleNow(w, now))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!widgets.length) {
      mainEl.innerHTML = `<div class="board-empty">No widgets to show right now.</div>`;
      return;
    }

    mainEl.innerHTML = widgets.map((w) => {
      const type = WidgetTypes[w.type];
      const colSpan = Math.max(1, w.colSpan || 1);
      const rowSpan = Math.max(1, w.rowSpan || 1);
      const body = type ? type.renderDisplay(w.settings || {}) : `<div class="widget-body">Unknown widget type: ${w.type}</div>`;
      return `<section class="widget-card" style="grid-column: span ${colSpan}; grid-row: span ${rowSpan};">
        <h2 class="widget-title">${(w.title || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</h2>
        ${body}
      </section>`;
    }).join("");
  }

  function reRenderIfVisibilityChanged() {
    // Widgets can enter/leave their scheduled time window between polls,
    // so re-run the visibility filter every tick even without new data.
    if (currentConfig) renderBoard(currentConfig);
  }

  async function fetchConfig() {
    try {
      const res = await fetch(`config.json?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const asString = JSON.stringify(json);
      currentConfig = json;
      if (asString !== lastConfigJson) {
        lastConfigJson = asString;
        renderBoard(json);
      }
    } catch (err) {
      console.error("Failed to load config.json", err);
      if (!currentConfig) {
        mainEl.innerHTML = `<div class="board-empty">Couldn't load the dashboard configuration. Retrying&hellip;</div>`;
      }
    }
  }

  function start() {
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(reRenderIfVisibilityChanged, 15000);

    fetchConfig();
    const pollMs = 45000; // refreshed below once config loads with its own preferred interval
    let intervalHandle = setInterval(fetchConfig, pollMs);

    // Once we know the configured poll interval, restart the timer to match it.
    const checkInterval = setInterval(() => {
      if (currentConfig && currentConfig.pollIntervalSeconds) {
        clearInterval(intervalHandle);
        clearInterval(checkInterval);
        intervalHandle = setInterval(fetchConfig, currentConfig.pollIntervalSeconds * 1000);
      }
    }, 1000);
  }

  start();
})();
