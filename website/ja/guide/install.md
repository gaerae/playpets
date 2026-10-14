---
description: OSに合ったインストーラーの選び方、初回起動時の警告、アップデートとデータフォルダー
---

# インストール

インストーラーは[GitHubリリース](https://github.com/gaerae/playpets/releases/latest)から入手します。ファイル名は`PlayPets_version_os.extension`の形式です。

::: warning macOSとWindowsでは開く前に警告が出る場合があります
配布ファイルはまだコード署名されておらず、macOSのアプリは公証も済んでいません。GatekeeperやSmartScreenが警告したり、開くのを止めたりする場合があります。これらの確認を通っても、ファイルが安全だと確かめられたわけではありません。公式リリースページからのダウンロードを信頼できる場合だけ進んでください。使える操作はOSや端末の管理方針によって異なります。署名は予定しています。
:::

## macOS <Since v="0.1.0" /> {#macos}

| ファイル | 対象 |
|---|---|
| `PlayPets_version_macos-universal.dmg` | Apple SiliconとIntelの両方 |

1. dmgを開き、PlayPetsを「アプリケーション」フォルダーへドラッグします。
2. PlayPetsを開いてみます。macOSが開発元を確認できない、またはアプリを検証できないと表示したら、警告を閉じます。
3. 「システム設定」>「プライバシーとセキュリティ」を開きます。PlayPetsについての案内と「このまま開く」を探します。
4. その操作が使えて、ダウンロードを信頼できる場合は「このまま開く」を押し、求められたら認証して、次の警告で「開く」を押します。macOSがこのアプリの例外を保存します。

この手順は[Appleの安全にアプリを開く方法の案内](https://support.apple.com/en-us/102445)に沿っています。macOSが「コンピュータに損害を与える」と表示した場合は、開発元を確認できないという警告と同じものとして扱わないでください。管理された端末では、アプリを開くことが制限される場合があります。

## Windows <Since v="0.1.0" /> {#windows}

| ファイル | 対象 |
|---|---|
| `PlayPets_version_windows-x64-setup.exe` | 通常のPC（x64）向けインストーラー |
| `PlayPets_version_windows-arm64-setup.exe` | ARM PC向けインストーラー |
| `PlayPets_version_windows-x64-portable.zip`、`…_windows-arm64-portable.zip` | 展開して実行、インストール不要 |

1. インストーラーを実行します。認識されないアプリとしてSmartScreenが「Windows によって PC が保護されました」と表示したら、ファイルが公式リリースページから入手したものか確認します。
2. ダウンロードを信頼できる場合は「詳細情報」を選び、使える操作を確認します。
3. 「実行」があれば選んで、インストーラーを続けます。ない場合は、端末のセキュリティ設定や組織の方針で続けられないようになっている可能性があります。

ポータブルZIPは、好きなフォルダーに展開して`playpets.exe`を実行します。同じ認識されないアプリの警告が出る場合があります。SmartScreenはファイルと発行元の評判を見るため、新しいバージョンでもまた警告が出ることがあります。[MicrosoftによるSmartScreenの評判の説明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)を参照してください。保護機能はオンのままにしてください。マルウェアの警告は、認識されないアプリの警告とは別のものです。

ARM PC（Snapdragonなど）では、arm64のファイルを使ってください。x64のファイルもエミュレーションで動きますが、そのインストーラーとアンインストーラーは実行中のPlayPetsを代わりに閉じられません。先にトレイから終了してください。

::: tip
Windows版は仮想マシンで確認しましたが、実機ではまだ十分にテストしていません。おかしな点があれば[GitHubのIssue](https://github.com/gaerae/playpets/issues)で知らせてください。
:::

## Linux <Since v="0.1.0" />

| ファイル | 対象 |
|---|---|
| `PlayPets_version_linux-x64.deb`、`…_linux-arm64.deb` | Debian、Ubuntu系 |
| `PlayPets_version_linux-x64.AppImage`、`…_linux-arm64.AppImage` | 対応するLinuxディストリビューション |

debはパッケージ管理ツールでインストールします。AppImageは実行可能にしてから起動します。

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linuxで知っておくこと
- AppImageにはFUSE 2が必要です。Ubuntu 22.04では`sudo apt install libfuse2`でインストールし、Ubuntu 24.04では名前が変わったパッケージ`sudo apt install libfuse2t64`を使います。お使いのディストリビューションについては[AppImageのFUSEの案内](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)を参照してください。FUSEがない場合は`./PlayPets_*.AppImage --appimage-extract-and-run`で起動します。
- 窓を閉じてもアプリはトレイに残ります。GNOMEでは「AppIndicator and KStatusNotifierItem Support」拡張機能がオンでないとトレイアイコンが表示されません。アイコンがなくても、アプリをもう一度起動すれば庭が戻ってきます。
- APIキーはSecret Service（GNOME Keyring、KWallet）に保存します。ない場合、キーが必要な接続を保存しようとすると、安全な保管場所に接続できないという案内が出ます。OllamaとサブスクリプションのCLIにはキーは要りません。
:::

## アップデート <Since v="0.1.0" /> {#updates}

- 設定タブの「PlayPets について」にある「アップデートを確認」、トレイメニューの「アップデートを確認…」、またはmacOSのメニューバーの「PlayPets」→「アップデートを確認…」で、すぐに確認できます。
- **メニュー**内の新しいバージョンのボタンと「設定」の点で知らせます。ボタンを押すと「変更点を見る」「あとで」「インストールして再起動」を選べます。同じ窓でダウンロードの進捗、署名の確認、インストールの状態を確認でき、失敗した場合は再試行できます。
- アプリの起動20秒後に、一度だけ静かに確認します。新しいバージョンがあれば案内が出て、設定タブからインストールできます。
- 新しいバージョンはGitHubリリースの`latest.json`で見つけます。ダウンロードしたファイルは、アップデート用の署名鍵で検証してからインストールします。検証に失敗したファイルはインストールしません。
- WindowsのポータブルZIPは自動アップデートの対象外です。新しいZIPをダウンロードして置き換えてください。

## アンインストール

| OS | 方法 |
|---|---|
| macOS | 「アプリケーション」フォルダーのPlayPetsをゴミ箱に入れます |
| Windowsインストーラー | 「設定」>「アプリ」でPlayPetsを削除します |
| Windowsポータブル | 展開したフォルダーを削除します |
| Linux deb | インストールに使ったパッケージ管理ツールで削除します |
| Linux AppImage | ファイルを削除します |

アプリを削除しても、下のデータフォルダーは残ります。設定や取り込んだペットも消すには、データフォルダーも削除してください。

## データフォルダー <Since v="0.1.0" /> {#data-folder}

| OS | 場所 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

中には`state.json`（友だちと設定）、`bridge.json`（エージェント連携のポートとトークン）、`pets/`（取り込んだペット）、`builtin/`（付属の3種類の仲間）があります。別の場所に置くには、環境変数`PLAYPETS_DATA`にフォルダーのパスを入れてアプリを起動します。詳しくは[設定](./settings.md)を参照してください。
