export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {}
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "green-room",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      error: {
        code: "server_error",
        message: "Could not reach purpleroom. Try again.",
      },
    }));
    if (
      response.status === 401 &&
      !/^\/(login|auth|invite)(\/|$)/.test(window.location.pathname)
    ) {
      window.location.assign(
        `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      );
    }
    throw new ApiError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.fields
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
