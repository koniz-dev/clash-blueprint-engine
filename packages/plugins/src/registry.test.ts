import { describe, expect, it } from "vitest";
import type { Renderer } from "./ports.js";
import { PluginRegistry } from "./registry.js";

const fakeRenderer = (id: string): Renderer => ({
  id,
  kind: "renderer",
  format: id,
  extension: id,
  mimeType: "text/plain",
  render: () => `<${id}>`,
});

describe("PluginRegistry", () => {
  it("registers and looks up a renderer by id", () => {
    const registry = new PluginRegistry();
    registry.registerRenderer(fakeRenderer("ascii"));
    expect(registry.getRenderer("ascii")?.render({} as never)).toBe("<ascii>");
    expect(registry.renderers()).toHaveLength(1);
  });

  it("supports a fluent chain of registrations", () => {
    const registry = new PluginRegistry()
      .registerRenderer(fakeRenderer("ascii"))
      .registerRenderer(fakeRenderer("svg"));
    expect(registry.renderers().map((r) => r.id)).toEqual(["ascii", "svg"]);
  });

  it("rejects duplicate ids", () => {
    const registry = new PluginRegistry();
    registry.registerRenderer(fakeRenderer("ascii"));
    expect(() => registry.registerRenderer(fakeRenderer("ascii"))).toThrow(/already registered/);
  });

  it("returns undefined for unknown ids", () => {
    expect(new PluginRegistry().getRenderer("nope")).toBeUndefined();
  });
});
