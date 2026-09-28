import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@x1a0f3n9/dsh-client-shortcuts',
  ['lib/types/index.js', 'lib/types/protocol.js'],
  { hostPhase: true },
)
