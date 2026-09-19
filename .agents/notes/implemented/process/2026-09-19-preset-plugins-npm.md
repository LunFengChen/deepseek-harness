# Agent Note: preset plugins from npm

Status: implemented

English | [中文](2026-09-19-preset-plugins-npm.zh.md)

## Problem

`npm install --global @x1a0f3n9/dsh` still resolved the eight xfdsh preset plugins through `github:LunFengChen/...#tag` specifiers. npm cloned those repositories and ran `prepare`, which needs a git+build toolchain and was killed on the friend's machine. `--ignore-scripts` skipped the clone build and then `xfdsh web` failed because `dshmarket` and `dsh-better-sidebar` gitignore `lib/` and ship no compiled entry.

## Decision

Each preset plugin publishes a compiled tarball to npm at the version already pinned in `packages/bundle/web-app`. The web-app manifest uses those exact npm versions, not `github:` specifiers. `npm install --global @x1a0f3n9/dsh@next` therefore installs plugins from the registry. `.github/workflows/publish-preset-plugins.yml` clones each tag, builds only when `lib/index.js` or `dist/index.js` is missing, and publishes with the harness `NPM_TOKEN`.

Pinned versions:

- `@x1a0f3n9/dshmarket@1.45.2`
- `@x1a0f3n9/dsh-reasoning-effort@0.7.3`
- `@x1a0f3n9/dsh-session-timeline@0.1.5-xfdsh.2`
- `@x1a0f3n9/dsh-context@0.49.7`
- `@x1a0f3n9/dsh-better-sidebar@0.19.3`
- `@x1a0f3n9/hindsight-coding-agents@0.5.2-xfdsh.4`
- `@x1a0f3n9/dsh-failover-queue@0.1.11`
- `@x1a0f3n9/dsh-skills-manager@0.1.53-xfdsh.1`

`@x1a0f3n9/dsh-web-search-pool` stays a workspace package and publishes with the harness family. Catalog `homepage` values stay the LunFengChen GitHub URLs.

## Alternatives considered

**Keep `github:` specifiers.** Rejected: `npm i -g` still clones the plugin repos and runs `prepare`.

**Install with `--ignore-scripts` and leave `lib/` out of git.** Rejected: market and better-sidebar then have no `lib/index.js`, so `xfdsh web` cannot load them.

**Publish the plugins from a developer laptop.** Rejected: this machine is not logged into npm, and the `@x1a0f3n9` token lives in GitHub Actions secrets.

## Consequences

- Friends install the fork with `npm install --global @x1a0f3n9/dsh@next` and run `xfdsh web` without cloning plugin repositories.
- The pinned plugin versions must exist on npm before `pnpm install` can refresh the harness lockfile.
- Official `@deepseek-ai/dsh` is unchanged.
