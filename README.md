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
