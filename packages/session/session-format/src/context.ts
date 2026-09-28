import type {
  SessionFormatEvent,
  SessionFormatEventRun,
  SessionFormatMigrationContext,
} from './types.ts'

/** Migration output context that expands compact runs into retained events. */
export class SessionFormatEventCollector implements SessionFormatMigrationContext {
  /** Events retained by this collector in source order. Empty when a live sink is set. */
  readonly values: SessionFormatEvent[] = []

  /**
   * @param adoptEvent - optional live sink; when set, events are not retained in {@link values}.
   */
  constructor(private readonly adoptEvent?: (event: SessionFormatEvent) => void) {}

  /**
   * Retain one settled event, or deliver it to the live sink.
   * @param event - settled event emitted by the upstream stage.
   */
  emitEvent(event: SessionFormatEvent): void {
    if (this.adoptEvent !== undefined) {
      this.adoptEvent(event)
      return
    }
    this.values.push(event)
  }

  /**
   * Expand one compact run directly into retained events or the live sink.
   * @param run - compact event run emitted by the upstream stage.
   */
  emitRun(run: SessionFormatEventRun): void {
    for (const event of run.expand()) this.emitEvent(event)
  }
}
