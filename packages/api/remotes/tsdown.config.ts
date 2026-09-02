import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@xfcodeai/dsh-api-remotes',
  ['lib/types/index.js'],
  { hostPhase: true },
)
