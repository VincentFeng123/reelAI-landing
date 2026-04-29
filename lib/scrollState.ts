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
 * - prismTargetX/Y/RotY/RotZ : per-section prism placement targets (set by PrismController)
 *   prismTargetRotZ is added on top of the base TILT_Z constant in Prism.tsx
 */
export const scrollState = {
  progress: 0,
  heroProgress: 0,
  pillarSectionProgress: 0,
  pillarActiveStage: 0,
  pillarStageSubProgress: 0,
  pillarTargetScale: 1.35,
  carouselVisible: false,
  carouselProgress: 0,
  velocity: 0,
  height: 0,
  pointerX: 0,
  pointerY: 0,
  pointerLerpedX: 0,
  pointerLerpedY: 0,
  // Defaults match PrismController's loaderActive branch (x=-1.2, y=0.1,
  // rotY=-0.45, rotZ=0, scale=1.35) so any read BEFORE PrismController's
  // first raf tick produces loader-pose targets — without this, Prism's
  // first useFrame can lerp toward (0,0,0)/scale=0.95 for a frame and the
  // shard assembly visibly drifts away from where the loader-overlay
  // expects the prism to sit.
  prismTargetX: -1.2,
  prismTargetY: 0.1,
  prismTargetRotY: -0.45,
  prismTargetRotZ: 0,
  /** Pillar dissection state — written by PillarSection's scrub timeline. */
  pillarExplodeAmount: 0,
  /** -1 outside the focus phase, else 0..3 indexing the focused chunk. */
  pillarFocusedPart: -1 as -1 | 0 | 1 | 2 | 3,
  /**
   * Continuous 0..1 zoom amount for the currently focused chunk. Smoothstepped
   * up at the start of the phase, held at 1 for the bulk of it, smoothstepped
   * back down at the end. Camera offset, chunk-opacity fade, leader-card
   * position+text fade are all driven from this single value so every
   * transition reads as one continuous blend (no integer-flip jumps).
   */
  pillarFocusBlend: 0,
  /** True during the soft-hold band between explode-complete and stage-1 focus. */
  pillarExploreActive: false,
  /**
   * Scroll progress 0..1 within the currently active dissection phase
   * (overview or one of the four focus windows). Consumers like the leader
   * overlay use it to drive scroll-tied dot/text reveals instead of timers.
   */
  pillarPhaseProgress: 0,
  /**
   * Active phase index inside section II. -1 outside the dissection band,
   * 0 = overview, 1..4 = focus on chunk 0..3. Used by the prominent top
   * progress bar to paint the current segment.
   */
  pillarActivePhase: -1,
  /**
   * Per-chunk reveal value (0 = white clay, 1 = fully textured). Each
   * chunk's value ramps 0→1 inside its focus phase so the white is fully
   * gone before the camera zooms out and jumps to the next chunk.
   */
  pillarChunkReveal: [0, 0, 0, 0] as [number, number, number, number],
  /**
   * Focused chunk's centroid in spinRef-local space. Written by PrismParts
   * each frame; read by Prism.tsx to compute the outer translation that
   * "zooms" the camera to centre the chunk while the section is in focus.
   */
  pillarFocusLocalX: 0,
  pillarFocusLocalY: 0,
  pillarFocusLocalZ: 0,
  /**
   * Loading phase. While `loaderActive` is true, the prism renders as a
   * wireframe (chunks invisible, edges bright) and particles flow toward
   * the surface using `loaderProgress` (0..1) as their sweep value. When
   * `loaderActive` flips to false, the prism shifts/rotates from the
   * loader pose to the hero pose, the chunk material fades in, the edges
   * fade out, and the loader text slides up.
   */
  loaderActive: true,
  loaderProgress: 0,
  /**
   * Set true by PrismParts the first frame after CSG split + per-chunk
   * particle fields are mounted. LoadingScreen waits for this before
   * starting its fill ramp (and before the minDisplay timer) so the
   * particle fill is guaranteed to play even when the 33 MB GLB +
   * synchronous CSG/sampling push the prism mount past the original
   * 1.8 s loader window. Once true, never reset (HMR-safe).
   */
  prismReady: false,
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
