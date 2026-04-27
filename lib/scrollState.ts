/**
 * Tiny shared store for scroll + pointer + section state.
 *
 * - progress              : 0..1 over the entire scroll range
 * - heroProgress          : 0..1 over the *first viewport* of scroll
 * - pillarSectionProgress : 0..1 over the pillar section's pinned scroll
 * - pillarActiveStage     : 0..3, integer index of the currently focused stage
 * - pillarStageSubProgress: 0..1, progress within the active stage
 * - pillarTargetScale     : target scale for the pillar (lerped in Prism)
 * - carouselVisible       : reel ribbon should fade in (during demo section)
 * - pointerLerpedX/Y      : smoothed pointer (any consumer can read same signal)
 * - prismTargetX/Y/RotY   : per-section prism placement targets (set by PrismController)
 */
export const scrollState = {
  progress: 0,
  heroProgress: 0,
  pillarSectionProgress: 0,
  pillarActiveStage: 0,
  pillarStageSubProgress: 0,
  pillarTargetScale: 0.95,
  carouselVisible: false,
  carouselProgress: 0,
  velocity: 0,
  height: 0,
  pointerX: 0,
  pointerY: 0,
  pointerLerpedX: 0,
  pointerLerpedY: 0,
  prismTargetX: 0,
  prismTargetY: 0,
  prismTargetRotY: 0,
};

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}
