# Agent Note: source builds without a git checkout

Status: implemented

English | [中文](2026-09-12-source-build-without-git.zh.md)

## Problem

`pnpm run build` reads `git rev-parse HEAD` through `execFileSync` to embed `DSH_CLIENT_COMMIT_HASH`. A zip or copied tree without `.git` makes Git exit 128, and that throw aborts `scripts/build.ts` before any client bundle is written.

## Decision

`repositoryCommitHash` probes Git with `spawnSync`, the same way `repositoryGitDirty` already does. An explicit `DSH_CLIENT_COMMIT_HASH` still wins and still rejects a value that is not a 7–40 character hex string. When the variable is unset and Git metadata is missing, the hash is the first seven hex characters of SHA-256(`package.json` version). Dirty metadata stays omitted.

## Alternatives considered

**Require `DSH_CLIENT_COMMIT_HASH` in every non-git tree.** Rejected: a friend zip of `dev-x1a0f3n9` should build with `pnpm run build` and no extra env.

**Write `unknown` or the version string into the commit field.** Rejected: client artifacts already validate `/^[0-9a-f]{7,40}$/i`.

**Keep throwing and tell users to clone with git.** Rejected: the failure is a missing metadata source, not a broken product tree.

## Consequences

- Source trees without `.git` complete the client build.
- Invalid explicit `DSH_CLIENT_COMMIT_HASH` still fails the build.
- Zip artifacts share one synthesized hash per package version.
