/**
 * Abstract decorative art for the hero -- overlapping "branching
 * path" strokes, not a photograph. Purely decorative (aria-hidden);
 * no person, testimonial or claim is depicted. See
 * docs/pathways/MEDIA_SOURCE_REGISTER.md.
 */
export function HeroArt() {
  return (
    <svg
      viewBox="0 0 480 420"
      aria-hidden="true"
      focusable="false"
      style={{ width: "100%", height: "auto" }}
    >
      <circle cx="240" cy="210" r="200" fill="var(--color-accent-tint)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M70 300 C 140 260, 150 190, 110 120"
          stroke="var(--color-navy-700)"
          strokeWidth="6"
          opacity="0.35"
        />
        <path
          d="M90 320 C 170 300, 220 230, 200 140 C 190 95, 230 60, 280 55"
          stroke="var(--color-navy-800)"
          strokeWidth="7"
        />
        <path
          d="M200 140 C 250 160, 300 150, 330 110"
          stroke="var(--color-teal-600)"
          strokeWidth="7"
        />
        <path
          d="M200 140 C 190 200, 230 250, 300 260"
          stroke="var(--color-teal-500)"
          strokeWidth="6"
          opacity="0.85"
        />
        <path
          d="M300 260 C 350 275, 390 260, 410 220"
          stroke="var(--color-navy-700)"
          strokeWidth="6"
          opacity="0.7"
        />
      </g>
      <circle cx="90" cy="320" r="9" fill="var(--color-navy-900)" />
      <circle cx="280" cy="55" r="8" fill="var(--color-teal-600)" />
      <circle cx="330" cy="110" r="8" fill="var(--color-teal-500)" />
      <circle cx="300" cy="260" r="8" fill="var(--color-teal-600)" />
      <circle cx="410" cy="220" r="9" fill="var(--color-navy-800)" />
    </svg>
  );
}
