---
description: 按操作系统选择安装文件、第一次运行时的警告、更新和数据文件夹
---

# 安装

安装文件在 [GitHub 发布页](https://github.com/gaerae/playpets/releases/latest)下载。文件名是 `PlayPets_版本_操作系统.扩展名` 的形式。

::: warning 第一次运行时会出现警告
目前的发布文件没有代码签名，所以 macOS 的 Gatekeeper 和 Windows 的 SmartScreen 会在第一次运行时拦一下。这不是应用本身的问题，只是因为没有签名才出现的警告。签名已在计划之中，准备好后这里的说明也会更新。按下面各操作系统的步骤跳过即可。
:::

## macOS <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_macos-universal.dmg` | Apple Silicon 和 Intel 都可以 |

1. 打开 dmg，把 PlayPets 拖到「应用程序」文件夹。
2. 打开一次 PlayPets。会出现「无法验证开发者」或「无法打开」的提示，然后关闭。
3. 前往「系统设置 > 隐私与安全性」。往下翻，有一条关于 PlayPets 的提示和**仍要打开**按钮。
4. 点**仍要打开**，用密码或 Touch ID 确认。之后就能直接打开了。

从 macOS 15 起，按住 Control 键打开的方法已经没有了，所以必须去系统设置。

## Windows <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_windows-x64-setup.exe` | 一般 PC（x64）的安装文件 |
| `PlayPets_版本_windows-arm64-setup.exe` | ARM PC 的安装文件 |
| `PlayPets_版本_windows-x64-portable.zip`、`…_windows-arm64-portable.zip` | 无需安装，解压即可运行 |

1. 运行安装文件。SmartScreen 会弹出「Windows 已保护你的电脑」窗口。
2. 点**更多信息**，就会出现**仍要运行**按钮。
3. 点**仍要运行**，按安装步骤走完。

便携版 zip 解压到想要的文件夹，运行 `playpets.exe` 就行。这时的 SmartScreen 警告也用同样的方法跳过。

::: tip
Windows 版还没有在真机上充分验证过。发现异常的话，请到 [GitHub Issues](https://github.com/gaerae/playpets/issues) 告诉我们。
:::

## Linux <Since v="0.1.0" />

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_linux-x64.deb`、`…_linux-arm64.deb` | Debian、Ubuntu 系 |
| `PlayPets_版本_linux-x64.AppImage`、`…_linux-arm64.AppImage` | 不限发行版，直接运行 |

deb 用包管理器安装。AppImage 加上可执行权限后直接运行。

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux 上要知道的事
- AppImage 需要 FUSE 2。Ubuntu 22.04 起默认没有，所以要运行一次 `sudo apt install libfuse2`，或者用 `./PlayPets_*.AppImage --appimage-extract-and-run` 来运行。
- 关闭窗口后，应用会留在托盘里。GNOME 默认不显示托盘图标，请开启「AppIndicator and KStatusNotifierItem Support」扩展。就算看不到图标，再运行一次应用，乐园窗口也会回来。
- API 密钥保存在 Secret Service（GNOME Keyring、KWallet）里。没有它的环境下，保存需要密钥的连接时会提示无法访问安全存储。Ollama 和订阅 CLI 不用密钥，所以不受影响。
:::

## 更新 <Since v="0.1.0" />

- 在设置标签的**应用更新**里点**检查更新**，就会立刻检查。有新版本时，按钮会变成**安装并重启**。
- 应用启动 20 秒后会悄悄检查一次。有新版本时会弹出通知，可以在设置标签里安装。
- 新版本从 GitHub 发布页的 `latest.json` 查找。下载的文件只有通过更新签名密钥验证后才会安装。验证失败的文件不会安装。
- Windows 便携版 zip 不在自动更新范围内。请下载新的 zip 替换。

## 卸载

| 操作系统 | 方法 |
|---|---|
| macOS | 把「应用程序」文件夹里的 PlayPets 移到废纸篓 |
| Windows 安装版 | 在「设置 > 应用」里卸载 PlayPets |
| Windows 便携版 | 删除解压出来的文件夹 |
| Linux deb | 用安装时的包管理器卸载 |
| Linux AppImage | 删除文件 |

删除应用后，下面的数据文件夹仍会留下。想把设置和导入的宠物也一起删掉，请把数据文件夹一并删除。

## 数据文件夹 <Since v="0.1.0" />

| 操作系统 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

里面有 `state.json`（伙伴和设置）、`bridge.json`（代理联动用的端口和令牌）、`pets/`（导入的宠物）、`builtin/`（自带的三只宠物）。想放到别的地方，就把文件夹路径填进环境变量 `PLAYPETS_DATA` 再运行应用。详细内容见[设置](./settings.md)。
