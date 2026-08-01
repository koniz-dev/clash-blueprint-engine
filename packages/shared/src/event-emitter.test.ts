import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "./event-emitter.js";

type Events = { placed: { id: string }; removed: { id: string } };

describe("TypedEventEmitter", () => {
  it("delivers payloads to subscribers of the matching event only", () => {
    const bus = new TypedEventEmitter<Events>();
    const onPlaced = vi.fn();
    const onRemoved = vi.fn();
    bus.on("placed", onPlaced);
    bus.on("removed", onRemoved);

    bus.emit("placed", { id: "a" });

    expect(onPlaced).toHaveBeenCalledWith({ id: "a" });
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("unsubscribes via the returned disposer", () => {
    const bus = new TypedEventEmitter<Events>();
    const listener = vi.fn();
    const off = bus.on("placed", listener);
    off();
    bus.emit("placed", { id: "a" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("once fires exactly one time", () => {
    const bus = new TypedEventEmitter<Events>();
    const listener = vi.fn();
    bus.once("placed", listener);
    bus.emit("placed", { id: "a" });
    bus.emit("placed", { id: "b" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tolerates unsubscribing during dispatch", () => {
    const bus = new TypedEventEmitter<Events>();
    const calls: string[] = [];
    const off = bus.on("placed", () => {
      calls.push("first");
      off();
    });
    bus.on("placed", () => calls.push("second"));
    bus.emit("placed", { id: "a" });
    expect(calls).toEqual(["first", "second"]);
  });
});
