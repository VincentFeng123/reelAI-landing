# GSAP Cinematic Scroll Skill

When building scroll-based landing pages:

## Core Rules
- Use GSAP + ScrollTrigger for all scroll-linked motion.
- Prefer one master timeline per major section.
- Use `scrub: true` for cinematic scroll control.
- Use `pin: true` only for major story moments.
- Animate only transform and opacity when possible.
- Avoid animating width, height, top, left, margin, or padding.
- Use `gsap.context()` in React and clean up on unmount.

## Animation Style
- Motion should feel premium, slow, intentional, and cinematic.
- Avoid random bouncing, spinning, or childish effects.
- Use depth: foreground, middle ground, background.
- Use staggered reveals for cards, text, and media.
- Use easing like `power2.out`, `power3.inOut`, `expo.out`.

## ScrollTrigger Defaults
- Use clear trigger sections.
- Use `start: "top top"` for pinned scenes.
- Use `end: "+=1500"` or longer for cinematic sections.
- Use `scrub: 1` for smooth delay.
- Use `invalidateOnRefresh: true`.
- Add mobile fallbacks.