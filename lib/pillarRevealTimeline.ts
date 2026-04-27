export const PILLAR_STAGE_ENTER = 0.06;
export const PILLAR_STAGE_WINDOW = 0.22;
export const PILLAR_LABEL_REVEAL_OFFSET = 0.1;
export const PILLAR_REVEAL_COMPLETE = 0.96;
export const PILLAR_REVEAL_Y_TOP = 2.4;
export const PILLAR_REVEAL_Y_BOTTOM = -2.4;

export const PILLAR_STAGE_BEGINS = [0.06, 0.28, 0.5, 0.72] as const;
export const PILLAR_STAGE_DOT_Y_PCTS = [28, 44, 52, 70] as const;

export const PILLAR_REVEAL_ANCHORS = [
  {
    progress: PILLAR_STAGE_BEGINS[0] + PILLAR_LABEL_REVEAL_OFFSET,
    ratio: PILLAR_STAGE_DOT_Y_PCTS[0] / 100,
  },
  {
    progress: PILLAR_STAGE_BEGINS[1] + PILLAR_LABEL_REVEAL_OFFSET,
    ratio: PILLAR_STAGE_DOT_Y_PCTS[1] / 100,
  },
  {
    progress: PILLAR_STAGE_BEGINS[2] + PILLAR_LABEL_REVEAL_OFFSET,
    ratio: PILLAR_STAGE_DOT_Y_PCTS[2] / 100,
  },
  {
    progress: PILLAR_STAGE_BEGINS[3] + PILLAR_LABEL_REVEAL_OFFSET,
    ratio: PILLAR_STAGE_DOT_Y_PCTS[3] / 100,
  },
] as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function getPillarRevealRatio(progress: number) {
  const p = clamp01(progress);
  const first = PILLAR_REVEAL_ANCHORS[0];
  const last = PILLAR_REVEAL_ANCHORS[PILLAR_REVEAL_ANCHORS.length - 1];

  if (p <= first.progress) {
    return lerp(0, first.ratio, p / first.progress);
  }

  for (let i = 0; i < PILLAR_REVEAL_ANCHORS.length - 1; i++) {
    const a = PILLAR_REVEAL_ANCHORS[i];
    const b = PILLAR_REVEAL_ANCHORS[i + 1];
    if (p <= b.progress) {
      return lerp(a.ratio, b.ratio, (p - a.progress) / (b.progress - a.progress));
    }
  }

  if (p >= PILLAR_REVEAL_COMPLETE) return 1;
  return lerp(
    last.ratio,
    1,
    (p - last.progress) / (PILLAR_REVEAL_COMPLETE - last.progress),
  );
}

export function getPillarRevealProgressForRatio(ratio: number) {
  const r = clamp01(ratio);
  const first = PILLAR_REVEAL_ANCHORS[0];
  const last = PILLAR_REVEAL_ANCHORS[PILLAR_REVEAL_ANCHORS.length - 1];

  if (r <= first.ratio) {
    return lerp(0, first.progress, r / first.ratio);
  }

  for (let i = 0; i < PILLAR_REVEAL_ANCHORS.length - 1; i++) {
    const a = PILLAR_REVEAL_ANCHORS[i];
    const b = PILLAR_REVEAL_ANCHORS[i + 1];
    if (r <= b.ratio) {
      return lerp(a.progress, b.progress, (r - a.ratio) / (b.ratio - a.ratio));
    }
  }

  return lerp(
    last.progress,
    PILLAR_REVEAL_COMPLETE,
    (r - last.ratio) / (1 - last.ratio),
  );
}
