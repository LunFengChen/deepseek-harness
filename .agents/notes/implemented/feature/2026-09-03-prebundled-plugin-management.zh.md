# Agent Note：预置插件目录与 profile 启停

状态：已实现

[English](2026-09-03-prebundled-plugin-management.md) | 中文

## 问题

Fork 特有的行为适合放进插件，但 profile 需要一种受支持的方式随包提供可选功能，同时不强制所有安装启用，也不要求用户手动编辑 patch 文件。

## 决策

bundle manifest 可以声明 `dsh.bundle.plugins` 目录项。加载 profile 时会校验并暴露目录，用户选择写入 `dsh.profile.pluginOverrides`。Host 插件清单 Remote 提供目录和 `setEnabled`，Web 设置的「插件列表」渲染可访问的开关并持久化选择。必需项不能停用。外部 npm 包继续由现有 profile 插件 CLI 管理，因此浏览器不会执行包管理器命令。

目录控制的是已经随 profile 安装的 Loader 条目，而不是包安装本身：bundle 及其依赖在 profile 中提供，开关只改变运行时组合，并会在下次启动继续生效。

## Alternatives considered

**要求用户编辑 `cordis.patch.yml`：**这会暴露实现细节，也让 profile 的可选功能难以发现和恢复默认值。

**把每个功能都作为独立 npm 包安装：**这样虽然可以按包移除，但会重复 profile 的依赖图，并要求浏览器负责包管理，不适合作为随 profile 交付的功能。

**允许 Settings 任意修改 Loader 条目：**这会让 UI 状态覆盖用户自己的组合和命令行 overlay，因此修改范围限制为 bundle 声明的目录项。

## 结果

- 功能作者可以提供默认关闭的插件行和本地化设置界面，不需要增加 profile 专用的 fork 逻辑。
- 用户可以在一个位置启停预置功能；`xfdsh plugin --profile <name> add/remove` 仍是包安装边界。
- profile override 是持久化 JSON 状态，在 bundle patch 之后、用户与命令行 overlay 之前应用，因此显式用户 patch 仍然拥有更高优先级。
