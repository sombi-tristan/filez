import Link from 'next/link'
import Image from 'next/image'

/**
 * `app` is the signed-in variant, rendered by AppShell at the foot of every dashboard screen.
 *
 * It drops the link row. Login is plainly wrong once you are signed in, and Feedback is
 * already a quick link on the station picker and reachable from the header, so repeating it
 * on all thirty screens is noise. What is left is the copyright and the house credit.
 *
 * The credit is drawn here with Premeval's own logo (public/premeval-logo.svg, the "p" and its
 * orange dot) rather than the design system's one-colour PoweredBy mark.
 */
export default function Footer({ app = false }) {
  return (
    <footer className="border-t border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-[15px] text-content-muted">
        {!app && (
          <div className="flex items-center gap-4">
            <Link href="/dashboard/feedback" className="hover:text-content">Help</Link>
            <Link href="/auth/login" className="hover:text-content">Login</Link>
          </div>
        )}
        <span>&copy; {new Date().getFullYear()} StationMGR</span>
        <p className="house-credit">
          <span>Powered by</span>
          {/* The logo and the name together on a white rectangle, the same in light and dark. */}
          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5">
            <Image src="/premeval-logo.svg" alt="" aria-hidden width={17} height={24} className="h-6 w-auto" />
            <b className="text-[#0b1220]">Premeval</b>
          </span>
        </p>
      </div>
    </footer>
  )
}
