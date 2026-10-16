import { PoweredBy } from '@/design'

/**
 * The foot of every station screen (components/shell/Screen.js): the copyright and the house
 * credit. Desktop build: no Help or Login links, there is nowhere online for them to go.
 */
export default function Footer() {
  return (
    <footer className="border-t-2 border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-[15px] text-content-muted">
        <span>&copy; {new Date().getFullYear()} StationMGR</span>
        <PoweredBy />
      </div>
    </footer>
  )
}
