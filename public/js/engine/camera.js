import { state } from '../state.js';

// Isometric (2:1) projection. TW/TH are tile width/height in px; HU is px per height unit.
export const TW = 72, TH = 36, HU = 44;

const centerY = () => state.H / 2 - 40 * state.Z;

/** World (x, y, z) -> screen px, relative to the camera. */
export function proj(x, y, z = 0) {
  const { W, Z, cam } = state;
  return {
    x: W / 2 + ((x - y) - (cam.x - cam.y)) * (TW / 2) * Z,
    y: centerY() + ((x + y) - (cam.x + cam.y)) * (TH / 2) * Z - z * HU * Z,
  };
}

/** Screen px -> world (x, y) on the floor plane. */
export function unproj(sx, sy) {
  const { W, Z, cam } = state;
  const a = (sx - W / 2) / ((TW / 2) * Z) + (cam.x - cam.y);          // x - y
  const b = (sy - centerY()) / ((TH / 2) * Z) + (cam.x + cam.y);      // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
