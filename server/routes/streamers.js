import { json, readJsonBody } from '../http/respond.js';
import { doneChapters, markDone } from '../auth/checkpoint.js';
import { isUnlocked, chapterIndex, missingTasks, streamerSummary } from '../content/progress.js';

// GET  /api/streamers                                  list of heroes with the player's progress
// GET  /api/streamers/:sid                             one hero: look, sources, chapters with unlock state
// GET  /api/streamers/:sid/chapters/:cid               full chapter (scene, dialogue); 403 while locked
// POST /api/streamers/:sid/chapters/:cid/complete      body { tasks: [...] }; unlocks the next chapter
export function streamerRoutes(registry, config) {
  return async (req, res, url, ctx) => {
    const H = ctx.headers;
    const parts = url.pathname.split('/').filter(Boolean); // ['api','streamers',...]
    if (parts[0] !== 'api' || parts[1] !== 'streamers') return false;

    if (parts.length === 2 && req.method === 'GET') {
      const list = registry.list().map((s) => {
        const done = doneChapters(ctx.state, s.meta.id);
        return { id: s.meta.id, name: s.meta.name, nick: s.meta.nick || s.meta.name, tagline: s.meta.tagline, accent: s.meta.accent, chapters: s.chapters.length, done: done.length };
      });
      json(res, 200, list, H());
      return true;
    }

    const streamer = registry.get(parts[2]);
    if (!streamer) { json(res, 404, { error: 'not_found' }, H()); return true; }
    const done = doneChapters(ctx.state, streamer.meta.id);

    if (parts.length === 3 && req.method === 'GET') {
      json(res, 200, streamerSummary(streamer, done), H());
      return true;
    }

    if (parts[3] === 'chapters' && parts[4]) {
      const idx = chapterIndex(streamer, parts[4]);
      if (idx < 0) { json(res, 404, { error: 'not_found' }, H()); return true; }
      if (!isUnlocked(streamer, done, idx)) { json(res, 403, { error: 'locked' }, H()); return true; }
      const chapter = streamer.chapters[idx];

      if (parts.length === 5 && req.method === 'GET') {
        json(res, 200, chapter, H());
        return true;
      }
      if (parts.length === 6 && parts[5] === 'complete' && req.method === 'POST') {
        const body = await readJsonBody(req, config.maxBodyBytes);
        // only a short list of short strings is meaningful; anything else is ignored rather than trusted
        const reported = Array.isArray(body.tasks) ? body.tasks.slice(0, 64).filter((t) => typeof t === 'string' && t.length <= 40) : [];
        const missing = missingTasks(chapter, reported);
        if (missing.length) { json(res, 400, { error: 'tasks_incomplete', missing }, H()); return true; }
        markDone(ctx.state, streamer.meta.id, chapter.id);
        ctx.save();
        json(res, 200, streamerSummary(streamer, doneChapters(ctx.state, streamer.meta.id)), H());
        return true;
      }
    }

    json(res, 404, { error: 'not_found' }, H());
    return true;
  };
}
