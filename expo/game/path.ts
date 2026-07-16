/**
 * FounderFloor — tile pathfinding for click/tap-to-walk.
 * Plain 4-directional BFS over the walkability grid (BuiltFloor.solid).
 * If the tapped tile is solid or unreachable, the path targets the
 * reachable tile nearest to it — so tapping a booth from across the
 * hall walks you up to its edge.
 *
 * Floors are small (a few thousand tiles), so a full flood per tap is
 * cheap; nothing here runs per frame.
 */

export interface TilePoint {
  x: number;
  y: number;
}

/**
 * Find a walking path from `start` to `goal` (tile coords).
 * Returns the tile sequence to follow, excluding the start tile and
 * ending at the resolved target — or null if there is nowhere to go
 * (already there, or nothing reachable in the goal's direction).
 */
export function findPath(
  width: number,
  height: number,
  solid: (tx: number, ty: number) => boolean,
  start: TilePoint,
  goal: TilePoint
): TilePoint[] | null {
  if (width <= 0 || height <= 0) return null;
  if (start.x < 0 || start.y < 0 || start.x >= width || start.y >= height) return null;

  const n = width * height;
  const dist = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let qHead = 0;
  let qTail = 0;

  const sIdx = start.y * width + start.x;
  dist[sIdx] = 0;
  queue[qTail++] = sIdx;

  const visit = (x: number, y: number, from: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (dist[idx] >= 0 || solid(x, y)) return;
    dist[idx] = dist[from] + 1;
    parent[idx] = from;
    queue[qTail++] = idx;
  };

  while (qHead < qTail) {
    const cur = queue[qHead++];
    const cx = cur % width;
    const cy = (cur / width) | 0;
    visit(cx + 1, cy, cur);
    visit(cx - 1, cy, cur);
    visit(cx, cy + 1, cur);
    visit(cx, cy - 1, cur);
  }

  const gx = Math.max(0, Math.min(width - 1, goal.x));
  const gy = Math.max(0, Math.min(height - 1, goal.y));
  const gIdx = gy * width + gx;

  let target = -1;
  if (!solid(gx, gy) && dist[gIdx] >= 0) {
    target = gIdx;
  } else {
    // nearest reachable tile to the goal: minimize manhattan distance to
    // the goal, tie-broken by shortest walk from the start
    let bestMd = Infinity;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (dist[i] < 0) continue;
      const x = i % width;
      const y = (i / width) | 0;
      const md = Math.abs(x - gx) + Math.abs(y - gy);
      if (md < bestMd || (md === bestMd && dist[i] < bestDist)) {
        bestMd = md;
        bestDist = dist[i];
        target = i;
      }
    }
  }

  if (target < 0 || target === sIdx) return null;

  // reconstruct, target back to (but excluding) start
  const rev: number[] = [];
  for (let i = target; i !== sIdx; i = parent[i]) {
    if (i < 0) return null; // disconnected (shouldn't happen)
    rev.push(i);
  }
  const path: TilePoint[] = new Array(rev.length);
  for (let i = 0; i < rev.length; i++) {
    const idx = rev[rev.length - 1 - i];
    path[i] = { x: idx % width, y: (idx / width) | 0 };
  }
  return path;
}
