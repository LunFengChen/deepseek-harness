# Agent Note: strip inherited reasoning effort on route-only overlays

Status: implemented

[English](2026-09-21-strip-inherited-reasoning-effort-on-reroute.md) | 中文

## Problem

故障转移这类 `agent/request` 覆盖层只改 `provider`/`model`，并原样留下 `reasoningEffort`。P1 上的自定义强度（例如 `xhigh`）就会进到 P2。LLM 层对显式不支持的 effort 会报 `UNSUPPORTED_REASONING_EFFORT`，而不是钳制。`installModelSelection` 在套用所选模型时已经丢掉继承的 effort，但后面的覆盖层仍可能把 seed 的 effort 写回另一条路由。

## Decision

在 `agent/request` waterfall 之后、`prepareCall` 之前：若提议路由和 seed 路由不同，且 `reasoningEffort` 仍是 seed 值，就删掉该字段。下一个模型会物化自己的适配器默认值；没有思考能力则省略。覆盖层若改成了另一个 effort，则保留。LLM 层对显式不支持的 effort 仍响亮失败。

## Verification

`packages/core/agent-loop/tests/request-reconstruction.spec.ts` 先在 P1 发送 `xhigh`，再让 waterfall 只改 provider/model。P2 必须拿到自己的适配器默认值而不是 `xhigh`，且日志 header 把该默认值标成适配器所有。

## Alternatives considered

**在 `resolveCallConfig` 里钳制不支持的 effort。** 否决：当前模型上的显式选择必须仍是响亮的能力错误。

**只让 failover-queue 清掉 effort。** 不能当唯一修复：任何只改路由的覆盖层都有同样的继承，所以防御放在 loop。插件以后仍可自己清。

**路由一变就丢掉所有 effort。** 否决：监听器若给新模型选了新的 effort，必须能发出去。

## Consequences

- 从带思考的模型故障转移到没有该 effort 的模型时，不会再死在继承字段上。
- 同一条路由上按轮改 effort 的行为不变。
- 显式 `maxTokens` 在换供应商后仍保留；effort 不保留，因为 effort id 属于具体模型。
