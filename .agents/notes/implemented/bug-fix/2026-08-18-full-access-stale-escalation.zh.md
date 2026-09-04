# Agent Note: full-access 会话忽略陈旧的沙箱升权目标

Status: implemented

[English](2026-08-18-full-access-stale-escalation.md) | 中文

## 问题

模型可能在会话已经切换到 `danger-full-access` 后，仍然保留被拒绝重试时的 `sandbox_permissions` 和 `justification`。严格升权 API 正确地拒绝从最大模式发起的所有目标，但该拒绝发生在命令或文件操作执行之前，因此有效的 full-access 会话会因为 `sandbox escalation ... is not strictly wider` 失败。

## 决策

共享沙箱词汇导出 `isEscalationSatisfiedByStandingMode`。当有效模式是 `danger-full-access` 且请求目标属于声明的目标集合时，`dsh-tool-bash`、`dsh-tool-pwsh` 和 `dsh-tool-fs` 保留常驻的 full-access 策略并跳过审批。参数配对校验仍然首先执行；目标不属于封闭集合时继续进入 `approveEscalation`，因此畸形值或注入值仍然保持 fail-closed。严格升权表不变。

## Alternatives considered

**允许 `approveEscalation` 接受相等或更窄的模式。** 拒绝，因为共享 API 明确是严格升权原语；修改它会削弱所有调用方，并使同级请求看起来像已获批准的升权。

**full-access 下从 schema 隐藏 `sandbox_permissions`。** 拒绝，因为有效模式按会话变化，而 schema 按组合全局生成；即使字段未声明，陈旧或注入的参数仍可能到达执行层。

**在每个工具中分别加入特判。** 拒绝，因为 bash、PowerShell 和文件系统消费方会产生漂移；封闭目标判定应放在共享升权词汇旁边。

## Consequences

当模型重复发送有效升权目标时，full-access 会话不再在执行前失败，即使审批提示不可用或被禁用也一样。较窄模式仍保留严格审批和拒绝行为，未知目标仍然 fail-closed。新增共享判定只覆盖 schema 声明的两个目标，不改变沙箱模式的安全含义。
