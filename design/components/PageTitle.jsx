/**
 * A screen's own heading: the one `<h1>`, in the heading face, with an optional quieter line
 * under it. `hidden` keeps both for screen readers and draws nothing, for a screen whose top
 * bar already says its name. Dressed by `.house-title` in design/house.css.
 */
export default function PageTitle({ children, subtitle = null, hidden = false }) {
  return (
    <div className={hidden ? 'house-title house-title-hidden' : 'house-title'}>
      <h1>{children}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  )
}
