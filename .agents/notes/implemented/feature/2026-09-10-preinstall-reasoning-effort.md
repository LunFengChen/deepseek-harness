# Agent Note: preinstall community Web plugins

Status: implemented

English | [中文](2026-09-10-preinstall-reasoning-effort.zh.md)

## Problem

The fork wanted several community Web plugins available on a fresh `xfdsh web` profile, still disableable from Settings → Plugins: thinking strength, a context dashboard, a sidebar workbench, and Hindsight long-term memory. Leaving them as manual `plugin add` commands hid them. Vendoring their sources into `packages/` would fork third-party UI with no maintenance path.

## Decision

`@x1a0f3n9/dsh-web-app` depends on the published artifacts, the Web patch mounts each host row, and the bundle plugin catalog marks every row `defaultEnabled: true`.

| Plugin | Pin | Why this pin |
| --- | --- | --- |
| `dsh-reasoning-effort` | GitHub `v0.7.1` | npm `latest` is still `0.2.7`; the GitHub tag already ships `lib/` and has no `prepare` script. |
| `dsh-context` | npm `0.48.0` | Published tarball includes `lib/`. Git `main` runs `prepare: husky`. |
| `dsh-better-sidebar` | npm `0.19.0-alpha.1` | This tree is `0.1.5-alpha.2`. npm `latest` `0.18.1` targets the 0.1.2 line; GitHub `v0.19.0` needs `0.1.5-rc.1+`. Git clones run `prepare: tsdown`. |
| `@vectorize-io/hindsight-coding-agents` | npm `0.5.2` | The DSH integration lives under `hindsight-integrations/coding-agents/`, which pnpm cannot take as a git subdirectory. The published package exports `./dsh` and `dsh.bundle.patch`. |

pnpm remaps only the official `@deepseek-ai/dsh-*` peers these plugins declare and that exist in this workspace. `@deepseek-ai/dsh-client-runtime` and optional `@huanlin/dsh-plugin-better-locale` are ignored as missing. The remap list is not every official product package.

Hindsight memory is configured outside dsh in `~/.hindsight/coding-agent.json`. With no server or with `disabled: true`, the plugin stays loaded and does not seed a bank.

## Verification

`pnpm install` resolves these four packages without adding `@deepseek-ai/dsh-*` product packages from npm. The Web bundle catalog lists `reasoning-effort`, `dsh-context`, `better-sidebar`, and `hindsight` with `defaultEnabled: true`.

## Alternatives considered

**Keep them as manual plugin adds, or install Hindsight only from the plugin market.** Rejected: the user asked to preinstall all four, matching dshmarket. The market remains available for other plugins and for disabling these rows.

**Vendor the plugin sources into `packages/`.** Rejected: the chosen pins already ship compiled artifacts, and copying third-party UI has no maintenance path.

**Depend on GitHub `main` or unpinned git refs.** Rejected: `dsh-context` and `dsh-better-sidebar` run build/`husky` `prepare` scripts on git installs.

**Add a global official-to-fork override for every `@deepseek-ai/dsh-*` package.** Rejected: only declared peers need remapping; a 250-package override would hide install mistakes.

**Pin better-sidebar `0.19.0`.** Rejected: that release's peer floor is `0.1.5-rc.1+`, which this tree is not.

**Re-enable a local `dsh-client-runtime` package.** Rejected: the successor is `dsh-client-modules`, and reasoning-effort's `client-runtime` imports are type-only.

## Consequences

- `xfdsh web` starts with thinking strength, a context dashboard, the better-sidebar workbench, and Hindsight tools without extra `plugin add` commands.
- Users can disable each row from Settings → Plugins.
- Hindsight loads on a fresh profile. xfdsh defaults it to a local daemon; Cloud remains optional.
- A later plugin bump is a dependency pin change on web-app.
