# Agent Note: per-model Supports images switch

Status: implemented

[English](2026-09-18-model-image-input-toggle.md) | 中文

## Problem

自定义 pi-ai 模型在存储的 `input` 列表包含 `image` 之前都是纯文本。模型页没有这个字段的控件，所以手写网关上的视觉模型（例如自定义 OpenAI 兼容路由上的 `grok-4.6`）会在附加图片时被拒绝，提示「当前模型不支持图片」，即使上游模型本身支持视觉。内置 catalog 路由已经声明了图片输入；缺口在用户自己拥有的模型行。

## Decision

每个模型行的容量折叠区都有一个**支持图片**开关。

- 打开时，pi-ai 行写入 `input: [text, image]`，DeepSeek 行写入 `inputModalities: [text, image]`。
- 关闭时删除该字段。随后解析会继承已安装 catalog 或路由 `defaultInput`；自定义 pi-ai 路由的 `defaultInput` 是 `['text']`。
- 只有当前存储列表包含 `image` 时开关为开。未知 id 默认关闭。
- 「获取 + 添加所选」会在 discovery 报告的 `inputModalities` 包含 `image` 时，把 `input: [text, image]` 复制到新行。
- `llm-pi-ai` discovery 会把已安装 catalog 的 `input` 复制到注册表已描述的 listing id 上；多个提供方共用同一 id 时优先带 `image` 的条目。catalog 路由的 discovery 会给每个 catalog 模型带上 `inputModalities`。

`read_image` 和 prompt 准入仍然要求当前路由模型包含 `image`。这个开关就是自定义行作出该声明的方式。相关：[统一图片请求管线](2026-08-20-unified-image-request-pipeline.zh.md)、[草稿提供方端点询问](../architecture/2026-08-04-draft-provider-endpoint-interrogation.zh.md)。

## Alternatives considered

**把每个自定义 OpenAI 兼容模型默认成视觉模型。** 否决：过度声明的图片会进入持久会话历史，随后被提供方在当轮拒绝。

**提供方级 `defaultInput` 控件。** 否决：一条网关路由常常同时混有视觉模型和纯文本模型。

**从模型 id 字符串推断能力。** 否决：id 不是能力声明，猜错比明确关闭更糟。

**继续只在 `settings.yaml` 里写这个字段。** 否决：自定义 `grok-4.6` 就是这样失败的。

## Consequences

- 用户可以在模型页声明图片输入，不必编辑 yaml。
- 关闭开关不会写入 `input: [text]`。省略 `input` 的 catalog id 仍可能从已安装 catalog 继承视觉能力。
- 已安装 catalog 未命名的网关 listing id 仍需打开开关，或在 yaml 里写 `input` 列表，图片才会被准入。
- 自定义 OpenAI 兼容路由不会默认成视觉模型。

## Testing

`packages/client/ui-settings-models/tests/image-input.spec.ts` 覆盖存储字段辅助函数。模型卡片规格从开关写入并删除 `input` / `inputModalities`，并从已采纳的 discovery 候选复制图片输入。`packages/llm/llm/tests/topology.spec.ts` 在归一化 discovery 结果时保留 `inputModalities`。`packages/llm/llm-pi-ai/tests/discovery.spec.ts` 覆盖 catalog 路由的 `inputModalities`，以及匹配 listing id 的 overlay。
