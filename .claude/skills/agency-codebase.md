# Agency Codebase Skill

Code must be clean, modular, and maintainable.

## Structure
Use clear folders:
- components/
- sections/
- animations/
- hooks/
- lib/
- styles/

## Rules
- Separate animation logic from layout when possible.
- Reuse animation hooks.
- Keep components focused.
- Avoid giant single-file pages unless explicitly requested.
- Use semantic HTML.
- Make responsive behavior intentional.
- Add comments only where the logic is non-obvious.

## Animation Architecture
Create reusable helpers:
- `useGsapScroll()`
- `useReducedMotion()`
- `createScrollTimeline()`
- `killScrollTriggers()`