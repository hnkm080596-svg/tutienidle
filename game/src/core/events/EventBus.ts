export type EventHandler<T> =
  (event: T) => void

export class EventBus {
  private handlers =
    new Map<string, Set<EventHandler<never>>>()

  on<T>(
    eventType: string,
    handler: EventHandler<T>,
  ) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(
        eventType,
        new Set(),
      )
    }

    this.handlers
      .get(eventType)!
      .add(handler as EventHandler<never>)
  }

  off<T>(
    eventType: string,
    handler: EventHandler<T>,
  ) {
    this.handlers
      .get(eventType)
      ?.delete(handler as EventHandler<never>)
  }

  emit<T>(
    eventType: string,
    event: T,
  ) {
    const handlers =
      this.handlers.get(eventType)

    if (!handlers) {
      return
    }

    // Snapshot before dispatch (audit T5-49): handlers added mid-emit fire
    // next time, never mid-iteration; each handler is isolated so one
    // throw cannot abort the chain or reach core tick emitters.
    for (
      const handler
      of [...handlers]
    ) {
      try {
        (handler as EventHandler<T>)(event)
      } catch (error: unknown) {
        console.error(`[EventBus] listener for "${eventType}" threw`, error)
      }
    }
  }

  clear() {
    this.handlers.clear()
  }
}