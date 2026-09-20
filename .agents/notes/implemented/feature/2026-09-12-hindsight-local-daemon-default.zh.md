# Agent Note: xfdsh defaults Hindsight to a local daemon

Status: implemented

[English](2026-09-12-hindsight-local-daemon-default.md) | 中文

## Problem

Hindsight coding-agent 插件内置的 `serverMode` 是 `cloud`。预装行在没有 `~/.hindsight/coding-agent.json` 时就会访问 `https://api.hindsight.vectorize.io`，并要 API token。插件其实已经支持 `daemon` 模式：有 `uv` 和提取用 LLM 时，它会在 `127.0.0.1:9077` 拉起 `hindsight-embed`；没有这些依赖时就退化成没有记忆。xfdsh 之前把 Cloud 表现成了必选项。

## Decision

`applyForkDefaults` 在 `HINDSIGHT_SERVER_MODE` 未设置或空白时写成 `daemon`。xfdsh 不写 `~/.hindsight/coding-agent.json`，不 vendor Hindsight，也不自己起 daemon。显式环境变量仍然生效。Hindsight 配置文件里的 `serverMode` 仍然盖过环境变量。开关默认值见 [xfdsh enables Hindsight by default](2026-09-12-hindsight-enabled-by-default.zh.md)。

## Alternatives considered

**没有 `~/.hindsight/coding-agent.json` 时就写入 `serverMode: daemon`。** 否决：这个文件和其他用 Hindsight 的 agent 共用，xfdsh 不该去创建。

**在 xfdsh 里附带或自动拉起 Hindsight 服务。** 否决：那是另一套 embed 栈、额外进程和首次下载，插件在 daemon 模式里已经负责这些。

**Fork `vectorize-io/hindsight` 去改内置默认值。** 否决：monorepo 比这块集成大得多；coding-agent 包已经认 `HINDSIGHT_SERVER_MODE`。

## Consequences

- 加载 Hindsight 不再需要 Cloud 账号。
- 本地回忆仍需要 PATH 上的 `uv` 和提取用 LLM（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GEMINI_API_KEY`、`GROQ_API_KEY`、`HINDSIGHT_API_LLM_PROVIDER`，或 Claude Code CLI）。缺这些会打警告，这一轮没有记忆。
- 已经在环境变量或 `coding-agent.json` 里选了 Cloud 或自建服务的用户不受影响。
