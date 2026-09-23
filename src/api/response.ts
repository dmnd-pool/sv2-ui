/** Array endpoints return [] when empty; another JSON shape is a contract error. */
export function requireArray<T>(payload: unknown): T[] {
  if (!Array.isArray(payload)) throw new Error('Invalid API response: expected an array');
  return payload as T[];
}
