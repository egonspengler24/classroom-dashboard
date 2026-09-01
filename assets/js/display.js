(function () {
  const classNameEl = document.getElementById("className");
  const clockEl = document.getElementById("clock");
  const mainEl = document.getElementById("boardMain");

  let currentConfig = null;
  let lastConfigJson = null;
  const mountedWidgets = new Map(); // widget id -> { dispose? }

  function updateClock() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}`;
  }

  function disposeWidget(id) {
    const mounted = mountedWidgets.get(id);
    if (mounted?.dispose) mounted.dispose();
    mountedWidgets.delete(id);
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
      mountedWidgets.forEach((_, id) => disposeWidget(id));
      mainEl.innerHTML = `<div class="board-empty">No widgets to show right now.</div>`;
      return;
    }

    const placeholder = mainEl.querySelector(".board-empty");
    if (placeholder) placeholder.remove();

    // Remove cards for widgets that are no longer visible (schedule ended,
    // deleted, disabled, etc.), disposing any live state (e.g. a running
    // countdown's interval) as we go.
    const desiredIds = new Set(widgets.map((w) => w.id));
    Array.from(mainEl.children).forEach((child) => {
      const id = child.dataset.widgetId;
      if (id && !desiredIds.has(id)) {
        disposeWidget(id);
        child.remove();
      }
    });

    widgets.forEach((w, index) => {
      const type = WidgetTypes[w.type];
      const colSpan = Math.max(1, w.colSpan || 1);
      const rowSpan = Math.max(1, w.rowSpan || 1);

      let card = Array.from(mainEl.children).find((el) => el.dataset.widgetId === w.id);
      if (!card) {
        card = document.createElement("section");
        card.className = "widget-card";
        card.dataset.widgetId = w.id;
        card.innerHTML = `<h2 class="widget-title"></h2>`;
        mainEl.appendChild(card);
      }
      card.style.gridColumn = `span ${colSpan}`;
      card.style.gridRow = `span ${rowSpan}`;
      card.style.order = index;

      const icon = type?.icon ? `<span class="widget-icon">${type.icon}</span>` : "";
      const safeTitle = (w.title || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
      card.querySelector(".widget-title").innerHTML = `${icon}<span>${safeTitle}</span>`;

      if (type?.mount) {
        // Stateful widget: mount exactly once, then never touch its body again.
        if (!mountedWidgets.has(w.id)) {
          const body = document.createElement("div");
          card.appendChild(body);
          mountedWidgets.set(w.id, type.mount(body, w.settings || {}) || {});
        }
      } else {
        // Stateless widget: safe to fully rebuild the body every render.
        Array.from(card.children).forEach((child) => {
          if (!child.classList.contains("widget-title")) child.remove();
        });
        const bodyHtml = type ? type.renderDisplay(w.settings || {}) : `<div class="widget-body">Unknown widget type: ${w.type}</div>`;
        card.insertAdjacentHTML("beforeend", bodyHtml);
      }
    });
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
