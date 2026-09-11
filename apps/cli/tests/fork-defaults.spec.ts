import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyForkDefaults } from '../src/bin.ts'

describe('applyForkDefaults', () => {
  it('isolates plugins under ~/.xfdsh while sharing ~/.dsh session data', () => {
    const env: Record<string, string | undefined> = {}
    applyForkDefaults(env)
    expect(env.DSH_HOME).toBe(join(homedir(), '.xfdsh'))
    expect(env.DSH_SESSION_HOME).toBe(join(homedir(), '.dsh'))
    expect(env.DSH_WEB_DEFAULT_PORT).toBe('7777')
    expect(env.HINDSIGHT_SERVER_MODE).toBe('daemon')
  })

  it('does not override explicit launcher configuration', () => {
    const env: Record<string, string | undefined> = {
      DSH_HOME: '/tmp/custom-xfdsh',
      DSH_SESSION_HOME: '/tmp/custom-sessions',
      DSH_WEB_DEFAULT_PORT: '9999',
      HINDSIGHT_SERVER_MODE: 'cloud',
    }
    applyForkDefaults(env)
    expect(env.DSH_HOME).toBe('/tmp/custom-xfdsh')
    expect(env.DSH_SESSION_HOME).toBe('/tmp/custom-sessions')
    expect(env.DSH_WEB_DEFAULT_PORT).toBe('9999')
    expect(env.HINDSIGHT_SERVER_MODE).toBe('cloud')
  })
})
