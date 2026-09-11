#!/usr/bin/env node
/**
 * Command-line entry for dsh.
 * @module @x1a0f3n9/dsh/bin
 */

/* v8 ignore file -- built-bin acceptance exercises this self-executing dispatch. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadLayeredEnv, registerOfficialDshPackageResolve } from '@x1a0f3n9/dsh-app-boot'
import { parseDshArgs } from './args.ts'

// Both the source tree (apps/cli/src) and the bundled bin (apps/cli/lib) sit
// one directory under apps/cli, so the checked-in manifest resolves with the
// same relative hop from either artifact.
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

function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version?: unknown }
  return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
}

/**
 * Run the public dsh command-line interface.
 * @returns a promise that settles when the selected command mode finishes.
 */
export async function runCli(): Promise<void> {
  const invocation = parseDshArgs(process.argv.slice(2), readVersion())
  applyForkDefaults()
  registerOfficialDshPackageResolve()

  switch (invocation.mode) {
    case 'profile': {
      const { runProfile } = await import('./profile-boot.ts')
      await runProfile({
        environment: loadLayeredEnv('dsh'),
        profile: invocation.profile,
        fromDefaultProfile: invocation.fromDefaultProfile,
        patchFiles: invocation.patches,
        args: invocation.args,
      })
      break
    }
    case 'plugin': {
      const { runPlugin } = await import('./plugin.ts')
      process.exit(runPlugin(invocation.profile, invocation.args))
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
    default:
      invocation satisfies never
      throw new Error(`dsh: unhandled invocation mode ${JSON.stringify(invocation)}`)
  }
}

if (import.meta.main) {
  await runCli()
}
