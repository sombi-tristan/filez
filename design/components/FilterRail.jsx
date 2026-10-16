/**
 * One choice among a few filters. On a phone the options wrap in a row above the list; on a
 * computer they stand in a column beside it, the current one marked by an accent rail.
 * Dressed by `.house-rail` in design/house.css.
 *
 *   options   [{ key, label }]
 *   value     the chosen key
 *   onChange  called with the key that was tapped
 */
export default function FilterRail({ options, value, onChange, label = 'Filter' }) {
  return (
    <nav aria-label={label} className="house-rail">
      <ul>
        {options.map((o) => {
          const active = value === o.key
          return (
            <li key={o.key}>
              <button type="button" onClick={() => onChange(o.key)} aria-current={active ? 'true' : undefined} className={active ? 'house-rail-on' : undefined}>
                {o.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
