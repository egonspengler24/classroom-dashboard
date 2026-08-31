(function () {
  // SHA-256 of the admin password. This is a *soft* deterrent, not real
  // security -- anyone with the browser devtools open can bypass it. Real
  // protection for the write path comes from the GitHub token below, which
  // never leaves this browser's localStorage.
  const ADMIN_PASSWORD_HASH = "219ac378b211f0eec1ed1116f91d472389f828ad0bc4e86197521592676428cf";
  const SESSION_KEY = "cd_admin_authed";
  const TOKEN_KEY = "cd_gh_token";
  const REPO_KEY = "cd_gh_repo";
  const CONFIG_PATH = "config.json";
  const DEFAULT_REPO = "egonspengler24/classroom-dashboard";

  // ---------- Login ----------
  const loginWrap = document.getElementById("loginWrap");
  const adminWrap = document.getElementById("adminWrap");
  const loginForm = document.getElementById("loginForm");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(loginPassword.value);
    if (hash === ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      loginError.textContent = "";
      showAdmin();
    } else {
      loginError.textContent = "Incorrect password.";
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  function showAdmin() {
    loginWrap.style.display = "none";
    adminWrap.style.display = "block";
    initAdmin();
  }

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    showAdmin();
  }

  // ---------- Admin state ----------
  let configState = null;
  let adminInitialised = false;

  const classNameInput = document.getElementById("classNameInput");
  const gridColumnsInput = document.getElementById("gridColumnsInput");
  const pollIntervalInput = document.getElementById("pollIntervalInput");
  const widgetListEl = document.getElementById("widgetList");
  const addWidgetType = document.getElementById("addWidgetType");
  const addWidgetBtn = document.getElementById("addWidgetBtn");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const reloadConfigBtn = document.getElementById("reloadConfigBtn");
  const saveStatus = document.getElementById("saveStatus");
  const ghToken = document.getElementById("ghToken");
  const ghRepo = document.getElementById("ghRepo");
  const saveTokenBtn = document.getElementById("saveTokenBtn");
  const forgetTokenBtn = document.getElementById("forgetTokenBtn");
  const tokenStatus = document.getElementById("tokenStatus");
  const previewClassName = document.getElementById("previewClassName");
  const previewMain = document.getElementById("previewMain");

  function initAdmin() {
    if (adminInitialised) return;
    adminInitialised = true;

    Object.entries(WidgetTypes).forEach(([key, def]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = def.label;
      addWidgetType.appendChild(opt);
    });

    ghToken.value = localStorage.getItem(TOKEN_KEY) || "";
    ghRepo.value = localStorage.getItem(REPO_KEY) || DEFAULT_REPO;
    updateTokenStatus();

    saveTokenBtn.addEventListener("click", () => {
      localStorage.setItem(TOKEN_KEY, ghToken.value.trim());
      localStorage.setItem(REPO_KEY, ghRepo.value.trim());
      updateTokenStatus();
    });

    forgetTokenBtn.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      ghToken.value = "";
      updateTokenStatus();
    });

    [classNameInput, gridColumnsInput, pollIntervalInput].forEach((el) => {
      el.addEventListener("input", () => {
        if (!configState) return;
        configState.className = classNameInput.value;
        configState.gridColumns = parseInt(gridColumnsInput.value, 10) || 3;
        configState.pollIntervalSeconds = parseInt(pollIntervalInput.value, 10) || 45;
        updatePreview();
      });
    });

    widgetListEl.addEventListener("input", handleWidgetListChange);
    widgetListEl.addEventListener("change", handleWidgetListChange);
    widgetListEl.addEventListener("click", handleWidgetListClick);

    addWidgetBtn.addEventListener("click", () => {
      if (!configState) return;
      const type = addWidgetType.value;
      const def = WidgetTypes[type];
      if (!def) return;
      const maxOrder = configState.widgets.reduce((m, w) => Math.max(m, w.order || 0), 0);
      configState.widgets.push({
        id: `${type}-${Date.now()}`,
        type,
        title: def.label,
        enabled: true,
        colSpan: 1,
        rowSpan: 1,
        order: maxOrder + 1,
        schedule: { start: "", end: "" },
        settings: def.defaultSettings(),
      });
      renderWidgetList();
      updatePreview();
    });

    saveConfigBtn.addEventListener("click", saveConfig);
    reloadConfigBtn.addEventListener("click", loadConfig);

    loadConfig();
  }

  function updateTokenStatus() {
    const hasToken = !!localStorage.getItem(TOKEN_KEY);
    tokenStatus.textContent = hasToken
      ? `Connected to ${localStorage.getItem(REPO_KEY) || DEFAULT_REPO}`
      : "No token saved yet -- Save will not work until you add one.";
  }

  async function loadConfig() {
    setStatus("Loading current configuration&hellip;", "info");
    try {
      const res = await fetch(`${CONFIG_PATH}?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      configState = await res.json();
      configState.widgets = configState.widgets || [];
      classNameInput.value = configState.className || "";
      gridColumnsInput.value = configState.gridColumns || 3;
      pollIntervalInput.value = configState.pollIntervalSeconds || 45;
      renderWidgetList();
      updatePreview();
      setStatus("Loaded current configuration.", "ok");
    } catch (err) {
      console.error(err);
      setStatus(`Couldn't load config.json: ${err.message}`, "err");
    }
  }

  function renderWidgetList() {
    widgetListEl.innerHTML = configState.widgets.map((w, i) => buildWidgetEditorHtml(w, i)).join("")
      || `<p class="hint">No widgets yet -- add one below.</p>`;
  }

  function buildWidgetEditorHtml(widget, index) {
    const typeDef = WidgetTypes[widget.type];
    const typeLabel = typeDef ? typeDef.label : widget.type;
    const typeFieldsHtml = typeDef ? typeDef.renderAdminForm(widget.settings || {}) : `<p class="hint">Unknown widget type "${escapeHtml(widget.type)}".</p>`;
    return `
      <div class="widget-editor" data-widget-index="${index}">
        <div class="widget-editor-head">
          <strong>${escapeHtml(typeLabel)}</strong>
          <button type="button" class="btn-danger btn-small" data-action="delete-widget" data-widget-index="${index}">Remove</button>
        </div>
        <div class="row">
          <label class="field">
            <span>Title shown on board</span>
            <input type="text" data-role="title" value="${escapeHtml(widget.title || "")}">
          </label>
          <label class="field" style="max-width:120px;">
            <span>Columns wide</span>
            <input type="number" data-role="colSpan" min="1" max="6" value="${widget.colSpan || 1}">
          </label>
          <label class="field" style="max-width:120px;">
            <span>Rows tall</span>
            <input type="number" data-role="rowSpan" min="1" max="4" value="${widget.rowSpan || 1}">
          </label>
          <label class="field" style="max-width:100px;">
            <span>Order</span>
            <input type="number" data-role="order" value="${widget.order || 0}">
          </label>
        </div>
        <div class="row">
          <label class="field" style="max-width:180px;">
            <span>Show from (blank = always)</span>
            <input type="time" data-role="scheduleStart" value="${escapeHtml(widget.schedule?.start || "")}">
          </label>
          <label class="field" style="max-width:180px;">
            <span>Show until</span>
            <input type="time" data-role="scheduleEnd" value="${escapeHtml(widget.schedule?.end || "")}">
          </label>
          <label class="field" style="max-width:140px; display:flex; align-items:center; gap:8px; flex-direction:row;">
            <input type="checkbox" data-role="enabled" ${widget.enabled !== false ? "checked" : ""} style="width:auto;">
            <span style="margin:0;">Enabled</span>
          </label>
        </div>
        <div class="widget-type-fields">${typeFieldsHtml}</div>
      </div>
    `;
  }

  function handleWidgetListChange(e) {
    const container = e.target.closest(".widget-editor");
    if (!container) return;
    const idx = parseInt(container.dataset.widgetIndex, 10);
    const widget = configState.widgets[idx];
    if (!widget) return;
    syncWidgetFromDom(container, widget);
    updatePreview();
  }

  function handleWidgetListClick(e) {
    const btn = e.target.closest('[data-action="delete-widget"]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.widgetIndex, 10);
    configState.widgets.splice(idx, 1);
    renderWidgetList();
    updatePreview();
  }

  function syncWidgetFromDom(container, widget) {
    widget.title = container.querySelector('[data-role="title"]').value;
    widget.enabled = container.querySelector('[data-role="enabled"]').checked;
    widget.colSpan = parseInt(container.querySelector('[data-role="colSpan"]').value, 10) || 1;
    widget.rowSpan = parseInt(container.querySelector('[data-role="rowSpan"]').value, 10) || 1;
    widget.order = parseInt(container.querySelector('[data-role="order"]').value, 10) || 0;
    widget.schedule = {
      start: container.querySelector('[data-role="scheduleStart"]').value || "",
      end: container.querySelector('[data-role="scheduleEnd"]').value || "",
    };
    const typeDef = WidgetTypes[widget.type];
    if (typeDef) widget.settings = typeDef.readAdminForm(container);
  }

  function updatePreview() {
    if (!configState) return;
    previewClassName.textContent = configState.className || "Our Class";
    previewMain.style.setProperty("--grid-columns", configState.gridColumns || 3);
    previewMain.style.gridTemplateColumns = `repeat(${configState.gridColumns || 3}, 1fr)`;

    const now = new Date();
    const widgets = (configState.widgets || [])
      .filter((w) => w.enabled !== false)
      .filter((w) => widgetIsVisibleNow(w, now))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!widgets.length) {
      previewMain.innerHTML = `<div class="board-empty">No widgets to show right now.</div>`;
      return;
    }

    previewMain.innerHTML = widgets.map((w) => {
      const type = WidgetTypes[w.type];
      const body = type ? type.renderDisplay(w.settings || {}) : `<div class="widget-body">Unknown widget type: ${escapeHtml(w.type)}</div>`;
      return `<section class="widget-card" style="grid-column: span ${Math.max(1, w.colSpan || 1)}; grid-row: span ${Math.max(1, w.rowSpan || 1)};">
        <h2 class="widget-title">${escapeHtml(w.title || "")}</h2>
        ${body}
      </section>`;
    }).join("");
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function saveConfig() {
    const token = localStorage.getItem(TOKEN_KEY);
    const repo = (localStorage.getItem(REPO_KEY) || DEFAULT_REPO).trim();
    if (!token) {
      setStatus("Add and save a GitHub token above before saving.", "err");
      return;
    }
    if (!configState) return;

    setStatus("Saving&hellip;", "info");
    const apiBase = `https://api.github.com/repos/${repo}/contents/${CONFIG_PATH}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    try {
      const getRes = await fetch(apiBase, { headers });
      if (!getRes.ok) throw new Error(`Couldn't read current file (HTTP ${getRes.status}). Check the token and repo name.`);
      const getJson = await getRes.json();
      const sha = getJson.sha;

      const contentJson = JSON.stringify(configState, null, 2);
      const putRes = await fetch(apiBase, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update dashboard config via admin page",
          content: utf8ToBase64(contentJson),
          sha,
          branch: "main",
        }),
      });
      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${putRes.status}`);
      }
      setStatus("Saved! The board will pick this up within about a minute.", "ok");
    } catch (err) {
      console.error(err);
      setStatus(`Save failed: ${err.message}`, "err");
    }
  }

  function setStatus(html, kind) {
    saveStatus.innerHTML = `<div class="status-msg ${kind}">${html}</div>`;
  }
})();
