# Agent Note: failover-queue add menu is provider then model

Status: implemented

[English](2026-09-19-failover-queue-provider-drilldown.md) | 中文

## Problem

`v0.1.8` 把剩余模型摊成一张平铺列表。供应商一多，菜单会又长又不分档。

## Decision

`v0.1.9` 加入菜单先出供应商。点一个供应商后只列出它下面还没入队的模型。Esc 或返回行回到供应商列表。xfdsh 钉 `github:LunFengChen/dsh-failover-queue#v0.1.9`。

## Verification

Settings → 故障转移 显示 `选择供应商（N）`。点开后列出供应商和模型数量。点 DeepSeek 只出现该供应商剩余模型，不是整份目录。

## Alternatives considered

**继续平铺，只加分组标题。** 菜单仍是一次全展开。

**手风琴，允许多个供应商同时展开。** 第一次点击就应该是选供应商。

## Consequences

- 加入一条路由要两步：先供应商，再模型。
- 搜索仍过滤当前这一层：先供应商，钻进去后是模型。
