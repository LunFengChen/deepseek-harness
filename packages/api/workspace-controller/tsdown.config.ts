import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@x1a0f3n9/dsh-api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
