import { state, $ } from '../state.js';
import { streamerApi } from '../api.js';
import { overlay, closeOverlay, esc } from '../ui/overlay.js';
import { renderQuest, renderHub } from '../ui/quest.js';
import { closeDialog } from '../ui/dialog.js';
import { whisper } from '../ui/whisper.js';
import { stopStream } from './stream.js';
import { buildWorld } from '../engine/world.js';

// Where the player can be:
//   lobby    a corridor with one door per hero, the hero's nickname on a plate above it
//   home     a hero's room; every chapter is a keepsake on a pedestal
//   chapter  playing a chapter; finishing it returns to the room with the next keepsake unlocked

const DEFAULT_LOOK = { body: '#8b93b8', hair: '#2b1d14', skin: '#f1c9a5', headset: null };
const LOBBY_STUB = { id: '', name: '', hero: { name: 'Гость', look: DEFAULT_LOOK }, sources: {}, idle: [], chapters: [], done: [], disclaimer: '' };

function setScene(scene, look) {
  state.world = buildWorld(scene);
  state.look = look;
  const { hero, cam } = state;
  hero.x = scene.start.x; hero.y = scene.start.y; hero.seated = false; hero.face = 1;
  cam.x = hero.x; cam.y = hero.y;
  state.path = []; state.pending = null; state.seat = null; state.focus = null;
  closeDialog();
  stopStream();
  state.particles.length = 0;
}

// Events are memories: a sepia tint with darker corners, entered and left through a white flash.
function setFlashback(on) { document.body.classList.toggle('flashback', on); }
function flash() {
  const el = $('flash');
  el.classList.remove('on');
  void el.offsetWidth; // restart the animation
  el.classList.add('on');
}

function updateMenuButton() {
  const b = $('menuBtn');
  b.hidden = state.mode === 'lobby';
  b.textContent = state.mode === 'chapter' ? 'В комнату' : 'В коридор';
}

// The corridor always has at least this many doors; the free ones are shown as "soon" so a single hero doesn't look lonely.
const MIN_DOORS = 3;

/** A corridor: one door per hero along the back wall, a name plate with the hero's nickname above each door. */
function lobbyScene(list) {
  const doors = Math.max(MIN_DOORS, list.length);
  const w = doors * 3 + 2;
  const objects = [];
  for (let i = 0; i < doors; i++) {
    const s = list[i];
    const door = { y: 0, x: 1 + i * 3, w: 2, h: 0.3, z: 1.8, type: 'portal' };
    objects.push(s
      ? { ...door, id: s.id, hero: s.id, name: s.name, nick: s.nick, color: s.accent }
      : { ...door, id: `soon-${i}`, to: 'soon', name: 'Скоро', nick: 'скоро…', color: '#3a3f55' });
  }
  return {
    w, h: 5, indoor: true, floor: ['#262a38', '#222633'], wall: '#363b52', start: { x: w / 2, y: 3 },
    deco: [{ kind: 'rug', x: 1, y: 2, w: w - 2, h: 2, color: '#33304a' }],
    objects,
  };
}

/** First screen: always the corridor with the heroes' doors. */
export async function enterHub() {
  return openLobby();
}

export async function openLobby() {
  state.streamers = (await streamerApi.list()).data;
  const wasChapter = state.mode === 'chapter';
  state.mode = 'lobby';
  state.chapter = null;
  state.streamer = LOBBY_STUB;
  document.documentElement.style.removeProperty('--acc');
  setScene(lobbyScene(state.streamers), DEFAULT_LOOK);
  setFlashback(false);
  if (wasChapter) flash();
  closeOverlay();
  renderHub();
  updateMenuButton();
}

export async function openHome(sid) {
  const { status, data } = await streamerApi.get(sid);
  if (status !== 200) return openLobby();
  const wasChapter = state.mode === 'chapter';
  state.mode = 'home';
  state.chapter = null;
  state.streamer = data;
  document.documentElement.style.setProperty('--acc', data.accent);
  setScene(data.home, data.hero.look);
  setFlashback(false);
  if (wasChapter) flash();
  closeOverlay();
  renderHub();
  updateMenuButton();
}

const statusOf = (s, c) => (s.done.includes(c.id) ? 'done' : c.unlocked ? 'open' : 'locked');

/** Card for a keepsake: what it is, and a button into its chapter when it is unlocked. */
export function openMemento(o) {
  const s = state.streamer;
  const c = s.chapters.find((x) => x.id === o.chapter);
  if (!c) return;
  const st = statusOf(s, c);
  const note = { done: 'Пройдено ✓. Можно пройти ещё раз.', open: '', locked: 'Сначала пройди предыдущую главу.' }[st];
  overlay(`
    <h1><small>${c.year}</small>${esc(c.title)}</h1>
    <p><b>${esc(c.memento.name)}.</b> ${esc(c.memento.text)}</p>
    <p>${esc(c.intro)}</p>
    ${note ? `<p class="small">${note}</p>` : ''}
    <div class="row">
      ${st === 'locked' ? '' : `<button class="primary" id="enter">${st === 'done' ? 'Пройти снова' : 'Войти в воспоминание'}</button>`}
      <button id="back">Назад</button>
    </div>`, (el) => {
    const enter = el.querySelector('#enter');
    if (enter) enter.onclick = () => startChapter(c.id, { skipIntro: true });
    el.querySelector('#back').onclick = closeOverlay;
  });
}

export async function startChapter(id, { skipIntro = false } = {}) {
  const s = state.streamer;
  const { status, data } = await streamerApi.chapter(s.id, id);
  if (status !== 200) return openHome(s.id);
  state.mode = 'chapter';
  state.chapter = data;
  state.done = new Set();
  setScene(data.scene, s.hero.look);
  setFlashback(data.flashback !== false);
  flash();
  renderQuest();
  updateMenuButton();
  if (skipIntro) return closeOverlay();
  overlay(`
    <h1><small>${data.year}</small>${esc(data.title)}</h1>
    <p>${esc(data.intro)}</p>
    <div class="row"><button class="primary" id="go">Поехали</button></div>`, (el) => { el.querySelector('#go').onclick = closeOverlay; });
}

export async function finishChapter() {
  const s = state.streamer;
  const chapterId = state.chapter.id;
  const { status, data } = await streamerApi.complete(s.id, chapterId, [...state.done]);
  if (status !== 200) return whisper('Что-то пошло не так. Попробуй ещё раз.');
  state.streamer = { ...s, ...data }; // fresh done list and unlock state
  const idx = state.streamer.chapters.findIndex((c) => c.id === chapterId);
  const next = state.streamer.chapters[idx + 1];
  if (!next) return showEnding();
  overlay(`
    <h1><small>ГЛАВА ПРОЙДЕНА</small>${esc(state.chapter.title)}</h1>
    <p>Дальше: ${next.year} · ${esc(next.title)}</p>
    <div class="row"><button class="primary" id="next">Дальше</button><button id="home">В комнату</button></div>`, (el) => {
    el.querySelector('#next').onclick = () => startChapter(next.id);
    el.querySelector('#home').onclick = () => openHome(s.id);
  });
}

function showEnding() {
  const s = state.streamer;
  const links = Object.values(s.sources).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join('<br>');
  overlay(`
    <h1><small>КОНЕЦ ИСТОРИИ</small>Спасибо, что дошёл до конца</h1>
    <p>История продолжается. Герой всё ещё в эфире.</p>
    <details class="src small"><summary>Источники</summary>${links}</details>
    <div class="row"><button class="primary" id="home">В комнату</button><button id="again">Пройти заново</button></div>`, (el) => {
    el.querySelector('#home').onclick = () => openHome(s.id);
    el.querySelector('#again').onclick = () => startChapter(s.chapters[0].id);
  });
}

/** Top-right button: leave a chapter (with a warning) or go back to the lobby. */
export function onMenu() {
  if (state.locked) return;
  if (state.mode === 'chapter') {
    overlay(`
      <h1>Выйти из главы?</h1>
      <p>Прогресс этой главы не сохранится, пройденные главы останутся.</p>
      <div class="row"><button class="primary" id="leave">Выйти в комнату</button><button id="stay">Остаться</button></div>`, (el) => {
      el.querySelector('#leave').onclick = () => openHome(state.streamer.id);
      el.querySelector('#stay').onclick = closeOverlay;
    });
  } else if (state.mode === 'home') openLobby();
}
