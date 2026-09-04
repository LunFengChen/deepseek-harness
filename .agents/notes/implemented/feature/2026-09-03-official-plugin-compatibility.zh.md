# Agent Note：xfdsh profile 兼容官方插件

状态：已实现

[English](2026-09-03-official-plugin-compatibility.md) | 中文

## 问题

官方 dsh 插件组合包可以继续保留 `@deepseek-ai/dsh-*` 依赖名和浏览器模块请求。直接拒绝这些组合包会让原本能在上游产品运行的插件无法用于 xfdsh，而同时安装两个命名空间又可能产生两套不兼容的运行时实例。

## 决策

profile 初始化时写入 profile 本地的 `.pnpmfile.cjs`。其中的 `readPackage` hook 会把 `dependencies`、`optionalDependencies` 和 `peerDependencies` 中的官方 dsh 依赖 spec 改成对应 `@xfcodeai/dsh-*` 包的 npm 别名。依赖键仍保留官方名称，因此插件原有的导入名继续可用，而 Node 实际收到的是 fork 实现。非 registry spec 保持不变；对应的 fork 包不可用时，pnpm 会在安装阶段明确失败。

浏览器 client module system 对官方 dsh 模块请求使用同样的映射，但只有在对应 fork seed、graph row 或已注册 factory 存在时才映射。这样官方 client 组合包可以继续请求原始名称，同时只实例化一份 fork 模块；没有 fork 对应项的其他官方 row 仍可正常解析。

## Alternatives considered

**拒绝所有官方包名：**这样可以保持单一命名空间，但会无谓排除仅保留上游导入名、实际可运行的插件。

**让官方包与 fork 包并列安装：**这能最大化表面上的包兼容性，但可能产生重复的 Loader 注册表和不兼容的服务实例，因此把官方名称别名到 fork 包更安全。

## 结果

- `xfdsh plugin --profile <name> add <official-plugin>` 可以安装依赖上游 dsh 产品包的官方组合包。
- 已有 profile 会在启动时获得 hook；升级后执行 `xfdsh plugin --profile <name> install` 可以重建已安装的别名。
- fork 不保留旧的 `x1a0f3n9` 命名空间，也不会静默混载官方与 fork 两套 dsh 运行时。
- 如果官方插件依赖未发布或缺失的 fork 包，安装仍会在安装阶段失败，而不是延迟为含糊的模块错误。
