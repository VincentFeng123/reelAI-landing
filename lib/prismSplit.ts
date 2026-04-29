import * as THREE from "three";
import { Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type SliceIndex = 0 | 1 | 2 | 3;

/**
 * Slice index 0..3 maps top → bottom along world Y, matching the existing
 * pillar stages in vertical reading order:
 *   0 = top    (Search)
 *   1 = upper  (Transcript)
 *   2 = lower  (Segmentation)
 *   3 = bottom (Ranking)
 */
export const SLICE_COUNT = 4;

export type SplitResult = {
  /** One BufferGeometry per horizontal slice, in cloned-scene local space. */
  chunks: THREE.BufferGeometry[];
  /** Centroid of each chunk's bounding box (cloned-scene local space). */
  centers: THREE.Vector3[];
  /**
   * Outward direction for each chunk's explode translation. For horizontal
   * slabs this is primarily ±Y — top chunk pushes up, bottom pushes down,
   * middle chunks push slightly toward their own side of centre.
   */
  outwardDirs: THREE.Vector3[];
};

/**
 * Walks every mesh in `scene`, bakes its local-chain transform into a copy of
 * its position attribute, merges all baked geometries into one, then CSG-
 * intersects the merged geometry against four horizontal slab boxes (split
 * planes at the model's Y quartiles) to produce four chunk geometries
 * stacked top-to-bottom.
 *
 * Designed to run inside a useMemo at component mount. ~50–200 ms for a
 * ~10k-tri model. Skips index/UV preservation work that mergeGeometries
 * already handles — the CSG step preserves UVs on original surfaces and
 * leaves cap faces with default (0,0) UVs.
 */
/**
 * Bake every mesh's local-chain transform into its position attribute and
 * merge into one BufferGeometry. Exported so `Prism.tsx` can build a
 * single uncut whole-model mesh for the loader-to-hero transition (so
 * the section-II fracture cavities never alpha-blend through).
 */
export function bakeAndMerge(scene: THREE.Object3D): THREE.BufferGeometry {
  scene.traverse((obj) => obj.updateMatrix());

  const transformedGeometries: THREE.BufferGeometry[] = [];

  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;

    const chain: THREE.Matrix4[] = [m.matrix.clone()];
    let parent: THREE.Object3D | null = m.parent;
    while (parent && parent !== scene) {
      chain.unshift(parent.matrix.clone());
      parent = parent.parent;
    }
    chain.unshift(scene.matrix.clone());

    const composed = new THREE.Matrix4();
    for (const mat of chain) composed.multiply(mat);

    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", src.attributes.position.clone());
    if (src.attributes.normal) {
      g.setAttribute("normal", src.attributes.normal.clone());
    }
    if (src.attributes.uv) {
      g.setAttribute("uv", src.attributes.uv.clone());
    }
    g.applyMatrix4(composed);
    transformedGeometries.push(g);

    if (src !== m.geometry) src.dispose();
  });

  if (transformedGeometries.length === 0) {
    throw new Error("bakeAndMerge: scene contains no meshes");
  }

  const merged = mergeGeometries(transformedGeometries);
  for (const g of transformedGeometries) g.dispose();
  if (!merged) throw new Error("bakeAndMerge: failed to merge geometries");
  if (!merged.attributes.normal) merged.computeVertexNormals();
  return merged;
}

export function splitSceneIntoQuadrants(scene: THREE.Object3D): SplitResult {
  const merged = bakeAndMerge(scene);

  merged.computeBoundingBox();
  const bbox = merged.boundingBox!;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  // Slab boxes are generously oversized in X and Z so the prism's silhouette
  // is fully contained on intersection regardless of where its widest features
  // sit relative to the slice plane.
  const reach = Math.max(size.x, size.y, size.z) * 4;

  // Four horizontal slabs split at Y = quartiles of the model's Y range.
  // We add a small overshoot at the very top and bottom so the outermost
  // slabs fully include the model's caps.
  const yMin = bbox.min.y - 0.001;
  const yMax = bbox.max.y + 0.001;
  const span = yMax - yMin;
  const overshoot = span * 0.5;
  // Uneven slab heights — gives the dissection a "shattered shard" feel
  // instead of mechanical equal slices. Slab 3 (bottom) is the slimmest,
  // slab 2 is the widest, top is moderate.
  const yBoundaries = [
    yMin - overshoot, // bottom of slab 3
    yMin + span * 0.18,
    yMin + span * 0.52,
    yMin + span * 0.78,
    yMax + overshoot, // top of slab 0
  ];

  // Slab order top → bottom: index 0 = topmost slab (between yBoundaries[3..4]),
  // index 3 = bottom slab (between yBoundaries[0..1]).
  const slabs = [
    { yLow: yBoundaries[3], yHigh: yBoundaries[4] }, // 0 — top
    { yLow: yBoundaries[2], yHigh: yBoundaries[3] }, // 1 — upper
    { yLow: yBoundaries[1], yHigh: yBoundaries[2] }, // 2 — lower
    { yLow: yBoundaries[0], yHigh: yBoundaries[1] }, // 3 — bottom
  ];

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  const sourceBrush = new Brush(merged);
  sourceBrush.updateMatrixWorld();

  const chunks: THREE.BufferGeometry[] = [];
  const centers: THREE.Vector3[] = [];
  const outwardDirs: THREE.Vector3[] = [];
  const yMid = (yMin + yMax) / 2;

  for (const slab of slabs) {
    const sliceHeight = slab.yHigh - slab.yLow;
    const boxGeom = new THREE.BoxGeometry(reach, sliceHeight, reach);
    const boxBrush = new Brush(boxGeom);
    boxBrush.position.set(0, (slab.yLow + slab.yHigh) / 2, 0);
    boxBrush.updateMatrixWorld();

    const result = evaluator.evaluate(sourceBrush, boxBrush, INTERSECTION);
    // result.geometry is owned by the brush; clone so we can dispose the
    // brush wrapper without losing the buffer.
    const chunkGeom = result.geometry.clone();
    chunkGeom.computeBoundingBox();

    const center = new THREE.Vector3();
    chunkGeom.boundingBox!.getCenter(center);

    // Outward vector is the centroid's Y offset from the model's vertical
    // centre — non-unit. Top slabs push more, middle slabs push less, so
    // adjacent slab gaps grow evenly at full explode.
    const outward = new THREE.Vector3(0, center.y - yMid, 0);
    if (outward.lengthSq() < 1e-6) outward.set(0, 0.001, 0);

    chunks.push(chunkGeom);
    centers.push(center);
    outwardDirs.push(outward);

    boxGeom.dispose();
  }

  merged.dispose();

  return { chunks, centers, outwardDirs };
}

// =============================================================================
// Per-chunk fracture — second-pass CSG that cuts small debris pieces off each
// chunk so the explode phase reads as a true uneven explosion (not 4 tidy
// slabs). Each call generates `count` randomly placed cube cuts; INTERSECTION
// extracts the debris piece, SUBTRACTION removes the same volume from the
// chunk so the main piece carries a matching hole.
// =============================================================================

export type DebrisPiece = {
  /** Debris BufferGeometry, in the same coordinate frame as its parent chunk. */
  geometry: THREE.BufferGeometry;
  /**
   * Outward unit vector the debris drifts along during explode. Roughly
   * radial from the chunk centroid, with a small random perpendicular kick
   * so neighbouring debris don't fly in parallel.
   */
  outward: THREE.Vector3;
  /** Random tumble rotation (radians) applied at full explode. */
  tumble: { x: number; y: number; z: number };
  /** Total outward distance at full explode (world units, ~0.18-0.4). */
  travel: number;
};

export type FractureResult = {
  main: THREE.BufferGeometry;
  debris: DebrisPiece[];
};

function fractureRandom(seedInit: number) {
  let seed = seedInit | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cuts `count` random small cube regions out of `chunkGeom` via CSG, returning
 * the chunk's holey main geometry plus an array of debris pieces (each with
 * its own outward direction, tumble, and travel distance for the explosion
 * animation).
 *
 * Cost: each cut runs two CSG ops (INTERSECTION to extract the debris,
 * SUBTRACTION to update the main). On a ~2k-tri chunk this is ~50-150 ms
 * total per chunk, run once at component mount inside a useMemo.
 *
 * The chunk geometry is expected to already be in chunkGroup-local space
 * (centroid at origin) — debris pieces inherit that frame so they ride
 * the chunkGroup transform alongside the main piece.
 *
 * `chunkOutward` (optional, in chunk-local frame which equals prism-local up
 * to a translation) is the direction the parent chunk itself travels during
 * explode (e.g. +Y for the top slab, –Y for the bottom). Debris outward is
 * heavily biased toward this so pieces fly AWAY from the prism centre and
 * don't drift into neighbouring chunks' space. Defaults to a unit-Y guess
 * if not provided.
 */
export function fractureChunk(
  chunkGeom: THREE.BufferGeometry,
  count: number,
  seed: number,
  chunkOutward?: THREE.Vector3,
): FractureResult {
  chunkGeom.computeBoundingBox();
  const bbox = chunkGeom.boundingBox;
  if (!bbox || bbox.isEmpty()) {
    return { main: chunkGeom.clone(), debris: [] };
  }
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const minExtent = Math.min(size.x, size.y, size.z);

  const random = fractureRandom(seed);
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  // Unit outward direction for the parent chunk — debris will be biased to
  // fly along this axis so a piece can't escape into the neighbouring slab.
  const baseOutward = (chunkOutward
    ? chunkOutward.clone()
    : new THREE.Vector3(0, 1, 0)
  ).normalize();
  if (baseOutward.lengthSq() < 1e-6) baseOutward.set(0, 1, 0);

  let mainBrush: Brush | null = new Brush(chunkGeom);
  mainBrush.updateMatrixWorld();

  const debris: DebrisPiece[] = [];

  // Track the main brush's triangle count between iterations so we can
  // validate that each SUBTRACTION actually cut something — if the count
  // is unchanged, the box didn't meaningfully overlap the chunk and we
  // should reject the debris (otherwise we'd render a debris piece with
  // no matching hole in the main).
  const triCount = (b: Brush) =>
    (b.geometry.attributes.position?.count ?? 0) / 3;

  // Sphere-bound rejection sampling. Each accepted cut box is recorded
  // as a centre + safe radius (half its 3D diagonal). A new candidate
  // box is rejected when ANY existing box's safe-radius sphere overlaps
  // its own with a 1.15 spacing factor — guarantees no two debris pieces
  // share volume, which `three-bvh-csg` alone wouldn't enforce on
  // independently sampled cubes.
  type PlacedBox = { centre: THREE.Vector3; safeRadius: number };
  const placedBoxes: PlacedBox[] = [];
  const SPACING_FACTOR = 1.15;
  const overlapsExisting = (centre: THREE.Vector3, radius: number) => {
    for (const p of placedBoxes) {
      const minDist = (radius + p.safeRadius) * SPACING_FACTOR;
      if (centre.distanceToSquared(p.centre) < minDist * minDist) return true;
    }
    return false;
  };

  // Allow many attempts because rejection (overlap, CSG no-op, sliver
  // filter) is expected — we want as many genuinely successful cuts as
  // the chunk can hold up to `count`.
  const MAX_ATTEMPTS = count * 18;
  let attempts = 0;

  // Cutter: plain BoxGeometry with non-cubic dimensions. This is the
  // proven-reliable shape — three-bvh-csg cuts it cleanly through the
  // chunk surface every time, so the tri-count validation passes and we
  // actually ship debris. Organic-feel comes from per-axis dimension
  // variation + random Y-axis rotation applied to the brush below.
  const buildOrganicCutter = (
    width: number,
    height: number,
    depth: number,
  ): { geometry: THREE.BufferGeometry; safeRadius: number } | null => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const safeRadius =
      Math.sqrt(width * width + height * height + depth * depth) * 0.5;
    return { geometry, safeRadius };
  };

  while (debris.length < count && attempts < MAX_ATTEMPTS && mainBrush) {
    attempts++;

    // Power-shaped size distribution: most cutters are small, a few are
    // bigger — gives a natural mix of debris sizes. Each axis varies
    // independently so cutters aren't cubic.
    const sizeRoll = random();
    const sizeFactor = 0.20 + Math.pow(sizeRoll, 1.5) * 0.32;
    const cutW = minExtent * sizeFactor * (0.85 + random() * 0.45);
    const cutH = minExtent * sizeFactor * (0.85 + random() * 0.45);
    const cutD = minExtent * sizeFactor * (0.85 + random() * 0.45);

    // Pick a random axis + sign for the cutter to "break out through".
    // The cutter's centre is placed near (and just inside of) that face
    // of the chunk's bbox so the cutter volume STRADDLES the boundary —
    // some inside the chunk, some outside. CSG SUBTRACTION then carves
    // a cavity that opens to the chunk's external surface, never an
    // invisible interior bubble. The other two axes pick a random
    // position inside the bbox so the breakout is on a single face,
    // not a corner.
    const exitAxis = Math.floor(random() * 3); // 0=X, 1=Y, 2=Z
    const exitSign = random() < 0.5 ? -1 : 1;
    const halves = [cutW * 0.5, cutH * 0.5, cutD * 0.5];
    const minBound = [bbox.min.x, bbox.min.y, bbox.min.z];
    const maxBound = [bbox.max.x, bbox.max.y, bbox.max.z];
    // Centre lies between (face − 0.85 × halfExit) and (face − 0.20 × halfExit)
    // on the inside of the chosen face — so the cutter pokes out by
    // 0.20 to 0.85 of its half-extent through that face.
    const insetFactor = 0.20 + random() * 0.65;
    const halfExit = halves[exitAxis];
    const facePos =
      exitSign > 0 ? maxBound[exitAxis] : minBound[exitAxis];
    const exitPos = facePos - exitSign * halfExit * insetFactor;
    const positions = [0, 0, 0];
    positions[exitAxis] = exitPos;
    for (let a = 0; a < 3; a++) {
      if (a === exitAxis) continue;
      const halfA = halves[a];
      const lo = minBound[a] + halfA;
      const hi = maxBound[a] - halfA;
      if (hi > lo) {
        positions[a] = lo + random() * (hi - lo);
      } else {
        // Cutter is wider than the chunk on this axis — centre it.
        positions[a] = (minBound[a] + maxBound[a]) * 0.5;
      }
    }

    const candidateCentre = new THREE.Vector3(
      positions[0],
      positions[1],
      positions[2],
    );

    const cutter = buildOrganicCutter(cutW, cutH, cutD);
    if (!cutter) continue;

    // Sphere-overlap pre-check before paying for CSG.
    if (overlapsExisting(candidateCentre, cutter.safeRadius)) {
      cutter.geometry.dispose();
      continue;
    }

    // Yaw-only rotation — keeps the box upright so its top/bottom faces
    // stay axis-aligned in Y. Empirically this gives the most reliable
    // CSG cuts; full 3D rotation produces grazing-edge cases that fail
    // the tri-count validation often enough to leave us with no debris.
    const rotY = (random() - 0.5) * Math.PI;

    const boxGeom = cutter.geometry;
    const boxBrush = new Brush(boxGeom);
    boxBrush.position.copy(candidateCentre);
    boxBrush.rotation.set(0, rotY, 0);
    boxBrush.updateMatrixWorld();

    const safeRadius = cutter.safeRadius;
    const trisBefore = triCount(mainBrush);

    let debrisGeom: THREE.BufferGeometry | null = null;
    try {
      const cloned = evaluator
        .evaluate(mainBrush, boxBrush, INTERSECTION)
        .geometry.clone();
      cloned.computeBoundingBox();
      const dbox = cloned.boundingBox;
      if (
        dbox &&
        !dbox.isEmpty() &&
        cloned.attributes.position &&
        cloned.attributes.position.count >= 9
      ) {
        // Only keep pieces with meaningful volume — tiny slivers look like
        // shader artifacts, not debris.
        const dsize = new THREE.Vector3();
        dbox.getSize(dsize);
        if (dsize.length() > 0.04) {
          debrisGeom = cloned;
        } else {
          cloned.dispose();
        }
      } else {
        cloned.dispose();
      }
    } catch {
      // CSG failures (e.g. on awkward geometry) are non-fatal — skip this
      // cut and keep iterating.
    }

    if (!debrisGeom) {
      boxGeom.dispose();
      continue;
    }

    let nextMain: THREE.BufferGeometry | null = null;
    try {
      nextMain = evaluator
        .evaluate(mainBrush, boxBrush, SUBTRACTION)
        .geometry.clone();
    } catch {
      // ignored
    }

    if (!nextMain) {
      // Subtraction failed → don't include this debris (would leave the
      // main chunk overlapping the debris).
      debrisGeom.dispose();
      boxGeom.dispose();
      continue;
    }

    // Validate: a real cut adds cap faces, so a successful SUBTRACTION
    // should INCREASE the triangle count of the main. If the count is
    // unchanged the box failed to actually clip the chunk (e.g. the
    // rotated cube grazed an edge and three-bvh-csg returned the input
    // verbatim) — drop the debris so we don't render a piece without a
    // matching hole.
    const trisAfter =
      (nextMain.attributes.position?.count ?? 0) / 3;
    if (trisAfter <= trisBefore) {
      debrisGeom.dispose();
      nextMain.dispose();
      boxGeom.dispose();
      continue;
    }

    debrisGeom.computeBoundingBox();
    const debrisCenter = new THREE.Vector3();
    debrisGeom.boundingBox!.getCenter(debrisCenter);

    // Lateral starburst: debris drifts AROUND the chunk in its own xz
    // plane, with a small y-tilt toward the chunk's outward axis. The
    // chunks are stacked vertically — letting debris fly meaningfully up
    // or down would push them into a neighbour's band, no matter how
    // small the travel. Spreading sideways instead keeps each chunk's
    // debris field inside its own slab y-band.
    //
    //   xz radial (debris position projected to chunk xz) → primary direction
    // + small y bias along chunk outward (so chunks 0/3 still have a hint
    //   of "blast forward" while chunks 1/2 stay almost flat)
    // + small xz kick for asymmetry
    const radial = new THREE.Vector3(debrisCenter.x, 0, debrisCenter.z);
    if (radial.lengthSq() < 1e-4) {
      // Debris near the chunk's vertical axis — fall back to a random xz
      // direction so it still flies somewhere instead of straight up/down.
      const angle = random() * Math.PI * 2;
      radial.set(Math.cos(angle), 0, Math.sin(angle));
    }
    radial.normalize();

    const yTilt = baseOutward.y * 0.18;

    const outward = new THREE.Vector3(radial.x, yTilt, radial.z);
    const kick = new THREE.Vector3(
      (random() - 0.5) * 0.35,
      // Y-kick is intentionally tiny so the lateral spread can't sneak a
      // piece into the neighbouring chunk via random fluctuation.
      (random() - 0.5) * 0.06,
      (random() - 0.5) * 0.35,
    );
    outward.add(kick).normalize();

    const tumble = {
      x: (random() - 0.5) * 2.6,
      y: (random() - 0.5) * 2.6,
      z: (random() - 0.5) * 2.6,
    };

    // Travel: 18-40% of the chunk's smallest extent, capped — debris should
    // settle NEAR the parent chunk, not fly off into space.
    const travel = minExtent * (0.45 + random() * 0.65);

    debris.push({ geometry: debrisGeom, outward, tumble, travel });
    // Lock this region — every subsequent candidate must clear it.
    placedBoxes.push({ centre: candidateCentre, safeRadius });

    mainBrush = new Brush(nextMain);
    mainBrush.updateMatrixWorld();

    boxGeom.dispose();
  }

  const main = mainBrush ? mainBrush.geometry.clone() : chunkGeom.clone();

  return { main, debris };
}

// =============================================================================
// Loader-shard builder — re-uses the volumetric pieces produced by
// `splitSceneIntoQuadrants` + `fractureChunk` (already CSG-cut 3D blocks of
// the model — same technique Houdini's "Voronoi Fracture" / Blender's "Cell
// Fracture" use, just with axis-aligned box cutters instead of full Voronoi
// cell polyhedra). For each chunk we expose its main piece and every debris
// piece as an independent shard so the loader can fly them in one-at-a-time.
//
// Output shards have geometry centered at origin (so their <group>'s
// rotation pivots around the shard's own centroid) and a `center` vector
// pointing to where they belong in the assembled prism (in scene-local
// coords — same frame `splitResult.centers[i]` lives in).
// =============================================================================

export type Shard = {
  /** Volumetric BufferGeometry, translated so centroid sits at origin. */
  geometry: THREE.BufferGeometry;
  /** Final assembled centroid position in scene-local space. */
  center: THREE.Vector3;
  /** 0 = bottom of prism, 1 = top — drives bottom-up assembly order. */
  yNormalized: number;
  /** Pre-assembly xz spread so shards don't all fall along a single column. */
  spreadX: number;
  spreadZ: number;
  /** Random initial rotation (radians) — lerps to identity during fly-in. */
  startRotation: { x: number; y: number; z: number };
};

function shredRandom(seedInit: number) {
  let s = seedInit | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shape of the splitResult that PrismParts already builds — re-exported so
 * Prism.tsx can receive it via callback from PrismParts and feed it into
 * `buildLoaderShards` without duplicating the CSG work.
 */
export type FullSplitResult = {
  centers: THREE.Vector3[];
  outwardDirs: THREE.Vector3[];
  yBounds: { top: number; bottom: number }[];
  fracturedChunks: FractureResult[];
};

/**
 * Convert a splitResult into a flat array of loader shards: every chunk's
 * main piece + every debris piece, each with its own scene-local centroid
 * and a centered geometry copy. Sorted ascending by world-Y so index 0 is
 * the bottom-most shard.
 *
 * Geometries are CLONED (and translated) so PrismParts retains the
 * originals for section II's chunk + debris rendering — the loader path
 * and the section-II path own independent BufferGeometry instances.
 */
export function buildLoaderShards(
  splitResult: FullSplitResult,
  seed: number,
): Shard[] {
  const random = shredRandom(seed);
  const shards: Shard[] = [];
  const centroidTmp = new THREE.Vector3();

  splitResult.fracturedChunks.forEach((fractured, i) => {
    const chunkCenter = splitResult.centers[i];

    // Main piece — its centroid is approximately at chunk-local origin
    // (input chunkGeom was shifted) but the SUBTRACTION cuts shift the
    // centroid slightly. Re-measure and re-center for an honest pivot.
    fractured.main.computeBoundingBox();
    const mainBox = fractured.main.boundingBox;
    if (
      mainBox &&
      !mainBox.isEmpty() &&
      fractured.main.attributes.position?.count >= 9
    ) {
      mainBox.getCenter(centroidTmp);
      const mainGeo = fractured.main.clone();
      mainGeo.translate(-centroidTmp.x, -centroidTmp.y, -centroidTmp.z);
      shards.push({
        geometry: mainGeo,
        center: new THREE.Vector3(
          chunkCenter.x + centroidTmp.x,
          chunkCenter.y + centroidTmp.y,
          chunkCenter.z + centroidTmp.z,
        ),
        yNormalized: 0,
        spreadX: (random() - 0.5) * 1.8,
        spreadZ: (random() - 0.5) * 1.8,
        startRotation: {
          x: (random() - 0.5) * 1.4,
          y: (random() - 0.5) * 1.4,
          z: (random() - 0.5) * 1.4,
        },
      });
    }

    // Debris pieces — same idea but smaller, with bigger random spread +
    // tumble since they read as "shrapnel" rather than "core mass."
    for (const piece of fractured.debris) {
      piece.geometry.computeBoundingBox();
      const dBox = piece.geometry.boundingBox;
      if (
        !dBox ||
        dBox.isEmpty() ||
        !piece.geometry.attributes.position ||
        piece.geometry.attributes.position.count < 9
      ) {
        continue;
      }
      dBox.getCenter(centroidTmp);
      const dGeo = piece.geometry.clone();
      dGeo.translate(-centroidTmp.x, -centroidTmp.y, -centroidTmp.z);
      shards.push({
        geometry: dGeo,
        center: new THREE.Vector3(
          chunkCenter.x + centroidTmp.x,
          chunkCenter.y + centroidTmp.y,
          chunkCenter.z + centroidTmp.z,
        ),
        yNormalized: 0,
        spreadX: (random() - 0.5) * 2.6,
        spreadZ: (random() - 0.5) * 2.6,
        startRotation: {
          x: (random() - 0.5) * 2.4,
          y: (random() - 0.5) * 2.4,
          z: (random() - 0.5) * 2.4,
        },
      });
    }
  });

  // Compute yNormalized across all shards (post-clone, so it reflects
  // their actual scene-local Y range, not the chunk-local one).
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of shards) {
    if (s.center.y < yMin) yMin = s.center.y;
    if (s.center.y > yMax) yMax = s.center.y;
  }
  const yHeight = Math.max(yMax - yMin, 0.001);
  for (const s of shards) {
    s.yNormalized = (s.center.y - yMin) / yHeight;
  }

  shards.sort((a, b) => a.yNormalized - b.yNormalized);
  return shards;
}
