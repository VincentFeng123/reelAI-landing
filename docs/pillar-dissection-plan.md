# Section II — Prism Dissection (anime.js-style)

Replaces the current `PillarSection` 2D-overlay leader-line treatment with a true exploded-view dissection of the prism, modeled on the anime.js homepage `#toolbox` section.

## Goal

The prism dissects into 4 chunks that translate outward. While they sit dissected, the user can hover (shows part name) and click (zooms to that part's stage). Continuing to scroll progresses through the 4 stages sequentially. Scroll-back returns to the explorable state.

## Anime.js technique we're replicating

Confirmed from the live anime.js source:

- 3D Three.js meshes, not 2D SVG. Pieces are real `.glb` modules positioned along z and separated by camera dolly during scroll.
- One fixed `<svg id="path-animation">` overlay, one `<polyline>` per piece, three points: `(card-edge, card-y) → (elbow, card-y) → (projectedX, projectedY)`. L-shaped, 1px solid stroke, `stroke-linejoin: square`. **No stroke-dashoffset draw-on.**
- Anchor `Object3D`s ride on each mesh; world position projected to screen via `vec.project(camera)` each frame.
- Endpoint lerps toward projected target each frame (`x = lerp(x, target, 0.25)`) — gives the trailing-elastic feel during scroll.
- Stagger 160–200 ms between pieces, easing `inOut(4)` ≈ GSAP `power4.inOut`.

## Geometry split — `three-bvh-csg`

CSG boolean against 4 quadrant boxes at load time. Watertight, capped chunks with preserved UVs on original surfaces. Cap faces get default `(0,0)` UVs and are assigned a solid darker "interior crystal" material.

- One-time precompute on a 10k-tri mesh: ~50–200 ms; do inside `useMemo` keyed on the loaded scene.
- Quadrant planes: world `x = 0` and `z = 0` → 4 chunks (++, +–, –+, ––).
- Existing `onBeforeCompile` reveal-sweep is applied per-chunk via `material.clone()` — all clones must share the **same** `revealRef.current` and `revealBandRef.current` uniform object refs so the sweep stays unified.
- Fallback if CSG misbehaves on this asset: centroid-bin partition (jagged seams; acceptable since chunks separate fast).

## File changes

**New:**
- `components/canvas/PrismParts.tsx` — replaces `<primitive object={cloned}>` in `Prism.tsx`. Owns CSG split, holds `chunkRefs[4]`, `anchorRefs[4]`, applies hover state, exposes positions for GSAP.
- `lib/prismSplit.ts` — pure function: `splitMeshIntoQuadrants(scene, options) → { chunks: BufferGeometry[4], anchors: Vector3[4], capMaterial }`.
- `components/sections/PillarLeaderOverlay.tsx` — fixed SVG + 4 polylines + 4 label cards. Lives outside the R3F canvas.
- `lib/pillarPartsState.ts` — small ref store: `anchorScreenX/Y[4]`, hovered index, focused index. Written from `useFrame`, read in the overlay rAF loop.

**Modified:**
- `components/canvas/Prism.tsx` — swap `<primitive>` for `<PrismParts />`. Outer/inner groups untouched.
- `components/sections/PillarSection.tsx` — major timeline rewrite (see choreography below).
- `lib/pillarRevealTimeline.ts` — add explore-zone constants.
- `lib/scrollState.ts` — add `pillarFocusedPart`, `pillarHoveredPart`, `pillarExploreActive`.

## Scroll choreography

Pin distance unchanged at `+=400%`. Progress band split:

| Progress | Phase |
| --- | --- |
| 0.00 – 0.06 | Pre-explore — prism arrives whole, no labels |
| 0.06 – 0.30 | **Explode** — 4 chunks translate outward, 4 leader lines + labels appear (stagger 160–200 ms, `power4.inOut`) |
| ~0.30 | **Snap-hold** — `ScrollTrigger.snap` to 0.30; user can hover/click |
| 0.30 – 0.48 | Stage I zoom (focus part 0) |
| 0.48 – 0.62 | Stage II zoom (focus part 1) |
| 0.62 – 0.76 | Stage III zoom (focus part 2) |
| 0.76 – 0.86 | Stage IV zoom (focus part 3) |
| 0.86 – 1.00 | Exit fade |

Snap config: `snap: { snapTo: [0.30], duration: 0.4, ease: "power2.inOut", delay: 0.05, inertia: false }`. If snap fights scrub during testing, fallback to a non-snapping "soft hold" where 6% of timeline is dead progress at 0.30.

Per-part zoom is three things synchronized in the timeline:
1. Focused chunk lerps toward camera (e.g. `position.z += 0.4`).
2. Sibling chunks dim to opacity 0.25.
3. Existing per-stage label/telemetry/quote reveal runs as today.

Per-stage π/2 inner rotation is **disabled** during the explore zone and **resumes** during 0.30 – 0.86.

## Interaction

Hover (gated on `pillarExploreActive`, i.e. `0.28 < progress < 0.32`):
- `onPointerOver` on chunk `N` → `pillarHoveredPart = N`, chunk lifts +0.15 toward camera, its leader-line stroke goes to 100%, others dim to 50%; label card `N` adds a hovered accent. `document.body.style.cursor = 'pointer'`.
- `onPointerOut` → reset.
- `e.stopPropagation()` in handler so only the front chunk fires.

Click (any time during explore zone):
- `onClick` on chunk `N` → compute target progress (midpoint of stage `N`'s band) → `gsap.to(window, { scrollTo: { y: triggerStart + (triggerEnd - triggerStart) * targetProgress }, duration: 0.9, ease: "power2.inOut" })`.
- Suppress snap-back during the click animation.

Outside the explore zone, chunks are non-pickable (`raycast = () => null` while gated off, or just check `pillarExploreActive` in handlers and bail).

## Leader-line overlay

`PillarLeaderOverlay.tsx`:

```
fixed-position <svg viewBox="0 0 vw vh">
  for i in 0..3:
    <polyline data-part={i}
              stroke={focused/hovered/inactive color}
              stroke-width="1"
              stroke-linejoin="square"
              fill="none"
              points={`${cardEdgeX},${cardY} ${elbowX},${cardY} ${anchorX},${anchorY}`} />
4 absolutely-positioned <div> label cards (re-use existing PillarSection markup: n/title/body/telemetry/quote)
```

`useEffect` rAF loop reads `pillarPartsState.anchorScreenX/Y[i]` and writes polyline `points`. Lerp endpoint with `target.lerp(current, 0.25)` matching anime.js's coefficient.

Card positions are fixed and match the current `labelInsetPct`/`labelTopPct` per stage. Only the third polyline point + line opacity change per frame.

Existing decorative SVG line work in `PillarSection.tsx` (caps, hash marks, elbow nodes, terminal rings) — keep as decoration on the **focused** leader line during stage walkthrough; hide during explore mode where 4 clean lines need to read.

## Anchor placement

Anchors are children of `spinRef`, **not** `outerRef`, so they ride the inner spin and stage rotation. World position computed via `getWorldPosition(target)` and projected with `target.project(camera)` inside the chunk's `useFrame`. Result written into `pillarPartsState.anchorScreenX/Y[i]`.

Anchor offset per chunk: from chunk centroid, slightly outward along its quadrant direction so the leader line doesn't visually originate from inside the geometry.

## Open implementation risks

1. **CSG cap UVs** — cut surfaces need a custom material; tri-planar shader on caps if interior reads weird (~30 min spike).
2. **Reveal-sweep + per-chunk clone** — uniform refs must be shared object identity across all 4 clones, otherwise the sweep desyncs.
3. **ScrollTrigger snap vs scrub** — known wart; fallback to soft-hold if snap behaves badly.
4. **Anchor projection accuracy** — anchors must be on `spinRef`, not `outerRef`; otherwise leader lines drift off chunks during stage rotation.
5. **Hover gating during fast scroll** — hard check `progress > 0.31 → disable picking`.

## Build phases (ship order)

1. **Split + render** — land CSG, 4 chunks rendering identically to current. Verify reveal-sweep still works across all 4 cloned materials.
2. **Static explosion** — hard-code outward chunk positions. See the dissected look at rest. Add anchor `Object3D`s.
3. **Leader overlay v0** — SVG + polylines + projection loop. Verify lines track anchors during idle spin.
4. **Timeline rewrite** — explode (0.06–0.30), snap-hold, sequential zooms (0.30–0.86), exit fade unchanged.
5. **Hover/click** — wire interactions, gate on explore zone.
6. **Polish** — cap material, leader-line stroke states (inactive/hovered/focused), telemetry cards re-anchored to projected points, integration with existing exit fade.

## Decisions locked

- Geometry split: option 1b (procedural) via `three-bvh-csg` + bit-of-3 (anime.js-style 2D SVG overlay leaders).
- Parts map 1:1 to existing 4 stages (Search / Transcript / Segmentation / Ranking).
- Hover shows part name; click zooms (skips remaining scroll).
- Scroll choreography: 25% explore + 75% sequential walkthrough.
- Existing telemetry/quote-rich label style retained.
- Scroll-back into explore zone re-engages all 4 parts as interactive.
