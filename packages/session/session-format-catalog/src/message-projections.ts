/** Pure first-party message interpreters for detached current-format replay, including browser readers. */

import { imageOffloadProjection } from '@x1a0f3n9/dsh-compaction-image-offload/projection'
import type { SessionMessageProjection } from '@x1a0f3n9/dsh-session/surface'

/** Installed interpretation definitions; recovery listeners are mounted separately by their owning plugins. */
export const currentSessionMessageProjections: readonly SessionMessageProjection[] = [imageOffloadProjection]
