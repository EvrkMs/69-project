import { state } from '../state.js';

// Which interaction an object offers: the first one whose task is still open (or has no task); the last one repeats.
export function pickInteraction(o) {
  const list = o.interactions || [];
  return list.find((it) => !it.task || !state.done.has(it.task)) || list[list.length - 1];
}

export const hasPendingTask = (o) => (o.interactions || []).some((it) => it.task && !state.done.has(it.task));
export const doorOpen = (o) => o.type === 'portal' || (o.requires || []).every((t) => state.done.has(t));

// Counter tasks ("talk to any 3 people") complete once enough sub-tasks with the given prefix are done.
export const countDone = (t) => [...state.done].filter((id) => id.startsWith(t.needs.prefix)).length;

export function checkCounters() {
  for (const t of state.chapter.tasks) {
    if (t.needs && !state.done.has(t.id) && countDone(t) >= t.needs.count) state.done.add(t.id);
  }
}
