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

    for (
      const handler
      of handlers
    ) {
      (handler as EventHandler<T>)(event)
    }
  }

  clear() {
    this.handlers.clear()
  }
}