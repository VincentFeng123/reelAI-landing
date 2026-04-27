# Performance Motion Skill

All animations must be smooth and production-ready.

## Rules
- Use transform and opacity.
- Avoid layout-triggering animation.
- Use `will-change` only on active animated elements.
- Clean up all GSAP timelines and ScrollTriggers.
- Debounce resize logic.
- Use lazy loading for heavy scenes.
- Use image/video compression.
- Reduce particle count on mobile.
- Add reduced-motion support.

## React Rules
- Use refs instead of querying the whole document when possible.
- Use `useLayoutEffect` for GSAP setup.
- Use `gsap.context()` for cleanup.
- Never create ScrollTriggers repeatedly without killing old ones.