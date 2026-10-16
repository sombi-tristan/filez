import { createAnimation } from '@ionic/react'

/**
 * Toasts slide in from their own edge and back out to it. No fade, no bounce.
 *
 * Ionic's own toast animation only fades, in place. It also sets the wrapper's resting offset,
 * `translateY(<top or bottom>)`, from `opts`, so this does the same and slides to it.
 *
 * `.toast-wrapper` starts at opacity 0.01 in Ionic's stylesheet, so it is set to 1 here, or the
 * toast would slide in invisible.
 */
const OFF = { top: 'translateY(-110%)', bottom: 'translateY(110%)' }

function wrapperOf(baseEl) {
  return (baseEl.shadowRoot || baseEl).querySelector('.toast-wrapper')
}

function slideIn(baseEl, opts) {
  const wrapper = wrapperOf(baseEl)
  const edge = opts?.position === 'top' ? 'top' : 'bottom'
  const rest = `translateY(${edge === 'top' ? opts.top : opts.bottom})`
  // Where it came from is kept on the element, so the leave goes back to the same edge.
  wrapper.dataset.edge = edge
  return createAnimation()
    .addElement(wrapper)
    .beforeStyles({ opacity: 1 })
    .fromTo('transform', OFF[edge], rest)
    .duration(280)
    .easing('cubic-bezier(0.2, 0, 0, 1)')
}

function slideOut(baseEl) {
  const wrapper = wrapperOf(baseEl)
  const edge = wrapper.dataset.edge === 'top' ? 'top' : 'bottom'
  // From wherever it is now, which is not the rest position after a swipe has moved it.
  const from = baseEl.ownerDocument.defaultView.getComputedStyle(wrapper).transform
  return createAnimation()
    .addElement(wrapper)
    .fromTo('transform', from && from !== 'none' ? from : 'translateY(0)', OFF[edge])
    .duration(220)
    .easing('cubic-bezier(0.3, 0, 1, 1)')
}

export const TOAST_SLIDE = { enter: slideIn, leave: slideOut }
