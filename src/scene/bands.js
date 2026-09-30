// Project bands: each project row carries a data-strand value in [0, 1). A
// strand belongs to the project whose value is nearest its seed, measured
// around a circle so 0.95 and 0.05 are neighbours. The shader measures the
// same way when a row is hovered.

/** Distance between two values on the unit circle, in [0, 0.5]. */
export function circularDistance(a, b) {
  return Math.abs(((((a - b) % 1) + 1.5) % 1) - 0.5);
}

/** data-strand strings -> numbers in [0, 1). Junk is dropped, order kept. */
export function parseBands(values) {
  const out = [];
  for (const raw of values) {
    if (raw === '' || raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    // v - floor(v) leaves in-range values bit-for-bit as written.
    out.push(v - Math.floor(v));
  }
  return out;
}

/** Index of the band nearest `seed` (first wins a tie), or -1 if none. */
export function nearestBand(seed, bands) {
  let best = -1;
  let bestD = Infinity;
  bands.forEach((b, k) => {
    const d = circularDistance(seed, b);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best;
}

/**
 * For each row's raw data-strand value, the index of its hoop (its position
 * among the valid values, as parseBands keeps them), or -1 if it has none.
 */
export function rowHoopIndices(values) {
  let next = 0;
  return values.map((raw) => (parseBands([raw]).length ? next++ : -1));
}
