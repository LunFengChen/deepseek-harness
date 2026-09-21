# Agent Note: sync upstream 0.1.6-alpha.2 onto the fork

Status: implemented

English | [中文](2026-09-21-sync-upstream-0.1.6-alpha.2.zh.md)

## Problem

Upstream reached `dsh-v0.1.6-alpha.2` after the fork's last merge-base at `0.1.5-rc.2`. New packages, profile resolution, and Web surfaces arrived under `@deepseek-ai/dsh-*`. Merging them raw would rename the CLI, collide with official `dsh web` on 3080, and drop xfdsh overlays. Landing that merge on `master` would also publish `@xfcodeai` before the fork is verified.

## Decision

Merge `upstream/master` (`ddefc45fbc`, `release(dsh): 0.1.6-alpha.2`) into `dev-x1a0f3n9` with `--no-ff`. Keep the [port-onto-upstream overlay](../architecture/2026-09-10-port-fork-onto-upstream.md): `xfdsh`, port `7777`, `DSH_HOME=~/.xfdsh`, `DSH_SESSION_HOME=~/.dsh`, preset catalog, staged client load, and official-to-fork resolve. Rescope new harness packages to `@x1a0f3n9/dsh-*`. Leave `OFFICIAL_DSH_PACKAGE_PREFIX` as `@deepseek-ai/dsh-`. Restore the fork llm-pi-ai overlays the merge dropped: in-band error classification, stream diagnostics, catalog listing input copy, and catalog `maxTokens` as the request default. Port the fork Web provider page onto upstream `plugins.item` + `PluginConfigForm`; do not restore the deleted Settings `PluginCard`. Do not merge `master` in this change.

## Verification

`git merge-base origin/dev-x1a0f3n9 upstream/master` was `c291e7961a` (`0.1.5-rc.2`) before the merge. After rescope, workspace `package.json` names are `@x1a0f3n9/dsh-*` except the intentional official alias keys in `pnpm-workspace.yaml`. Focused tests cover app-boot, CLI, agent-loop, plugin-inventory, client-modules, and the inherited-effort strip.

## Alternatives considered

**Reset `master` to upstream first, then rebase `dev-x1a0f3n9`.** Rejected for this pass: `origin/master` is not an ancestor of `dev-x1a0f3n9`, and the user forbade publishing `@xfcodeai` until the fork merge is verified.

**Keep new upstream packages on `@deepseek-ai/dsh-*`.** Rejected: workspace package names must match the fork scope, or `pnpm` and the CLI import graph split.

**Silent-clamp unsupported reasoning effort in the LLM layer.** Rejected: an explicit unsupported effort must still fail loud; only seed-equal effort on a route-only overlay is inheritance. See [strip inherited reasoning effort](../bug-fix/2026-09-21-strip-inherited-reasoning-effort-on-reroute.md).

## Consequences

- `dev-x1a0f3n9` carries 0.1.6-alpha.2 plus the existing xfdsh overlay.
- `master` stays the previous fork release until an explicit `@xfcodeai` publish.
- Community plugins keep official import names; source launch remaps them.
