export async function documentRequest<T>(url: string, fallback: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error ?? fallback);
  return body as T;
}
