const API_BASE = import.meta.env.VITE_API_BASE ?? "";

interface ApiOptions {
  method?: string;
  body?: BodyInit | Record<string, unknown> | null;
  token?: string | null;
}

export async function apiRequest(path: string, options: ApiOptions = {}) {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error((data.detail as string) || `HTTP ${res.status}`);
  return data;
}

export function useApi() {
  return { apiRequest };
}
