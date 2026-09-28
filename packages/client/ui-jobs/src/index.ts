/**
 * Node half of the background-job list plugin. The browser half in
 * `src/client/` owns every contribution; this entry exists so the package
 * appears as an ordinary Loader row.
 * @module @x1a0f3n9/dsh-client-ui-jobs
 */

/** Loader-visible no-op body; the browser half carries the feature. */
export function apply(): void {}
