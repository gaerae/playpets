# 常见问题

## PlayPets 是什么？

- PlayPets 是一款免费开源的桌宠应用，能让你的 Codex 宠物最多 12 位一起玩，适用于 macOS、Windows、Linux。
- 伙伴们一起住在小乐园里，也可以跑到桌面上。ChatGPT 桌面应用只显示你选的一只宠物（[OpenAI 指南](https://learn.chatgpt.com/docs/pets)，截至 2026 年 10 月）。
- 它们会通过你连接的 AI 和你聊天，也会互相聊；Claude Code、Codex、Gemini CLI 或 Cursor 干活时，它们会做出反应。

## 能用 Codex 宠物吗？

- “Codex 宠物”是大家对为 ChatGPT 和 Codex 制作的自定义宠物的叫法，OpenAI 把这个功能叫作 Pets。
- 能。PlayPets 原样读取 Codex 宠物文件：一个装有 `pet.json` 和精灵图的文件夹就是一只宠物。所有动作都能用；精灵图里有视线方向时，十六个方向也都能用。
- Codex 宠物文件夹（`~/.codex/pets`）里的宠物会自动出现。还可以从社区网站、GitHub 文件夹或电脑上的文件夹[带来更多](./import.md)。
- 不需要 Codex。如果你在用 ChatGPT 桌面应用，那边的宠物照常用就好；PlayPets 读取的是同样的宠物文件。

## 要花钱吗？

- 应用免费，是 MIT 许可的开源软件。
- 用订阅登录的 Claude Code 或 Codex CLI：使用套餐额度，不另付 API 账单；套餐限制和主动购买的额外点数仍然适用。
- 本地 Ollama 模型：在你的电脑上运行，没有托管推理费用。
- API 密钥连接、兼容服务器和 Ollama 云端模型：按提供方的计费规则。
- 详见 [AI 连接的种类](./chat.md#ai-连接的种类)。

## 没有网络也能用吗？

- 不需要网络：邀请、游戏、桌面模式、时段和天气。
- “自动天气”不获取真实天气，而是按时钟决定。
- 需要网络：导入社区宠物、检查更新、和使用网络的 AI 对话。
- 已下载的本地 Ollama 模型可以离线聊天，对话留在本机。Ollama 云端模型需要网络。

## 我的代码或提示词会发给宠物吗？

- [编码代理联动](./agents.md)省略用户提示词和工具输入。
- 本地桥接使用 `127.0.0.1` 和令牌认证。
- 简短的完成或通知报告（包括截取的代理回复）可能包含工作细节，并可能随伙伴对话发给所选 AI 服务。
- 请检查通过终端或 MCP 发送的消息。想把这些内容留在本机，用已下载的本地模型。

## 在 macOS 上打不开。

- 发布文件没有签名和公证，macOS 可能显示警告。
- 先确认文件来自本项目的发布页面。
- 系统提供**仍要打开**时，按[安装指南](./install.md#macos)操作。
- 能用哪些选项，取决于警告类型和系统策略。

## Windows 上出现警告。

- SmartScreen 可能对暂无代码签名的 GitHub 安装文件显示警告。先核实文件来源。
- 部分系统提供**更多信息**和**仍要运行**；受管理的设备可能不允许继续。
- 详见[安装指南](./install.md#windows)。
- 想不看到警告直接安装，请用 [Microsoft Store](./install.md#microsoft-store) 或 winget：那个安装包由 Microsoft 签名。

## Windows 上无法进行 AI 对话。

- 用 npm 安装的 Claude Code 或 Codex CLI 要在 `%APPDATA%\npm` 里，应用才能找到。

1. 先在终端确认 `claude` 或 `codex` 能运行。
2. 再看连接窗口里对应的卡片是否标着“已安装”。

- Windows 版还没在实际设备上充分测试。仍然不行的话，请通过 [Issue](https://github.com/gaerae/playpets/issues) 告诉我们。

## 宠物很慢，或者很耗电。

- 伙伴只在有动作时频繁绘制，静止时很少绘制。
- 关闭乐园窗口把它隐藏后，乐园不再绘制。
- 还是占用很多的话，减少伙伴数量，或关掉**在桌面散步**试试。
- 告诉我们是在哪种状态下出现的（只有乐园、只有桌面、两者都有），会很有帮助。

## 可以自己做宠物吗？

- 可以。一个装有 `pet.json` 和精灵图的文件夹就是一只宠物，格式和 Codex 宠物相同。
- 做好的文件夹用**导入宠物**里的**从本机文件夹导入**直接邀请。
- 详细规则见[导入宠物](./import.md#自己制作)和开发者文档[宠物文件格式](/dev/standards/pet-files)。

## 有多台显示器时会怎样？

- 在[桌面模式](./desktop.md)下，伙伴可以在任何一台显示器上。
- 拖到另一台显示器，它就留在那里。
- 各显示器缩放比例不同也没关系。

## 数据在哪里？

| 操作系统 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

- `state.json`：伙伴和设置。`pets/`：导入的宠物。`builtin/`：自带宠物。
- API 密钥不在这里，而在操作系统的安全存储里。
- PlayPets 不把对话记录存成文件，只在当前应用会话中保留。
- 连接服务的对话保存，遵循该服务的政策。
- 详见[设置](./settings.md#data-folder)。
