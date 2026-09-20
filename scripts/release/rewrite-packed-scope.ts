/**
 * Rewrite one packed dsh family from the checkout scope onto a publish scope.
 *
 * Git keeps `@x1a0f3n9/dsh-*`. `master` publishes `@xfcodeai/dsh-*` by rewriting
 * packed tarballs after pack, so the two npm lines share one tree
 * ([rationale](../../.agents/notes/implemented/process/2026-09-20-master-xfcodeai-publish.md)).
 */

import { lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { releaseFamily, tarballName, type ReleaseFamily } from './families.ts'
import { capture, isEntry } from './process.ts'
import { PUBLISH_ORDER_FILE, readPublishOrder } from './tarball.ts'

/** A character that can continue an npm package name after a match. */
const PACKAGE_NAME_CONTINUE = /[A-Za-z0-9._~-]/u

/**
 * Map each family package name from `fromScope` onto `toScope`.
 * @param names - packed family member names.
 * @param fromScope - scope the tarballs currently declare.
 * @param toScope - scope the rewritten tarballs must declare.
 * @returns Old name to new name, longest names first when iterated as keys.
 */
export function publishScopeMapping(
  names: readonly string[],
  fromScope: string,
  toScope: string,
): Map<string, string> {
  const prefix = `${fromScope}/`
  const mapping = new Map<string, string>()
  for (const name of names) {
    if (!name.startsWith(prefix)) {
      throw new Error(`${name} is not in ${fromScope}`)
    }
    mapping.set(name, `${toScope}/${name.slice(prefix.length)}`)
  }
  return mapping
}

/**
 * Replace complete family package names. A shorter name such as `@x1a0f3n9/dsh`
 * does not rewrite `@x1a0f3n9/dsh-session-timeline`.
 * @param text - file contents.
 * @param mapping - old name to new name.
 * @returns The rewritten text.
 */
export function rewriteScopedNames(text: string, mapping: ReadonlyMap<string, string>): string {
  const names = [...mapping.keys()].sort((left, right) => right.length - left.length)
  let result = text
  for (const from of names) {
    const to = mapping.get(from)
    if (to === undefined) continue
    result = replaceCompleteName(result, from, to)
  }
  return result
}

/**
 * Replace `from` where the next character cannot continue an npm package name.
 * @param text - file contents.
 * @param from - complete package name.
 * @param to - replacement package name.
 * @returns The rewritten text.
 */
function replaceCompleteName(text: string, from: string, to: string): string {
  let result = ''
  let cursor = 0
  while (cursor < text.length) {
    const index = text.indexOf(from, cursor)
    if (index === -1) {
      result += text.slice(cursor)
      break
    }
    result += text.slice(cursor, index)
    const after = text[index + from.length]
    if (after !== undefined && PACKAGE_NAME_CONTINUE.test(after)) {
      result += from
    } else {
      result += to
    }
    cursor = index + from.length
  }
  return result
}

/**
 * Whether a packed file should be rewritten as text.
 * @param bytes - file bytes.
 * @returns False for a file that contains a NUL.
 */
export function isRewritablePackedFile(bytes: Buffer): boolean {
  return !bytes.includes(0)
}

/**
 * Rewrite one packed tarball onto `toScope` and return the new filename.
 * @param tarball - absolute source tarball path.
 * @param destination - absolute output directory.
 * @param mapping - old name to new name.
 * @returns The rewritten tarball filename.
 */
export function rewritePackedTarball(
  tarball: string,
  destination: string,
  mapping: ReadonlyMap<string, string>,
): string {
  const scratch = mkdtempSync(join(tmpdir(), 'dsh-rewrite-scope-'))
  try {
    capture('tar', ['-xzf', tarball, '-C', scratch])
    rewriteDirectory(scratch, mapping)
    const identity = packedIdentityFromDir(scratch)
    const filename = tarballName({
      directory: '',
      name: identity.name,
      version: identity.version,
      manifest: {},
    })
    capture('tar', ['-czf', join(destination, filename), '-C', scratch, 'package'])
    return filename
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/**
 * Rewrite every rewritable file under `root`.
 * @param root - extracted tarball directory.
 * @param mapping - old name to new name.
 */
function rewriteDirectory(root: string, mapping: ReadonlyMap<string, string>): void {
  for (const relative of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const file = join(root, relative)
    if (!lstatSync(file).isFile()) continue
    const bytes = readFileSync(file)
    if (!isRewritablePackedFile(bytes)) continue
    const text = bytes.toString('utf8')
    const rewritten = rewriteScopedNames(text, mapping)
    if (rewritten !== text) writeFileSync(file, rewritten)
  }
}

/**
 * Read `package/package.json` from an extracted tarball directory.
 * @param root - extracted tarball directory.
 * @returns The packed name and version.
 */
function packedIdentityFromDir(root: string): { name: string; version: string } {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package/package.json'), 'utf8'))
  if (manifest === null || typeof manifest !== 'object') {
    throw new Error(`${root} has no packed manifest`)
  }
  const { name, version } = manifest as Record<string, unknown>
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error(`${root} packed manifest lacks name/version`)
  }
  return { name, version }
}

/**
 * Rewrite a packed family directory onto `toScope`.
 * @param family - the release family whose members define the mapping.
 * @param root - repository root used to discover those members.
 * @param fromDir - directory of packed tarballs.
 * @param outDir - rewritten output directory.
 * @param toScope - publish scope.
 * @returns Rewritten tarball filenames in the original publish order.
 */
export function rewritePackedFamilyDirectory(
  family: ReleaseFamily,
  root: string,
  fromDir: string,
  outDir: string,
  toScope: string,
): string[] {
  const members = family.members(root)
  const mapping = publishScopeMapping(members.map(member => member.name), family.packageScope, toScope)
  const order = readPublishOrder(fromDir)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const rewritten: string[] = []
  for (const filename of order) {
    rewritten.push(rewritePackedTarball(join(fromDir, filename), outDir, mapping))
  }
  writeFileSync(join(outDir, PUBLISH_ORDER_FILE), `${rewritten.join('\n')}\n`)
  return rewritten
}

/** Rewrite `--from` onto `--to-scope` into `--out`. */
function main(): void {
  const { values } = parseArgs({
    options: {
      family: { type: 'string' },
      from: { type: 'string' },
      out: { type: 'string' },
      'to-scope': { type: 'string' },
    },
    allowPositionals: false,
  })
  if (
    values.family === undefined
    || values.from === undefined
    || values.out === undefined
    || values['to-scope'] === undefined
  ) {
    throw new Error('usage: rewrite-packed-scope.ts --family dsh --from <packed> --out <dir> --to-scope @xfcodeai')
  }
  const family = releaseFamily(values.family)
  const root = process.cwd()
  const fromDir = resolve(root, values.from)
  const outDir = resolve(root, values.out)
  const rewritten = rewritePackedFamilyDirectory(family, root, fromDir, outDir, values['to-scope'])
  console.log(
    `release rewrite-scope: family ${family.id}, ${String(rewritten.length)} tarball(s)`
    + ` ${family.packageScope} -> ${values['to-scope']} in ${values.out}`,
  )
}

if (isEntry(import.meta.url)) main()
