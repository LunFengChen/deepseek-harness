# Agent Note: classify Grok and pi-ai context overflow

Status: implemented

[English](2026-09-14-pi-ai-context-overflow-classification.md) | 中文

## Problem

Grok 等 pi-ai OpenAI 兼容线路会把本该压缩的回合直接停掉。xAI 报 `maximum prompt length`；有的网关返回中文超窗文案；`length` 停且没有输出，或输入已经占满目录窗口的大部分，会被标成 `max-tokens`。压缩只重试 `CONTEXT_WINDOW_EXCEEDED`，所以这些回合会停。

## Decision

`isContextWindowExceededError` 识别 xAI 的 prompt length 措辞、Groq 式缩短 messages 的文案，以及中文上下文超限说法。pi-ai 把零输出的 `length` 停，以及输入至少占目录窗口 80% 的 `length` 停，映射为 `CONTEXT_WINDOW_EXCEEDED`。HTTP 400 的超窗正文优先于泛化的 invalid-request 标签。

## Alternatives considered

**把所有 `length` 停都当成 overflow。** 否决：上下文还有余量时的真正输出上限仍应是 `max-tokens`。

**抬高默认目录 `contextWindow` 去迁就 Grok 4.6。** 否决：这会推迟更小自定义模型的压力压缩；线路上仍应设置 `contextWindow`。

## Consequences

- Grok 的 `maximum prompt length` 和本地化超窗错误会进入 overflow 恢复，而不再以 `INVALID_REQUEST` 停掉。
- 已经写出 token、且目录窗口大部分仍空闲的截断生成仍是 `max-tokens`。
- 恢复仍需要可压缩区间；缩不掉的不可分子前缀仍保留原来的错误。
