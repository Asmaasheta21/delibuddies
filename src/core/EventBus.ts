type EventMap = Record<string, unknown>;

type Handler<Payload> = (payload: Payload) => void;

/**
 * Minimal typed pub/sub. Keeps systems (UI, audio, missions) decoupled from
 * whichever object emits a given event, so Phase 2 networking can subscribe
 * to the same events a local system does without rewiring call sites.
 */
export class EventBus<Events extends EventMap> {
  private readonly listeners: {
    [K in keyof Events]?: Set<Handler<Events[K]>>;
  } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const set = this.listeners[event] ?? new Set<Handler<Events[K]>>();
    set.add(handler);
    this.listeners[event] = set;
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.listeners[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear(): void {
    for (const key of Object.keys(this.listeners) as Array<keyof Events>) {
      delete this.listeners[key];
    }
  }
}
