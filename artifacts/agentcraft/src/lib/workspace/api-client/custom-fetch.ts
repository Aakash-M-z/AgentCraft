export type CustomFetchOptions = RequestInit & {
    responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
    _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
    _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
    return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
    if (explicitMethod) return explicitMethod.toUpperCase();
    if (isRequest(input)) return input.method.toUpperCase();
    return "GET";
}

function isUrl(input: RequestInfo | URL): input is URL {
    return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
    if (!_baseUrl) return input;
    const url = resolveUrl(input);
    if (!url.startsWith("/")) return input;
    const absolute = `${_baseUrl}${url}`;
    if (typeof input === "string") return absolute;
    if (isUrl(input)) return new URL(absolute);
    return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (isUrl(input)) return input.toString();
    return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
    const headers = new Headers();
    for (const source of sources) {
        if (!source) continue;
        new Headers(source).forEach((value, key) => headers.set(key, value));
    }
    return headers;
}

function getMediaType(headers: Headers): string | null {
    const value = headers.get("content-type");
    return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(m: string | null) {
    return m === "application/json" || Boolean(m?.endsWith("+json"));
}

function isTextMediaType(m: string | null) {
    return Boolean(m && (m.startsWith("text/") || m === "application/xml" || m.endsWith("+xml")));
}

function hasNoBody(response: Response, method: string): boolean {
    if (method === "HEAD") return true;
    if (NO_BODY_STATUS.has(response.status)) return true;
    if (response.headers.get("content-length") === "0") return true;
    if (response.body === null) return true;
    return false;
}

function stripBom(text: string): string {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
    const t = text.trimStart();
    return t.startsWith("{") || t.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    const c = (value as Record<string, unknown>)[key];
    if (typeof c !== "string") return undefined;
    return c.trim() || undefined;
}

function buildErrorMessage(response: Response, data: unknown): string {
    const prefix = `HTTP ${response.status} ${response.statusText}`;
    if (typeof data === "string") return data.trim() ? `${prefix}: ${data.trim()}` : prefix;
    const msg = getStringField(data, "detail") ?? getStringField(data, "message") ?? getStringField(data, "error");
    return msg ? `${prefix}: ${msg}` : prefix;
}

export class ApiError<T = unknown> extends Error {
    readonly name = "ApiError";
    constructor(
        readonly response: Response,
        readonly data: T | null,
        readonly requestInfo: { method: string; url: string },
    ) {
        super(buildErrorMessage(response, data));
        Object.setPrototypeOf(this, new.target.prototype);
    }
    get status() { return this.response.status; }
    get statusText() { return this.response.statusText; }
    get headers() { return this.response.headers; }
    get method() { return this.requestInfo.method; }
    get url() { return this.response.url || this.requestInfo.url; }
}

async function parseBody(response: Response, method: string, requestInfo: { method: string; url: string }): Promise<unknown> {
    if (hasNoBody(response, method)) return null;
    const mediaType = getMediaType(response.headers);
    const raw = await response.text();
    const normalized = stripBom(raw);
    if (!normalized.trim()) return null;
    if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
        try { return JSON.parse(normalized); } catch { return raw; }
    }
    return raw;
}

export async function customFetch<T = unknown>(
    input: RequestInfo | URL,
    options: CustomFetchOptions = {},
): Promise<T> {
    input = applyBaseUrl(input);
    const { responseType = "auto", headers: headersInit, ...init } = options;
    const method = resolveMethod(input, init.method);
    const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

    if (typeof init.body === "string" && !headers.has("content-type") && looksLikeJson(init.body)) {
        headers.set("content-type", "application/json");
    }
    if (responseType === "json" && !headers.has("accept")) {
        headers.set("accept", DEFAULT_JSON_ACCEPT);
    }
    if (_authTokenGetter && !headers.has("authorization")) {
        const token = await _authTokenGetter();
        if (token) headers.set("authorization", `Bearer ${token}`);
    }

    const requestInfo = { method, url: resolveUrl(input) };
    const response = await fetch(input, { ...init, method, headers });

    if (!response.ok) {
        const errorData = await parseBody(response, method, requestInfo);
        throw new ApiError(response, errorData, requestInfo);
    }

    if (hasNoBody(response, method)) return undefined as T;
    if (response.status === 204) return undefined as T;

    const mediaType = getMediaType(response.headers);
    const raw = await response.text();
    const normalized = stripBom(raw);
    if (!normalized.trim()) return undefined as T;
    if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
        return JSON.parse(normalized) as T;
    }
    return raw as T;
}
