# Agent Note: pi-ai sends model output capability as the request cap

Status: implemented

[English](2026-09-11-pi-ai-capability-as-request-output-cap.md) | 中文

## Problem

手写声明的 pi-ai 路由（例如 OpenAI 兼容网关）常常省略 `maxTokens`。适配器把目录和回退的 `maxTokens` 只当成能力，不填 `defaultMaxTokens`，请求也就不带 `max_output_tokens`。网关随后套用自己更小的默认值，以 `max_tokens` 结束，界面就会报告输出碰到了用户从未选择的 token 上限。

## Decision

`PiAiAdapter.modelInfo` 始终发布 `defaultMaxTokens`：显式配置的上限优先，否则使用模型能力（已安装目录或路由 `defaultMaxTokens` 回退）。未描述模型的回退是 `256,000`，与原生 DeepSeek 适配器一致。`LlmRuntime` 仍会在发到线上之前把该值写入 `request/header`，并标记 `adapterDefaults.maxTokens: true`。

这推翻了 pi-ai 先前“不要把目录能力当成请求默认值发出”的选择。那个选择假定省略字段等于“没有上限”；在许多网关上，省略字段其实等于“使用提供方隐藏的默认值”。

## Verification

`packages/llm/llm-pi-ai/tests/catalog.spec.ts` 期望：没有显式上限的目录模型发布的 `defaultMaxTokens` 等于 `Model.maxTokens`；配置为 `4096` 的上限会胜出；裸手写模型的尺寸为 `256,000`。

## Alternatives considered

**继续省略该字段，让用户给每个模型设置 `maxTokens`。** 否决：大多数手写网关模型从不命名上限，截断看起来像 harness 的 bug。

**在 `max-tokens` 停止后自动发送“继续”。** 本变更否决：较大的请求上限就能挡住网关隐藏默认值。轮次级续写仍是单独的 UX。

**当目录最大值小于 256,000 时把每个模型钳到目录最大值。** 不必要：目录模型已经发送 `Model.maxTokens`，当前 API 也不要求再发明一层钳制。

## Consequences

- 未命名 `maxTokens` 的请求现在会发送模型能力或 `256,000`。
- 有些网关可能拒绝大于模型允许范围的上限；部署方在该路由下调 `maxTokens` 或 `defaultMaxTokens`。
- 适配器自有的 max-token 缝仍然拥有重建规则；本笔记拥有 pi-ai 发布该字段的决定。

## Related

[适配器自有 max-token 默认值](../../archived/architecture/2026-07-30-adapter-owned-max-token-defaults.md)
