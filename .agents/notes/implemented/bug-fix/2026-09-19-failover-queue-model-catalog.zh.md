# Agent Note: failover-queue add-row must not require a live session

Status: implemented

[English](2026-09-19-failover-queue-model-catalog.md) | 中文

## Problem

Settings → 故障转移 能打开，但加入控件看起来是空的。两个原因：

1. client 用 `/failover __candidates` 拉候选，而 `remote.commands.execute` 只能对着 session id 跑。新会话页没有 session id。
2. 原生 `<select>` 关闭时一直停在占位文案，弹出层在深色设置弹层里也读不清。

## Decision

`v0.1.8` 先读 `session/modelCatalog`，和输入框模型选择器同一份 Host 代际目录。有 session id 且目录为空时，斜杠命令仍作回退。加入控件改成按钮，显示候选数量，并在输入框上方打开可搜索列表。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.8`。

## Verification

新会话页上，Settings → 故障转移 显示 `选择一条路由（N）`。点开后在输入框上方列出已配置提供方。加入 `xfcodeai-grok / Grok 4.6` 会把 P1 写进队列。

## Alternatives considered

**继续走斜杠命令，再造一个临时会话来执行。** 列出模型是 Host 代际目录，不是会话状态。

**inject `sessions`，等有当前会话再拉。** Settings 页必须在「新会话」也能用。

**目录加载后再继续用原生 `<select>`。** 关闭时仍然像空的，系统弹出层在弹层里会被裁切或读不清。

## Consequences

- 队列在用户加入路由之前仍是空的。加入控件不再因为没有会话而空，有选项时也不会看起来是空的。
- 如果再钉回 `v0.1.6`，新会话里下拉仍会空。
