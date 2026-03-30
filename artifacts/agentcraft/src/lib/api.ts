/**
 * Central API utility.
 *
 * - Dev:  VITE_API_URL is empty → calls go to /api (Vite proxy → localhost:3001)
 * - Prod: VITE_API_URL = https://agentcraft-kexf.onrender.com → direct calls
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const workflows = await api.get("/api/workflows");
 *   const exec = await api.post("/api/executions", { workflowId: 1, input: "..." });
 */

// Resolved once at module load — baked in by Vite at build time.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function url(path: string): string {
    // path must start with /
    return `${BASE}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const endpoint = url(path);

    console.debug(`[api] ${init.method ?? "GET"} ${endpoint}`);

    const res = await fetch(endpoint, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...init.headers,
        },
    });

    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            detail = body?.detail ?? body?.error ?? detail;
        } catch { /* ignore parse errors */ }
        throw new ApiError(res.status, detail, endpoint);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly url: string,
    ) {
        super(`HTTP ${status}: ${message}`);
        this.name = "ApiError";
    }
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** The resolved backend base URL (useful for SSE endpoints). */
export const API_BASE = BASE;
