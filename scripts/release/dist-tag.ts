/**
 * Point an npm dist-tag at versions this family already published.
 *
 * Publication skips a version that is already on the registry, so a later
 * change to `distTagForVersion` cannot move `latest` by itself.
 * `release:dist-tag` writes the tag without packing or republishing
 * ([rationale](../../.agents/notes/implemented/process/2026-09-19-dsh-rc-latest-dist-tag.md)).
 */

import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { attempt, attemptEchoed, isEntry } from './process.ts'
import { PUBLISH_SPACING_MS, REGISTRY_PROBE_SPACING_MS, isRateLimited } from './publish.ts'

let lastRegistryCallAt = 0

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
 * Parse `npm view <name> dist-tags --json`.
 * @param output - JSON object of tag name to version.
 * @returns The dist-tag map.
 */
export function parseDistTags(output: string): Record<string, string> {
  const parsed: unknown = JSON.parse(output)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('npm dist-tags is not a JSON object')
  }
  const tags: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string' || value === '') {
      throw new Error(`npm dist-tag ${key} is not a version`)
    }
    tags[key] = value
  }
  return tags
}

/**
 * Whether a dist-tag already names the target version.
 * @param current - version the tag currently points at, if any.
 * @param version - version the tag should name.
 * @returns `skip` when the tag already matches, otherwise `add`.
 */
export function distTagAction(current: string | undefined, version: string): 'add' | 'skip' {
  return current === version ? 'skip' : 'add'
}

/**
 * Arguments for `npm dist-tag add <name>@<version> <tag>`.
 * @param name - package name.
 * @param version - published version.
 * @param tag - dist-tag to move.
 * @returns argv after `npm`.
 */
export function distTagAddArgs(name: string, version: string, tag: string): string[] {
  return ['dist-tag', 'add', `${name}@${version}`, tag]
}

/**
 * Read current dist-tags for one package.
 * @param name - package name.
 * @returns The dist-tag map.
 */
async function readDistTags(name: string): Promise<Record<string, string>> {
  await spaceRegistryCall(REGISTRY_PROBE_SPACING_MS)
  const result = attempt('npm', ['view', name, 'dist-tags', '--json', '--fetch-retries', '0'])
  const output = `${result.stdout}${result.stderr}`.trim()
  if (result.status !== 0) {
    throw new Error(`npm view ${name} dist-tags failed:\n${output}`)
  }
  return parseDistTags(result.stdout.trim() === '' ? output : result.stdout)
}

/**
 * Move one dist-tag, failing on the first `E429`.
 * @param name - package name.
 * @param version - published version.
 * @param tag - dist-tag to move.
 */
async function addDistTag(name: string, version: string, tag: string): Promise<void> {
  await spaceRegistryCall(PUBLISH_SPACING_MS)
  const result = attemptEchoed('npm', [...distTagAddArgs(name, version, tag), '--fetch-retries', '0'])
  const output = `${result.stdout}${result.stderr}`
  if (result.status === 0) return
  if (isRateLimited(output)) {
    throw new Error(`npm dist-tag add ${name}@${version} ${tag} hit npm E429.\n${output}`)
  }
  throw new Error(`npm dist-tag add ${name}@${version} ${tag} failed:\n${output}`)
}

/** Point `--tag` at each family member's published version. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      family: { type: 'string' },
      tag: { type: 'string', default: 'latest' },
      version: { type: 'string' },
    },
    allowPositionals: false,
  })
  if (values.family === undefined) {
    throw new Error('usage: dist-tag.ts --family <dsh|vendor> [--tag latest] [--version <version>]')
  }
  const tag = values.tag ?? 'latest'
  if (tag === '' || /\s/.test(tag)) throw new Error(`invalid dist-tag: ${JSON.stringify(tag)}`)

  const family = releaseFamily(values.family)
  const members = family.members(process.cwd())
  family.verifyVersions(members)
  const total = String(members.length)
  let moved = 0
  let skipped = 0

  for (const [index, member] of members.entries()) {
    const version = values.version ?? member.version
    if (version === '') throw new Error(`${member.name} has an empty version`)
    const progress = `[${String(index + 1)}/${total}]`
    const tags = await readDistTags(member.name)
    if (distTagAction(tags[tag], version) === 'skip') {
      console.log(`release dist-tag: ${progress} ${member.name}@${version} already ${tag}, skipping`)
      skipped += 1
      continue
    }
    await addDistTag(member.name, version, tag)
    console.log(`release dist-tag: ${progress} ${member.name}@${version} -> ${tag}`)
    moved += 1
  }

  console.log(
    `release dist-tag: family ${family.id}, tag ${tag}, ${total} member(s),`
    + ` ${String(moved)} moved, ${String(skipped)} already current`,
  )
}

if (isEntry(import.meta.url)) await main()
