import PremevalLogo from './PremevalLogo.jsx'

/**
 * "Operated by Premeval", with the mark: who stands behind the app, at the foot of a page.
 * "Operated by", not "Powered by": Premeval runs the app and takes the money, which is what
 * matches the name on its merchant accounts.
 *
 * One colour, the text's, so it follows the theme. The mark reads negative: a filled square
 * plate with the letter knocked out of it in the page's ground. Not a link: a credit is a
 * statement, not a way out of the app. Dressed by `.house-credit` in design/house.css.
 */
export default function PoweredBy({ className = '' }) {
  return (
    <p className={`house-credit ${className}`.trim()}>
      <span>Operated by</span>
      <span className="house-credit-plate">
        <PremevalLogo />
      </span>
      <b>Premeval</b>
    </p>
  )
}
