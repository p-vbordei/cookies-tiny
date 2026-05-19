import { describe, it, expect } from "vitest";
import { parse, serialize, parseSetCookie } from "../src/index.js";

describe("parse: Cookie request header", () => {
  it("simple", () => {
    expect(parse("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });
  it("url-decodes values", () => {
    expect(parse("name=Vlad%20Bordei")).toEqual({ name: "Vlad Bordei" });
  });
  it("strips surrounding quotes", () => {
    expect(parse('q="hello"')).toEqual({ q: "hello" });
  });
  it("first occurrence wins (RFC 6265)", () => {
    expect(parse("a=first; a=second")).toEqual({ a: "first" });
  });
  it("empty input → empty object", () => {
    expect(parse("")).toEqual({});
    expect(parse("   ")).toEqual({});
  });
  it("ignores parts without =", () => {
    expect(parse("a=1; broken; b=2")).toEqual({ a: "1", b: "2" });
  });
  it("invalid percent encoding falls back to raw", () => {
    expect(parse("a=%E0%A4")).toEqual({ a: "%E0%A4" });
  });
});

describe("serialize: Set-Cookie value", () => {
  it("basic", () => {
    expect(serialize("session", "abc")).toBe("session=abc");
  });
  it("url-encodes value by default", () => {
    expect(serialize("name", "Vlad Bordei")).toBe("name=Vlad%20Bordei");
  });
  it("all attributes", () => {
    const out = serialize("session", "abc", {
      domain: "example.com",
      path: "/",
      maxAge: 3600,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
    expect(out).toBe(
      "session=abc; Domain=example.com; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax",
    );
  });
  it("Expires uses UTC string", () => {
    const out = serialize("a", "1", { expires: new Date("2026-12-31T23:59:59Z") });
    expect(out).toContain("Expires=Thu, 31 Dec 2026 23:59:59 GMT");
  });
  it("SameSite=None requires Secure", () => {
    expect(() => serialize("a", "1", { sameSite: "None" })).toThrow(/Secure/);
    expect(() => serialize("a", "1", { sameSite: "None", secure: true })).not.toThrow();
  });
  it("normalizes sameSite case", () => {
    expect(serialize("a", "1", { sameSite: "strict" })).toContain("SameSite=Strict");
    expect(serialize("a", "1", { sameSite: "lax" })).toContain("SameSite=Lax");
  });
  it("rejects invalid cookie name", () => {
    expect(() => serialize("bad name", "1")).toThrow();
    expect(() => serialize("a;b", "1")).toThrow();
  });
  it("rejects invalid maxAge", () => {
    expect(() => serialize("a", "1", { maxAge: 1.5 })).toThrow();
  });
});

describe("parseSetCookie", () => {
  it("simple", () => {
    expect(parseSetCookie("a=1")).toMatchObject({ name: "a", value: "1", secure: false, httpOnly: false });
  });
  it("full attributes", () => {
    const r = parseSetCookie("session=abc; Domain=example.com; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax");
    expect(r).toMatchObject({
      name: "session",
      value: "abc",
      domain: "example.com",
      path: "/",
      maxAge: 3600,
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
  });
  it("parses Expires", () => {
    const r = parseSetCookie("a=1; Expires=Thu, 31 Dec 2026 23:59:59 GMT");
    expect(r?.expires?.toUTCString()).toBe("Thu, 31 Dec 2026 23:59:59 GMT");
  });
  it("returns null for invalid input", () => {
    expect(parseSetCookie("")).toBeNull();
    expect(parseSetCookie("no equals here")).toBeNull();
  });
  it("attribute name is case-insensitive", () => {
    const r = parseSetCookie("a=1; samesite=strict; httponly; secure");
    expect(r?.sameSite).toBe("Strict");
    expect(r?.httpOnly).toBe(true);
    expect(r?.secure).toBe(true);
  });
});

describe("round-trip", () => {
  it("serialize then parse", () => {
    const out = serialize("session", "Hello World!", {
      maxAge: 3600,
      httpOnly: true,
      sameSite: "Lax",
    });
    const r = parseSetCookie(out);
    expect(r?.name).toBe("session");
    expect(r?.value).toBe("Hello World!");
    expect(r?.maxAge).toBe(3600);
    expect(r?.httpOnly).toBe(true);
    expect(r?.sameSite).toBe("Lax");
  });
});
