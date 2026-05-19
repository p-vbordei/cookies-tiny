# cookies-tiny

[![ci](https://github.com/p-vbordei/cookies-tiny/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cookies-tiny/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/cookies-tiny.svg)](https://www.npmjs.com/package/cookies-tiny)
[![downloads](https://img.shields.io/npm/dm/cookies-tiny.svg)](https://www.npmjs.com/package/cookies-tiny)
[![bundle](https://img.shields.io/bundlejs/size/cookies-tiny)](https://bundlejs.com/?q=cookies-tiny)

> Tiny RFC 6265 cookie parser and serializer. `Cookie` request header → object, `Set-Cookie` value ↔ object, with all the standard attributes. Zero dependencies.

```ts
import { parse, serialize, parseSetCookie } from "cookies-tiny";

parse("session=abc; locale=ro");
// { session: "abc", locale: "ro" }

serialize("session", "abc", {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  maxAge: 3600,
});
// "session=abc; Max-Age=3600; HttpOnly; Secure; SameSite=Lax"

parseSetCookie("session=abc; Path=/; Max-Age=3600; HttpOnly");
// { name: "session", value: "abc", path: "/", maxAge: 3600, secure: false, httpOnly: true }
```

## Install

```sh
npm install cookies-tiny
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

The classic `cookie` package on npm is ~700 lines of CJS-only code. `tough-cookie` is even bigger (with a full cookie jar). For a request handler that just needs to read `Cookie` and write `Set-Cookie`, you want something small, ESM-first, fully typed.

`cookies-tiny` is ~150 lines. RFC 6265 compliant where it matters (`SameSite=None` requires `Secure`, name validation, URL encoding by default).

## Recipes

### Plain `http` middleware

```ts
import { parse, serialize } from "cookies-tiny";

function cookieParser(req: IncomingMessage) {
  return parse(req.headers.cookie ?? "");
}

function setCookie(res: ServerResponse, name: string, value: string, opts: SerializeOptions) {
  const existing = res.getHeader("Set-Cookie") ?? [];
  const list = Array.isArray(existing) ? existing : [String(existing)];
  list.push(serialize(name, value, opts));
  res.setHeader("Set-Cookie", list);
}
```

### Session cookie

```ts
import { serialize } from "cookies-tiny";

const sessionCookie = serialize("sid", sessionId, {
  httpOnly: true,   // not readable by JS
  secure: true,     // HTTPS only
  sameSite: "Lax",  // CSRF protection
  path: "/",
  maxAge: 60 * 60 * 24 * 7,  // 1 week
});
```

### Delete a cookie

```ts
import { serialize } from "cookies-tiny";

const clear = serialize("sid", "", { path: "/", maxAge: 0 });
// Send as Set-Cookie to delete the client-side cookie
```

### Read cookies in a Next.js / Cloudflare Worker handler

```ts
import { parse } from "cookies-tiny";

export async function GET(req: Request) {
  const cookies = parse(req.headers.get("cookie") ?? "");
  const sessionId = cookies.sid;
  if (!sessionId) return new Response("Unauthorized", { status: 401 });
  // ...
}
```

### Inspect Set-Cookie from a fetch response

```ts
import { parseSetCookie } from "cookies-tiny";

const res = await fetch(url);
for (const raw of res.headers.getSetCookie()) {
  const parsed = parseSetCookie(raw);
  console.log("server set:", parsed?.name, "expires", parsed?.expires);
}
```

## API

### `parse(cookieHeader: string): Record<string, string>`

Parses the `Cookie` request header. URL-decodes values. First occurrence wins per RFC 6265. Returns `{}` for empty/invalid input — never throws.

### `serialize(name, value, opts?): string`

Builds a single `Set-Cookie` value. URL-encodes the value by default. Validates input and throws for invalid names/domains.

| Option | Type | Notes |
|---|---|---|
| `domain` | `string` | |
| `path` | `string` | |
| `expires` | `Date` | Emitted as `Expires=<UTC>` |
| `maxAge` | `number` (integer seconds) | Use `0` to delete |
| `secure` | `boolean` | |
| `httpOnly` | `boolean` | |
| `sameSite` | `"Strict" \| "Lax" \| "None"` (case-insensitive) | `None` requires `secure: true` |
| `raw` | `boolean` | Skip URL-encoding (only for already-safe values) |

### `parseSetCookie(setCookieHeader: string): ParsedSetCookie | null`

Parses a single `Set-Cookie` header value into `{ name, value, domain?, path?, expires?, maxAge?, secure, httpOnly, sameSite? }`. Returns `null` for invalid input.

## Caveats

- **Single header at a time.** `parseSetCookie` parses one value. If you have multiple `Set-Cookie` headers in a response, iterate them (e.g. via `headers.getSetCookie()` in modern fetch).
- **No cookie jar.** No domain/path matching for outgoing requests. If you're building a programmatic HTTP client that needs to send cookies it received, use `tough-cookie` or implement matching yourself.
- **`SameSite=None` requires `Secure`** — `serialize` throws if you violate this. Intentional.

## License

Apache-2.0 © Vlad Bordei
