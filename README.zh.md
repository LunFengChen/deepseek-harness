# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

分支说明：这个 fork 发布的是 `@xfcodeai/dsh` 和 `xfdsh` 启动器，可以和上游 `dsh` 并存。下面表格概览这个 fork 相对上游的主要改动。

## Fork 概览

| 领域 | 改动 | 结果 |
| --- | --- | --- |
| 发布身份 | 包名保持 `@xfcodeai/dsh` / `@xfcodeai/dsh-*`，发布的可执行命令改为 `xfdsh`。 | fork 可以和上游 `dsh` 并装并用。 |
| 会话历史 | Web UI 可以对当前会话做“真删除”：删掉某个问题/回答以及后面的所有历史，并且有双重确认。 | 不满意的回答可以直接从会话里移除，而不是另起一条分支。 |
| 会话工具 | 工作区列表里增加了复制 session id。 | 方便分享、排障和定位会话。 |
| 长任务稳定性 | context overflow 会触发压缩；握手失败可以恢复； goal 轮次不再被旧的硬上限卡死。 | 长任务更不容易在中途停摆。 |
| 模型与图片兼容 | 不支持图片的命令会直接 toast 拒绝；模型不兼容会以清晰的 `session/model-unavailable` 报错。 | 混合模型/图片流程会快速失败，不会悄悄卡住。 |
| sandbox 与回放 | 会忽略过期的 full-access escalation target；pi-ai replay metadata 和包装后的响应状态处理更稳；临时的 `PI_AI_ERROR` 会重试。 | 更少误报，更少回放漂移。 |
| 发布准备 | release 校验、pack 布局、文档和入口检查都已为 fork 调整。 | fork 可以按自己的包线发布和安装。 |

### 安装这个 fork

```sh
npm install --global @xfcodeai/dsh
xfdsh web
```

一次性运行：

```sh
npx @xfcodeai/dsh web
```

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @xfcodeai/dsh web
```

如需重复使用，可全局安装启动器：

```sh
npm install --global @xfcodeai/dsh
xfdsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
