# Agent Note: labeled composer compact button

Status: implemented

[English](2026-09-10-composer-compact-visible.md) | 中文

## Problem

输入框旁的压缩控件是 28px 的三级色图标，没有可见文字。用户找「压缩」按钮时看不见。命令失败只打到 `console.error`。

## Decision

压缩控件在图标旁显示本地化的「压缩」/ Compact 文字。`/compact` Remote 失败或抛错会以 toast 显示。

## Alternatives considered

**继续只用图标，靠 tooltip。** 否决：tooltip 要悬停才出现，三级色又和周围控件混在一起。

**只把压缩过程写进聊天记录。** 否决：传输层 Remote 失败根本不会生成命令卡片。

## Consequences

- 不用悬停也能在输入框右侧看到压缩控件。
- 自动 overflow 恢复逻辑不变；按钮是 `CONTEXT_WINDOW_EXCEEDED` 之后、会话空闲时的手动出口。
