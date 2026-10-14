import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, isBlockedTile, findPath, isAdjacent, spotGoal, blockedAtPoint } from '../shared/grid.js';

const scene = {
  w: 6, h: 5,
  objects: [
    { id: 'wall', type: 'box', x: 2, y: 0, w: 1, h: 4 },   // a wall with a gap at y = 4
    { id: 'chair', type: 'prop', x: 4, y: 1, w: 1, h: 1 },  // props never block
    { id: 'desk', type: 'box', x: 4, y: 3, w: 2, h: 1, sitAt: { x: 4.5, y: 2.5 } },
  ],
};

test('props do not block, boxes do', () => {
  const grid = buildGrid(scene);
  assert.equal(isBlockedTile(grid, 4, 1), false);
  assert.equal(isBlockedTile(grid, 2, 2), true);
  assert.equal(isBlockedTile(grid, -1, 0), true, 'outside the scene counts as blocked');
});

test('findPath goes around obstacles and reports unreachable goals', () => {
  const grid = buildGrid(scene);
  const path = findPath(grid, 0, 0, (i, j) => i === 3 && j === 0);
  assert.ok(path, 'a path exists through the gap');
  assert.ok(path.some(([i, j]) => i === 2 && j === 4), 'the path uses the gap');
  assert.deepEqual(path.at(-1), [3, 0]);
  assert.equal(findPath(grid, 0, 0, (i, j) => i === 2 && j === 2), null, 'a blocked tile is never a goal');
});

test('no corner cutting between two blocked tiles', () => {
  const grid = buildGrid({ w: 3, h: 3, objects: [{ id: 'a', type: 'box', x: 1, y: 0, w: 1, h: 1 }, { id: 'b', type: 'box', x: 0, y: 1, w: 1, h: 1 }] });
  assert.equal(findPath(grid, 0, 0, (i, j) => i === 1 && j === 1), null);
});

test('use spots: chair tile for desks, adjacent tiles otherwise', () => {
  const grid = buildGrid(scene);
  const desk = grid.objs.find((o) => o.id === 'desk');
  const wall = grid.objs.find((o) => o.id === 'wall');
  assert.equal(spotGoal(desk)(4, 2), true);
  assert.equal(spotGoal(desk)(3, 2), false, 'next to a desk with a chair is not enough');
  assert.equal(spotGoal(wall)(1, 1), true);
  assert.equal(isAdjacent(wall, 4, 4), false);
});

test('blockedAtPoint uses a body radius', () => {
  const grid = buildGrid(scene);
  assert.equal(blockedAtPoint(grid, 1.9, 2.5), true, 'body overlaps the wall tile');
  assert.equal(blockedAtPoint(grid, 1.5, 2.5), false);
});
