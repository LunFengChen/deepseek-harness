import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@x1a0f3n9/dsh-session-projection'

declare module '@x1a0f3n9/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}
