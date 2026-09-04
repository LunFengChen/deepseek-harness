# Agent Note: 让 Python runtime closure 使用当前 fork scope

Status: implemented

[English](2026-09-04-python-runtime-scope-install.md) | 中文

## Problem

开发 scope 重写已经把锁文件和构建入口更新为 `@x1a0f3n9/dsh`，但 `python/sdk-runtime/package.json` 仍声明旧的 `@deepseek-ai/dsh-*` workspace 依赖。因此干净 workspace 安装会在构建 Python runtime closure 之前失败。runtime 的 node 模式文档和启动路径也仍然使用旧包路径。

## Decision

在 Python runtime closure manifest、node 模式启动器文档和启动路径描述中统一使用当前 fork scope。对于代表外部插件身份、而非 workspace 包依赖的 profile 兼容测试和用户 profile manifest，继续保留官方包名。

## Alternatives considered

**保留官方 workspace 依赖并增加别名：** 否决，因为 workspace 必须解析一套当前产品依赖图，别名会掩盖不完整的 scope 迁移。

**不修改 Python carrier 路径：** 否决，因为生成的开发 carrier 使用当前 scope 的包，原路径会在运行时失效。

## Consequences

干净的开发 scope workspace 安装可以解析 Python runtime closure，显式 node 模式也会指向 `@x1a0f3n9/dsh`。稳定的 `@xfcodeai` 分支保留对应的稳定 scope 路径。官方插件兼容仍然是显式映射，不会偷偷引入第二套产品运行时。
