# Agent Note: 固定 pi-ai 调用快照并传递调用方取消

Status: implemented

[English](2026-09-04-pi-ai-prepared-snapshot-abort.md) | 中文

## Problem

pi-ai 适配器从一代配置解析模型元数据，却可能在预备调用真正派发时读取下一代配置。与此同时，诊断对象被传到了流转换器原本用于调用方取消信号的位置，导致预取消请求可能被报告为提供方错误，图片读取也无法获得取消信号。

## Decision

`PiAiAdapter.prepareCall()` 捕获解析得到的配置、模型和模型集合，并通过这个快照派发。直接流调用也通过同一个私有路径捕获当前快照。持久图片转换收到 watchdog 信号；`toStreamChunks()` 保留诊断对象作为第三个参数，另行接收调用方信号，用于识别流内取消事件。

## Alternatives considered

**在派发时重新读取配置：** 否决，因为一次预备调用的模型元数据和 endpoint 可能来自不同配置代际。

**只在适配器最外层 catch 中识别取消：** 否决，因为 pi-ai 会把很多提供方故障作为终止流事件返回，这些事件不会以抛出错误的形式进入该 catch。

**移除流转换中的诊断信息：** 否决，因为需要 HTTP 状态、请求 id 和事件事实来解释提供方错误，同时不能泄露凭据。

## Consequences

预备调用固定在同一模型和配置代际，后续调用仍能看到配置变更。预取消和并发取消请求会生成 Harness `ABORTED` 结束结果。附件读取可以随请求 watchdog 停止，现有诊断调用仍保留第三参数接口。
