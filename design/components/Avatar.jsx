/**
 * A person's picture, and the placeholder face for somebody without one.
 *
 * Avatar draws `src` if there is one and the Silhouette if not. Round by default; `round={false}`
 * gives the 4px corner. `label` is the name a screen reader says; without it the picture is
 * decoration beside a name that is already written.
 */

// The placeholder's three greys are typed rather than tokens: it is a picture of a person, not
// chrome, and it looks the same in light and dark.
const PLATE = '#D8DDE1'
const SKIN = '#9BA5AD'
const HAIR = '#6E7A83'

// Gender is carried by the outline, because this is drawn as small as 18px.
const FIGURES = {
  male: (
    <>
      <circle cx="20" cy="13.8" r="8.8" fill={HAIR} />
      <circle cx="20" cy="16.2" r="7.7" fill={SKIN} />
      <path d="M1 40c0-7.5 8.5-11.5 19-11.5S39 32.5 39 40Z" fill={HAIR} />
    </>
  ),
  female: (
    <>
      <path d="M9 20V16.5A11 13 0 0 1 31 16.5V20Q31 23.5 28.5 23.5L11.5 23.5Q9 23.5 9 20Z" fill={HAIR} />
      <circle cx="20" cy="16.5" r="7.8" fill={SKIN} />
      <path d="M3 40c0-5.5 7.6-8.5 17-8.5S37 34.5 37 40Z" fill={HAIR} />
    </>
  ),
}

const shape = (round) => (round ? 'house-avatar house-avatar-round' : 'house-avatar')

export function Silhouette({ gender = 'male', size = 40, label, round = true, className = '' }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : 'true'}
      className={`${shape(round)} ${className}`.trim()}
    >
      {label ? <title>{label}</title> : null}
      {/* A square plate; the shoulders run wider than a circle on purpose, so the round clip
          trims them rather than leaving them floating. */}
      <rect width="40" height="40" fill={PLATE} />
      {FIGURES[gender] || FIGURES.male}
    </svg>
  )
}

export default function Avatar({ src = null, gender, size = 40, label, round = true, className = '' }) {
  if (!src) return <Silhouette gender={gender} size={size} label={label} round={round} className={className} />
  return (
    <img
      src={src}
      alt={label || ''}
      aria-hidden={label ? undefined : 'true'}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`${shape(round)} ${className}`.trim()}
    />
  )
}
