import PremevalLogo from './PremevalLogo.jsx'

/**
 * "Powered by Premeval", with the mark: who stands behind the app, at the foot of a page.
 *
 * One colour, the text's, so it follows the theme. The mark reads negative: a filled square
 * plate with the letter knocked out of it in the page's ground. Not a link: a credit is a
 * statement, not a way out of the app. Dressed by `.house-credit` in design/house.css.
 */
export default function PoweredBy({ className = '' }) {
  return (
    <p className={`house-credit ${className}`.trim()}>
      <span>Powered by</span>
      <span className="house-credit-plate">
        <PremevalLogo />
      </span>
      <b>Premeval</b>
    </p>
  )
}
