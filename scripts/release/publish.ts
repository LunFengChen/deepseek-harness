/**
 * Publish one packed release family from the tarballs the pack step produced.
 *
 * Publication is decided per package against the registry, never from a list of
 * "what this release includes". Every member is probed first. Names the registry
 * lacks are published in the original order. Names already present are handled
 * afterwards: identical tarballs skip, a tagged mismatch fails, and a branch
 * allow-ref publish skips that mismatch because npm will not replace the version
 * ([rationale](../../.agents/notes/implemented/bug-fix/2026-09-11-publish-absent-names-first.md)).
 *
 * Skipping on identical integrity is what makes re-running the publish step over
 * the same artifact safe.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { attempt, attemptEchoed, isEntry } from './process.ts'
import { packedIdentity, readPublishOrder } from './tarball.ts'

/**
 * Registry codes that answer a write which did not settle, rather than a
 * rejection of what was sent. `E409 Failed to save packument` is a packument
 * race from back-to-back writes and may retry. `E429` is npm refusing further
 * writes after a burst, especially new package names; it is classified here so
 * the run can stop further PUTs, not retried. A rejected payload
 * (`E403` over an existing version, a malformed manifest) never clears on a
 * retry and must surface.
 */
const TRANSIENT_PUBLISH_CODES = ['E409', 'E429', 'E500', 'E502', 'E503', 'E504', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'] as const

/** How many times one tarball's publish is attempted before the run fails. */
export const PUBLISH_ATTEMPTS = 10

/**
 * Shortest gap between two PUTs, and the first `E409` retry backoff.
 *
 * The registry needs a moment to commit a packument before the next write; back
 * to back publishes are what produce `E409`. The same gap applies before the
 * first PUT after a skip-path `npm view` burst.
 */
export const PUBLISH_SPACING_MS = 5_000

/**
 * Shortest gap before every `npm view`. Skip-path probes with no delay spend
 * the same write-adjacent quota the first PUT needs.
 */
export const REGISTRY_PROBE_SPACING_MS = 1_000

/** How many `E429` answers one tarball may retry before this run stops PUTs. */
export const RATE_LIMIT_ATTEMPTS = 1

/**
 * npm refused further new-package writes. Remaining absent names wait for a
 * later run; this error is not retried.
 */
export class NpmWriteQuotaError extends Error {
  override readonly name = 'NpmWriteQuotaError'

  /**
   * @param packageName - member that received `E429`.
   * @param packageVersion - version that was being published.
   * @param output - combined npm output.
   */
  constructor(
    readonly packageName: string,
    readonly packageVersion: string,
    output: string,
  ) {
    super(
      `npm publish ${packageName}@${packageVersion} hit the npm new-package write quota (E429).\n${output}`,
    )
  }
}

let lastRegistryCallAt = 0

/** What the registry knows about one version. */
type RegistryState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly integrity: string }

/**
 * Whether a failed publish is worth another attempt.
 * @param output - combined npm output.
 * @returns True when the registry reported a write it did not commit.
 */
export function isTransientFailure(output: string): boolean {
  return TRANSIENT_PUBLISH_CODES.some(code => output.includes(`code ${code}`))
}

/**
 * Whether a failed publish is an npm write-budget rejection rather than a packument race.
 * @param output - combined npm output.
 * @returns True when npm reported `E429`.
 */
export function isRateLimited(output: string): boolean {
  return output.includes('code E429')
}

/**
 * How long to wait before the next publish attempt after a packument race.
 * `E429` never reaches this helper: the run stops PUTs on the first rate limit.
 * @param output - combined npm output of the failed attempt.
 * @param tries - 1-based attempt that just failed.
 * @returns Backoff in milliseconds.
 */
export function retryBackoffMs(output: string, tries: number): number {
  void output
  return PUBLISH_SPACING_MS * 2 ** (tries - 1)
}

/**
 * Wait until `minGapMs` has passed since the previous registry call, then mark
 * the next call as started.
 * @param minGapMs - shortest allowed gap before this call.
 */
async function spaceRegistryCall(minGapMs: number): Promise<void> {
  const wait = lastRegistryCallAt + minGapMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastRegistryCallAt = Date.now()
}

/**
 * How to treat a version the registry already has.
 *
 * Tagged releases fail on a byte mismatch so a changed payload cannot reuse a
 * version. A branch allow-ref publish skips: npm will not replace the version.
 * Callers run this only after every absent name has been attempted.
 * @param localIntegrity - sha512 of the packed tarball.
 * @param registryIntegrity - `dist.integrity` npm recorded for this version.
 * @param allowRef - `RELEASE_PUBLISH_ALLOW_REF`, or empty for tag-only publishes.
 * @returns `skip` to leave the registry bytes in place, or `fail` to stop the run.
 */
export function existingPublishedVersionAction(
  localIntegrity: string,
  registryIntegrity: string,
  allowRef: string,
): 'skip' | 'fail' {
  if (localIntegrity === registryIntegrity) return 'skip'
  return allowRef === '' ? 'fail' : 'skip'
}

/**
 * How a branch vs tagged publish treats npm's new-package write quota.
 *
 * A tagged release must fail: the version did not finish publishing. A branch
 * allow-ref publish pauses: already-published names are skipped on the next
 * push, and GitHub Actions is not a drip queue.
 * @param allowRef - `RELEASE_PUBLISH_ALLOW_REF`, or empty for tag-only publishes.
 * @returns `pause` to exit 0 after stopping PUTs, or `fail` to fail the job.
 */
export function rateLimitedPublishAction(allowRef: string): 'pause' | 'fail' {
  return allowRef === '' ? 'fail' : 'pause'
}

/** Registry membership used to split a family into publish passes. */
export type PublishRegistryKind = 'absent' | 'present'

/**
 * Split probed members into an absent pass and a present pass.
 *
 * Each pass keeps the original order. Absent names consume the new-package
 * write quota. A present mismatch must not fail before unpublished members
 * are attempted.
 * @param members - family members in publish-order, each already probed.
 * @returns absent names first, then names the registry already has.
 */
export function partitionPublishPasses<T extends { readonly kind: PublishRegistryKind }>(
  members: readonly T[],
): { readonly absent: readonly T[]; readonly present: readonly T[] } {
  return {
    absent: members.filter(member => member.kind === 'absent'),
    present: members.filter(member => member.kind === 'present'),
  }
}

/**
 * The subresource integrity string npm records for a tarball.
 * @param tarball - absolute tarball path.
 * @returns A `sha512-<base64>` string.
 */
function integrityOf(tarball: string): string {
  return `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
}

/**
 * Ask the registry whether a version exists, and with what integrity.
 * @param name - package name.
 * @param version - package version.
 * @returns The registry state for that version.
 */
async function registryState(name: string, version: string): Promise<RegistryState> {
  await spaceRegistryCall(REGISTRY_PROBE_SPACING_MS)
  const result = attempt('npm', ['view', `${name}@${version}`, 'dist.integrity', '--json'])
  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`
    if (output.includes('E404') || output.includes('404 Not Found')) return { kind: 'absent' }
    throw new Error(`npm view ${name}@${version} failed:\n${output}`)
  }
  const parsed: unknown = JSON.parse(result.stdout)
  if (typeof parsed !== 'string' || parsed === '') {
    throw new Error(`registry reported no dist.integrity for ${name}@${version}`)
  }
  return { kind: 'present', integrity: parsed }
}

/**
 * Publish one tarball, retrying a registry write that did not settle.
 *
 * Every retry re-reads the registry first, because `E409` can answer a write
 * that landed anyway: republishing a version that now exists fails permanently,
 * so the same integrity appearing under the failed attempt counts as success.
 * @param tarball - absolute tarball path.
 * @param name - package name the tarball declares.
 * @param version - package version the tarball declares.
 * @param distTag - explicit npm dist-tag, or undefined for npm's `latest` default.
 */
async function publishTarball(
  tarball: string,
  name: string,
  version: string,
  distTag: string | undefined,
): Promise<void> {
  const tagArgs = distTag === undefined ? [] : ['--tag', distTag]
  for (let tries = 1; tries <= PUBLISH_ATTEMPTS; tries += 1) {
    // No --access: every release member declares its own publishConfig, and
    // a command-line flag would override it. check-workspace-constraints
    // requires a public access level on every release member.
    await spaceRegistryCall(PUBLISH_SPACING_MS)
    const result = attemptEchoed('npm', ['publish', tarball, ...tagArgs, '--fetch-retries', '0'])
    const output = `${result.stdout}${result.stderr}`
    if (result.status === 0) return

    const settled = await registryState(name, version)
    if (settled.kind === 'present' && settled.integrity === integrityOf(tarball)) {
      console.log(`release publish: ${name}@${version} landed despite a reported failure, continuing`)
      return
    }
    if (tries === PUBLISH_ATTEMPTS || !isTransientFailure(output)) {
      throw new Error(`npm publish ${name}@${version} failed:\n${output}`)
    }
    if (isRateLimited(output) && tries >= RATE_LIMIT_ATTEMPTS) {
      throw new NpmWriteQuotaError(name, version, output)
    }
    const backoff = retryBackoffMs(output, tries)
    console.log(
      `release publish: ${name}@${version} hit a transient registry failure`
      + ` (attempt ${String(tries)} of ${String(PUBLISH_ATTEMPTS)}), retrying in ${String(backoff)}ms`,
    )
    await sleep(backoff)
  }
}

/** One packed family member after its registry probe. */
interface ProbedMember {
  readonly index: number
  readonly tarball: string
  readonly name: string
  readonly version: string
  readonly kind: PublishRegistryKind
  readonly registryIntegrity: string | undefined
}

/** Publish the family named by `--family` from the directory named by `--from`. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, from: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.family === undefined || values.from === undefined) {
    throw new Error('usage: publish.ts --family <dsh|vendor> --from <packed directory>')
  }

  const family = releaseFamily(values.family)
  const directory = resolve(process.cwd(), values.from)

  // Every entry in the order settles as either published or already present, so
  // one counter answers "how far along is this run" for whoever is watching a
  // release that takes minutes per family.
  const order = readPublishOrder(directory)
  const total = String(order.length)
  const probed: ProbedMember[] = []
  for (const [index, filename] of order.entries()) {
    const tarball = join(directory, filename)
    const { name, version } = packedIdentity(tarball)
    const state = await registryState(name, version)
    probed.push({
      index,
      tarball,
      name,
      version,
      kind: state.kind,
      registryIntegrity: state.kind === 'present' ? state.integrity : undefined,
    })
  }

  const { absent, present } = partitionPublishPasses(probed)
  let published = 0
  let skipped = 0
  let quotaPaused = false
  const allowRef = process.env.RELEASE_PUBLISH_ALLOW_REF?.trim() ?? ''

  for (const member of absent) {
    const progress = `[${String(member.index + 1)}/${total}]`
    try {
      await publishTarball(member.tarball, member.name, member.version, family.distTagForVersion(member.version))
    } catch (error) {
      if (
        error instanceof NpmWriteQuotaError
        && rateLimitedPublishAction(allowRef) === 'pause'
      ) {
        console.log(
          `release publish: ${progress} paused at ${error.packageName}@${error.packageVersion} after npm E429;`
          + ' remaining absent names wait for a later push',
        )
        quotaPaused = true
        break
      }
      throw error
    }
    console.log(`release publish: ${progress} ${member.name}@${member.version} published`)
    published += 1
  }

  for (const member of present) {
    const progress = `[${String(member.index + 1)}/${total}]`
    const local = integrityOf(member.tarball)
    const registryIntegrity = member.registryIntegrity
    if (registryIntegrity === undefined) {
      throw new Error(`release publish: ${member.name}@${member.version} probed present without integrity`)
    }
    if (existingPublishedVersionAction(local, registryIntegrity, allowRef) === 'fail') {
      throw new Error(
        `${member.name}@${member.version} is already published with different content`
        + `\n  registry: ${registryIntegrity}\n  packed:   ${local}`
        + '\nBump the version, or investigate why the build is not reproducible.',
      )
    }
    if (local !== registryIntegrity) {
      console.log(
        `release publish: ${progress} ${member.name}@${member.version} already published with different content, skipping`
        + `\n  registry: ${registryIntegrity}\n  packed:   ${local}`,
      )
    } else {
      console.log(`release publish: ${progress} ${member.name}@${member.version} already published, skipping`)
    }
    skipped += 1
  }

  console.log(
    `release publish: family ${family.id}, ${total} member(s),`
    + ` ${String(published)} published, ${String(skipped)} already present`
    + (quotaPaused
      ? `, paused on npm new-package write quota (${String(absent.length - published)} absent remaining)`
      : ''),
  )
}

if (isEntry(import.meta.url)) await main()
