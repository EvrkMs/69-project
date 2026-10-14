import { state } from '../state.js';
import { buildGrid, isBlockedTile, blockedAtPoint, findPath } from '/shared/grid.js';

export function buildWorld(scene) {
  const grid = buildGrid(scene);
  return { ...scene, ...grid, deco: scene.deco || [] };
}

export const isBlocked = (i, j) => isBlockedTile(state.world, i, j);
export const blockedAt = (x, y) => blockedAtPoint(state.world, x, y);
export const pathTo = (si, sj, isGoal) => findPath(state.world, si, sj, isGoal);
export const heroTile = () => [Math.floor(state.hero.x), Math.floor(state.hero.y)];
