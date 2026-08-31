# Classroom Dashboard

A two-page dashboard for a classroom smart board:

- **`index.html`** — the public display, meant to run full-screen on the smart board. Shows a fixed class-name header and a grid of widgets. Polls `config.json` automatically to pick up changes.
- **`admin.html`** — password-protected page for editing the class name and widgets. Saving here commits an updated `config.json` straight to this GitHub repo.

## Setting up admin access (one-time, per device you'll admin from)

The admin page needs a GitHub **Personal Access Token** to save changes, because a static GitHub Pages site has no server of its own — saving works by having your browser commit the updated `config.json` file directly via the GitHub API.

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Set:
   - **Repository access**: "Only select repositories" → choose `classroom-dashboard`.
   - **Permissions**: under "Repository permissions", set **Contents** to **Read and write**. Leave everything else as "No access".
   - Set an expiration you're comfortable with (you can regenerate later).
3. Generate the token and copy it (starts with `github_pat_...`).
4. Open `admin.html`, log in with the admin password, paste the token into **GitHub connection → GitHub token**, confirm the repo field says `egonspengler24/classroom-dashboard`, and click **Save connection**.

The token is stored only in that browser's `localStorage` — it is never sent anywhere except directly to GitHub's API. Don't do this on a shared/public computer.

## Adding a widget type

Everything about a widget type lives in one place: `assets/js/widgets.js`. Add a new entry to the `WidgetTypes` object with:

- `label` — shown in the admin "add widget" dropdown
- `defaultSettings()` — starting settings for a newly added widget
- `renderDisplay(settings)` — HTML string rendered on the board
- `renderAdminForm(settings)` — HTML string of the settings form in the admin page
- `readAdminForm(container)` — reads that form back into a settings object

No other file needs to change — both `index.html` and `admin.html` pick up new types automatically.

## Widget layout & scheduling

Each widget has:
- `colSpan` / `rowSpan` — how many grid columns/rows it occupies (grid column count is set in Board Settings, default 3)
- `order` — display order, lowest first
- `schedule.start` / `schedule.end` — optional `HH:MM` window; leave blank to always show
