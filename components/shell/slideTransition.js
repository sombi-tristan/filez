import { createAnimation, getIonPageElement } from '@ionic/core/components'

/**
 * How one screen of the stack replaces another (components/shell/IonicShell.js): sideways.
 *
 *   opening  the new screen slides in from the right over the one it opens from, which drifts
 *            a little to the left beneath it
 *   leaving  Back slides the top screen out to the right, and the one underneath comes back in
 *            from the left
 *
 * Ionic's own Android-style transition rises from below and fades instead; the house runs
 * Ionic in that mode everywhere else, so only the page transition is replaced here.
 */
const DURATION = 280
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'
const OFF_RIGHT = 'translateX(100%)'
const BEHIND = 'translateX(-30%)'
const IN_PLACE = 'translateX(0)'

export default function slideTransition(_baseEl, opts) {
  const back = opts.direction === 'back'
  const duration = opts.duration || DURATION

  const entering = getIonPageElement(opts.enteringEl)
  const root = createAnimation()
    .duration(duration)
    .easing(EASING)

  const enter = createAnimation()
    .addElement(entering)
    .fill('both')
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('transform', back ? BEHIND : OFF_RIGHT, IN_PLACE)
  root.addAnimation(enter)

  if (opts.leavingEl) {
    const leavingPage = getIonPageElement(opts.leavingEl)
    const leave = createAnimation()
      .addElement(leavingPage)
      .fill('both')
      .fromTo('transform', IN_PLACE, back ? OFF_RIGHT : BEHIND)
    if (back) {
      // The screen going away stays above the one coming back until it is gone.
      leave
        .beforeStyles({ 'z-index': '2' })
        .afterClearStyles(['z-index'])
        .onFinish((step) => {
          if (step === 1 && leave.elements.length > 0) leave.elements[0].style.setProperty('display', 'none')
        })
    } else {
      // The one left underneath must not keep its offset when Back brings it back.
      leave.afterClearStyles(['transform'])
    }
    root.addAnimation(leave)
  }

  return root
}
