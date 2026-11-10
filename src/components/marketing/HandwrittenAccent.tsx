import styles from "./HandwrittenAccent.module.css";

/**
 * A decorative handwritten-style phrase (Phase 2B visual direction),
 * used sparingly. Always aria-hidden -- it exists to echo something
 * already stated in visible, readable text nearby, never to carry
 * meaning of its own (per the accessibility requirement that
 * decorative text duplicating visible meaning be hidden from screen
 * readers).
 */
export function HandwrittenAccent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={className ? `${styles.accent} ${className}` : styles.accent}>
      {children}
    </span>
  );
}
