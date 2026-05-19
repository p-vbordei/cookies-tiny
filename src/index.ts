// Token regex per RFC 6265 / 7230 §3.2.6 — covers cookie names and unquoted values.
const TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export type SameSite = "Strict" | "Lax" | "None";

/**
 * Parse a `Cookie` request header into a name → value object.
 *
 * - URL-decodes values when valid.
 * - First-occurrence wins (RFC 6265 §5.4).
 * - Returns `{}` for empty/invalid input — never throws.
 */
export function parse(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof header !== "string" || !header) return out;
  for (const piece of header.split(";")) {
    const idx = piece.indexOf("=");
    if (idx < 0) continue;
    const name = piece.slice(0, idx).trim();
    if (!name) continue;
    let value = piece.slice(idx + 1).trim();
    if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    if (out[name] !== undefined) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export interface SerializeOptions {
  domain?: string;
  path?: string;
  /** Expires (Date). If you set both `expires` and `maxAge`, both are emitted. */
  expires?: Date;
  /** Max-Age in seconds. Use `0` to delete a cookie. */
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSite | "strict" | "lax" | "none";
  /** Skip URL-encoding the value. Defaults to false. Use only when value is already safe. */
  raw?: boolean;
}

function normalizeSameSite(s: NonNullable<SerializeOptions["sameSite"]>): SameSite {
  const lower = s.toString().toLowerCase();
  if (lower === "strict") return "Strict";
  if (lower === "lax") return "Lax";
  if (lower === "none") return "None";
  throw new Error(`invalid sameSite: ${s}`);
}

/**
 * Serialize a single `Set-Cookie` header value.
 *
 * ```
 * serialize("session", "abc123", { httpOnly: true, secure: true, maxAge: 3600, sameSite: "Lax" })
 * // "session=abc123; Max-Age=3600; HttpOnly; Secure; SameSite=Lax"
 * ```
 */
export function serialize(name: string, value: string, opts: SerializeOptions = {}): string {
  if (!TOKEN_RE.test(name)) throw new Error(`invalid cookie name: ${JSON.stringify(name)}`);
  const encoded = opts.raw ? value : encodeURIComponent(value);
  if (opts.raw && !/^[!#-+--:<-[]-~]*$/.test(encoded)) {
    throw new Error(`raw value contains invalid cookie-octet characters`);
  }
  const parts: string[] = [`${name}=${encoded}`];
  if (opts.domain !== undefined) {
    if (!/^\.?[A-Za-z0-9.-]+$/.test(opts.domain)) throw new Error(`invalid domain: ${opts.domain}`);
    parts.push(`Domain=${opts.domain}`);
  }
  if (opts.path !== undefined) {
    if (/[\s;]/.test(opts.path)) throw new Error(`invalid path: ${opts.path}`);
    parts.push(`Path=${opts.path}`);
  }
  if (opts.maxAge !== undefined) {
    if (!Number.isInteger(opts.maxAge)) throw new Error(`maxAge must be an integer`);
    parts.push(`Max-Age=${opts.maxAge}`);
  }
  if (opts.expires !== undefined) {
    if (!(opts.expires instanceof Date) || Number.isNaN(opts.expires.getTime())) {
      throw new Error(`expires must be a valid Date`);
    }
    parts.push(`Expires=${opts.expires.toUTCString()}`);
  }
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) {
    const ss = normalizeSameSite(opts.sameSite);
    parts.push(`SameSite=${ss}`);
    if (ss === "None" && !opts.secure) {
      // The spec requires Secure on SameSite=None; we surface a friendly error.
      throw new Error("SameSite=None requires Secure=true");
    }
  }
  return parts.join("; ");
}

export interface ParsedSetCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: SameSite;
}

/**
 * Parse a single `Set-Cookie` header value into a structured object.
 * Returns `null` for invalid input (no `name=value` pair).
 */
export function parseSetCookie(header: string): ParsedSetCookie | null {
  if (typeof header !== "string" || !header) return null;
  const parts = header.split(";");
  const first = parts[0]!.trim();
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  let value = first.slice(eq + 1).trim();
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    value = value.slice(1, -1);
  }
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  const out: ParsedSetCookie = { name, value, secure: false, httpOnly: false };
  for (let i = 1; i < parts.length; i++) {
    const piece = parts[i]!.trim();
    const lower = piece.toLowerCase();
    if (lower === "secure") out.secure = true;
    else if (lower === "httponly") out.httpOnly = true;
    else if (lower.startsWith("domain=")) out.domain = piece.slice(7).trim();
    else if (lower.startsWith("path=")) out.path = piece.slice(5).trim();
    else if (lower.startsWith("max-age=")) {
      const n = Number(piece.slice(8).trim());
      if (Number.isFinite(n)) out.maxAge = n;
    } else if (lower.startsWith("expires=")) {
      const d = new Date(piece.slice(8).trim());
      if (!Number.isNaN(d.getTime())) out.expires = d;
    } else if (lower.startsWith("samesite=")) {
      const v = piece.slice(9).trim().toLowerCase();
      if (v === "strict") out.sameSite = "Strict";
      else if (v === "lax") out.sameSite = "Lax";
      else if (v === "none") out.sameSite = "None";
    }
  }
  return out;
}
