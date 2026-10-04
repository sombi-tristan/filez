/**
 * Path → route module for the in-app API. Every `/api/...` request the screens make is answered
 * here, in the app, by the same handler code that used to run on the server (lib/local/routes).
 * Generated list — keep in step with the folders under lib/local/routes.
 */
export const ROUTES = [
  ['/api/auth/me', () => import('./routes/auth/me/route.js')],
  ['/api/dashboard/data', () => import('./routes/dashboard/data/route.js')],
  ['/api/entries/banks', () => import('./routes/entries/banks/route.js')],
  ['/api/entries/customer-payments', () => import('./routes/entries/customer-payments/route.js')],
  ['/api/entries/customers', () => import('./routes/entries/customers/route.js')],
  ['/api/entries/daily-sales', () => import('./routes/entries/daily-sales/route.js')],
  ['/api/entries/imprest', () => import('./routes/entries/imprest/route.js')],
  ['/api/entries/imprest/entries', () => import('./routes/entries/imprest/entries/route.js')],
  ['/api/entries/imprest/entries/[id]', () => import('./routes/entries/imprest/entries/[id]/route.js')],
  ['/api/entries/imprest/upload', () => import('./routes/entries/imprest/upload/route.js')],
  ['/api/entries/lodgements', () => import('./routes/entries/lodgements/route.js')],
  ['/api/entries/lube-products', () => import('./routes/entries/lube-products/route.js')],
  ['/api/entries/lube-sales', () => import('./routes/entries/lube-sales/route.js')],
  ['/api/entries/lube-stock', () => import('./routes/entries/lube-stock/route.js')],
  ['/api/entries/nozzles', () => import('./routes/entries/nozzles/route.js')],
  ['/api/entries/poll', () => import('./routes/entries/poll/route.js')],
  ['/api/entries/product-receipt', () => import('./routes/entries/product-receipt/route.js')],
  ['/api/entries/tanks', () => import('./routes/entries/tanks/route.js')],
  ['/api/excel-templates', () => import('./routes/excel-templates/route.js')],
  ['/api/invites', () => import('./routes/invites/route.js')],
  ['/api/invites/list', () => import('./routes/invites/list/route.js')],
  ['/api/invites/permissions', () => import('./routes/invites/permissions/route.js')],
  ['/api/local/backup', () => import('./routes/local/backup/route.js')],
  ['/api/local/change-pin', () => import('./routes/local/change-pin/route.js')],
  ['/api/local/login', () => import('./routes/local/login/route.js')],
  ['/api/local/setup', () => import('./routes/local/setup/route.js')],
  ['/api/local/status', () => import('./routes/local/status/route.js')],
  ['/api/onboarding', () => import('./routes/onboarding/route.js')],
  ['/api/organizations', () => import('./routes/organizations/route.js')],
  ['/api/stations/[stationId]/config', () => import('./routes/stations/[stationId]/config/route.js')],
  ['/api/subscription-check', () => import('./routes/subscription-check/route.js')],
]

const compiled = ROUTES.map(([pattern, load]) => {
  const keys = []
  const re = new RegExp('^' + pattern.replace(/\[(\w+)\]/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  return { re, keys, load, dynamic: keys.length > 0 }
}).sort((a, b) => Number(a.dynamic) - Number(b.dynamic)) // exact paths win

export function matchRoute(pathname) {
  for (const r of compiled) {
    const m = pathname.match(r.re)
    if (m) return { load: r.load, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
  }
  return null
}
