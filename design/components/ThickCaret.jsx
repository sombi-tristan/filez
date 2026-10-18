'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A thick caret for every text field. Browsers give the caret a colour and nothing else: no
 * width. So while this is mounted the browser's caret is made transparent (`html.house-thick-caret`
 * in design/house.css) and this draws a 3px bar in the accent where it would be, blinking like
 * the real one and restarting its blink on every move, as a real caret does.
 *
 * Mount it once, at the root of the app. It draws nothing while a selection is held or no text
 * field has the focus.
 *
 * Not in a number or date field: those never report selectionStart, so there is nowhere to draw
 * the bar. They keep the browser's own caret, in the accent (house.css). Keep this list and the
 * one in house.css the same.
 */
const TEXT_TYPES = new Set(['text', 'search', 'email', 'password', 'tel', 'url'])

export function isTextField(el) {
  if (!el || !el.tagName) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (tag !== 'input') return false
  const type = (el.getAttribute('type') || 'text').toLowerCase()
  return TEXT_TYPES.has(type)
}

export function showsCaret(el) {
  if (!el || el.readOnly || el.disabled) return false
  return el.selectionStart != null && el.selectionStart === el.selectionEnd
}

const WIDTH = 3

// What a hidden copy of the field needs so its text wraps and sits exactly as the field's does.
const COPIED = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
  'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration',
  'letterSpacing', 'wordSpacing', 'tabSize', 'direction',
]

/** Where the caret is on the screen, or null when it has scrolled out of its field. */
function caretBox(el) {
  const doc = el.ownerDocument
  const style = doc.defaultView.getComputedStyle(el)
  const isInput = el.tagName.toLowerCase() === 'input'
  const mirror = doc.createElement('div')
  for (const prop of COPIED) mirror.style[prop] = style[prop]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = isInput ? 'pre' : 'pre-wrap'
  mirror.style.overflowWrap = isInput ? 'normal' : 'break-word'
  if (isInput) mirror.style.height = 'auto'
  const value = el.type === 'password' ? '•'.repeat(el.value.length) : el.value
  const at = el.selectionStart ?? value.length
  mirror.textContent = value.slice(0, at)
  const marker = doc.createElement('span')
  marker.textContent = value.slice(at) || '.'
  mirror.appendChild(marker)
  doc.body.appendChild(mirror)
  const fontSize = parseFloat(style.fontSize) || 16
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.25
  const top = marker.offsetTop + parseFloat(style.borderTopWidth || 0)
  const left = marker.offsetLeft
  doc.body.removeChild(mirror)
  const rect = el.getBoundingClientRect()
  const height = Math.min(lineHeight, fontSize * 1.35)
  const y = isInput ? rect.top + (rect.height - height) / 2 : rect.top + top - el.scrollTop + (lineHeight - height) / 2
  const x = rect.left + left - el.scrollLeft - WIDTH / 2
  const inner = {
    left: rect.left + parseFloat(style.borderLeftWidth || 0),
    right: rect.right - parseFloat(style.borderRightWidth || 0),
    top: rect.top,
    bottom: rect.bottom,
  }
  if (x + WIDTH < inner.left - 1 || x > inner.right + 1) return null
  if (y + height < inner.top - 1 || y > inner.bottom + 1) return null
  return { x, y, height }
}

export default function ThickCaret() {
  const [box, setBox] = useState(null)
  const [moves, setMoves] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    const doc = document
    doc.documentElement.classList.add('house-thick-caret')
    const update = () => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const el = doc.activeElement
        if (!isTextField(el) || !showsCaret(el)) {
          setBox(null)
          return
        }
        let next = null
        try {
          next = caretBox(el)
        } catch {
          next = null
        }
        setBox(next)
        setMoves((n) => n + 1)
      })
    }
    const events = ['focusin', 'focusout', 'input', 'keyup', 'pointerup', 'selectionchange']
    for (const name of events) doc.addEventListener(name, update, true)
    doc.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      doc.documentElement.classList.remove('house-thick-caret')
      cancelAnimationFrame(frame.current)
      for (const name of events) doc.removeEventListener(name, update, true)
      doc.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  if (!box) return null
  // Keyed on the move, so the blink starts again each time the caret does.
  return <span key={moves} aria-hidden="true" className="house-caret" style={{ left: box.x, top: box.y, height: box.height, width: WIDTH }} />
}
