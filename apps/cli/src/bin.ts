#!/usr/bin/env node
/**
 * Command-line entry for dsh.
 * @module @x1a0f3n9/dsh/bin
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { getDshRuntimeVersion, loadLayeredEnv, registerOfficialDshPackageResolve, StartupError } from '@x1a0f3n9/dsh-app-boot'
import { resolveDshHome } from '@x1a0f3n9/dsh-home-paths'
import { parseDshArgs } from './args.ts'
import { reportStartupFailure } from './startup-diagnostics.ts'

/**
 * Apply fork-only defaults without overriding explicit user configuration.
 * Profiles and plugins live under `~/.xfdsh`; durable session data remains in
 * the official `~/.dsh` location so both launchers can read the same history.
 * Unset `HINDSIGHT_SERVER_MODE` becomes `daemon` so Hindsight uses a local
 * embed instead of Hindsight Cloud. An explicit env value still wins; a
 * `serverMode` in `~/.hindsight/coding-agent.json` also still wins.
 * @param env - mutable process environment used by the launcher.
 */
export function applyForkDefaults(env: Record<string, string | undefined> = process.env): void {
  if (env.DSH_HOME === undefined || env.DSH_HOME.trim().length === 0) env.DSH_HOME = join(homedir(), '.xfdsh')
  if (env.DSH_SESSION_HOME === undefined || env.DSH_SESSION_HOME.trim().length === 0) {
    env.DSH_SESSION_HOME = join(homedir(), '.dsh')
  }
  if (env.DSH_WEB_DEFAULT_PORT === undefined || env.DSH_WEB_DEFAULT_PORT.trim().length === 0) {
    env.DSH_WEB_DEFAULT_PORT = '7777'
  }
  if (env.HINDSIGHT_SERVER_MODE === undefined || env.HINDSIGHT_SERVER_MODE.trim().length === 0) {
    env.HINDSIGHT_SERVER_MODE = 'daemon'
  }
}

/**
 * Run the public dsh command-line interface.
 * @returns a promise that settles when the selected command mode finishes.
 */
export async function runCli(): Promise<void> {
  const version = getDshRuntimeVersion()
  const invocation = parseDshArgs(process.argv.slice(2), version)
  applyForkDefaults()
  registerOfficialDshPackageResolve()

  switch (invocation.mode) {
    case 'profile': {
      const { runProfile } = await import('./profile-boot.ts')
      try {
        await runProfile({
          environment: loadLayeredEnv('dsh'),
          profile: invocation.profile,
          fromDefaultProfile: invocation.fromDefaultProfile,
          patchFiles: invocation.patches,
          args: invocation.args,
        })
      } catch (error) {
        if (!(error instanceof StartupError)) throw error
        await reportStartupFailure(error, { home: resolveDshHome(), version, profile: invocation.profile })
        process.exit(1)
      }
      break
    }
    case 'plugin': {
      const { runPlugin } = await import('./plugin.ts')
      process.exit(await runPlugin(invocation.profile, invocation.args))
      break
    }
    case 'dump-config': {
      const { runDumpConfig } = await import('./dump-config.ts')
      runDumpConfig(
        invocation.profile,
        invocation.defaultOnly,
        invocation.patches,
        invocation.fromDefaultProfile,
      )
      break
    }
    case 'dump-config-schema': {
      const { runDumpConfigSchema } = await import('./dump-config-schema.ts')
      await runDumpConfigSchema(invocation.profile, invocation.patches, invocation.fromDefaultProfile)
      break
    }
    default:
      invocation satisfies never
      throw new Error(`dsh: unhandled invocation mode ${JSON.stringify(invocation)}`)
  }
}

if (import.meta.main) {
  await runCli()
}
