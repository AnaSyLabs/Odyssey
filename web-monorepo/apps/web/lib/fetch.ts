/** fetch + JSON for the app's own API. Throws the route's { error } message when the answer isn't 2xx. */
export async function api<T = any>(url: string, init?: RequestInit): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${url} failed (${res.status})`);
  return body;
}
