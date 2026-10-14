import { state, $ } from '../state.js';
import { countDone, doorOpen } from '../game/tasks.js';
import { esc } from './overlay.js';

const CHAPTER_HINT = 'ЛКМ: идти и говорить · WASD: двигаться · E: действие';
const HOME_HINT = 'ЛКМ или E: подойти к вещи. Каждая вещь открывает главу.';

// On a phone the long lists (a room with 12 events) start folded; the player can unfold them by tapping the title.
const compact = () => matchMedia('(max-width: 600px), (pointer: coarse), (max-height: 500px)').matches;
let lastKey = '';

export function initQuest() {
  $('qtitle').addEventListener('click', () => $('quest').classList.toggle('collapsed'));
}

function panel(title, itemsHtml, hint, key) {
  if (key !== lastKey) { lastKey = key; $('quest').classList.toggle('collapsed', compact() && key.startsWith('hub')); }
  $('qtitle').textContent = title;
  $('qtasks').innerHTML = itemsHtml;
  $('qhint').textContent = hint;
  $('quest').hidden = false;
}

/** Task list of the current chapter. */
export function renderQuest() {
  const { chapter, done } = state;
  const items = chapter.tasks.map((t) => {
    const progress = t.needs && !done.has(t.id) ? ` (${countDone(t)}/${t.needs.count})` : '';
    return `<li class="${done.has(t.id) ? 'done' : ''}">${esc(t.text)}${progress}</li>`;
  });
  // once a door is open the last objective is to walk through it
  if (state.world.objs.some((o) => o.type === 'door' && doorOpen(o))) items.push('<li class="exit">Выйти через дверь</li>');
  panel(`${chapter.year} · ${chapter.title}`, items.join(''), CHAPTER_HINT, `chapter:${chapter.id}`);
}

/** Panel for the lobby (heroes) and for a hero's room (chapters with their keepsakes). */
export function renderHub() {
  const s = state.streamer;
  if (state.mode === 'lobby') {
    panel('Коридор', state.streamers.map((h) => `<li class="${h.done >= h.chapters ? 'done' : ''}">${esc(h.nick)} · ${h.done}/${h.chapters}</li>`).join(''),
      'На каждой двери ник стримера, чья это комната. Подойди к двери: ЛКМ или E.', 'lobby');
    return;
  }
  panel(`Комната: ${s.name}`, s.chapters.map((c) => {
    const cls = s.done.includes(c.id) ? 'done' : c.unlocked ? '' : 'locked';
    return `<li class="${cls}">${c.year} · ${esc(c.memento.name)}</li>`;
  }).join(''), `${HOME_HINT}\n${s.disclaimer}`, `hub:${s.id}`);
}
