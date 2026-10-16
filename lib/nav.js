'use client'

import { createContext, forwardRef, useContext, useMemo } from 'react'
import { useIonRouter } from '@ionic/react'
import { useLocation, useParams as useRouteParams } from 'react-router-dom'

/**
 * Navigation for the screens inside the Ionic app (components/shell/IonicShell.js).
 *
 * The dashboard and the admin area each run as one Ionic app with Ionic's own router, so a
 * screen opened from another slides in over it and Back slides it away, with the screen
 * underneath still alive. The screens were written against Next's router, so this file gives
 * them the same names (useRouter, usePathname, useSearchParams, useParams, Link) backed by
 * Ionic's.
 *
 * Only an address inside the app's own area (/dashboard or /admin) moves within the stack.
 * Anything else (/auth, the other area, the home page) is a full page load, so the server's
 * sign-in and admin checks in middleware.js run exactly as they did.
 */

/** The area the running Ionic app owns, '/dashboard' or '/admin'. */
export const AreaContext = createContext(null)

/**
 * The address a screen was opened at, held by components/shell/Screen.js. A screen under the
 * top one keeps its own address instead of seeing the top screen's query string.
 */
export const ScreenLocationContext = createContext(null)

function pathOf(href) {
  try {
    return new URL(href, window.location.origin).pathname
  } catch {
    return String(href)
  }
}

function insideArea(href, area) {
  if (!area || typeof href !== 'string') return false
  if (/^[a-z]+:/i.test(href) && !href.startsWith(window.location.origin)) return false
  const path = pathOf(href)
  return path === area || path.startsWith(`${area}/`)
}

/** Next's useRouter, on Ionic's stack. */
export function useRouter() {
  const ionRouter = useIonRouter()
  const area = useContext(AreaContext)
  return useMemo(() => ({
    push(href) {
      if (insideArea(href, area)) ionRouter.push(href, 'forward', 'push')
      else window.location.assign(href)
    },
    replace(href) {
      if (insideArea(href, area)) ionRouter.push(href, 'none', 'replace')
      else window.location.replace(href)
    },
    /** Start a fresh stack at `href`: for the menu, where a destination is not a step deeper. */
    root(href) {
      if (insideArea(href, area)) ionRouter.push(href, 'root', 'replace')
      else window.location.assign(href)
    },
    back() {
      if (ionRouter.canGoBack()) ionRouter.goBack()
      else window.history.back()
    },
    forward() {
      window.history.forward()
    },
    refresh() {},
    prefetch() {},
  }), [ionRouter, area])
}

/** The location this screen was opened at; the live one outside a screen (the menu). */
function useScreenLocation() {
  const live = useLocation()
  const held = useContext(ScreenLocationContext)
  return held || live
}

export function usePathname() {
  return useScreenLocation().pathname
}

export function useSearchParams() {
  const { search } = useScreenLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The route's own segments (:stationId, :id). Ionic holds them per screen. */
export function useParams() {
  return useRouteParams()
}

/**
 * next/link's Link, on Ionic's stack. A plain <a> with the real address, so a long press,
 * a middle click and "open in new tab" still work; an ordinary tap moves within the stack.
 */
export const Link = forwardRef(function Link(
  // prefetch and scroll are Next's; they mean nothing here and must not reach the DOM.
  // eslint-disable-next-line no-unused-vars
  { href, replace = false, prefetch, scroll, onClick, children, ...rest },
  ref,
) {
  const router = useRouter()
  return (
    <a
      ref={ref}
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return
        e.preventDefault()
        if (replace) router.replace(href)
        else router.push(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
})

export default Link
