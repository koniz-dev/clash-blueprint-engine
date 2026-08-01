import { TypedEventEmitter } from "@clash/shared";
import type { DomainEvent, StoredEvent } from "./events.js";

interface EventStoreEvents extends Record<string, unknown> {
  appended: StoredEvent;
}

/**
 * Append-only log of domain events. Assigns a monotonic sequence to each and
 * notifies subscribers, enabling a live timeline, replay and (later) syncing
 * events between collaborators. The store never mutates or drops history.
 */
export class EventStore {
  readonly #events: StoredEvent[] = [];
  readonly #emitter = new TypedEventEmitter<EventStoreEvents>();

  append(event: DomainEvent, source?: string): StoredEvent {
    const stored: StoredEvent =
      source === undefined
        ? { sequence: this.#events.length, event }
        : { sequence: this.#events.length, event, source };
    this.#events.push(stored);
    this.#emitter.emit("appended", stored);
    return stored;
  }

  /** All events in order. Defensive copy — callers cannot mutate history. */
  all(): ReadonlyArray<StoredEvent> {
    return [...this.#events];
  }

  get length(): number {
    return this.#events.length;
  }

  /** Subscribe to newly appended events. Returns an unsubscribe function. */
  onAppended(listener: (stored: StoredEvent) => void): () => void {
    return this.#emitter.on("appended", listener);
  }
}
