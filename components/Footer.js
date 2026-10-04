import PremevalLogo from '@/components/PremevalLogo'

/**
 * `app` is the signed-in variant, rendered by AppShell at the foot of every dashboard screen.
 *
 * It drops the link row. Login is plainly wrong once you are signed in, and Feedback is
 * already a quick link on the station picker and reachable from the header, so repeating it
 * on all thirty screens is noise. What is left is the copyright and the Premeval line, which
 * is the whole point of putting a footer there.
 */
export default function Footer({ app = false }) {
  return (
    <footer className="border-t border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-xs text-content-faint">
        <span>&copy; {new Date().getFullYear()} StationMGR</span>

        {/* The `icon` variant: the mark on its own white card, which is the artwork's own
            framing. It carries its background with it, so one copy reads on both themes and
            no dark-mode swap is needed. A shade larger than the bare mark was, because the
            card holds roughly 14% air around the glyph. */}
        <span className="flex items-center gap-1.5 mt-1">
          Powered by
          <PremevalLogo variant="icon" className="w-5 h-5" />
          <span className="font-semibold text-content-muted">Premeval Digital</span>
        </span>
      </div>
    </footer>
  )
}
