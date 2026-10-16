/**
 * The Premeval mark: a lowercase "p" with a dot.
 *
 * The "p" takes `currentColor` (the class `house-mark` gives it Premeval's blue). The dot takes
 * `dot`: Premeval's own orange, `#F57D00`, or leave it out for a mark in one colour.
 *
 * The hole in the "p" is a mask, not a white fill, so the mark is right on any ground.
 */
const VIEW_BOX = '1529.79 750 1381.33 1984.09'

const STEM =
  'M1746.6 970.338c59.7709,-60.8858 118.488,-114.717 187.065,-150.935 87.6094,-46.2661 185.35,-69.4028 293.399,-69.4028 188.262,0 349.506,68.1543 483.325,203.633 133.82,135.484 200.726,298.391 200.726,489.144 0,194.908 -66.0744,360.311 -199.062,496.205 -132.57,135.894 -292.572,204.056 -480.419,204.056 -105.142,0 -202.504,-21.9012 -290.908,-65.6646 -37.787,-18.7051 -26.635,-21.8764 -59.928,-28.7539l0 140.552c0,67.6122 -349.002,62.4118 -349.002,0.775984l0 -136.512 0 -135.106c0,-329.25 -37.8437,-690.658 214.804,-947.991zm467.169 -55.7669c-147.947,0 -272.21,51.5303 -373.198,154.592 -101.404,103.068 -151.685,231.484 -151.685,384.835 0,100.571 22.4433,191.169 67.3228,271.371 45.3024,80.6244 109.719,144.209 193.665,191.169 83.9469,46.9606 172.88,70.6524 265.969,70.6524 91.8461,0 178.29,-23.6917 258.914,-71.0681 80.6185,-47.7921 145.035,-113.867 192.827,-199.062 48.2079,-85.1953 71.8996,-174.544 71.8996,-268.049 0,-93.9272 -23.6917,-183.276 -71.0669,-267.639 -47.3764,-84.7795 -111.377,-150.022 -192.001,-196.989 -80.2087,-46.5437 -167.895,-69.8126 -262.646,-69.8126z'

const DOT =
  'M1717.19 2363.31c102.374,0 185.392,83.0173 185.392,185.392 0,102.374 -83.0173,185.392 -185.392,185.392 -102.371,0 -185.392,-83.0173 -185.392,-185.392 0,-102.374 83.0209,-185.392 185.392,-185.392z'

const BOWL = { cx: 2216.7, cy: 1442.69, rx: 553.183, ry: 561.773 }
const COUNTER = { cx: 2240.04, cy: 1479.87, rx: 325.815, ry: 330.874 }

const MASK_ID = 'premeval-counter'

export default function PremevalLogo({ className = '', dot = 'currentColor' }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Premeval"
      style={{ shapeRendering: 'geometricPrecision' }}
    >
      <defs>
        <mask id={MASK_ID}>
          <rect x="1529.79" y="750" width="1381.33" height="1984.09" fill="white" />
          <ellipse cx={COUNTER.cx} cy={COUNTER.cy} rx={COUNTER.rx} ry={COUNTER.ry} fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${MASK_ID})`}>
        <path d={STEM} fill="currentColor" fillRule="nonzero" />
        <ellipse cx={BOWL.cx} cy={BOWL.cy} rx={BOWL.rx} ry={BOWL.ry} fill="currentColor" />
      </g>
      <path d={DOT} fill={dot} />
    </svg>
  )
}
