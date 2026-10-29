# 常见问题

## PlayPets 是什么？

- PlayPets 是一款免费开源的桌宠应用，能让你的 Codex 宠物最多 12 位一起玩，适用于 macOS、Windows、Linux。
- 伙伴们一起住在小乐园里，也可以跑到桌面上。ChatGPT 桌面应用只显示你选的一只宠物（[OpenAI 指南](https://learn.chatgpt.com/docs/pets)，截至 2026 年 10 月）。
- 它们会通过你连接的 AI 和你聊天，也会互相聊；Claude Code、Codex、Gemini CLI 或 Cursor 干活时，它们会做出反应。

## 能用 Codex 宠物吗？

- “Codex 宠物”是大家对为 ChatGPT 和 Codex 制作的自定义宠物的叫法，OpenAI 把这个功能叫作 Pets。
- 能。PlayPets 原样读取 Codex 宠物文件：一个装有 `pet.json` 和精灵图的文件夹就是一只宠物。所有动作都能用；精灵图里有视线方向时，十六个方向也都能用。
- Codex 宠物文件夹（`~/.codex/pets`）里的宠物会自动出现在**邀请伙伴**里。还可以从社区网站、GitHub 文件夹或电脑上的文件夹[带来更多](./import.md)。
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

## 遇到问题时 {#troubleshooting}

| 现象 | 原因 | 怎么办 |
|---|---|---|
| macOS 上打不开 PlayPets | 1.2.0 及更早版本没有签名 | 安装 1.3.0 或更高版本。旧版本请看[仍要打开](./install.md#macos) |
| Windows 安装文件出现 SmartScreen 警告 | GitHub 上的安装文件暂无代码签名 | 用由 Microsoft 签名的 [Microsoft Store 或 winget](./install.md#microsoft-store) 安装。或者先核实来源，再选**更多信息 → 仍要运行**（[GitHub 安装文件](./install.md#installer-from-github)） |
| Linux 上 AppImage 无法启动 | 缺少 FUSE 2 | 安装 `libfuse2`（Ubuntu 24.04 为 `libfuse2t64`），或用 `--appimage-extract-and-run` 运行（[Linux](./install.md#linux)） |
| 关闭窗口后乐园不见了 | 关闭只是隐藏 | 在托盘图标里选**打开乐园**。GNOME 没有 AppIndicator 扩展时会隐藏托盘图标；再次启动应用也能让乐园回来 |
| 伙伴只说“准备好一起玩了！”，不回答 | 这位伙伴还没有 AI | [连接 AI](./chat.md#创建连接) |
| Claude Code 或 Codex CLI 的卡片上没有**已安装** | 应用找不到这个命令 | 确认终端里能运行 `claude` 或 `codex`。在 Windows 上用 npm 安装的，要在 `%APPDATA%\npm` 里 |
| 保存连接时提示无法访问安全存储 | 密钥存储被锁定或不存在（Linux 上没有 Secret Service 时） | 允许访问；在 Linux 上可用 GNOME Keyring 或 KWallet。Ollama 和已登录的 CLI 不需要密钥 |
| 编码代理在工作，伙伴却没有反应 | 没有粘贴设置、没有重新启动代理，或者移动过应用 | 重新复制并粘贴设置，再重新启动代理（[编码代理联动](./agents.md)）。Codex CLI 的伙伴只显示任务完成，不显示工作中 |
| 消息发给了别的伙伴 | 没有选**负责的伙伴**，所以由第一位伙伴接收 | 在**设置 → 编码工具连接**里选好负责的伙伴，再重新复制并粘贴设置 |
| 宠物地址导入不了 | 网站不受支持，或文件在另一个网站上 | 下载宠物，用文件夹或 ZIP 导入（[导入宠物](./import.md)） |
| 很慢或很耗电 | 伙伴移动时会频繁绘制 | 关闭乐园窗口：隐藏的乐园不会绘制。也可以减少伙伴，或关掉**在桌面散步** |

还有其他问题，请写上系统和 PlayPets 版本，通过 [Issue](https://github.com/gaerae/playpets/issues) 告诉我们。Windows 版还没在实际设备上充分测试。

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
| Windows | `%APPDATA%\app.playpets\`。Microsoft Store（包括用 winget 安装）：在安装包专用的文件夹里 |
| Linux | `~/.local/share/app.playpets/` |

- `state.json`：伙伴和设置。`pets/`：导入的宠物。`backgrounds/`：导入的背景。`builtin/`：自带宠物。
- API 密钥不在这里，而在操作系统的安全存储里。
- PlayPets 不把对话记录存成文件，只在当前应用会话中保留。
- 连接服务的对话保存，遵循该服务的政策。
- 详见[设置](./settings.md#data-folder)。
