export const API_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type JsonBody = Record<string, unknown> | unknown[];

/**
 * Raw fetch escape hatch for call sites that don't fit the typed JSON-in/JSON-out
 * helpers below (content-type sniffing, empty-body-tolerant parsing, etc).
 * Always sends cookies; never throws on a non-ok response.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { credentials: "include", ...init });
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response, fallbackError), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, fallbackError = "טעינת הנתונים נכשלה"): Promise<T> {
  return request<T>(path, {}, fallbackError);
}

export function apiPost<T>(path: string, body?: JsonBody, fallbackError = "הפעולה נכשלה"): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    },
    fallbackError
  );
}

export function apiPut<T>(path: string, body: JsonBody, fallbackError = "השמירה נכשלה"): Promise<T> {
  return request<T>(
    path,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    fallbackError
  );
}

export function apiPatch<T>(path: string, body: JsonBody, fallbackError = "השמירה נכשלה"): Promise<T> {
  return request<T>(
    path,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    fallbackError
  );
}

export function apiDelete<T>(path: string, fallbackError = "המחיקה נכשלה"): Promise<T> {
  return request<T>(path, { method: "DELETE" }, fallbackError);
}

export function invoicePrintUrl(invoiceId: string): string {
  return `${API_URL}/v1/invoices/${invoiceId}/export-html`;
}
