import { createApp } from './app.js';
import { ContentError } from './content/expand.js';

const PORT = Number(process.env.PORT) || 3069;

try {
  const server = createApp();
  server.listen(PORT, () => console.log(`arch69-project listening on http://localhost:${PORT}`));
} catch (e) {
  if (e instanceof ContentError) { console.error(e.message); process.exit(1); }
  throw e;
}
