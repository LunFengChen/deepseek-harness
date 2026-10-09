# Agent Note: 只把新过期的历史折进头部检查点

Status: implemented

[English](2026-10-08-compaction-fold-new-history.md) | 中文

## Problem

头部检查点落地后，步骤边界压力仍会选中该检查点，`/compact` 也会在保留尾部为零时选中它。后端再次摘要同一条替换，常常通不过缩小检查，于是在下一次预步骤循环，或让 `/compact` 报摘要错误，即使已经没有可折入的新历史。

## Decision

`rangeLacksFoldableHistory` 在所选范围的每个节点都是 compact-checkpoint 时为真。大小不是门槛。压力路径的 `compactIfNeeded` 与空闲的 `compactNow` 跳过该范围。溢出路径的 `compactIfNeeded` 仍会强制压缩它，包括短溢出回退。

只有所选范围仍含非检查点历史时才重试。剩余压力来自保留尾部或请求 envelope 时，`compactIfNeeded` 返回上一次成功结果，而不是抛出会话仍高于阈值。

`compactNow` 对仅含检查点的范围不写括号并返回 `null`。混合范围若带框架摘要并不更便宜，仍记录 `compaction/start` 与带错误的 `compaction/end`，然后返回 `null`；`SummaryDidNotShrinkError` 是 `summary` 的 cause。其它摘要器失败仍是 `ManualCompactionError` `summary`。缩小检查仍是提交门槛。

这部分取代[压缩能力 seam](../feature/2026-06-18-compaction-capability-seam.zh.md)中关于重试的段落。

## Alternatives considered

**只跳过已经落在摘要上限以内的检查点：** 否决，因为过大的检查点仍会再次摘要并循环。

**取消缩小检查：** 否决，因为并不更便宜的替换不得落地，溢出仍需要更便宜的回退。

**让 `/compact` 继续把未能缩小的检查点报成摘要错误：** 否决，因为没有可改变的内容时用户仍会看到失败。

**反复摘要头部检查点直到压力下降：** 否决；那正是本笔记要关掉的循环。

## Consequences

自动压缩把新过期的非检查点历史折进已有头部检查点后停止。对仅含检查点的历史执行 `/compact` 会报告暂无可压缩历史。溢出仍可替换过大检查点。仅剩 envelope 的压力在一次成功压缩后不再抛错。默认摘要 `maxTokens` 为 `2048`，不继承 `headroomTokens`。

## Testing

单元测试钉住压力路径与 `/compact` 对仅含检查点范围的跳过、溢出仍压缩该范围、成功压缩后跳过剩余检查点、重试耗尽且仍有可折历史时抛错，以及未能缩小的 `compactNow` 返回 `null`。
