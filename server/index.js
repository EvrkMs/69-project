import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { ContentError } from './content/expand.js';

try {
  const config = loadConfig();
  const server = createApp({ config });
  server.listen(config.port, config.host, () => {
    console.log(`arch69-project listening on http://${config.host.includes(':') ? `[${config.host}]` : config.host}:${config.port}`);
    if (!['127.0.0.1', '::1', 'localhost'].includes(config.host)) {
      console.warn(`[security] bound to ${config.host}: set ALLOWED_HOSTS to your domain and run behind HTTPS (see SECURITY.md)`);
    }
  });
} catch (e) {
  if (e instanceof ContentError) { console.error(e.message); process.exit(1); }
  console.error(e.message);
  process.exit(1);
}
