---
description: 按操作系统选择安装文件、第一次运行时的警告、更新和数据文件夹
---

# 安装

安装文件在 [GitHub 发布页](https://github.com/gaerae/playpets/releases/latest)下载。文件名是 `PlayPets_版本_操作系统.扩展名` 的形式。

::: warning macOS 和 Windows 可能在打开前显示警告
目前的发布文件没有代码签名，macOS 应用也未经公证。Gatekeeper 或 SmartScreen 可能显示警告或阻止打开。这些检查并不能证明文件安全；只有信任从官方发布页下载的文件时才继续。可用操作取决于操作系统和设备策略。代码签名已在计划之中。
:::

## macOS <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_macos-universal.dmg` | Apple Silicon 和 Intel 都可以 |

1. 打开 dmg，把 PlayPets 拖到「应用程序」文件夹。
2. 尝试打开 PlayPets。如果 macOS 提示无法验证开发者或无法验证应用，请关闭提示。
3. 前往「系统设置 > 隐私与安全性」，找到关于 PlayPets 的说明和**仍要打开**。
4. 如果该选项可用，而且你信任下载的文件，点击**仍要打开**，按提示验证身份，再在下一条提示中点击**打开**。macOS 会将该应用保存为例外。

这些步骤遵循 [Apple 的安全打开应用指南](https://support.apple.com/en-us/102445)。如果 macOS 提示应用会损坏电脑，请不要把它当作无法验证开发者的警告处理。受管理的设备可能限制打开应用。

## Windows <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_windows-x64-setup.exe` | 一般 PC（x64）的安装文件 |
| `PlayPets_版本_windows-arm64-setup.exe` | ARM PC 的安装文件 |

1. 运行安装文件。如果 SmartScreen 针对无法识别的应用显示「Windows 已保护你的电脑」，请确认文件来自官方发布页。
2. 如果你信任下载的文件，点击**更多信息**查看可用选项。
3. 如果有**仍要运行**按钮，点击后继续安装。如果没有，设备安全设置或组织策略可能不允许继续。
4. 在语言选择窗口中选择简体中文、英语、韩语或日语，再按提示完成安装。

SmartScreen 检查文件和发布者的信誉，因此新版本也可能再次显示警告。详见 [Microsoft 的 SmartScreen 信誉说明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)。请保持安全防护开启；恶意软件警告与无法识别应用警告是不同情况。

在 ARM PC（骁龙等）上请使用 arm64 文件。x64 文件也能通过模拟运行，但它的安装和卸载程序无法替你关闭正在运行的 PlayPets，请先从托盘退出。

::: tip
Windows 版已在虚拟机中确认过，但还没有在真机上充分验证。发现异常的话，请到 [GitHub Issues](https://github.com/gaerae/playpets/issues) 告诉我们。
:::

## Linux <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_linux-x64.deb`、`…_linux-arm64.deb` | Debian、Ubuntu 系 |
| `PlayPets_版本_linux-x64.AppImage`、`…_linux-arm64.AppImage` | 兼容的 Linux 发行版 |

deb 用包管理器安装。AppImage 加上可执行权限后直接运行。

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux 上要知道的事
- AppImage 需要 FUSE 2。Ubuntu 22.04 使用 `sudo apt install libfuse2`；Ubuntu 24.04 的软件包已改名，使用 `sudo apt install libfuse2t64`。其他发行版请查看 [AppImage 的 FUSE 指南](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)。不使用 FUSE 时，可以运行 `./PlayPets_*.AppImage --appimage-extract-and-run`。
- 关闭窗口后，应用会留在托盘里。GNOME 默认不显示托盘图标，请开启「AppIndicator and KStatusNotifierItem Support」扩展。就算看不到图标，再运行一次应用，乐园窗口也会回来。
- API 密钥保存在 Secret Service（GNOME Keyring、KWallet）里。没有它的环境下，保存需要密钥的连接时会提示无法访问安全存储。Ollama 和订阅 CLI 不用密钥，所以不受影响。
:::

## 更新 <Since v="0.1.0" />

- 可以用设置标签**关于 PlayPets**里的**检查更新**、托盘菜单里的**检查更新…**，或 macOS 菜单栏的 **PlayPets → 检查更新…** 立即检查。
- 新版本按钮会显示在乐园底部操作栏的最左边、地点选择之前。**菜单**里的**设置**也会出现小圆点。点击按钮可选择**查看新内容**、**稍后**或**安装并重启**。同一窗口会显示下载进度、签名验证和安装状态；失败后也可在这里重试。重启成功后，会短暂显示已安装版本的通知。
- 应用启动 20 秒后会悄悄检查一次。有新版本时会弹出通知，可以在设置标签里安装。
- 新版本从 GitHub 发布页的 `latest.json` 查找。下载的文件只有通过更新签名密钥验证后才会安装。验证失败的文件不会安装。

## 卸载

| 操作系统 | 方法 |
|---|---|
| macOS | 把「应用程序」文件夹里的 PlayPets 移到废纸篓 |
| Windows 安装版 | 在「设置 > 应用」里卸载 PlayPets |
| Linux deb | 用安装时的包管理器卸载 |
| Linux AppImage | 删除文件 |

删除应用后，下面的数据文件夹仍会留下。想把设置和导入的宠物也一起删掉，请把数据文件夹一并删除。

## 数据文件夹 <Since v="0.1.0" />

| 操作系统 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

里面有 `state.json`（伙伴和设置）、`bridge.json`（代理联动用的端口和令牌）、`pets/`（导入的宠物）、`builtin/`（自带的四位伙伴）。想放到别的地方，就把文件夹路径填进环境变量 `PLAYPETS_DATA` 再运行应用。详细内容见[设置](./settings.md)。
