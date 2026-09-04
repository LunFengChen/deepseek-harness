# Agent Note: 为会话删除注入 persistence 服务

Status: implemented

[English](2026-09-04-session-delete-persistence-injection.md) | 中文

## Problem

会话删除命令会访问 `ctx.sessionPersistence`，但 Session Controller 的 Cordis 注入列表没有声明这个服务。因此生产 web 请求点击删除按钮后，会在执行持久化截断前因为属性访问失败，而不是完成真正的历史删除。

## Decision

将 `sessionPersistence` 声明为 Session Controller 依赖，并在删除命令中显式解析它。如果直接测试或不完整 profile 没有提供该服务，则返回说明无法删除会话历史的结构化内部错误，不再访问不存在的 context 属性。

## Alternatives considered

**继续使用未声明的 context 属性：** 否决，因为 Cordis 不保证未声明的服务会出现在注入 context 中，而且这个问题只有用户点击删除后才会暴露。

**在客户端插件中实现删除：** 否决，因为真正的持久化截断必须由 host controller 协调 live Session 和 persistence writer。

## Consequences

web profile 会在暴露 Session Controller 前等待 persistence 服务，删除请求会先改写持久化 JSONL 前缀，再更新 live Session。缺少 persistence 时现在会得到可诊断的 Remote 错误，而不是 `sessionPersistence` 属性访问异常。
