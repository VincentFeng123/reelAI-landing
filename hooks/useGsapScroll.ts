"use client";
import { useLayoutEffect, useRef, RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Setup = (ctx: gsap.Context) => void;

/**
 * Run GSAP setup scoped to a ref using gsap.context for cleanup.
 * Returns the ref to attach to the root element.
 */
export function useGsapScroll<T extends HTMLElement = HTMLElement>(
  setup: Setup,
  deps: ReadonlyArray<unknown> = [],
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(setup, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export { gsap, ScrollTrigger };
