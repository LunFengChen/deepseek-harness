/**
 * Typed failures shared by subagent service and provider operations.
 *
 * @module @x1a0f3n9/dsh-subagent
 */

import { HarnessError } from '@x1a0f3n9/dsh-llm'

/** Typed failure for the subagent seam. */
export class SubagentError extends HarnessError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
    this.name = 'SubagentError'
  }
}
