// Pure tile-grid logic shared by the server (content validation) and the browser (movement, picking).
// No DOM, no Node APIs: keep it that way so both sides can import it.

const EPS = 1e-6;

/** Builds the collision grid for a scene. Props (decor like chairs) never block and get no tiles. */
export function buildGrid(scene) {
  const { w, h } = scene;
  const blocked = new Uint8Array(w * h);
  const objs = scene.objects.map((o) => ({ ...o, tiles: [] }));
  for (const o of objs) {
    if (o.type === 'prop') continue;
    for (let i = Math.floor(o.x + EPS); i < Math.ceil(o.x + o.w - EPS); i++) {
      for (let j = Math.floor(o.y + EPS); j < Math.ceil(o.y + o.h - EPS); j++) {
        if (i >= 0 && j >= 0 && i < w && j < h) { blocked[j * w + i] = 1; o.tiles.push([i, j]); }
      }
    }
  }
  return { w, h, blocked, objs };
}

export const isBlockedTile = (grid, i, j) =>
  i < 0 || j < 0 || i >= grid.w || j >= grid.h || grid.blocked[j * grid.w + i] === 1;

/** Collision test for a point with a small body radius (used by keyboard movement). */
export function blockedAtPoint(grid, x, y, r = 0.2) {
  return isBlockedTile(grid, Math.floor(x - r), Math.floor(y - r)) || isBlockedTile(grid, Math.floor(x + r), Math.floor(y - r))
    || isBlockedTile(grid, Math.floor(x - r), Math.floor(y + r)) || isBlockedTile(grid, Math.floor(x + r), Math.floor(y + r));
}

/**
 * BFS over tiles (8 neighbours, no corner cutting).
 * Returns the tiles from the start (excluded) to the first goal tile, or null when unreachable.
 */
export function findPath(grid, si, sj, isGoal) {
  const { w, h } = grid;
  const prev = new Int32Array(w * h).fill(-2);
  const queue = [[si, sj]];
  prev[sj * w + si] = -1;
  for (let k = 0; k < queue.length; k++) {
    const [i, j] = queue[k];
    if (isGoal(i, j) && !(i === si && j === sj)) {
      const out = [];
      for (let c = j * w + i; c !== -1; c = prev[c]) out.push([c % w, Math.floor(c / w)]);
      out.pop();
      out.reverse();
      return out;
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const ni = i + dx, nj = j + dy;
        if (isBlockedTile(grid, ni, nj) || prev[nj * w + ni] !== -2) continue;
        if (dx && dy && (isBlockedTile(grid, i + dx, j) || isBlockedTile(grid, i, j + dy))) continue;
        prev[nj * w + ni] = j * w + i;
        queue.push([ni, nj]);
      }
    }
  }
  return null;
}

/** A tile is "next to" an object when it touches one of the object's tiles (diagonals count). */
export const isAdjacent = (o, i, j) => o.tiles.some(([a, b]) => Math.abs(a - i) <= 1 && Math.abs(b - j) <= 1);

/** Goal test for "stand where the hero can use this object": its chair if it has one, otherwise any adjacent tile. */
export function spotGoal(o) {
  const seat = o.sitAt ? [Math.floor(o.sitAt.x), Math.floor(o.sitAt.y)] : null;
  return (i, j) => (seat ? i === seat[0] && j === seat[1] : isAdjacent(o, i, j));
}
