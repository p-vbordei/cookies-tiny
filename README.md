# cookies-tiny

[![ci](https://github.com/p-vbordei/cookies-tiny/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cookies-tiny/actions/workflows/ci.yml)

Tiny RFC 6265 cookie parser and serializer. `Cookie` request header → object, `Set-Cookie` value ↔ object, with all the standard attributes (Domain, Path, Expires, Max-Age, Secure, HttpOnly, SameSite). Zero dependencies.

```ts
import { parse, serialize, parseSetCookie } from "cookies-tiny";

// Request header → object
parse("session=abc; locale=ro");          // { session: "abc", locale: "ro" }

// Build a Set-Cookie value
serialize("session", "abc", {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  maxAge: 3600,
});
// "session=abc; Max-Age=3600; HttpOnly; Secure; SameSite=Lax"

// Parse a Set-Cookie value back to a structured record
parseSetCookie("session=abc; Path=/; Max-Age=3600; HttpOnly");
// { name: "session", value: "abc", path: "/", maxAge: 3600, secure: false, httpOnly: true }
```

## Install

```sh
npm install cookies-tiny
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

## License

Apache-2.0 © Vlad Bordei
