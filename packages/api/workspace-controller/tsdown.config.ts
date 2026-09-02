import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@xfcodeai/dsh-api-workspace-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
