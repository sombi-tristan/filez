# StationMGR Desktop (offline)

This branch (`desktop/offline`) is StationMGR as a Windows app that runs with no internet and
no Supabase. Everything is stored on the computer it is installed on.

## Getting the installer

Every push to a `desktop/*` branch builds `StationMGR-Setup-<version>.exe` on GitHub:
**Actions → "Build Windows desktop app" → latest run → Artifacts**. You can also start a build
by hand from that page with **Run workflow**.

The installer is unsigned, so Windows SmartScreen will warn on first run: choose
**More info → Run anyway**.

## Using it

- **First launch:** create the station and the owner (name, username, 4–8 digit PIN), then run
  the setup wizard (nozzles, tanks, lodgements, products, accounts).
- **Staff:** the owner adds staff on the station page (name, username, PIN) and picks which
  screens each can open. Staff sign in by choosing their name and entering their PIN.
- **Backups:** the owner's station page has *Back up data* (saves one `.json` file) and
  *Restore backup*. Records exist only on this PC, so back up regularly to a flash drive.
- Closing the app signs everyone out.

## How it works

- `next build` produces a static export in `out/` (`output: 'export'` in `next.config.mjs`).
- `electron/main.js` serves `out/` from a private `app://stationmgr` origin and blocks all
  http(s) traffic.
- The screens still call `/api/...`. `lib/local/installFetch.js` answers those calls inside
  the app by running the original route handlers (now in `lib/local/routes`) against a local
  IndexedDB database (`lib/local/store.js`, `lib/local/supabase.js` — a small stand-in for the
  parts of supabase-js the routes use).
- Column defaults come from the migrations: `node scripts/gen-local-schema.mjs` regenerates
  `lib/local/schema.json` after a migration adds columns.
- The station id is fixed (`lib/local/constants.js`) because a static export needs every
  dynamic route known at build time.

## Developing

```bash
npm ci
npm run desktop      # build and open the Electron app
npm run build && npm run serve-out   # or test the export in a browser at :4173
npm run dist:win     # build the Windows installer (on Windows)
```

Removed from this branch: Supabase auth/storage, admin panel, subscriptions and payments, email
invites, chat/notifications, feedback, WhatsApp/Tawk support, PWA/service worker.
