/**
 * Full-bleed scenic hero background -- a layered mountain panorama at
 * dawn with a sunrise glow and a quiet trail line climbing a distant
 * peak, evoking the Pathways visual reference concepts' "large
 * aspirational hero photography" without actually being photography.
 *
 * This is a documented substitute, not a stylistic choice: Phase 2B
 * asked for real licensed photography here, but this sandbox's
 * network egress policy blocks every external image/stock-photo host
 * (tested directly against Wikimedia Commons, Unsplash, Pexels, and a
 * neutral control domain -- all rejected by the egress proxy, while
 * package registries and Google Fonts remain reachable). See
 * docs/pathways/MEDIA_SOURCE_REGISTER.md for the full test record and
 * what swapping in real photography later would involve. Purely
 * decorative, so aria-hidden.
 */
export function HeroArt() {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-navy-900)" />
          <stop offset="55%" stopColor="var(--color-navy-700)" />
          <stop offset="82%" stopColor="var(--color-blue-600)" />
          <stop offset="100%" stopColor="var(--color-green-500)" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9b8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe9b8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="1600" height="900" fill="url(#sky)" />

      {/* Sun / horizon glow */}
      <circle cx="1150" cy="620" r="260" fill="url(#sun)" />
      <circle cx="1150" cy="620" r="70" fill="#fff4d6" opacity="0.9" />

      {/* Distant mountain layer (hazy, furthest back) */}
      <path
        d="M0,640 L160,540 320,610 480,520 660,600 840,500 1020,590 1200,510 1380,585 1600,530 1600,900 0,900 Z"
        fill="var(--color-navy-600)"
        opacity="0.55"
      />

      {/* Mid mountain layer */}
      <path
        d="M0,720 L200,600 420,690 640,570 860,680 1080,590 1300,700 1600,610 1600,900 0,900 Z"
        fill="var(--color-navy-700)"
        opacity="0.75"
      />

      {/* Foreground mountain layer (darkest, closest) */}
      <path
        d="M0,820 L140,700 300,780 500,650 720,760 940,670 1160,790 1380,680 1600,760 1600,900 0,900 Z"
        fill="var(--color-navy-900)"
      />

      {/* Trail / pathway line climbing a foreground peak on the right
          side of the scene (clear of the text column at every
          breakpoint), echoing "pathways" branching -- a quiet brand
          callback, not a literal map. */}
      <path
        d="M760,900 C830,830 900,800 960,745 C1010,700 1040,680 1090,635"
        fill="none"
        stroke="var(--color-green-500)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 18"
        opacity="0.85"
      />
    </svg>
  );
}
