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

1. インストーラーを実行します。認識されないアプリとしてSmartScreenが「Windows によって PC が保護されました」と表示したら、ファイルが公式リリースページから入手したものか確認します。
2. ダウンロードを信頼できる場合は「詳細情報」を選び、使える操作を確認します。
3. 「実行」があれば選んで、インストーラーを続けます。ない場合は、端末のセキュリティ設定や組織の方針で続けられないようになっている可能性があります。
4. 言語選択画面で日本語、英語、韓国語、簡体字中国語から選び、案内に沿ってインストールします。

SmartScreenはファイルと発行元の評判を見るため、新しいバージョンでもまた警告が出ることがあります。[MicrosoftによるSmartScreenの評判の説明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)を参照してください。保護機能はオンのままにしてください。マルウェアの警告は、認識されないアプリの警告とは別のものです。

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

Microsoft Store版の更新はStoreが管理します。**Microsoft Store → ライブラリ**で確認してください。以下のGitHubインストーラーによる更新はMSIX以外のインストールに適用されます。テスト用MSIXもパッケージ管理による更新を使います。保存と外部通信については[プライバシーポリシー](../privacy.md)をご覧ください。

- 設定の「アプリのアップデート」にある「アップデートを確認」、トレイメニューの「アップデートを確認…」、またはmacOSのメニューバーの「PlayPets」→「アップデートを確認…」で、すぐに確認できます。どれも設定の「アプリのアップデート」を開き、確認結果と更新の操作を同じ場所に表示します。
- 新しいバージョンがあると、バージョン表示が静かに現れ、押すと同じ設定項目を開きます。変更内容を読み、**インストールして再起動**を選ぶと、ダウンロード、署名確認、インストール後に再起動します。自動確認だけでインストールを始めることはありません。ダウンロード中は設定を閉じて遊びを続けられ、小さい窓にも進捗ボタンが残ります。開き直しても重複ダウンロードしません。エラーと再試行も「アプリのアップデート」で確認できます。再起動後に新しいバージョンを短く知らせます。
- アプリの起動20秒後に静かに確認し、その後は実行中に6時間ごとに確認します。確認に失敗した場合は5分後、15分後、1時間後に静かに再試行し、その後は6時間ごとに再試行します。確認に成功すると6時間間隔に戻ります。自動確認で設定を開いたり通知を表示したりすることはありません。
- 新しいバージョンはGitHubリリースの`latest.json`で見つけます。ダウンロードしたファイルは、アップデート用の署名鍵で検証してからインストールします。検証に失敗したファイルはインストールしません。

## アンインストール

| OS | 方法 |
|---|---|
| macOS | 「アプリケーション」フォルダーのPlayPetsをゴミ箱に入れます |
| Windowsインストーラー | 「設定」>「アプリ」でPlayPetsを削除します |
| Linux deb | インストールに使ったパッケージ管理ツールで削除します |
| Linux AppImage | ファイルを削除します |

アプリを削除しても、下のデータフォルダーは残ります。設定や取り込んだペットも消すには、データフォルダーも削除してください。

## データフォルダー <Since v="0.1.0" /> {#data-folder}

| OS | 場所 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

中には`state.json`（友だちと設定）、`bridge.json`（エージェント連携のポートとトークン）、`pets/`（取り込んだペット）、`builtin/`（付属の4種類の仲間）があります。別の場所に置くには、環境変数`PLAYPETS_DATA`にフォルダーのパスを入れてアプリを起動します。詳しくは[設定](./settings.md)を参照してください。
