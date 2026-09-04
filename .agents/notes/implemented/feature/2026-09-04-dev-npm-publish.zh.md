# Agent Note: 开发分支 npm 发布

Status: implemented

[English](2026-09-04-dev-npm-publish.md) | 中文

## Problem

开发分支需要发布独立重命名后的 `@x1a0f3n9/dsh-*` 包线，同时不能让 feature 分支或其他 release family 的 tag 直接发布它。

## Decision

开发分支的 release workflow 在 pull request 和 `dev-x1a0f3n9` push 时运行校验。成功的开发分支 push 可以发布 dsh family；release verifier 通过 `RELEASE_PUBLISH_ALLOW_REF` 只接受这个精确分支引用。现有的按 tag 手动发布仍然由 tag 门禁保护。

包版本仍然由仓库的 release bump 提交提供。已经发布且完整性相同的版本可以幂等重跑；如果包内容发生变化，必须先生成新版本再 push。

## Alternatives considered

**每个提交都生成一个临时版本：** 这样会让包版本依赖 CI 实现细节，仓库 release 脚本也不再是版本唯一来源。

**允许任意分支发布：** 这样未经审核的 feature 分支就能写入开发包线。

**继续只从 master 发布：** 这样开发包 scope 在合并稳定分支前无法供用户使用。

## Consequences

- `dev-x1a0f3n9` push 会发布 `@x1a0f3n9/dsh-*`；已存在且完整性相同的版本会跳过。
- feature 分支的 pull request 仍会运行打包和安装布局校验，但不使用凭据。
- 同一个 release verifier 可以通过精确比较允许的 ref，同时保护稳定和开发 workflow。
