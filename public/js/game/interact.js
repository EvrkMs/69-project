import { state } from '../state.js';
import { say } from '../ui/dialog.js';
import { whisper } from '../ui/whisper.js';
import { renderQuest } from '../ui/quest.js';
import { pickInteraction, doorOpen, checkCounters } from './tasks.js';
import { stopStream, syncStream } from './stream.js';
import { blockedAt } from '../engine/world.js';
import { sfx } from '../audio/sound.js';
import { finishChapter, openMemento, openHome, openLobby } from './flow.js';

/**
 * Plays whatever the object offers right now. Chapter objects: door check, or the next open interaction
 * (sitting down first if the object has a chair). Hub objects: keepsakes open chapters, portals change rooms.
 */
export function interact(o) {
  const { hero, done } = state;
  state.idleAt = performance.now();

  if (o.type === 'memento') return openMemento(o);
  if (o.type === 'portal') {
    sfx('portal');
    if (o.to === 'lobby') return openLobby();
    if (o.to === 'soon') return whisper('За этой дверью пока никого нет. Скоро здесь появится новая комната.');
    return openHome(o.hero);
  }

  if (o.type === 'door') {
    if (!doorOpen(o)) return say(o.locked, null, o);
    return say(o.steps, () => {
      if (o.task) done.add(o.task);
      // the door swings open and floods with light before the chapter ends
      o.openedAt = performance.now();
      sfx('door');
      state.locked = true;
      setTimeout(() => { state.locked = false; finishChapter(); }, 750);
    }, o);
  }

  const it = pickInteraction(o);
  if (!it) return;
  if (o.sitAt) {
    hero.x = o.sitAt.x; hero.y = o.sitAt.y; hero.seated = true; hero.face = 1; state.path = [];
    state.seat = o;
    syncStream();
  }
  say(it.steps, () => {
    if (it.task) { done.add(it.task); checkCounters(); renderQuest(); sfx('task'); }
    if (hero.seated) {
      hero.seated = false;
      state.seat = null;
      stopStream();
      if (!blockedAt(hero.x, hero.y + 0.8)) hero.y += 0.8; // stand up in front of the chair
    }
  }, o);
}
