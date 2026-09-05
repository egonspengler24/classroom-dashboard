# Classroom Dashboard

A two-page dashboard for a classroom smart board:

- **`index.html`** — the public display, meant to run full-screen on the smart board. Shows a fixed class-name header and a grid of widgets. Polls `config.json` automatically to pick up changes.
- **`admin.html`** — password-protected page for editing the class name and widgets. Saving here commits an updated `config.json` straight to this GitHub repo.

## Setting up admin access (one-time, per device/person)

The admin page needs a GitHub **Personal Access Token** to save changes, because a static GitHub Pages site has no server of its own — saving works by having your browser commit the updated `config.json` file directly via the GitHub API.

**Two people can both admin the dashboard.** The simplest way is to share the *same* token between devices — generate it once, then paste that same token into the admin page on each device. This is the recommended approach for something like a household with two admins; it doesn't need a second GitHub account. (If you'd rather each person use their own token for accountability, add them as a collaborator on this repo on GitHub first, then have them generate their own token following the steps below under their own account.)

1. Click this shortcut, which pre-fills the account and permission for you: [Create a Classroom Dashboard token](https://github.com/settings/personal-access-tokens/new?target_name=egonspengler24&description=Classroom+Dashboard+admin&contents=write). (If it ever stops working, go manually via **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.)
2. Check/set:
   - **Repository access**: "Only select repositories" → choose `classroom-dashboard`.
   - **Permissions** → **Repository permissions** → **Contents** should already show **Read and write** from the shortcut; double-check it, and leave everything else as "No access".
   - Set an expiration you're comfortable with (you can regenerate later; it won't affect the other device's saved token).
3. Click **Generate token** and copy it (starts with `github_pat_...`) — GitHub only shows it once.
4. Open `admin.html`, log in with the admin password, paste the token into **GitHub connection → GitHub token**, confirm the repo field says `egonspengler24/classroom-dashboard`, and click **Save connection**.

The token is stored only in that browser's `localStorage` — it is never sent anywhere except directly to GitHub's API. Don't do this on a shared/public computer, and don't send the token itself over email/chat if you're passing it to another device — read it out or use a password manager instead.

## Widgets

- **What's for Lunch** — fully autonomous, like Word of the Week: shows today's Red/Green/Blue meal choices, read from [`data/lunch-menu.json`](data/lunch-menu.json). That file encodes the menu as a repeating cycle (`cycleAnchorDate` — a Monday marking the start of "week 1" — plus `cycleLengthWeeks` and a `weeks` array), so the board works out which week applies to any date by counting whole weeks since the anchor, modulo the cycle length. This means the cycle repeats indefinitely in both directions, not just across the date range the source menu happened to list. To update the menu (new cycle, corrected dish, different length), edit that JSON file directly on GitHub — nothing in the admin page needs to change.
- **Weather** — today's forecast for a configurable location, in 2-hour steps, via [Open-Meteo](https://open-meteo.com/) (no API key needed).
- **Announcements** — free-text list, one per line, via the admin page.
- **Word of the Week** — fully autonomous: picks a word from [`data/word-of-the-week.json`](data/word-of-the-week.json) based on the ISO calendar week, so it changes every Monday with no admin action needed and stays identical across every device. To change the vocabulary, edit that JSON file directly on GitHub (each entry is `{ "word", "definition", "example" }`); the board picks up edits the same way it picks up `config.json` changes.
- **Countdown Timer** — a digital `00:00` readout with 5 tappable preset buttons underneath (defaults: 1:00, 2:00, 3:00, 5:00, 7:00, editable in the admin page). Tapping a preset on the board instantly (re)starts the countdown from that value; a small reset button clears it back to idle. Runs entirely in the board's browser tab — nothing is saved or synced, so it resets on page reload, and each teacher/board just uses whatever is showing locally.

## Adding a widget type

Everything about a widget type lives in one place: `assets/js/widgets.js`. Add a new entry to the `WidgetTypes` object with:

- `label` — shown in the admin "add widget" dropdown
- `icon` — (optional) an inline SVG string shown next to the widget's title
- `defaultSettings()` — starting settings for a newly added widget
- `renderDisplay(settings)` — HTML string rendered on the board
- `renderAdminForm(settings)` — HTML string of the settings form in the admin page (return an info message instead of fields if the widget needs no per-instance configuration, like Word of the Week)
- `readAdminForm(container)` — reads that form back into a settings object

Most widgets are stateless — `renderDisplay()` is called fresh on every refresh and its HTML fully replaces the widget's body. A widget that needs to keep running state across those refreshes (like the countdown's live timer) should instead provide `mount(container, settings)`, which the display board calls exactly once per widget instance and never overwrites afterwards; it can return `{ dispose() {...} }` to clean up (e.g. clear an interval) if the widget is later removed or scheduled out. Such a widget should still implement `renderDisplay()` for the admin page's (non-interactive) live preview. See `widgets.js`'s countdown entry for a worked example.

No other file needs to change — both `index.html` and `admin.html` pick up new types automatically.

## Widget layout & scheduling

Each widget has:
- `colSpan` / `rowSpan` — how many grid columns/rows it occupies (grid column count is set in Board Settings, default 3)
- `order` — display order, lowest first
- `schedule.start` / `schedule.end` — optional `HH:MM` window; leave blank to always show
