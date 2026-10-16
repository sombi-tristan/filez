CLAUDE.md

Desktop branch (desktop/offline)

This branch is the offline Windows app: no Supabase, no server. The "server" is
lib/local (route handlers in lib/local/routes running in the app against IndexedDB,
reached through the fetch shim in lib/local/installFetch.js). The sync engine below still
runs, but its target is that local store. See README.md. Do not push this branch under a
claude/ prefix: the auto-merge workflow would merge it into main.

The computer is linked to a station on the web platform (app/api/desktop/* on main):
- Push and Pull move rows between the local store and the web station (lib/local/webSync.js).
  Every write the in-app server makes to a synced table (lib/desktopTables.js) is recorded in
  the outbox (lib/local/outbox.js); a pull writes the store directly and never echoes back.
- The window never reaches the web itself. electron/web.js does, through electron/preload.js
  (window.stationmgr), holding the device token. Pages call lib/local/web.js.
- The station's subscription is checked offline from the signed licence (lib/local/licence.js).
  A screen's service is the `service` field in screens/routes.js; LicenceGate locks the screen,
  or the whole app when no service runs. The in-app server's requireService follows the licence.
- Staff and their PINs stay on the computer: users and org_invites never sync.

Important

After every git push, always provide the pull request / merge link:
https://github.com/traderugo/filez/compare/main...<branch-name>

When generating code for this project, always follow the offline-first architecture defined in this file.

Prioritize local IndexedDB reads and writes before any server communication.

The application should behave like a desktop application:

- instant UI updates
- minimal loading states
- minimal server usage
- background synchronization

Never block UI interactions while waiting for network responses.

This project does not use TypeScript. All code should be written in JavaScript.

---

Design System

The UI uses the house design system from the groo repository, copied into "design/".

- Import its parts from "@/design" only, and only from client components.
- Never edit anything in "design/". Change it in groo, then run "node design/sync.mjs ../filez" from groo. tests/design-copy.test.mjs fails if the copy drifts.
- One accent: blue ("data-accent=\"blue\"" on <html>). Dark is "data-theme=\"dark\"" on <html>.
- Ionic runs in md mode with core.css only. Do not import @ionic/react/css/structure.css: it pins <body> on every page, and the home and auth pages scroll the document. The Ionic apps pin it themselves (html.ionic-app in app/globals.css).
- Entry screens are built from components/entries/EntryParts.js (forms) and EntryListParts.js (lists). Keep the lists off EntryParts.js: it carries the date picker.
- Tailwind screens keep using bg-surface / text-content / border-line / bg-primary-*. app/globals.css maps those names to the house values. The filez line token is "--line-ch" because house.css already defines "--line" as a hex value.

---

Ionic Screens

The station's screens run as one Ionic app with Ionic's own router, so screens stack: a screen opens over the last, Back slides it away, and the one underneath is still there. Desktop build: no admin area.

- app/dashboard/[[...path]]/page.js exports one page (generateStaticParams) that mounts components/shell/IonicShell.js; electron/resolve.js answers every /dashboard address with it.
- The screens live in screens/dashboard, not app/. A new screen is a page.js there plus a row in screens/routes.js (path, title, lazy import).
- Each screen is wrapped by components/shell/Screen.js: an IonPage with the top bar (menu, back, bell, home) and an IonContent that scrolls. Layout inside a screen is relative to IonContent: sticky things use top-0, not top-14.
- Inside the Ionic apps, import useRouter / usePathname / useSearchParams / useParams / Link from "@/lib/nav", never from next/navigation or next/link. lib/nav moves within the stack for addresses inside the app and does a full page load for anything else (sign-in is a plain page).
- The sidebars are the content of the IonMenu inside an IonSplitPane: a column on a computer, a drawer on a phone. Their groups are accordions (the house SidebarSections), one open at a time, opening the group that holds the screen shown.
- Screens slide sideways (components/shell/slideTransition.js): an opened screen comes in from the right; Back slides it out to the right and the one underneath comes back from the left.
- A report's date range and its Generate button are components/reports/DateRange.js: the two dates and a round icon button that stay on one line.
- Every screen's footer sits at the bottom of the screen when the content is short (Screen.js). A bar pinned to the bottom of a phone carries the class entry-actionbar, which keeps the footer clear of it.

---

Project Architecture

This project uses a local-first / offline-first architecture.

The browser acts as the primary database and compute engine.

The backend (Supabase / serverless APIs) is used only for:

- authentication
- persistent storage
- cross-device synchronization

Core Workflow

User Action
→ Write to IndexedDB
→ Update derived tables
→ UI updates instantly
→ Add operation to "syncQueue"
→ Background sync sends changes to server

The UI should never depend on server responses to update.

---

Local Database

Primary database: IndexedDB

Recommended library: Dexie.js

Typical tables:

- "transactions"
- "categoryTotals"
- "dashboardStats"
- "monthlyTotals"
- "syncQueue"

Rules

- All CRUD operations write to IndexedDB first
- UI reads only from IndexedDB
- Server responses must never control UI rendering

---

Repository Pattern

All database mutations must go through repository functions.

Repositories are responsible for:

- writing to IndexedDB
- updating derived tables
- adding operations to the sync queue

Example pattern:

async function createTransaction(tx) {
  await db.transactions.add(tx)

  await updateCategoryTotals(tx)

  await db.syncQueue.add({
    operation: "CREATE",
    table: "transactions",
    payload: tx,
    createdAt: Date.now()
  })
}

UI components should never write directly to IndexedDB.

They should call repository methods.

---

Derived Tables

Dashboards must never scan large tables.

Instead maintain derived tables that store summaries.

Examples:

- "categoryTotals"
- "dashboardStats"
- "monthlyTotals"

These tables are updated when underlying data changes.

Benefits:

- instant dashboard rendering
- minimal calculations during reads
- reduced CPU usage
- reduced server load

---

UI Data Access

UI should read only from IndexedDB.

Reactive queries should be used so the UI updates automatically when the database changes.

Example:

useLiveQuery(() => db.transactions.toArray())

Benefits:

- instant UI updates
- offline functionality
- minimal API calls
- predictable rendering

---

Heavy Calculations

Heavy calculations must not run on the UI thread.

Use Web Workers for:

- analytics
- aggregations
- financial calculations
- large dataset processing

Typical flow:

IndexedDB query
→ send data to worker
→ worker processes data
→ worker returns result
→ UI updates

This prevents UI freezing when datasets grow.

---

IndexedDB Performance Rules

To support large datasets, follow these rules:

1. Always index queried fields.
2. Avoid full table scans.
3. Use compound indexes when filtering multiple fields.
4. Limit query sizes where possible.
5. Use pagination for large datasets.
6. Keep records small and normalized.

Example schema:

db.version(1).stores({
  transactions: "id, userId, category, date"
})

Example indexed query:

db.transactions
  .where("userId")
  .equals(userId)
  .toArray()

---

Sync Queue

All mutations must be recorded in "syncQueue".

Example record:

{
  operation: "CREATE",
  table: "transactions",
  payload: {...},
  createdAt: timestamp
}

This enables eventual consistency with the server.

---

Background Sync Engine

The sync engine periodically sends queued operations to the server.

Operations should be batched into a single request.

Example pattern:

async function sync() {
  const pending = await db.syncQueue.toArray()

  if (!pending.length) return

  await fetch("/api/sync", {
    method: "POST",
    body: JSON.stringify(pending)
  })

  for (const item of pending) {
    await db.syncQueue.delete(item.id)
  }
}

Batching reduces:

- serverless executions
- API requests
- Supabase query load
- Vercel invocation costs

---

Optional Initial Data Sync

After login, the app may download the user's dataset once.

Example flow:

login
→ download dataset
→ store in IndexedDB
→ application runs locally

After this, most operations occur entirely on the client.

---

Server Responsibilities

The backend should handle only:

- authentication
- persistent storage
- cross-device synchronization

The server should not perform dashboard calculations.

All analytics and aggregation should happen in the browser.

---

Cost Optimization Goals

This architecture dramatically reduces backend usage.

Benefits include:

- far fewer API calls
- reduced Supabase reads/writes
- fewer serverless executions
- reduced Vercel costs

Heavy computation and data processing are handled locally.

---

Development Goal

The application should feel like a native desktop application:

- instant response times
- reactive UI updates
- smooth performance with large datasets
- minimal dependence on network connectivity

---

Code Generation Rules

When generating code for this project, always follow these rules:

1. Offline-first is mandatory
   
   - All writes go to IndexedDB first.
   - UI updates immediately from local state.

2. Never fetch inside UI components
   
   - Server communication must go through repository or sync logic.

3. Prefer local queries
   
   - UI reads must come from IndexedDB.

4. All mutations must enter the syncQueue
   
   - No direct server mutations.

5. Batch network requests
   
   - Avoid unnecessary API calls.

6. Avoid heavy work on the UI thread
   
   - Use Web Workers for analytics and large computations.

7. Optimize for large datasets
   
   - Always use indexed queries.
   - Avoid full table scans.

8. JavaScript only
   
   - Do not introduce TypeScript.

9. Prioritize desktop-level responsiveness

10. When uncertain, choose the solution that reduces server load and network usage.