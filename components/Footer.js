import Image from 'next/image'

/**
 * The foot of every station screen (components/shell/Screen.js): the copyright and the house
 * credit. Desktop build: no Help or Login links, there is nowhere online for them to go.
 *
 * The credit is drawn here with Premeval's own logo (public/premeval-logo.svg, the "p" and its
 * orange dot) rather than the design system's one-colour PoweredBy mark.
 */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-[15px] text-content-muted">
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
