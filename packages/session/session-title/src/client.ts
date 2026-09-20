/**
 * Client-namespace projection of the title domain: a pure re-export of the package's
 * types outlet. Client code imports ONLY the client namespace (repo
 * discipline), so `./client` projects the same single-source content
 * `./types` serves to host consumers — zero duplication.
 *
 * @module @x1a0f3n9/dsh-session-title/client
 */

export type * from './types.ts'
