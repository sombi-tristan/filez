/**
 * Pins that the dashboard and admin area are wired as Ionic apps, with the sidebar mounted.
 *
 * StationSidebar once shipped complete and unreachable: imported, never rendered, and the
 * menu button never drawn. Both failures are silent (an unused import is legal, a guarded
 * button simply does not draw), so the wiring is pinned here rather than left to the eye.
 *
 * This reads the source instead of rendering it: the defect is whether the wiring is written,
 * so a source assertion catches it with no DOM and no React test runner.
 *
 * Run: node tests/app-shell-sidebar.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8')

const shell = read('components', 'shell', 'IonicShell.js')
const screen = read('components', 'shell', 'Screen.js')
const dashboardPage = read('app', 'dashboard', '[[...path]]', 'page.js')
const adminPage = read('app', 'admin', '[[...path]]', 'page.js')
const nav = read('lib', 'nav.js')
const routes = read('screens', 'routes.js')
const tailwind = read('tailwind.config.js')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('Each area mounts the Ionic app')

check('/dashboard mounts the shell for its area', /<IonicShell area="\/dashboard" \/>/.test(dashboardPage))
check('/admin mounts the shell for its area', /<IonicShell area="\/admin" \/>/.test(adminPage))
check('the shell is loaded in the browser only', /ssr: false/.test(dashboardPage) && /ssr: false/.test(adminPage))

console.log('\nThe shell is an Ionic app with the sidebar in a split pane')

check('IonApp around Ionic\'s router', /<IonApp>\s*<IonReactRouter>/s.test(shell))
check('a split pane whose content is the outlet', /<IonSplitPane contentId="main"/.test(shell) && /<IonRouterOutlet id="main">/.test(shell))
check('the menu points at the same content', /<IonMenu contentId="main"/.test(shell))
check('the dashboard menu renders the station sidebar with the open station', /<StationSidebar stationId=\{stationId\} \/>/.test(shell))
check('the admin menu renders the admin sidebar', /<AdminSidebar \/>/.test(shell))
check('every screen of the area is a route', /screens\.map\(\(screen\) => \(\s*<Route key=\{screen\.path\} path=\{screen\.path\} element=\{<Screen screen=\{screen\} \/>\}/s.test(shell))

console.log('\nEach screen is an Ionic page that can open the menu and go back')

check('the screen is an IonPage', /<IonPage>/.test(screen))
check('the top bar draws the menu button', /<IonMenuButton \/>/.test(screen),
  'without it a phone has no way to the sidebar')
check('the top bar draws a back button off the area root', /<IonBackButton/.test(screen))
check('the content scrolls in IonContent', /<IonContent>/.test(screen))
check('the screen holds its own address for the hooks', /<ScreenLocationContext\.Provider value=\{held\}>/.test(screen))

console.log('\nLeaving an area is a full page load, so middleware checks the way in')

check('nav only stacks addresses inside the area', /if \(insideArea\(href, area\)\) ionRouter\.push\(href, 'forward', 'push'\)\s*else window\.location\.assign\(href\)/.test(nav))
check('the station screens are in the dashboard table', /path: '\/dashboard\/stations\/:stationId'/.test(routes))

console.log('\nThe screens are styled')

check('Tailwind reads screens/ for its classes', /"\.\/screens\/\*\*\/\*\.\{js/.test(tailwind),
  'without it every class used only by a screen is stripped from the CSS')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
