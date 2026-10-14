import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandChapter, ContentError } from './expand.js';
import { validateStreamer } from './validate.js';
import { buildHome } from './home.js';

// CONTENT_ROOT lets you point the server at another content folder (staging copy, experiments) without touching content/.
const DEFAULT_ROOT = process.env.CONTENT_ROOT
  ? path.resolve(process.env.CONTENT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ContentError([`${path.relative(process.cwd(), file)}: ${e.message}`]);
  }
};

function loadStreamer(dir, shared) {
  const meta = readJson(path.join(dir, 'streamer.json'));
  const npcsFile = path.join(dir, 'npcs.json');
  const npcs = existsSync(npcsFile) ? readJson(npcsFile) : {};
  const ctx = { ...shared, npcs };
  const errors = [];
  const chapters = [];
  for (const name of meta.chapters || []) {
    const file = path.join(dir, 'chapters', `${name}.json`);
    if (!existsSync(file)) { errors.push(`${meta.id}: chapter file chapters/${name}.json is listed but missing`); continue; }
    try {
      chapters.push(expandChapter(readJson(file), ctx));
    } catch (e) {
      errors.push(`${meta.id}/${name}: ${e.message}`);
    }
  }
  if (errors.length) throw new ContentError(errors);
  return { meta, chapters, home: buildHome(meta, chapters, shared) };
}

/**
 * Loads and validates all streamers under content/streamers. Directories starting with "_" (the template) are
 * skipped unless includeTemplates is set. Throws ContentError listing every problem found.
 */
export function loadContent({ root = DEFAULT_ROOT, includeTemplates = false } = {}) {
  const shared = readJson(path.join(root, 'presets.json'));
  const base = path.join(root, 'streamers');
  const streamers = new Map();
  const errors = [];
  for (const ent of readdirSync(base, { withFileTypes: true })) {
    if (!ent.isDirectory() || (ent.name.startsWith('_') && !includeTemplates)) continue;
    try {
      const s = loadStreamer(path.join(base, ent.name), shared);
      errors.push(...validateStreamer(s));
      if (s.meta.id !== ent.name) errors.push(`${ent.name}: streamer.json id "${s.meta.id}" must match the folder name`);
      streamers.set(s.meta.id, s);
    } catch (e) {
      if (e instanceof ContentError) errors.push(...e.errors); else throw e;
    }
  }
  if (errors.length) throw new ContentError(errors);

  return {
    streamers,
    list: () => [...streamers.values()],
    get: (id) => streamers.get(id) || null,
  };
}
