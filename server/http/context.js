import { parseCookies, COOKIE_ATTRS } from './cookies.js';
import { issueSession, verifySession } from '../auth/session.js';
import { signCheckpoint, readCheckpoint } from '../auth/checkpoint.js';

/**
 * Resolves the session and checkpoint of a request. `save()` queues a fresh checkpoint cookie;
 * `headers()` returns the Set-Cookie headers to attach to the response.
 */
export function requestContext(req) {
  const ua = req.headers['user-agent'] || '';
  const cookies = parseCookies(req.headers.cookie);
  const setCookies = [];
  let session = verifySession(cookies.session, ua);
  let cpToken = cookies.cp;
  if (!session) {
    const issued = issueSession(ua);
    session = verifySession(issued.raw, ua);
    cpToken = undefined;
    setCookies.push(`session=${issued.raw}${COOKIE_ATTRS}`);
  }
  const state = readCheckpoint(session.sid, cpToken);
  const save = () => setCookies.push(`cp=${signCheckpoint(session.sid, state)}${COOKIE_ATTRS}`);
  if (!cookies.cp || setCookies.length) save();
  return { sid: session.sid, state, save, headers: () => ({ 'Set-Cookie': setCookies }) };
}
