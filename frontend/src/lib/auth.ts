import type {
  AuthUser,
  Observation,
  ObservationInput,
  RegistrationInput,
} from "@/types/auth";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

async function requestJson<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      cache: "no-store",
      signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the account API at ${apiBaseUrl}. Start FastAPI and verify NEXT_PUBLIC_API_BASE_URL.`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return requestJson("/api/v1/auth/me", "GET", undefined, signal);
}

export function registerAccount(input: RegistrationInput): Promise<{ message: string }> {
  return requestJson("/api/v1/auth/register", "POST", input);
}

export function signIn(email: string, password: string): Promise<AuthUser> {
  return requestJson("/api/v1/auth/login", "POST", { email, password });
}

export function signOut(): Promise<{ message: string }> {
  return requestJson("/api/v1/auth/logout", "POST", {});
}



export function getObservations(): Promise<Observation[]> {
  return requestJson("/api/v1/observations");
}

export function createObservation(input: ObservationInput): Promise<Observation> {
  return requestJson("/api/v1/observations", "POST", input);
}

export function updateObservationNotes(id: number, notes: string): Promise<Observation> {
  return requestJson(`/api/v1/observations/${id}`, "PATCH", { notes });
}

export function deleteObservation(id: number): Promise<void> {
  return requestJson(`/api/v1/observations/${id}`, "DELETE");
}

export function deleteAccount(): Promise<void> {
  return requestJson("/api/v1/auth/me", "DELETE");
}
