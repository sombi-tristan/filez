# The design system

One look for every app. This folder is the one true copy: the tokens, Ionic dressed in them, and
the components. See it all on one screen at `/design` on the local server (`npm run dev`, then
http://localhost:8888/design). It is not on the public site.

## The rules

- **One accent per app.** Orange `#F57D00` or blue `#0093DD`: set `data-accent="blue"` on
  `<html>` for blue, nothing for orange. The accent is the same in light and dark.
- **4px corners** on everything: buttons, fields, cards, tiles, sheets.
- **Flat.** No gradients and no shadows; a 2px line in the line colour marks an edge. The toast
  is the one thing that casts a shadow, because it floats over the screen.
- **Type.** Outfit (800, 600) for headings, Source Sans 3 for the rest. 17px to read, 15px for
  small print, 13px only on a badge or under a tab.
- **Dark** is `data-theme="dark"` on `<html>`. Only the neutrals turn.
- **Ionic, in one mode.** `setupIonicReact({ mode: 'md' })`, so a screen looks the same on every
  phone and on a computer.
- **Buttons.** 48px; 56px (`size="large"`) for the one main action of a screen; 36px inside
  something else. One filled button per screen, the rest outlined.
- **Notices are toasts**, never a line of text that pushes the screen down. What is wrong with
  one field is said under that field.
- **Reports.** Right-aligned means tabular figures. Green and red are for signed accounting
  figures only. Any list that can run long is paged, and its total is over all rows on every
  page. An empty table says so in one line; a whole empty view is an `EmptyState`.
- **Consumer apps** may add the pastels, the dark button on an accent block and emoji stickers:
  put `class="consumer"` on a wrapper. **Business apps use none of the three.**

## What is here

| File | What it is |
|---|---|
| `house.css` | The tokens, Ionic's variables fed from them, Ionic's components dressed, then the `.house-*` classes of the components below. |
| `index.js` | Every component, one export each. Import from here. |
| `components/` | The components. Each imports only React, `@ionic/react`, `ionicons` and its neighbours. |

| Component | Use |
|---|---|
| `Button`, `IconButton` | Every button. `variant`: primary, secondary, neutral, danger. `size`: small, default, large. |
| `FloatingInput`, `FloatingTextarea`, `FloatingSelect` | Every form field: the label rests in the box and rises into its edge. |
| `Toast` | Every notice. `tone`: error, success, info. |
| `PremevalLogo` | The maker's mark. |
| `PoweredBy` | "Operated by Premeval", at the foot of a page. |
| `PageTitle` | A screen's one heading; `hidden` when the top bar already says it. |
| `ListRow` | A Settings-style row: label, value or switch, chevron. The whole row is the target. |
| `SwipeRow` | A row that slides left to show its buttons (Archive, Delete). |
| `Tabs` | Underline tabs, each as wide as its words. |
| `BottomSheet`, `SheetAction`, `SheetHero` | A panel from the bottom of the screen (centred on a computer), its action rows, and the icon on a round plate at its head. |
| `Skeleton`, `ListRowSkeleton`, `TextSkeleton` | What a screen draws while it loads, in the shape of what is coming. Never a lone spinner. |
| `LoadFailed` | What a screen shows when its load failed: offline or a real failure, with Try again. |
| `ErrorBoundary` | The wall a render error stops at, so one broken screen is not a blank app. |
| `Avatar`, `Silhouette` | A person's picture, and the placeholder face without one. |
| `Fab` | The floating action button: the one thing a screen is for making. |
| `ThickCaret` | A 3px caret in the accent for every text field. Mount once at the root. |
| `useOnline`, `useRetryOnReconnect` | Hooks: whether there is a network, and a retry when it returns. |
| `Card`, `SectionHeader`, `IconChip`, `Badge` | A dashboard's pieces: the flat card, the heading over a group, an icon on a tinted plate, a count. |
| `Tile`, `HeroTile` | Dashboard tiles: square ones in a grid, and the larger one or two for the main actions (`solid` fills the primary). |
| `RowGroup`, `Row` | Rows in one bordered container: icon chip, label, quiet line, count, chevron. |
| `EmptyState` | What a whole view shows when it has nothing: icon, title, line, one action. |
| `FilterRail` | One choice among a few filters: a wrapped row on a phone, a column with a rail on a computer. |
| `Dialog`, `ConfirmDialog` | A titled dialog (centred, or `placement="bottom"`), and "Are you sure?" that holds while the answer is carried out and says why if it fails. |
| `SearchableSelect` | A select for a long list: a sheet with a search box, best match first. |
| `DateInput` | A day, typed ("15", "15/3", "150326", t, y, + and -) or picked from the calendar. |
| `Toggle`, `Spinner`, `LoadingOverlay` | A switch with its words; the spinner for a wait with no shape; the whole screen held. |
| `ThemeControl` | Light, Dark or System, remembered on the device. Call `applyTheme()` before the app draws. |
| `AppHeader` | A screen's top bar: back arrow and title, or the brand, and actions at the end. |
| `Sidebar`, `SidebarBrand`, `SidebarSwitcher`, `SidebarGroupLabel`, `SidebarNavRow`, `SidebarUserFooter` | A business app's sidebar, for an IonMenu inside an IonSplitPane. |
| `ReportShell`, `ReportSection` | A report's frame (controls pinned to the top) and its titled blocks. |
| `ReportTable`, `TableFrame`, `Pager` | The standard table: filled head, ruled rows, numeric columns right and tabular, a totals row, pages of `PAGE_SIZE`. `TableFrame` and `Pager` on their own for a table too unusual for it. |
| `Stat`, `StatGrid` | Figure tiles in a ruled grid, two across on a phone and four on a computer. |
| `BreakdownPanel`, `BreakdownRow` | Label-left, figure-right lines: a profit and loss, a cash breakdown. |
| `DayTabs` | "All" and a tab per day, pinned to the bottom of a report. |
| `balanceTone`, `ALL_TAB`, `PAGE_SIZE`, `pageCount`, `pageOf` | The plain values and functions behind the reports. |
| `fuzzyScore`, `fuzzyFilter`, `parseDay`, `toIso`, `toDisplay`, `fromIso`, `addDays`, `applyTheme`, `savedTheme` | The plain functions behind the select, the date field and the theme, for an app's own use. |

## Taking it into an app

From this repository, with the app's folder beside it:

- [ ] `node design/sync.mjs ../<app>` (or `--to src/design` for another folder inside it)
- [ ] In the app: install `react`, `@ionic/react` and `ionicons`, and load the two fonts (Outfit
      600 and 800, Source Sans 3 400, 600 and 700)
- [ ] In the app's entry file:

```js
import { setupIonicReact } from '@ionic/react'
import '@ionic/react/css/core.css'
import '@ionic/react/css/structure.css'
import './design/house.css'

setupIonicReact({ mode: 'md' })
```

- [ ] Blue instead of orange: `data-accent="blue"` on `<html>`
- [ ] Use the parts: `import { Button, FloatingInput, Toast } from './design'`
- [ ] Add the drift check to the app's tests:

```js
import { drift } from '../design/check.mjs'
test('the design system copy is untouched', () => assert.deepEqual(drift(), []))
```

After a change here, run the sync again in each app that has a copy.

## Changing it

Change a component here, never in an app's copy: `check.mjs` fails the app's tests if its copy
was edited, lost a file or gained one. A new component needs four things, and
`tests/design.test.mjs` holds it to them: a file in `components/`, an export in `index.js`, a row
in the table above, and a sample on the showcase (`src/screens/Design.jsx`).

| File | What it is |
|---|---|
| `sync.mjs` | Copies this folder into an app and writes its `manifest.json`. Stays here. |
| `check.mjs` | Compares a copy against its manifest. Goes with the copy. |
