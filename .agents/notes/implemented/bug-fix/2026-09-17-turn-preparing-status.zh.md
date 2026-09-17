# Agent Note: 在提示词组装前刷新 running 状态，并标注轮次阶段

Status: implemented

[English](2026-09-17-turn-preparing-status.md) | 中文

## 问题

Enter 会唤醒驱动器，并在与 `assemble()` 长同步前缀同一 JavaScript 轮次里把 `running` 置位。提示词 RPC、`session/event` follow 和 `api-session/status` 要等到该前缀 await 之后才能刷新。Chat 随后在整个 `running` 窗口显示 `chat.deepDiving`，包括 `step/start` 之前的等待，以及 `step/end` 之后下一次 assemble 仍在飞行时的等待。

## 决策

每次 inbox 领取之后、`systemPrompt.assemble()` 之前，驱动器 await 一次 `setImmediate`，然后调用 `signal.throwIfAborted()`。`followup()` 仍同步发出 `turn/start` 与 `agent/inbox/claimed`。Chat 从宿主 `running`、本地 transcript 提交回声、最后一条可见 Chat 节点，以及时间线最后一步推导轮次状态阶段：

- `running` 为 false 时的 transcript 回声为 preparing
- 位于顶端且 `scheduled` 的 `model-retry` 为 retrying
- 开放的最后一步、running 的 assistant-step，或 running 的 tool-call 为 generating（`chat.deepDiving`）
- 其余在 `running` 为 true 时为 preparing

文案位于 `packages/client/ui-chat/src/client/locale.ts`。领取先于 pre-step 的归属仍在[领取后的 pre-step inbox 生命周期](../architecture/2026-07-31-claimed-pre-step-inbox-lifecycle.zh.md)。宿主 `running` 仍是驱动器级 `api-session/status` 事实。

## 测试

`packages/core/agent-loop/tests/agent.spec.ts` 钉住领取后的 `setImmediate` 让出，以及让出期间取消。`packages/client/ui-chat/tests/chat-view.client.spec.tsx` 钉住 preparing、retrying 与 generating 标签。

## 考虑过的替代方案

**从 `turn/end` 推导 `running`。** 步骤之间持久轮次仍开放，驱动器仍在 running。此时清掉 `running` 会让页脚闪烁，并掩盖诚实的 assemble 等待。

**用 `Promise.resolve()` 让出。** 那是 microtask。Node 仍会在 socket I/O 之前跑完它。只有 `setImmediate` 能让 WebSocket 刷新。

**推迟整个 `kick()`。** `followup()` 测试与观察者要求 `turn/start` 加上领取发生在同一同步轮次。

**通过 `resetForRetry` 恢复 retry 气泡。** 重试时隐藏 `assistant-step` 是已测试约定。Chat 改为读取顶端的 scheduled retry 节点。

**新增 `step/preparing` 会话事件，或把 `running` 放进 control stream。** 那些是后续工作。本次改动使用已有的宿主状态、历史和 Chat 节点。

## 后果

- Enter 可以在 assemble 的同步前缀之前画出 `running` 与 preparing 文案。
- `step/end` 之后若轮次仍开放，页脚显示 preparing 而不是 generating。
- 长达数十秒的 assemble 仍是单独的性能轨道。
- 中断后的空尾 chrome 与 control-stream `running` 保持不变。
