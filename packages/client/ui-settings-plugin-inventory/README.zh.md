---
description: "dsh Web 客户端设置中的插件标签页：按作用域分组的插件清单，以及旁边的 xfdsh 预置插件目录。"
kind: "package-reference"
---

# @x1a0f3n9/dsh-client-ui-settings-plugin-inventory

[English](README.md) | 中文

## 概述

**插件列表**标签页让 Web 用户查看会话和全局插件，而不改变其配置。它优先展示 Agent 预设，并在需要前收起全局清单。xfdsh 预置插件不出现在这个列表里，而是放在旁边的 **xfdsh预置插件** 标签页。卡片保留包名作为主标题，以稳定的条目 id 标识实例，并展示启停状态、出处、运行状态、禁用条件与发现失败；由预设提供的全局条目会列出对应预设。搜索覆盖两个分组，并指出其他预设中的匹配。标签页处理加载、空结果、无匹配、失败与重试状态，且不暴露传输细节；没有预设 roster 时仍会展示全局清单。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

打开设置中的「插件」分区并选择**插件列表**标签页，即可查看宿主的会话和全局插件清单；**xfdsh预置插件**标签页用来启用或停用当前 profile 预置的功能。插件激活期间不会读取 Remote——首次选择该标签页时才挂载组件，并通过 `api-remotes` 懒调用 `ctx.remote.pluginInventory.list()`。

### 阅读卡片

每张收起的卡片使用模块短名称作为主标题，在下方显示稳定的条目 id，并以小标签表示启停状态；已启用的条目还会显示彩色根 fiber 状态圆点。组合生成的次标题省略开头的 `include:` 标记；悬停、搜索、无障碍名称与展开详情仍保留完整 id。长条目 id 会在行内截断，悬停时仍可查看完整值。展开卡片后会显示声明的条目 id、完整模块标识与状态事实：预设行说明它来自哪个预设、组合存活时的运行状态，以及它携带的禁用条件；被预设提供的全局行说明它由 Agent 预设按会话提供、列出启用它的预设，并提供跳转到预设组的入口。预设名经共享的 `presetDisplayText` 纯函数（`dsh-agent-presets/display`）叠在 [`ui-agent-preset`](../ui-agent-preset/README.zh.md) 的字典上解析：内置预设走当前语言，用户自建预设保留自己的元数据，因此英文界面不会回显预设文件里的中文名。搜索按模块名称与条目 id 过滤两组。

### xfdsh预置插件

**xfdsh预置插件**标签页把当前 profile 预置的功能显示成带开关的卡片。每张卡片在标题下显示包名，宿主快照带了版本号时也会显示出来。目录声明了 GitHub homepage 时，包名这一串本身就是指向该 URL 的新标签页链接。没有 homepage 的卡片把包名保留为纯文本，不会编造 npm 仓库地址，也不会多出一行作者。目录为空时隐藏这一组，而不是渲染空分组。插件列表会从全局清单里去掉这些包。

### 预设切换器

切换器与通用设置各行使用同一种「选择胶囊 + 菜单」控件。它列出 roster 的每个预设——默认项带后缀、坏预设带标记——并且只改变列表显示什么：它不写任何设置，选中坏预设时在行的位置展示 discovery 报告的原因。选择默认预设或会话预设的入口仍在原处：Agent 预设分区与新会话页。

### 重试失败的读取

读取失败会在标签页内渲染通用失败状态；重试会重新执行懒 `list()` 调用，且不会暴露传输细节。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

插件列表是宿主拥有快照的只读投影；xfdsh预置插件通过同一份快照写启停。两个标签页在插件激活期间都不读取 Remote，首次选择时才取快照。

### 注册

浏览器插件注册两个本地化 `settings.plugins.tab` 贡献（`all` 和 `xfdsh-presets`）；「插件」分区拥有导航入口与标签栏。注册使用 `ctx.slots.inject()`，因此能跟随标签 slot 的延迟声明、重新声明、本地化变化与 teardown，而无需 import 分区拥有方。

### 渲染

行 key 按作用域限定（`global:`、`preset:<id>:<index>`），因此同一模块出现在两个作用域时保持各自的展开状态；声明的条目 id 出现在展开详情中，并在去掉开头的组合 `include:` 标记后作为收起次标题，没有 id 的行不显示次级标签。预设提供标记在客户端推导：一个全局条目在全局被停用、且至少一个预设行对同一模块标识实际启用时才携带它，因此被所有预设关掉（或仅条件声明）的模块保持单纯的已停用，而不是夸大提供关系。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

以下页面覆盖设置分区、Remote 调用与宿主侧投影。

- [ui-settings-plugins](../ui-settings-plugins/README.zh.md)——本标签页注册进的「插件」分区。
- [ui-settings](../ui-settings/README.zh.md)——声明 `settings.plugins.tab` 的领域底座。
- [api-remotes](../../api/remotes/README.zh.md)——`pluginInventory.list()` 背后的 Remote BFF 表面。
- [plugin-inventory](../../host/plugin-inventory/README.zh.md)——本标签页所渲染的宿主侧只读 Loader 投影。

-----

<a id="model-experience"></a>
## 模型体验

无。该包是浏览器端清单投影，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义清单视图的新鲜度与触达范围；它们是当前包约束。

- **每次 Settings 挂载或重试只读取一份快照**：标签页不订阅 Loader 变化，也不会在重连后自动重新读取；切换标签页会保留当前快照，重新打开 Settings 则会取得新快照。
- **清单仍只读**：插件列表展示全局与预设的启停状态但都不修改。xfdsh预置插件标签页会写 profile 启停。写回自定义预设组合文件的启停控件是刻意留作后续的工作。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。本包持有清单与预置插件启停的 Settings contribution。
