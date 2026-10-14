/** GET (no body) or POST (JSON body). Always resolves to { status, data }. */
export async function api(url, body) {
  const init = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(url, init);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

export const streamerApi = {
  list: () => api('/api/streamers'),
  get: (sid) => api(`/api/streamers/${sid}`),
  chapter: (sid, cid) => api(`/api/streamers/${sid}/chapters/${cid}`),
  complete: (sid, cid, tasks) => api(`/api/streamers/${sid}/chapters/${cid}/complete`, { tasks }),
};
