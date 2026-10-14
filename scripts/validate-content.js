// npm run validate: checks everything under content/ (including the _template) and prints a summary.
import { loadContent } from '../server/content/loader.js';
import { ContentError } from '../server/content/expand.js';

try {
  const registry = loadContent({ includeTemplates: true });
  for (const s of registry.list()) {
    const scenes = s.chapters.length;
    const facts = s.chapters.flatMap((c) => c.scene.objects).flatMap((o) => o.interactions || []).flatMap((i) => i.steps).filter((st) => st.who === 'fact').length;
    console.log(`ok  ${s.meta.id.padEnd(12)} ${scenes} chapters, ${facts} fact cards, ${Object.keys(s.meta.sources).length} sources`);
  }
} catch (e) {
  if (!(e instanceof ContentError)) throw e;
  console.error(e.message);
  process.exit(1);
}
