'use client'

import { Component } from 'react'

/**
 * A wall a render error stops at. Without one, any throw during render takes the whole app
 * down to a blank screen; with one around a screen, that screen shows `fallback` and the rest
 * of the app carries on.
 *
 *   fallback  what to draw instead: an element, or a function given `retry` (which draws the
 *             children again), so the fallback can be a LoadFailed with a Try again
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('A render error was caught by a boundary:', error, info?.componentStack)
  }

  retry = () => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback(this.retry) : (fallback ?? null)
  }
}
