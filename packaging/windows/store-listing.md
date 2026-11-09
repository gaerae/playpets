# Microsoft Store listing text

- The Store description, short description and features live only in Partner Center (**Store listings → each language**); `scripts/store-submit.mjs` changes only What's new.
- This file is the text to paste there, kept with the package so a change to what the app does can change its listing in the same pull request.
- Rules each language follows are in [Store setup](../../docs/how-to/store-and-apple-signing.md#prepare-the-listing-and-request-certification):
  - the generative-AI disclosure (policy 11.16) and the dependencies (policy 10.2.4) come first;
  - the category is Entertainment, so PlayPets is a desktop pet app, not a game (policy 10.1.1);
  - a person reports an AI reply through the support contact Partner Center shows on the listing.
- Features stay as they are in Partner Center.

## English (en-us)

Short description:

```text
A cozy desktop pet app: friends stroll, fish and collect beside your work, and can chat through an AI you connect.
```

Description:

```text
A little place to unwind, right beside your work.

AI and requirements: friends' chat replies are generated live by an AI service you choose and connect yourself: Claude Code or Codex signed in with your own account, a local Ollama model, or an OpenAI-compatible API. PlayPets has no AI of its own. AI chat is optional, and its replies can be wrong or unsuitable; to report one, use the support contact on this page. On Windows, PlayPets needs the Microsoft Edge WebView2 Runtime. The yard, games and collecting work without AI.

PlayPets is a free, open-source desktop pet app. Daisy, Clover, Pip and Miso wander through a sunny yard, and you can invite compatible community pets to join them. Leave your companions nearby while you work, or take a short break to play together.

Make the place your own
Choose from four places, change the season, time and weather, or import a compatible background. Resize the window and toggle Always on top independently. Desktop mode lets companions stroll outside the yard window.

Take a small break
Play hide-and-seek, tag and parade, go fishing, grow flowers and fill your collection. Ordinary movement, games and collecting work without an AI connection.

Give each friend a voice
Connect the AI you chose, then set each companion's personality and choose a relationship: friend, partner, mentor or younger sibling. Whatever personality or relationship you set, PlayPets asks the AI to keep replies suitable for ages 13 and up. Chat with one friend or let connected friends talk together.

Bring more friends home
Import compatible Codex pet files and supported community pet pages. Community pets are made and shared by other people, not by PlayPets; to report one, use the site it came from. Free character and background creation kits are available on the PlayPets website for use in your chosen creation tool. PlayPets does not include a hosted image-generation service.

Costs
PlayPets is free. Optional external AI services may charge subscription or usage fees separately. Local models need their own installation and suitable hardware. Downloading pets, external services and updates can require internet access. Store installations receive updates through Microsoft Store. Before uninstalling, press Disconnect for each coding tool you connected in Settings.

PlayPets is an independent community project. It is not an official OpenAI or Anthropic product. It does not require Codex or a PlayPets account.
```

## Korean (ko-kr)

Short description:

```text
일하는 화면 곁에서 친구들이 산책하고 낚시하고 수집하는 데스크톱 펫 앱이에요. 연결한 AI로 대화도 할 수 있어요.
```

Description:

```text
일하는 화면 곁에, 잠시 쉬어갈 작은 공간을 놓아보세요.

AI와 실행 환경: 친구들의 대화는 직접 고르고 연결한 AI 서비스가 그때그때 만들어요. 내 계정으로 로그인한 Claude Code나 Codex, 로컬 Ollama 모델, OpenAI 호환 API 중에서 고를 수 있어요. PlayPets에는 자체 AI가 없어요. AI 대화는 선택 기능이고, 답이 틀리거나 부적절할 수 있어요. 문제가 있는 답은 이 페이지의 지원 연락처로 알려 주세요. Windows에서는 Microsoft Edge WebView2 Runtime이 필요해요. 놀이터와 놀이, 수집은 AI 없이도 즐길 수 있어요.

PlayPets는 무료 오픈소스 데스크톱 펫 앱이에요. Daisy, Clover, Pip, Miso가 화창한 놀이터를 거닐고, 호환되는 커뮤니티 펫도 친구로 초대할 수 있어요. 일할 때 곁에 두거나, 잠깐 함께 놀며 쉬어가세요.

내 취향대로 꾸미는 공간
네 가지 장소에서 계절과 시간, 날씨를 골라보세요. 호환되는 배경을 가져올 수도 있어요. 창 크기는 자유롭게 조절하고 항상 위에 띄우기는 따로 켜거나 끌 수 있어요. 바탕화면 모드에서는 친구들이 놀이터 창 밖을 돌아다녀요.

작고 가벼운 놀이
숨바꼭질, 술래잡기, 퍼레이드를 즐기고 낚시와 꽃 가꾸기, 도감 수집도 해보세요. 산책과 놀이, 수집에는 AI 연결이 필요하지 않아요.

각자 다른 목소리를 가진 친구
고른 AI를 연결한 뒤 친구마다 성격을 정하고 친구·연인·든든한 선배·장난꾸러기 동생 관계를 골라보세요. 어떤 성격이나 관계를 정해도 PlayPets는 AI에게 13세 이상에게 알맞은 답만 하도록 요청해요. 한 친구와 대화하거나 AI가 연결된 친구들끼리 이야기하게 할 수도 있어요.

더 다양한 친구와 배경
호환되는 Codex 펫 파일과 지원하는 커뮤니티 펫 페이지에서 친구를 가져오세요. 커뮤니티 펫은 PlayPets가 아니라 다른 사람들이 만들어 올린 거예요. 문제가 있는 펫은 그 펫을 가져온 사이트에 신고해 주세요. 웹사이트의 무료 캐릭터·배경 제작 키트는 원하는 제작 도구에서 사용할 수 있어요. PlayPets 자체에서 호스팅하는 이미지 생성 서비스는 제공하지 않아요.

비용
PlayPets는 무료예요. 선택한 외부 AI 서비스의 구독료나 사용료는 별도일 수 있어요. 로컬 모델은 따로 설치해야 하며 모델에 맞는 하드웨어가 필요해요. 펫 다운로드와 외부 서비스, 업데이트에는 인터넷 연결이 필요할 수 있어요. Store 설치본은 Microsoft Store에서 업데이트해요. 앱을 지우기 전에 설정에서 연결한 코딩 도구마다 연결 해제를 눌러 주세요.

PlayPets는 독립적인 커뮤니티 프로젝트이며 OpenAI나 Anthropic의 공식 제품이 아니에요. Codex 설치나 PlayPets 계정 가입은 필수가 아니에요.
```

## Japanese (ja-jp)

Short description:

```text
作業画面のそばで仲間が散歩や釣り、収集を楽しむデスクトップペットアプリです。接続したAIで会話もできます。
```

Description:

```text
作業画面のそばに、ひと休みできる小さな場所を。

AIと動作環境：仲間との会話の返事は、自分で選んで接続したAIサービスがその場で生成します。自分のアカウントでログインしたClaude CodeやCodex、ローカルのOllamaモデル、OpenAI互換APIから選べます。PlayPets自体はAIを持ちません。AIとの会話は任意で、返事が誤っていたり不適切だったりすることがあります。問題のある返事は、このページのサポート連絡先からお知らせください。WindowsではMicrosoft Edge WebView2 Runtimeが必要です。庭、遊び、収集はAIなしで楽しめます。

PlayPetsは無料のオープンソース・デスクトップペットアプリです。Daisy、Clover、Pip、Misoが晴れた庭を歩き、互換性のあるコミュニティのペットも仲間に招待できます。仕事中はそばに置いて、休憩には一緒に遊んでみてください。

自分好みの場所に
4つの場所から選び、季節、時間帯、天気を変えられます。対応する背景の読み込みも可能です。ウィンドウは自由にサイズ変更でき、最前面表示は別に切り替えられます。デスクトップモードでは、仲間が庭のウィンドウの外を歩き回ります。

気軽に楽しむ小さな遊び
かくれんぼ、鬼ごっこ、パレードのほか、釣りや花育て、図鑑集めを楽しめます。散歩、遊び、収集にAI接続は必要ありません。

それぞれの声を持つ仲間
選んだAIを接続したら、仲間ごとに性格を決め、友達、恋人、頼れる先輩、遊び好きな年下の関係を選べます。どんな性格や関係にしても、PlayPetsはAIに13歳以上にふさわしい返事をするよう求めます。1人と話したり、AIに接続した仲間同士で会話させたりできます。

もっと多くの仲間と背景を
対応するCodexペットファイルやコミュニティのペットページから読み込めます。コミュニティのペットはPlayPetsではなく、ほかの人が作って公開したものです。問題のあるペットは、取り込んだ元のサイトで報告してください。Webサイトの無料キャラクター・背景制作キットは、お好みの制作ツールで使えます。PlayPets独自のホスト型画像生成サービスは提供していません。

費用
PlayPetsは無料です。選択した外部AIサービスの利用料やサブスクリプション料金は別途かかる場合があります。ローカルモデルには別途インストールと適したハードウェアが必要です。ペットのダウンロード、外部サービス、更新にはインターネット接続が必要な場合があります。Store版はMicrosoft Storeから更新されます。アンインストールの前に、設定で接続したコーディングツールごとに「接続を解除」を押してください。

PlayPetsは独立したコミュニティプロジェクトで、OpenAIやAnthropicの公式製品ではありません。CodexのインストールやPlayPetsアカウント登録は必須ではありません。
```

## Simplified Chinese (zh-cn)

Short description:

```text
在工作画面旁陪伴你的桌面宠物应用：伙伴们散步、钓鱼和收集，还能通过你连接的 AI 聊天。
```

Description:

```text
在工作画面旁，留一处可以歇一歇的小天地。

AI 与运行要求：伙伴的聊天回复由你自己选择并连接的 AI 服务实时生成，可选用以你自己的账号登录的 Claude Code 或 Codex、本地 Ollama 模型，或兼容 OpenAI 的 API。PlayPets 本身不含 AI。AI 对话是可选功能，回复可能有误或不妥；如需举报某条回复，请使用本页面的支持联系方式。在 Windows 上，PlayPets 需要 Microsoft Edge WebView2 Runtime。庭院、游戏和收集不需要 AI。

PlayPets是一款免费开源的桌面宠物应用。Daisy、Clover、Pip和Miso会在晴朗的庭院里散步，你也可以邀请兼容的社区宠物加入。工作时让伙伴陪在身边，休息时一起玩一会儿。

布置喜欢的空间
从四个场景中选择，自由切换季节、时段和天气，也能导入兼容背景。窗口大小可以自由调整，始终置顶可以单独开关。桌面模式下，伙伴会走出庭院窗口，在桌面上活动。

轻松的小小玩法
玩捉迷藏、追逐和游行，体验钓鱼、养花与图鉴收集。散步、游戏和收集不需要连接AI。

让每位伙伴有自己的声音
连接你选择的 AI 后，为每位伙伴设置性格，选择朋友、恋人、可靠的前辈或爱玩的弟妹关系。无论设置成什么性格或关系，PlayPets 都会要求 AI 的回复适合 13 岁及以上的用户。既能与一位伙伴聊天，也能让已连接AI的伙伴彼此交谈。

更多伙伴与背景
导入兼容的Codex宠物文件或受支持的社区宠物页面。社区宠物由其他人制作和分享，而不是 PlayPets；如需举报某只宠物，请前往它所在的站点。网站提供免费的角色与背景制作套件，可在你选择的制作工具中使用。PlayPets不提供自行托管的图像生成服务。

费用
PlayPets免费。所选外部AI服务可能另外收取订阅费或使用费。本地模型需要单独安装，并使用适合该模型的硬件。下载宠物、使用外部服务及更新时可能需要联网。Store版通过Microsoft Store更新。卸载前，请在设置中对每个已连接的编码工具点击“断开连接”。

PlayPets是独立的社区项目，并非OpenAI或Anthropic的官方产品。无需安装Codex，也无需注册PlayPets账号。
```
