import { state, $ } from './state.js';
import { resize } from './engine/gfx.js';
import { initInput } from './engine/input.js';
import { update } from './engine/update.js';
import { render } from './engine/scene.js';
import { initDialog } from './ui/dialog.js';
import { initAction } from './ui/action.js';
import { initTouch } from './ui/touch.js';
import { enterHub, onMenu } from './game/flow.js';
import { initAudio } from './audio/sound.js';
import { initSoundButton } from './ui/soundbtn.js';
import { initQuest } from './ui/quest.js';
import { positionBubbles } from './ui/bubble.js';

resize();
addEventListener('resize', resize);
initInput();
initDialog();
initAction();
initTouch();
initAudio();
initSoundButton();
initQuest();
$('menuBtn').onclick = onMenu;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.world) update(dt, now);
  render(now);
  positionBubbles();
  requestAnimationFrame(frame);
}

enterHub();
requestAnimationFrame(frame);
