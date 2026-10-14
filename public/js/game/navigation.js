import { state } from '../state.js';
import { spotGoal } from '/shared/grid.js';
import { heroTile, isBlocked, pathTo } from '../engine/world.js';
import { interact } from './interact.js';

/** Click on floor: walk to that tile. Returns false when it is blocked or unreachable. */
export function walkTo(i, j) {
  const [si, sj] = heroTile();
  if (isBlocked(i, j)) return false;
  if (si === i && sj === j) { state.path = []; return true; }
  const p = pathTo(si, sj, (a, b) => a === i && b === j);
  if (!p) return false;
  state.path = p;
  return true;
}

/** Click on an object: walk to its use spot (chair or an adjacent tile), then interact on arrival. */
export function goInteract(o) {
  const [si, sj] = heroTile();
  const goal = spotGoal(o);
  if (goal(si, sj)) { state.path = []; state.pending = null; interact(o); return; }
  const p = pathTo(si, sj, goal);
  if (!p) return;
  state.path = p;
  state.pending = o;
}
