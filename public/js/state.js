// Single mutable game state shared by all modules. Modules import `state` and read/write it directly;
// there is no other global.

export const $ = (id) => document.getElementById(id);

export const state = {
  // viewport
  W: 0, H: 0, Z: 1,
  baseZ: 1,            // scale that fits the window
  zoom: 1, zoomNow: 1, // player's zoom (mouse wheel / pinch): the target and the smoothed value, multiplied into Z
  // content
  mode: 'lobby',       // 'lobby' (doors to heroes) | 'home' (a hero's room with keepsakes) | 'chapter'
  streamers: [],       // heroes with the player's progress
  streamer: null,      // currently opened streamer (look, sources, chapters + unlock state); a stub in the lobby
  chapter: null,       // current chapter (scene, tasks, dialogue); null outside chapters
  world: null,         // scene + collision grid
  look: null,          // how the player's figure looks right now
  seat: null,          // desk object the hero is sitting at
  done: new Set(),     // task ids completed in this chapter
  // actors
  hero: { x: 0, y: 0, face: 1, moving: false, t: 0, seated: false },
  cam: { x: 0, y: 0 },
  focus: null,         // { x, y, until }: the camera looks here for a moment (e.g. at a door that just opened)
  // navigation / input
  path: [],
  pending: null,       // object to interact with after the path ends
  dlg: null,           // active dialogue
  idleAt: 0,
  hover: null,
  mouse: { x: -1, y: -1 },
  keys: new Set(),
  stick: null,         // on-screen stick: { x, y } screen direction (-1..1) or null when released
  locked: true,        // true while a full-screen menu is open
  // effects
  pings: [],
  particles: [],
  live: null,          // active stream simulation
};
