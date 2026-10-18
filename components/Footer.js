import Link from 'next/link'
import { PoweredBy } from '@/design'

/**
 * `app` is the signed-in variant, rendered by AppShell at the foot of every dashboard screen.
 *
 * It drops the link row. Login is plainly wrong once you are signed in, and Feedback is
 * already a quick link on the station picker and reachable from the header, so repeating it
 * on all thirty screens is noise. What is left is the copyright and the house credit.
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
        <PoweredBy />
      </div>
    </footer>
  )
}
