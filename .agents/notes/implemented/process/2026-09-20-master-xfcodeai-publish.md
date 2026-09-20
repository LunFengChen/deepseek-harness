# Agent Note: publish @xfcodeai/dsh from master

Status: implemented

English | [中文](2026-09-20-master-xfcodeai-publish.zh.md)

## Problem

`dev-x1a0f3n9` already publishes `@x1a0f3n9/dsh-*`. The stable fork line is supposed to publish `@xfcodeai/dsh-*` from `master` in the same GitHub repository. Rescoping the git tree to `@xfcodeai` would fight every master↔dev merge, and a blanket `@x1a0f3n9/` rewrite would also rename preset plugins that stay on `@x1a0f3n9`.

## Decision

Git keeps `@x1a0f3n9/dsh-*`. Pushing `master` packs that tree, rewrites only complete dsh-family package names in the packed tarballs onto `@xfcodeai`, and publishes from environment `npm-publish-xfcodeai`. Preset plugins that are not family members, and vendor `@deepseek-ai` packages, stay unrewritten. `dev-x1a0f3n9` still publishes `@x1a0f3n9/*` from environment `npm-publish`.

`pnpm run release:rewrite-scope --family dsh --from dist/npm --out dist/npm-xfcodeai --to-scope @xfcodeai` is the rewrite step. A shorter name such as `@x1a0f3n9/dsh` does not rewrite `@x1a0f3n9/dsh-session-timeline`.

## Verification

`pnpm exec vitest run scripts/release/rewrite-packed-scope.spec.ts scripts/ci-workflow.spec.ts scripts/release/verify.spec.ts` pins the complete-name rewrite and the `publish-xfcodeai` job.

## Alternatives considered

**Rescope the git tree to `@xfcodeai` on master.** Rejected: every merge between `master` and `dev-x1a0f3n9` would rewrite hundreds of package names.

**Replace every `@x1a0f3n9/` string in the tarball.** Rejected: that would publish preset plugins such as `@x1a0f3n9/dsh-session-timeline` as `@xfcodeai/...`.

**Publish `@xfcodeai/*` from `dev-x1a0f3n9`.** Rejected: the two scopes are two lines. Development stays `@x1a0f3n9`; stable stays `@xfcodeai`.

## Consequences

- `master` is the stable fork line, not a clean upstream mirror. Upstream updates merge into `master`, then into `dev-x1a0f3n9`.
- Friends install the stable CLI with `npm install --global @xfcodeai/dsh`.
- An npm new-name quota pause on `master` stops remaining `@xfcodeai` names the same way `dev-x1a0f3n9` pauses `@x1a0f3n9`.
