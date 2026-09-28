# Agent Note: sync upstream 0.1.6-alpha.2 onto the fork

Status: implemented

[English](2026-09-21-sync-upstream-0.1.6-alpha.2.md) | 中文

## Problem

上游在 fork 上次合并基线 `0.1.5-rc.2` 之后发到了 `dsh-v0.1.6-alpha.2`。新包、profile 解析和 Web 面都带着 `@x1a0f3n9/dsh-*`。原样合入会改 CLI 名、和官方 `dsh web` 的 3080 冲突，并丢掉 xfdsh 覆盖层。若先合 `master`，还会在 fork 验证前把 `@xfcodeai` 发出去。

## Decision

把 `upstream/master`（`ddefc45fbc`，`release(dsh): 0.1.6-alpha.2`）`--no-ff` 合进 `dev-x1a0f3n9`。保留[移植到上游的覆盖层](../architecture/2026-09-10-port-fork-onto-upstream.zh.md)：`xfdsh`、端口 `7777`、`DSH_HOME=~/.xfdsh`、`DSH_SESSION_HOME=~/.dsh`、预置目录、分阶段 client 加载，以及官方名到 fork 的 resolve。新 harness 包改到 `@x1a0f3n9/dsh-*`。`OFFICIAL_DSH_PACKAGE_PREFIX` 仍是 `@x1a0f3n9/dsh-`。补回合并时丢掉的 fork llm-pi-ai 覆盖层：带内错误分类、流诊断、listing 拷贝 catalog 输入类型，以及把 catalog `maxTokens` 当作请求默认。把 fork 的 Web 搜索提供方页接到上游的 `plugins.item` + `PluginConfigForm`，不要把已删除的设置页 `PluginCard` 找回来。这次不合 `master`。

## Verification

合并前 `git merge-base origin/dev-x1a0f3n9 upstream/master` 是 `c291e7961a`（`0.1.5-rc.2`）。改 scope 之后，工作区 `package.json` 名称都是 `@x1a0f3n9/dsh-*`，只留下 `pnpm-workspace.yaml` 里有意保留的官方别名键。聚焦测试覆盖 app-boot、CLI、agent-loop、plugin-inventory、client-modules，以及继承思考强度剥离。

## Alternatives considered

**先把 `master` 重置到上游，再 rebase `dev-x1a0f3n9`。** 这次否决：`origin/master` 不是 `dev-x1a0f3n9` 的祖先，而且用户禁止在 fork 合并验证前发 `@xfcodeai`。

**让新的上游包继续用 `@x1a0f3n9/dsh-*`。** 否决：工作区包名必须和 fork scope 一致，否则 `pnpm` 和 CLI 导入图会裂开。

**在 LLM 层静默钳制不支持的思考强度。** 否决：显式不支持的 effort 仍须响亮失败；只有路由覆盖还带着与 seed 相同的 effort 才是继承。见[剥离换路由时继承的思考强度](../bug-fix/2026-09-21-strip-inherited-reasoning-effort-on-reroute.zh.md)。

## Consequences

- `dev-x1a0f3n9` 带着 0.1.6-alpha.2 和现有 xfdsh 覆盖层。
- 在明确要发 `@xfcodeai` 之前，`master` 仍停在上一份 fork 发布。
- 社区插件继续用官方导入名；源码启动会 remap。
