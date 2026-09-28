# Agent Note: 0.1.7 之后恢复共享会话目录

Status: implemented

[English](2026-09-28-restore-shared-session-home.md) | 中文

## 问题

上游 0.1.7 用 profile 承载的 `dsh-settings` 替换了 `dsh-settings-file`，并把持久化根路径改成 `dshHomePath(...)`。xfdsh 把 `DSH_HOME` 设成 `~/.xfdsh`，如果跟着改，会话、附件、工作区存储和 API key 就会写进插件目录，而不是官方共享的 `~/.dsh`。

## 决策

保留 0.1.7 的 settings 服务。把 credentials、会话持久化、附件和 JSON storage 重新指向 `dshSessionPath()`，它读取 `DSH_SESSION_HOME`，默认是 `~/.dsh`。插件和 profile 仍留在 `DSH_HOME`。

## 验证

`packages/bundle/base/tests/base.spec.ts` 断言这四处 `!!js dshSessionPath(...)` 根路径。`apps/cli/tests/fork-defaults.spec.ts` 仍然固定 `DSH_HOME=~/.xfdsh` 和 `DSH_SESSION_HOME=~/.dsh`。

## 否决的方案

**恢复 `dsh-settings-file`。** 否决：0.1.7 已经从组合里删掉这个包。模型表单现在写当前 profile 的 patch。

**继续用 `dshHomePath`，让用户自己拷 `~/.dsh`。** 否决：fork 已经承诺共享历史、不做迁移。

## 后果

- `xfdsh web` 继续读 `~/.dsh/sessions` 和 `~/.dsh/.credentials.yaml`。
- 插件启停和 0.1.7 的模型表单留在 `~/.xfdsh/profiles/web`。
- 官方 `dsh` 和 `xfdsh` 仍然共享会话和 key；不再共享同一份 `settings.yaml`。
