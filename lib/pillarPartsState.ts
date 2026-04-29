/**
 * Shared store for pillar dissection state — written by the Three.js scene
 * (PrismParts inside the R3F canvas), read by the DOM-side leader overlay
 * (PillarLeaderOverlay running its own rAF loop).
 *
 * - anchorTargetX/Y : raw projected screen-space pixel coords for each chunk's
 *                     anchor Object3D, written every useFrame.
 * - anchorVisible   : false when the anchor is behind the camera (clip z>1)
 *                     or to either side of the frustum — the overlay can hide
 *                     that polyline.
 * - hoveredPart     : 0..3 when hovering a chunk during the explore zone, else -1.
 * - focusedPart     : 0..3 when a stage is locked, else -1.
 * - exploreActive   : true while the timeline sits in the explore zone where
 *                     hover/click on chunks is enabled.
 */
export const pillarPartsState = {
  anchorTargetX: [0, 0, 0, 0],
  anchorTargetY: [0, 0, 0, 0],
  anchorVisible: [false, false, false, false],
  hoveredPart: -1 as -1 | 0 | 1 | 2 | 3,
  focusedPart: -1 as -1 | 0 | 1 | 2 | 3,
  exploreActive: false,
  /**
   * Click intent — set to a chunk index when the user clicks a chunk; the
   * pillar timeline component picks this up, scrolls to that chunk's focus
   * midpoint, then resets to -1.
   */
  pendingClickFocus: -1 as -1 | 0 | 1 | 2 | 3,
};
