import { state, $ } from '../state.js';
import { renderQuest } from './quest.js';
import { showAction, cancelAction } from './action.js';
import { checkCounters } from '../game/tasks.js';
import { sfx } from '../audio/sound.js';

// Hero / NPC lines go to the bottom window; facts and clips go to a card at the top centre.
// Two step kinds are not dialogue: "action" waits for a held button, "task" completes a task and moves on.
let typer = null;

export function say(steps, onDone) {
  document.body.classList.add('talking');
  state.dlg = { steps, i: 0, onDone };
  showStep();
}

function showStep() {
  const { dlg, streamer } = state;
  const s = dlg.steps[dlg.i];

  if (s.who === 'task') { // silent: the scene reacts (monitor, door) while the conversation goes on
    state.done.add(s.task);
    checkCounters();
    renderQuest();
    sfx('task');
    return next();
  }
  if (s.who === 'action') {
    clearInterval(typer);
    $('dialog').hidden = true; $('fact').hidden = true; showMedia(null);
    dlg.waiting = true;
    showAction(s.label, s.hold, () => { dlg.waiting = false; next(); });
    return;
  }

  const card = s.who === 'fact' || s.who === 'clip';
  $('fact').classList.toggle('copyable', s.who === 'fact');
  $('dialog').hidden = card;
  $('fact').hidden = !card;
  let el;
  if (card) {
    el = $('ftext');
    $('flabel').textContent = s.who === 'fact' ? 'ФАКТ' : 'КЛИП';
    const src = streamer.sources[s.src];
    const link = $('fsrc');
    if (s.who === 'fact' && src && /^https?:\/\//.test(src.url)) { link.href = src.url; link.textContent = src.label; link.hidden = false; } else link.hidden = true;
    showMedia(s.media);
  } else {
    el = $('dtext');
    $('dialog').className = s.who === 'npc' ? 'npc' : '';
    $('dname').textContent = s.who === 'hero' ? streamer.hero.name : s.name || '';
    showMedia(null);
  }
  const text = s.text;
  if (card) sfx('fact');
  const voice = s.who === 'hero' ? 'hero' : s.who === 'npc' ? 'npc' : null;
  let n = 0;
  clearInterval(typer);
  el.textContent = '';
  typer = setInterval(() => {
    n += 2;
    if (voice && n % 6 === 0) sfx(voice); // a blip every third letter
    el.textContent = text.slice(0, n);
    if (n >= text.length) clearInterval(typer);
  }, 16);
  dlg.el = el;
  dlg.full = text;
}

function next() {
  const { dlg } = state;
  dlg.i++;
  if (dlg.i < dlg.steps.length) return showStep();
  const done = dlg.onDone;
  state.dlg = null;
  document.body.classList.remove('talking');
  $('dialog').hidden = true;
  $('fact').hidden = true;
  showMedia(null);
  state.idleAt = performance.now();
  if (done) done();
}

/** First call finishes the typing animation, the next one moves to the following step. Ignored while a hold-action waits. */
export function advance() {
  const { dlg } = state;
  if (!dlg || dlg.waiting) return;
  if (dlg.el.textContent.length < dlg.full.length) { clearInterval(typer); dlg.el.textContent = dlg.full; return; }
  sfx('next');
  next();
}

export function closeDialog() {
  document.body.classList.remove('talking');
  clearInterval(typer);
  cancelAction();
  state.dlg = null;
  $('dialog').hidden = true;
  $('fact').hidden = true;
  showMedia(null);
}

// Embedded clip inside the fact card. Always offers a plain link too (embedding can be disabled by the uploader).
// Built with DOM calls, not HTML strings; the id is re-checked and URL-encoded even though the server validated it;
// the frame is sandboxed to what a video player needs, and CSP (frame-src) allows only YouTube and Twitch.
const MEDIA_TOKEN = /^[\w-]{6,64}$/;
const SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

function text(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = content;
  return node;
}

function showMedia(m) {
  const el = $('fmedia');
  el.replaceChildren();
  const token = m && (m.type === 'youtube' ? m.id : m.type === 'twitchclip' ? m.slug : null);
  if (!token || !MEDIA_TOKEN.test(token)) { el.hidden = true; return; }

  const id = encodeURIComponent(token);
  const link = m.type === 'youtube' ? `https://www.youtube.com/watch?v=${id}` : `https://clips.twitch.tv/${id}`;
  const src = m.type === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${id}?rel=0`
    : `https://clips.twitch.tv/embed?clip=${id}&parent=${encodeURIComponent(location.hostname)}&autoplay=false`;

  const frame = document.createElement('iframe');
  frame.src = src;
  frame.loading = 'lazy';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.setAttribute('sandbox', SANDBOX);

  const open = text('a', '', 'Открыть оригинал');
  open.href = link; open.target = '_blank'; open.rel = 'noopener noreferrer';
  const caption = document.createElement('div');
  caption.className = 'cap';
  caption.append(text('span', '', String(m.title)), open);

  el.append(frame, caption, text('div', 'note', 'Нарезка и права принадлежат авторам ролика.'));
  el.hidden = false;
}

export function initDialog() {
  // Copying is allowed only for a fact's text: whatever else is selected (Ctrl+A, drag) never reaches the clipboard.
  document.addEventListener('copy', (e) => {
    const keep = $('fact').classList.contains('copyable') && !$('fact').hidden ? $('ftext') : null;
    const sel = getSelection();
    const ok = keep && sel.rangeCount && keep.contains(sel.anchorNode) && keep.contains(sel.focusNode);
    if (ok) return;
    e.preventDefault();
    if (e.clipboardData) e.clipboardData.setData('text/plain', '');
  });
  document.addEventListener('cut', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  $('dialog').addEventListener('click', advance);
  $('fnext').addEventListener('click', advance);
  $('ftext').addEventListener('click', advance);
}
