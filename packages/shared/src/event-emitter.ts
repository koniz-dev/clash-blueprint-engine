/**
 * Minimal, fully-typed synchronous event bus. Powers the engine's event-driven
 * architecture without depending on Node's `EventEmitter` or the DOM, so it
 * runs unchanged on web, CLI, desktop and mobile.
 *
 * `EventMap` maps an event name to its payload type:
 *
 * ```ts
 * type Events = { placed: { id: string }; removed: { id: string } };
 * const bus = new TypedEventEmitter<Events>();
 * bus.on("placed", (e) => e.id); // e is fully typed
 * ```
 */
export type Listener<Payload> = (payload: Payload) => void;

export type Unsubscribe = () => void;

export class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  readonly #listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.#listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.#listeners.get(event);
    if (!set) return;
    // Copy so listeners may safely unsubscribe (or subscribe) during dispatch.
    for (const listener of [...set]) {
      (listener as Listener<EventMap[K]>)(payload);
    }
  }

  removeAllListeners(): void {
    this.#listeners.clear();
  }
}
