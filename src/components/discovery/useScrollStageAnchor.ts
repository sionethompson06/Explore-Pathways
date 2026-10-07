"use client";

import { useEffect, useRef } from "react";
import { scrollStageIntoView } from "./scrollStageIntoView";

/**
 * Returns a ref to attach to the element that should come back into
 * view whenever `activeKey` changes (Phase 3D). Deliberately skips
 * the very first render -- a freshly loaded page is already scrolled
 * to its top, and stealing focus on mount (rather than only on an
 * actual in-page stage change) would be a real, if minor, surprise
 * for a visitor who just landed here from a link or a reload.
 *
 * Tracks the previous `activeKey` in a ref (initialized to the SAME
 * value on first render) rather than a separate "have I mounted yet"
 * boolean: under React StrictMode's dev-only double-invoke of an
 * effect on mount, a boolean flag flipped inside the effect body
 * would already read "true" on the second (simulated-remount)
 * invocation, firing a spurious scroll+focus grab on page load. A
 * value comparison against the render that set it stays correctly
 * "unchanged" across both invocations, so it only ever fires on a
 * genuine `activeKey` change.
 */
export function useScrollStageAnchor<T extends HTMLElement>(activeKey: string) {
  const ref = useRef<T>(null);
  const previousKeyRef = useRef(activeKey);

  useEffect(() => {
    if (previousKeyRef.current === activeKey) return;
    previousKeyRef.current = activeKey;
    scrollStageIntoView(ref.current);
  }, [activeKey]);

  return ref;
}
