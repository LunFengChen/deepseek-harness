# Agent Note: Fork dsh-context，而不是映射官方 CLI 包名

Status: implemented

[English](2026-09-11-fork-dsh-context.md) | 中文

## Problem

`dsh-context` 会从 `$DSH_HOME/profiles` 探测 `@deepseek-ai/dsh`，并把这个版本当成正在运行的 harness。残留的官方 CLI `0.1.0-rc.8` 会触发插件的 `0.1.2-rc.1` 基线门闸，即使本 fork 已经是 `0.1.5-alpha.2`。在 xfdsh 里把 `@deepseek-ai/dsh` 映射成 `@x1a0f3n9/dsh`，等于改内核去迁就第三方探测。

## Decision

xfdsh 只 remap `@deepseek-ai/dsh-*` 库包。官方 CLI 名 `@deepseek-ai/dsh` 保持原样。版本探测改在 `bowenliang123/dsh-context` 的 fork `LunFengChen/dsh-context@0.49.6` 里：先读 `@x1a0f3n9/dsh` / `@xfcodeai/dsh` 和 fork 库包，最后才看残留的官方 CLI。web-app bundle 预装这个 GitHub 包。

## Alternatives considered

**启动时 remap `@deepseek-ai/dsh`。** 否决：CLI 包不是库 import，xfdsh 不该为了让第三方插件的 home 探测成功而给它开特例。

**删掉 profile 树里残留的 `@deepseek-ai/dsh`。** 否决：官方 `dsh` 和 `xfdsh` 可能共用会话数据，清掉那份安装不是产品要求。

**继续用 npm `dsh-context@0.48.0`，在本仓库里打补丁。** 否决：这个插件是独立的 GitHub 产品，版本探测应该改在那个仓库。

## Consequences

- 官方插件 import `@deepseek-ai/dsh-session` 时仍会 remap 到本 fork。
- `dsh-context` 不再把残留的官方 CLI 当成正在运行的版本。
- 预装改为 `github:LunFengChen/dsh-context#v0.49.6`，不再用 npm `dsh-context@0.48.0`。
