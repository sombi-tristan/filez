# StationMGR Desktop (offline)

This branch (`desktop/offline`) is StationMGR as a Windows app. It works offline: every record is
kept on the computer it is installed on. It is tied to the station's account on the StationMGR
web platform, which is where the station's subscription is bought. The web version has every
feature; the desktop is the same station screens with PIN sign-in, for the computer at the
station.

## Getting the installer

Every push to a `desktop/*` branch builds `StationMGR-Setup-<version>.exe` on GitHub:
**Actions → "Build Windows desktop app" → latest run → Artifacts**. You can also start a build
by hand from that page with **Run workflow**.

Before the first build, set two repository variables (Settings → Secrets and variables →
Actions → Variables):

- `STATIONMGR_WEB_ORIGIN`: the web platform's address, e.g. `https://stationmgr.example.com`
- `NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY`: from `node scripts/gen-desktop-licence-keys.mjs` on
  `main`. Its private half goes into the web's environment as `DESKTOP_LICENCE_PRIVATE_KEY`.

The installer is unsigned, so Windows SmartScreen will warn on first run: choose
**More info → Run anyway**.

## Using it

- **First launch (no internet needed):** the owner names the station and chooses the username
  and PIN they sign in with on this computer. The free features open at once.
- **Linking (needs the internet once):** with a StationMGR web account, the owner links the
  computer with their web email and password and picks the station, either on the first launch
  (*Link instead*) or later from any locked feature. A computer set up offline moves its records
  into the web station; if both have records, the owner chooses which to keep.
- **Staff:** the owner adds staff on the station page (name, username, PIN) and picks which
  screens each can open. Staff sign in by choosing their name and entering their PIN. Staff and
  PINs stay on this computer.
- **Free:** daily sales, lodgements, station setup, staff and PINs, and reports over up to 5
  days (Dip Calculator included).
- **Push and Pull** (station page, needs the internet and a subscription). With a subscription
  the app also does both on its own while online: it pulls when it opens and every 10 minutes,
  so entries the staff make on their phones reach the computer's reports, and pushes a minute
  after a change here. The buttons do it at once. Push sends what was entered here to the
  web station; Pull brings the web station's records here. Changes not yet pushed are kept as
  they are on a pull. Everything else works offline.
- **Subscription:** the web platform sells it; the desktop checks it offline from a licence the
  web signs on every link, push, pull and whenever the computer is online. Any service running
  opens backup, reports over more than 5 days, and Push and Pull. The other entries need their
  own service (Product Receipt and Imprest need Fuel operations, Lube and the Lube Report need
  Lube management, Accounts and the Account Ledger need Customer payments). Setting the
  computer's clock back closes the paid features until the web is reached again.
- **Backups** (needs a subscription): the owner's station page has *Back up data* (saves one
  `.json` file) and *Restore backup*.
- Closing the app signs everyone out.

## How it works

- `next build` produces a static export in `out/` (`output: 'export'` in `next.config.mjs`).
- `electron/main.js` serves `out/` from a private `app://stationmgr` origin and blocks all
  http(s) traffic from the window. The station's screens are one Ionic app exported as one
  page; `electron/resolve.js` answers every `/dashboard` address with it.
- The screens still call `/api/...`. `lib/local/installFetch.js` answers those calls inside
  the app by running the original route handlers (now in `lib/local/routes`) against a local
  IndexedDB database (`lib/local/store.js`, `lib/local/supabase.js` — a small stand-in for the
  parts of supabase-js the routes use).
- The web: `electron/web.js` is the only way out. It reaches the one web address the build was
  made for, only its `/api/desktop/` endpoints, and keeps the device token from linking
  encrypted with Windows' key store. The pages reach it through `electron/preload.js`.
- `lib/local/outbox.js` records every row the in-app server changes; `lib/local/webSync.js`
  pushes them, pulls, and links. `lib/local/licence.js` checks the licence;
  `components/desktop/LicenceGate.js` passes it to the screens (`useLicence`, `paid`) and
  locks a screen whose service is not running. `lib/reportRange.js` caps a report at 5 days
  without one.
- Column defaults come from the migrations: `node scripts/gen-local-schema.mjs` regenerates
  `lib/local/schema.json` after a migration adds columns.

## Developing

```bash
npm ci
npm run desktop      # build and open the Electron app
npm run build && npm run serve-out   # or test the export in a browser at :4173
npm run dist:win     # build the Windows installer (on Windows)
```

### Building the installer on a Windows PC

1. Install [Node.js 20 LTS](https://nodejs.org) and [Git](https://git-scm.com).
2. In a terminal (PowerShell):

   ```powershell
   git clone https://github.com/sombi-tristan/filez.git
   cd filez
   git checkout desktop/offline
   npm ci
   npm run dist:win
   ```

3. The installer is `dist\StationMGR-Setup-<version>.exe`.

The web address and the licence key come from package.json "stationmgr", so nothing else is
needed. Raise "version" in package.json for each release. On Linux or a Mac the same command
works with Wine installed (64- and 32-bit).

Removed from this branch: Supabase auth/storage, the admin panel, buying a subscription (done on
the web), email invites, chat/notifications, feedback, WhatsApp/Tawk support, PWA/service worker.
