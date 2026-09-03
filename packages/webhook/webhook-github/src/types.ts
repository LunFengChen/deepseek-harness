/** GitHub event values projected after signature verification. */

import type { JsonValue } from '@x1a0f3n9/dsh-util-values'

/** Signed GitHub JSON object. Event-specific field validation belongs to each rule. */
export type GitHubJsonObject = { readonly [key: string]: JsonValue }

/** Provider event supplied to `WebhookRule<'github'>`. */
export interface GitHubWebhookEvent {
  /** Raw `X-GitHub-Event` name such as `pull_request`. */
  readonly name: string
  /** Signed JSON object exactly as parsed from the request body. */
  readonly payload: GitHubJsonObject
}

declare module '@x1a0f3n9/dsh-webhook' {
  interface WebhookEventMap {
    github: GitHubWebhookEvent
  }
}

export type { EmitterWebhookEvent, EmitterWebhookEventName } from '@octokit/webhooks'
