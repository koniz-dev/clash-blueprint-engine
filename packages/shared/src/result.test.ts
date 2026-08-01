import { describe, expect, it } from "vitest";
import { err, flatMap, isErr, isOk, map, ok, unwrapOr } from "./result.js";

describe("Result", () => {
  it("constructs and narrows Ok", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("constructs and narrows Err", () => {
    const r = err("boom");
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.error).toBe("boom");
  });

  it("map transforms Ok and passes Err through", () => {
    expect(map(ok(2), (n) => n * 2)).toEqual(ok(4));
    expect(map(err<string>("e"), (n: number) => n * 2)).toEqual(err("e"));
  });

  it("flatMap chains fallible computations", () => {
    const half = (n: number) => (n % 2 === 0 ? ok(n / 2) : err("odd"));
    expect(flatMap(ok(8), half)).toEqual(ok(4));
    expect(flatMap(ok(7), half)).toEqual(err("odd"));
    expect(flatMap(err<string>("prior"), half)).toEqual(err("prior"));
  });

  it("unwrapOr falls back on error", () => {
    expect(unwrapOr(ok(1), 9)).toBe(1);
    expect(unwrapOr(err<string>("e"), 9)).toBe(9);
  });
});
