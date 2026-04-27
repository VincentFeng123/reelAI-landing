import gsap from "gsap";

export const easings = {
  in: "power2.out",
  inOut: "power3.inOut",
  expo: "expo.out",
  cinema: "expo.inOut",
} as const;

export const durations = {
  micro: 0.35,
  short: 0.6,
  medium: 1.1,
  long: 1.8,
  cinematic: 2.4,
} as const;

/**
 * Reveal helper — fades in from a downward shift.
 */
export function revealY(
  target: gsap.TweenTarget,
  opts: gsap.TweenVars = {},
) {
  return gsap.fromTo(
    target,
    { y: 60, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: durations.short,
      ease: easings.expo,
      stagger: 0.08,
      ...opts,
    },
  );
}

/**
 * Animate a long phrase by splitting into characters via spans the caller wraps.
 * The caller should render `<span class="char">` per character.
 */
export function revealChars(
  selector: string,
  ctx: HTMLElement,
  opts: gsap.TweenVars = {},
) {
  const els = ctx.querySelectorAll(selector);
  return gsap.fromTo(
    els,
    { yPercent: 110, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: durations.medium,
      ease: easings.expo,
      stagger: 0.018,
      ...opts,
    },
  );
}
