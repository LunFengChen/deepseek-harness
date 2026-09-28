import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@x1a0f3n9/dsh-api-job-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
