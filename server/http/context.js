import { parseCookies, cookieAttrs } from './cookies.js';
import { issueSession, verifySession } from '../auth/session.js';
import { signCheckpoint, readCheckpoint } from '../auth/checkpoint.js';

/**
 * Resolves the session and checkpoint of a request. `save()` queues a fresh checkpoint cookie;
 * `headers()` returns the Set-Cookie headers to attach to the response.
 */
export function requestContext(req, { secure = false } = {}) {
  const attrs = cookieAttrs(secure);
  const ua = String(req.headers['user-agent'] || '').slice(0, 512);
  const cookies = parseCookies(req.headers.cookie);
  const setCookies = [];
  let session = verifySession(cookies.session, ua);
  let cpToken = cookies.cp;
  if (!session) {
    const issued = issueSession(ua);
    session = verifySession(issued.raw, ua);
    cpToken = undefined;
    setCookies.push(`session=${issued.raw}${attrs}`);
  }
  const state = readCheckpoint(session.sid, cpToken);
  const save = () => setCookies.push(`cp=${signCheckpoint(session.sid, state)}${attrs}`);
  if (!cookies.cp || setCookies.length) save();
  return { sid: session.sid, state, save, headers: () => ({ 'Set-Cookie': setCookies }) };
}
