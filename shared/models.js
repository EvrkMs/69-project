// Names the renderer knows (public/js/engine/furniture.js and deco.js). The server validates content against these lists.
export const MODEL_NAMES = [
  'desk', 'bed', 'bookcase', 'trophycase', 'wardrobe', 'sofa', 'plant', 'bench', 'streetlamp', 'billboard', 'noticeboard', 'speaker',
  'pullupbar', 'arch', 'banquet', 'can', 'mannequin', 'podium', 'camera',
];

// Wall and floor decoration declared in scene.deco.
export const DECO_KINDS = ['rug', 'poster', 'window', 'banner', 'garland', 'balloons', 'spotlight'];

// How a scene is lit. "dark" hides everything except what the hero's flashlight and light sources reach.
export const LIGHTING_MODES = ['dark'];
