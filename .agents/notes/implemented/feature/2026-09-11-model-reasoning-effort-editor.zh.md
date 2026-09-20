# Agent Note: custom model reasoning effort editor

Status: implemented

[English](2026-09-11-model-reasoning-effort-editor.md) | 中文

## Problem

手写的 `llm-pi-ai` 模型不会继承思考档位。composer 滑条只读 `reasoning.efforts`，所以没写 `reasoningEfforts` 的自定义 Grok 路由看不到思考强度。改 YAML 可以，但 Settings → Models 已经在管自定义模型列表，却漏了这个字段。

## Decision

Settings → Models 里每个自定义模型行只有两档：默认（无）会省略 `reasoningEfforts`；自定义会把勾选的档位和网关值写到该模型。没有提供方级别的控件，也不猜预设。预装的 `dsh-reasoning-effort` 滑条仍然只读模型目录。

## Verification

`pnpm exec vitest run packages/client/ui-settings-models/tests/reasoning-efforts.client.spec.ts packages/client/ui-settings-models/tests/provider-form.client.spec.tsx packages/client/ui-settings-models/tests/components.client.spec.tsx` 覆盖 map 解析、空自定义拒绝、写入 `{ high, xhigh }`，以及回到默认（无）。

## Alternatives considered

**按模型 id 猜 Grok 或 DeepSeek 预设。** 否决：用户只要默认（无）和自定义两档。

**预装 `dsh-thinking-effort` 这类声明插件。** 这个字段否决：模型列表已经在 Settings → Models，再开一页设置会把同一处编辑藏起来。

**改 `dsh-reasoning-effort` 去发明档位。** 否决：那个插件读 `reasoning.efforts`；写目录数据属于模型行。

**提供方级别一个输入框。** 否决：同一路由下的模型并不一致，图片模型必须保持无。

## Consequences

- 自定义 Grok 和其他手写模型不用手改 `settings.yaml` 也能露出思考强度。
- 默认（无）保持原来的目录行为。
- 选「自定义」不会写入空 map，保存按钮保持可用；勾选 off 以外的档位后才写入。
- 自定义只勾了 `off` 时，卡片会拒绝保存。
