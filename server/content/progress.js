// Progress rules, independent of HTTP: which chapters are open and when a chapter counts as completed.

/** A chapter is unlocked when every chapter before it is completed; a museum-style hero sets meta.unlock = "free". */
export const isUnlocked = (streamer, doneIds, index) =>
  streamer.meta.unlock === 'free' || streamer.chapters.slice(0, index).every((c) => doneIds.includes(c.id));

export const chapterIndex = (streamer, chapterId) => streamer.chapters.findIndex((c) => c.id === chapterId);

/** The client reports which tasks it finished; the chapter completes only if all required ones are included. */
export const missingTasks = (chapter, reported) => {
  const have = new Set(Array.isArray(reported) ? reported : []);
  return chapter.tasks.filter((t) => !have.has(t.id)).map((t) => t.id);
};

/** Public (client-safe) description of a streamer's progress. */
export function streamerSummary(streamer, doneIds) {
  const { meta, chapters, home } = streamer;
  return {
    id: meta.id, name: meta.name, nick: meta.nick || meta.name, tagline: meta.tagline, accent: meta.accent,
    hero: meta.hero, disclaimer: meta.disclaimer, idle: meta.idle || [], sources: meta.sources,
    home, // the hero's room; pedestals map to chapters by id
    done: doneIds,
    chapters: chapters.map((c, i) => ({ id: c.id, year: c.year, title: c.title, intro: c.intro, memento: c.memento, unlocked: isUnlocked(streamer, doneIds, i) })),
  };
}
