/**
 * Phase 3D: scrolls the Discovery questionnaire's progress/stage
 * region back into view after a stage change (Continue/Back/Edit
 * from Review, and Demo Complete/Restart in Preview Demo Mode), and
 * moves focus there for keyboard/screen-reader users.
 *
 * The sticky site header's height is measured live from the actual
 * rendered `<header>` element rather than hard-coded, since its
 * height is not a fixed CSS constant (it can differ by breakpoint or
 * content); this keeps the offset correct without a brittle guess.
 * Motion is skipped entirely when the visitor has requested reduced
 * motion.
 */
export function scrollStageIntoView(target: HTMLElement | null): void {
  if (!target || typeof window === "undefined") return;

  const header = document.querySelector("header");
  const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  target.style.scrollMarginTop = `${headerHeight + 16}px`;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });

  // preventScroll avoids a second, conflicting jump from focus() itself.
  // tabIndex={-1} on the target (set by each caller) is what makes this
  // focusable at all -- whether a visible ring then appears is entirely
  // the browser's own :focus-visible heuristic (keyboard-triggered
  // navigation shows one, a mouse click typically does not), not
  // anything controlled here.
  target.focus({ preventScroll: true });
}
