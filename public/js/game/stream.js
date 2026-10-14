import { state, $ } from '../state.js';
import { sfx } from '../audio/sound.js';

// Stream simulation while the hero is live at the PC: viewer counter, fake chat, floating hearts.
// Chat nicknames and phrases are generic and invented; they are not real people.
const CHAT_USERS = [['kolya_228', '#ff7b7b'], ['nastya', '#7bd0ff'], ['vovan', '#ffd166'], ['mr_pixel', '#9bff9b'], ['ghoul', '#c79bff'], ['kot_bob', '#ff9bd5']];
const CHAT_MSGS = ['привет!', 'KEKW', 'ахах', 'го дальше', 'Pog', 'F', 'красава', 'лол', 'что происходит', '+', 'ору', '!!!', 'первый!', 'жиза'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * What a desk monitor shows. `screen.phases` is an ordered list of { until: taskId, mode }: the first phase whose task
 * is not done yet wins ('youtube' | 'watch' | 'offline'); when all are done the monitor shows the live stream.
 */
export function screenMode(o) {
  for (const ph of (o.screen && o.screen.phases) || []) if (!state.done.has(ph.until)) return ph.mode;
  return 'stream';
}

export function startStream(o) {
  const [a, b] = (o.screen && o.screen.viewers) || [1, 5];
  state.live = { o, viewers: a, range: [a, b], target: a, nextMsg: 0, nextTarget: 0, nextPart: 0, chat: [] };
  $('hchat').innerHTML = '';
  $('hud').hidden = false;
}

export function stopStream() {
  state.live = null;
  $('hud').hidden = true;
}

/** Goes live / offline as soon as the monitor's phase changes (e.g. right after the "create channel" button). */
export function syncStream() {
  const o = state.seat;
  const wantLive = !!o && screenMode(o) === 'stream';
  if (wantLive && !state.live) startStream(o);
  else if (!wantLive && state.live) stopStream();
}

export function updateStream(dt, now) {
  const live = state.live;
  if (!live) return;
  if (now > live.nextTarget) { live.nextTarget = now + 1800; live.target = live.range[0] + Math.random() * (live.range[1] - live.range[0]); }
  live.viewers += (live.target - live.viewers) * Math.min(1, dt * 1.5);
  $('hviewers').textContent = `👁 ${Math.round(live.viewers).toLocaleString('ru-RU')}`;

  if (now > live.nextMsg) {
    live.nextMsg = now + 450 + Math.random() * 900;
    const [name, color] = pick(CHAT_USERS);
    sfx('pop');
    live.chat.push({ color, w: 14 + Math.floor(Math.random() * 22) });
    if (live.chat.length > 7) live.chat.shift();
    const row = document.createElement('div');
    const user = document.createElement('b');
    user.style.color = color; user.textContent = name;
    row.append(user, `: ${pick(CHAT_MSGS)}`);
    const box = $('hchat');
    box.append(row);
    while (box.childElementCount > 7) box.firstChild.remove();
  }

  if (now > (live.nextKey || 0)) { // the hero types while streaming
    live.nextKey = now + 90 + Math.random() * (Math.random() < 0.15 ? 900 : 160);
    sfx('key');
  }

  if (now > live.nextPart) {
    live.nextPart = now + 700 + Math.random() * 900;
    const o = live.o;
    state.particles.push({
      x: o.x + o.w / 2 + (Math.random() - 0.5) * 0.8, y: o.y + 0.35, z: o.z + 0.7, t: 0,
      txt: Math.random() < 0.6 ? '❤' : '★', col: Math.random() < 0.6 ? '#ff6b9d' : '#ffd166',
    });
  }
}
