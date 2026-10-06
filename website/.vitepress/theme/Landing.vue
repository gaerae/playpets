<!-- The front page, in the order a newcomer asks: what it is (the hero: Codex pets as they are,
     several in one yard, each with its own AI), why it exists (the pets lived in one place, one at a
     time), how it differs from other pet apps, then what it does and how to start. The scene and the
     demo draw the sample pets from their real sprite sheets (the files the app uses). -->
<script setup lang="ts">
import { withBase } from 'vitepress';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import generated from '../generated.json';
import Downloads from './Downloads.vue';
import Sprite from './Sprite.vue';
import { useWords } from './words';

const { lang } = useWords();

const copy = {
  ko: {
    eyebrow: '오픈소스 데스크톱 펫 앱 · macOS · Windows · Linux',
    title: ['서로 이야기하는', '펫들의 놀이터'],
    lead: 'Codex 펫 1만 마리를 그대로 데려와요. 친구마다 Claude Code, Codex, Ollama로 말하고, 친구들끼리 이어서 이야기하고, 어느 코딩 에이전트가 일하든 곁에서 함께 일해요. Codex는 없어도 돼요.',
    scene: [
      ['tabby', 'Tabby', 'Claude Code', '오늘 테스트 다 통과했어!'],
      ['smoky', 'Smoky', 'Codex', '리뷰는 내가 봤지.'],
      ['mochi', 'Mochi', 'Ollama', '그럼 간식은 언제 먹어?'],
    ],
    sceneNote: 'Codex 펫 형식 그대로, 커뮤니티 펫 1만 개 이상(2026년 9월 기준). 가져올 수 있는 곳:',
    communities: [
      'OpenPets Registry',
      'Petdex',
      'Codex PokéPets',
      'Awesome Codex Pet',
      'Codex Pets',
      'GitHub 폴더',
      '내 컴퓨터 폴더',
    ],
    whyTitle: '펫은 1만 마리, 보이는 곳은 한 군데였어요',
    whyLead:
      'Codex가 펫을 보여 주자 사람들이 펫을 그리기 시작했어요. 2026년 9월에 세어 보니 1만 마리가 넘었고, 모두 같은 형식이에요. 그런데 이 펫들은 Codex 안에서, 한 번에 한 마리만, Codex가 일할 때만 움직였어요. Claude Code를 쓰면 남의 일이었고, 열 마리를 모아도 한 번에 한 마리만 볼 수 있었어요.',
    whyFrom: 'Codex 안',
    whyTo: 'PlayPets 놀이터',
    why: [
      [
        '형식은 그대로',
        '펫 앱은 대개 자기 형식을 새로 만들어요. 그러면 펫을 다시 그려야 하고 커뮤니티가 나뉘어요. PlayPets는 Codex 펫 파일을 그대로 읽어요.',
      ],
      [
        '한 마리가 아니라 여럿',
        '펫이 한 마리면 상태 표시등이에요. 셋이 모이면 놀이터가 돼요. 간식을 먹으러 걸어오고, 숨바꼭질을 하고, 자기들끼리 이야기를 이어 가요.',
      ],
      [
        'AI와 에이전트는 내가 골라요',
        '친구마다 다른 AI를 붙이고, 코딩 에이전트도 하나에 묶지 않았어요. 이미 쓰는 구독이면 추가 요금이 없어요.',
      ],
    ],
    whyThanks: '펫을 그린 분들께 고마워요. 이 앱은 그 펫들이 더 많은 책상 위에서 움직이게 하려고 만들었어요.',
    diffTitle: '펫 앱은 많아요. 이야기하는 펫은 없었어요',
    diffLead:
      '코딩 에이전트에 반응하는 펫 앱은 2026년에만 열 개 넘게 나왔고, 거의 모두 한 마리가 상태를 보여 주는 표시기예요. PlayPets는 거기서 출발해 대화와 공간을 더했어요.',
    diffNone: '없음',
    diffHead: ['', 'Codex 펫', '대부분의 펫 앱', 'PlayPets'],
    diff: [
      ['펫과 대화', '없음', '없음', '친구마다 Claude Code, Codex, Ollama, OpenAI 호환'],
      ['펫끼리 대화', '없음', '정해진 연출', 'AI가 이어서 말해요'],
      ['어디에', 'Codex 안', '바탕화면 위 한 마리', '시간과 날씨가 흐르는 놀이터, 그리고 바탕화면'],
      ['몇 마리', '한 마리', '대개 한 마리', '여럿'],
      ['펫 파일', 'Codex 형식', '자체 또는 Codex 형식', 'Codex 형식 그대로, 갤러리 주소로 바로'],
      ['에이전트 반응', 'Codex', '훅으로 여러 종', '훅과 MCP로 여러 종. 여기는 같아요'],
    ],
    diffNote:
      'Codex 펫은 OpenAI Codex의 기능이에요. PlayPets는 그 펫 파일 형식을 따르는 별도의 오픈소스 앱이고, Codex가 없어도 돼요.',
    demoTitle: '일하는 친구들',
    demoLead:
      '친구마다 담당 에이전트를 정하면, 그 에이전트의 생각 중과 확인 요청, 완료가 그 친구의 몸짓이 돼요. 프롬프트와 코드는 보내지 않고 상태만 보내요. "뭐 하고 있었어?"라고 물으면 최근 작업을 들려줘요.',
    demo: [
      { line: '$ claude', state: 'idle', tag: '' },
      { line: '> 실패하는 테스트 고쳐 줘', state: 'idle', tag: '' },
      { line: '● 생각 중…', state: 'working', tag: '생각 중' },
      { line: '● Bash: npm test', state: 'working', tag: 'Bash 사용 중' },
      { line: '● 파일을 바꿔도 될까요?', state: 'waiting', tag: '확인 기다리는 중' },
      { line: '● Edit: src/app.js', state: 'working', tag: '편집 중' },
      { line: '✓ 테스트 56개 통과', state: 'done', tag: '끝났어요!' },
    ],
    states: [
      ['working', '생각 중, 도구 사용 중'],
      ['waiting', '확인을 기다릴 때'],
      ['done', '작업이 끝났을 때'],
      ['error', '명령이 실패했을 때'],
      ['wave', '인사할 때'],
      ['idle', '쉴 때'],
    ],
    features: [
      {
        title: '친구들이 서로 이야기해요',
        body: '친구 여럿을 한 대화에 부르면 차례로 답하고, 놀이터의 수다 떨기를 누르면 자기들끼리 이어 가요. 각자 다른 AI와 성격이라 같은 질문에도 다르게 말해요. 놀이터에서는 말풍선으로 보여요.',
        shot: 'yard-talk',
        link: '/guide/chat',
      },
      {
        title: '친구마다 다른 AI로 대화해요',
        body: 'Claude Code와 Codex는 설치돼 있으면 바로 쓰고, 추가 요금이 없어요. Ollama면 인터넷 없이도 돼요. 성격을 정해 두면 그 말투로 답하고, 대화 중에 성격을 바꿀 수도 있어요. 친구·연인·선배·동생 가운데 관계를 정하면 호칭과 말투가 달라져요.',
        shot: 'friend-chat',
        link: '/guide/chat',
      },
      {
        title: '놀이터에서도, 바탕화면에서도',
        body: '아침, 한낮, 저녁, 밤과 날씨가 시계를 따라 바뀌는 놀이터에서 간식을 먹고 숨바꼭질을 해요. 바탕화면으로 내보내면 모니터마다 나와 다른 창 위를 돌아다녀요.',
        shot: 'desktop',
        link: '/guide/desktop',
      },
    ],
    howTitle: '시작은 세 단계예요',
    how: [
      [
        '친구를 초대해요',
        '기본 펫 세 마리가 들어 있고, ~/.codex/pets의 펫은 자동으로 보여요. 커뮤니티 펫은 주소를 붙여 넣거나 갤러리의 "PlayPets에서 열기" 링크로 가져와요.',
      ],
      [
        '친구마다 AI를 붙여요',
        '친구 탭에서 AI 연결하기를 눌러요. 설치된 Claude Code와 Codex는 자동으로 찾고, Ollama와 OpenAI 호환 서버는 주소만 적어요. 성격은 친구 설정에서요.',
      ],
      [
        '에이전트에게 담당 친구를 정해요',
        '설정 탭에서 도구마다 담당 친구를 고르고 "설정 복사"를 눌러 붙여 넣어요. Node.js는 필요 없고, 앱 실행 파일이 곧 명령이에요.',
      ],
    ],
    agents: [
      ['Claude Code', '~/.claude/settings.json', '훅으로 모든 단계'],
      ['Codex CLI', '~/.codex/config.toml', '작업이 끝나면 알림'],
      ['Gemini CLI', '~/.gemini/settings.json', '훅으로 모든 단계'],
      ['Cursor', '~/.cursor/hooks.json', '편집, 명령, 완료'],
      ['그 밖의 MCP 도구', '도구의 MCP 설정', 'set_pet_state, say, react'],
    ],
    agentsHead: ['에이전트', '붙여 넣는 곳', '전해지는 것'],
    trustTitle: '내 컴퓨터 안에서만',
    trust: [
      ['무료, MIT 라이선스', '코드는 전부 GitHub에 있어요.'],
      ['127.0.0.1에서만 오가요', '연동은 토큰이 있는 로컬 브리지로만 받아요.'],
      ['프롬프트와 코드는 안 보내요', '상태와 짧은 문장만 친구에게 가요.'],
      ['가벼워요', 'Tauri로 만들어 운영체제의 웹뷰를 쓰고, 설치 파일이 작아요.'],
    ],
    releaseTitle: (v: string) => `PlayPets ${v}`,
    releaseBody: '이 버전에 들어간 것과 알려진 제한을 버전 페이지에 적어 두었어요.',
    releaseLink: (v: string) => `${v} 살펴보기`,
    finalTitle: '펫들이 서로 이야기하는 걸 들어 보세요',
    github: 'GitHub에서 보기',
    guide: '사용 안내 읽기',
    more: '자세히',
  },
  en: {
    eyebrow: 'Open-source desktop pet app · macOS · Windows · Linux',
    title: ['A yard where', 'your pets talk to each other'],
    lead: 'Bring the ten thousand Codex pets as they are. Each friend talks with its own AI (Claude Code, Codex, Ollama), friends keep the conversation going among themselves, and whatever coding agent is working has company. No Codex required.',
    scene: [
      ['tabby', 'Tabby', 'Claude Code', 'All tests passed today!'],
      ['smoky', 'Smoky', 'Codex', 'I did the review.'],
      ['mochi', 'Mochi', 'Ollama', 'So when is treat time?'],
    ],
    sceneNote: 'The Codex pet format as is: 10,000+ community pets (as of September 2026). Bring them from:',
    communities: [
      'OpenPets Registry',
      'Petdex',
      'Codex PokéPets',
      'Awesome Codex Pet',
      'Codex Pets',
      'a GitHub folder',
      'a folder on your disk',
    ],
    whyTitle: 'Ten thousand pets, one place to see them',
    whyLead:
      'When Codex started showing pets, people started drawing them. By September 2026 there were more than ten thousand, all in the same format. Yet they lived inside Codex, one at a time, moving only while Codex worked. If you used Claude Code they were someone else’s, and if you collected ten you still saw one.',
    whyFrom: 'Inside Codex',
    whyTo: 'The PlayPets yard',
    why: [
      [
        'The format, as it is',
        'Most pet apps invent their own format. Pets get redrawn and the community splits. PlayPets reads Codex pet files as they are.',
      ],
      [
        'Several, not one',
        'One pet is a status light. Three make a yard: they walk over for treats, play hide and seek, and keep a conversation going among themselves.',
      ],
      [
        'Your AI, your agent',
        'Each friend gets its own AI, and no single coding agent is required. A subscription you already pay for costs nothing extra.',
      ],
    ],
    whyThanks: 'Thank you to everyone who drew these pets. PlayPets exists so they can move on more desks.',
    diffTitle: 'Plenty of pet apps. None that talk',
    diffLead:
      'More than ten pet apps that react to coding agents appeared in 2026, and nearly all are a single pet showing a status. PlayPets starts there and adds conversation and a place to live.',
    diffNone: 'No',
    diffHead: ['', 'Codex pet', 'Most pet apps', 'PlayPets'],
    diff: [
      ['Chat with a pet', 'No', 'No', 'Each friend: Claude Code, Codex, Ollama, OpenAI-compatible'],
      ['Pets talking to each other', 'No', 'Scripted only', 'The AIs keep the conversation going'],
      ['Where they live', 'Inside Codex', 'One pet over the desktop', 'A yard with time and weather, and the desktop'],
      ['How many', 'One', 'Usually one', 'Several'],
      ['Pet files', 'Codex format', 'Own or Codex format', 'Codex format as is, straight from a gallery address'],
      ['Agent reactions', 'Codex', 'Hooks, several agents', 'Hooks and MCP, several agents. Same here'],
    ],
    diffNote:
      'Codex pets are a feature of OpenAI Codex. PlayPets is a separate open-source app that follows that pet file format, and it works without Codex.',
    demoTitle: 'Friends at work',
    demoLead:
      'Give each coding agent a friend, and that agent’s thinking, waiting and done become that friend’s poses. Prompts and code never leave; only the state does. Ask “What were you up to?” and it tells you.',
    demo: [
      { line: '$ claude', state: 'idle', tag: '' },
      { line: '> fix the failing test', state: 'idle', tag: '' },
      { line: '● Thinking…', state: 'working', tag: 'Thinking' },
      { line: '● Bash: npm test', state: 'working', tag: 'Using Bash' },
      { line: '● May I edit this file?', state: 'waiting', tag: 'Waiting for you' },
      { line: '● Edit: src/app.js', state: 'working', tag: 'Editing' },
      { line: '✓ 56 tests passed', state: 'done', tag: 'Done!' },
    ],
    states: [
      ['working', 'Thinking, using a tool'],
      ['waiting', 'Waiting for your answer'],
      ['done', 'Work finished'],
      ['error', 'A command failed'],
      ['wave', 'Saying hi'],
      ['idle', 'Resting'],
    ],
    features: [
      {
        title: 'Friends talk to each other',
        body: 'Bring several friends into one conversation and they answer in turn; press Let them chat in the yard and they keep going among themselves. Different AIs and personalities answer the same question differently. In the yard it shows as speech bubbles.',
        shot: 'yard-talk',
        link: '/guide/chat',
      },
      {
        title: 'Each friend, its own AI',
        body: 'Claude Code and Codex work as soon as they are installed, with no extra fee. Ollama works offline. Set a personality and the friend keeps that voice, or change it mid-conversation. Pick a relationship, friend, partner, senior or younger sibling, and the voice and the address follow.',
        shot: 'friend-chat',
        link: '/guide/chat',
      },
      {
        title: 'In the yard, and on the desktop',
        body: 'Treats and hide-and-seek in a yard where morning, day, evening, night and the weather follow the clock. Send friends out and they roam every monitor over other windows.',
        shot: 'desktop',
        link: '/guide/desktop',
      },
    ],
    howTitle: 'Three steps to start',
    how: [
      [
        'Invite friends',
        'Three starter pets are included and pets in ~/.codex/pets show up by themselves. Bring community pets in by pasting an address or through a gallery’s “Open in PlayPets” link.',
      ],
      [
        'Give each friend an AI',
        'In the Friend tab, press Connect an AI. Installed Claude Code and Codex are found by themselves; Ollama and OpenAI-compatible servers just need an address. Personalities live in friend settings.',
      ],
      [
        'Give each agent a friend',
        'In Settings, pick which friend each tool reports to, then press “Copy settings” and paste. No Node.js needed: the app binary is the command.',
      ],
    ],
    agents: [
      ['Claude Code', '~/.claude/settings.json', 'Every step, via hooks'],
      ['Codex CLI', '~/.codex/config.toml', 'A note when a turn ends'],
      ['Gemini CLI', '~/.gemini/settings.json', 'Every step, via hooks'],
      ['Cursor', '~/.cursor/hooks.json', 'Edits, commands, completion'],
      ['Other MCP tools', 'The tool’s MCP settings', 'set_pet_state, say, react'],
    ],
    agentsHead: ['Agent', 'Where to paste', 'What arrives'],
    trustTitle: 'Stays on your computer',
    trust: [
      ['Free, MIT licensed', 'All of the code is on GitHub.'],
      ['127.0.0.1 only', 'Integrations reach the app through a local bridge with a token.'],
      ['No prompts, no code', 'Only a state and a short line reach your friends.'],
      ['Light', 'Built with Tauri on the system webview; the installer stays small.'],
    ],
    releaseTitle: (v: string) => `PlayPets ${v}`,
    releaseBody: 'What is in this version and its known limits are on the release page.',
    releaseLink: (v: string) => `See what’s in ${v}`,
    finalTitle: 'Come hear your pets talk to each other',
    github: 'View on GitHub',
    guide: 'Read the guide',
    more: 'How it works',
  },
  'zh-hans': {
    eyebrow: '开源桌面宠物应用 · macOS · Windows · Linux',
    title: ['宠物们互相聊天的', '乐园'],
    lead: '把一万只 Codex 宠物原样带来。每位伙伴用 Claude Code、Codex 或 Ollama 说话，伙伴之间接着聊，任何编码代理工作时都有它们陪着。没有 Codex 也可以。',
    scene: [
      ['tabby', 'Tabby', 'Claude Code', '今天的测试全过了！'],
      ['smoky', 'Smoky', 'Codex', '评审是我看的。'],
      ['mochi', 'Mochi', 'Ollama', '那什么时候吃零食？'],
    ],
    sceneNote: 'Codex 宠物格式原样支持，社区宠物超过一万只（截至 2026 年 9 月）。可以从这些地方带来：',
    communities: [
      'OpenPets Registry',
      'Petdex',
      'Codex PokéPets',
      'Awesome Codex Pet',
      'Codex Pets',
      'GitHub 文件夹',
      '我电脑上的文件夹',
    ],
    whyTitle: '宠物有一万只，能看到它们的地方只有一个',
    whyLead:
      'Codex 开始显示宠物后，大家开始画宠物。2026 年 9 月数了一下，已经超过一万只，格式全都一样。可是这些宠物只在 Codex 里、一次一只、只在 Codex 工作时才动。用 Claude Code 的人看不到，收集了十只也只能一次看一只。',
    whyFrom: 'Codex 里',
    whyTo: 'PlayPets 乐园',
    why: [
      ['格式保持原样', '宠物应用通常会另造一套格式，宠物就得重画，社区也会分裂。PlayPets 直接读取 Codex 宠物文件。'],
      ['不是一只，是好几只', '一只宠物只是状态灯，三只聚在一起就成了乐园：走过来吃零食，玩捉迷藏，自己接着聊天。'],
      ['AI 和代理由你选', '每位伙伴接不同的 AI，也不绑定某一个编码代理。用你已经在付费的订阅，不多花钱。'],
    ],
    whyThanks: '感谢画出这些宠物的人。做这个应用，是为了让它们在更多人的桌面上动起来。',
    diffTitle: '宠物应用很多。会聊天的宠物还没有',
    diffLead:
      '2026 年一年就出了十多个会对编码代理做出反应的宠物应用，几乎都是一只宠物显示状态的指示器。PlayPets 从那里出发，加上了对话和空间。',
    diffNone: '无',
    diffHead: ['', 'Codex 宠物', '大多数宠物应用', 'PlayPets'],
    diff: [
      ['和宠物聊天', '无', '无', '每位伙伴：Claude Code、Codex、Ollama、OpenAI 兼容'],
      ['宠物之间聊天', '无', '固定演出', 'AI 接着说下去'],
      ['住在哪里', 'Codex 里面', '桌面上的一只', '时间和天气流动的乐园，还有桌面'],
      ['几只', '一只', '通常一只', '好几只'],
      ['宠物文件', 'Codex 格式', '自有或 Codex 格式', 'Codex 格式原样，粘贴画廊地址就行'],
      ['对代理的反应', 'Codex', '通过钩子支持多种', '钩子和 MCP 支持多种。这一点相同'],
    ],
    diffNote: 'Codex 宠物是 OpenAI Codex 的功能。PlayPets 是遵循该宠物文件格式的另一个开源应用，没有 Codex 也可以用。',
    demoTitle: '工作中的伙伴',
    demoLead:
      '给每个编码代理指定一位伙伴，代理的思考、等待确认、完成就变成那位伙伴的动作。不发送提示词和代码，只发送状态。问一句“刚才在做什么？”，它会讲最近的工作。',
    demo: [
      { line: '$ claude', state: 'idle', tag: '' },
      { line: '> 修一下失败的测试', state: 'idle', tag: '' },
      { line: '● 正在思考…', state: 'working', tag: '正在思考' },
      { line: '● Bash: npm test', state: 'working', tag: '正在使用 Bash' },
      { line: '● 可以修改这个文件吗？', state: 'waiting', tag: '等待确认' },
      { line: '● Edit: src/app.js', state: 'working', tag: '正在修改' },
      { line: '✓ 56 个测试通过', state: 'done', tag: '完成了！' },
    ],
    states: [
      ['working', '思考中、使用工具中'],
      ['waiting', '等待你确认时'],
      ['done', '任务完成时'],
      ['error', '命令失败时'],
      ['wave', '打招呼时'],
      ['idle', '休息时'],
    ],
    features: [
      {
        title: '伙伴们互相聊天',
        body: '把几位伙伴叫进同一个对话，它们轮流回答；按下乐园里的“聊聊天”，它们就自己接着聊。各自的 AI 和性格不同，同一个问题也会答得不一样。在乐园里会以气泡显示。',
        shot: 'yard-talk',
        link: '/guide/chat',
      },
      {
        title: '每位伙伴用不同的 AI 聊天',
        body: 'Claude Code 和 Codex 装好就能用，没有额外费用。用 Ollama 的话不联网也行。定好性格，它就用那种语气回答，聊天中也能改。在朋友、恋人、前辈、弟弟妹妹里定下关系，称呼和语气就跟着变。',
        shot: 'friend-chat',
        link: '/guide/chat',
      },
      {
        title: '在乐园里，也在桌面上',
        body: '早晨、白天、傍晚、夜晚和天气跟着时钟变化的乐园里，吃零食、玩捉迷藏。放到桌面上，它们会在每台显示器上、在其他窗口之上走来走去。',
        shot: 'desktop',
        link: '/guide/desktop',
      },
    ],
    howTitle: '三步开始',
    how: [
      [
        '邀请伙伴',
        '自带三只基础宠物，~/.codex/pets 里的宠物会自动出现。社区宠物粘贴地址，或者通过画廊的“在 PlayPets 中打开”链接带来。',
      ],
      [
        '给每位伙伴接上 AI',
        '在伙伴标签按“连接 AI”。已安装的 Claude Code 和 Codex 会自动找到，Ollama 和 OpenAI 兼容服务器只需填地址。性格在伙伴设置里。',
      ],
      [
        '给代理指定负责的伙伴',
        '在设置标签为每个工具选一位伙伴，按“复制设置”粘贴进去。不需要 Node.js，应用的可执行文件就是命令。',
      ],
    ],
    agents: [
      ['Claude Code', '~/.claude/settings.json', '通过钩子传递每一步'],
      ['Codex CLI', '~/.codex/config.toml', '一轮结束时通知'],
      ['Gemini CLI', '~/.gemini/settings.json', '通过钩子传递每一步'],
      ['Cursor', '~/.cursor/hooks.json', '编辑、命令、完成'],
      ['其他 MCP 工具', '工具的 MCP 设置', 'set_pet_state、say、react'],
    ],
    agentsHead: ['代理', '粘贴到哪里', '传过来什么'],
    trustTitle: '只在你的电脑上',
    trust: [
      ['免费，MIT 许可证', '代码全都在 GitHub 上。'],
      ['只走 127.0.0.1', '联动只通过带令牌的本地桥接进来。'],
      ['不发送提示词和代码', '到伙伴那里的只有状态和一句短话。'],
      ['轻巧', '用 Tauri 构建，使用操作系统的 WebView，安装包很小。'],
    ],
    releaseTitle: (v: string) => `PlayPets ${v}`,
    releaseBody: '这个版本里有什么、已知的限制，都写在版本页面上。',
    releaseLink: (v: string) => `查看 ${v}`,
    finalTitle: '来听听宠物们互相聊天',
    github: '在 GitHub 上查看',
    guide: '阅读使用指南',
    more: '了解更多',
  },
};
const t = computed(() => copy[lang.value]);
const shotUrl = (name: string) => withBase(`/shots/${generated.version}/${lang.value}/${name}.webp`);
// The launch video, once it has been made for this language: site-prepare records whether
// intro-<lang>.mp4 and its intro-<lang>.jpg poster exist. The WebM is an optional extra source (a
// browser that finds none falls back to the MP4 without showing anything); the poster is set only
// when it exists, so a missing JPG never shows as a broken image.
const videoSrc = computed(() => (generated.video?.[lang.value] ? withBase(`/media/intro-${lang.value}`) : null));
const posterSrc = computed(() =>
  videoSrc.value && generated.poster?.[lang.value] ? `${videoSrc.value}.jpg` : undefined,
);
// A page's address in the current language: the English address, under the language's folder.
const path = (page: string) => withBase(lang.value === 'en' ? page : `/${lang.value}${page}`);

// The scene: three friends take turns doing something.
const sceneStates = ref(['wave', 'idle', 'idle']);
// Who is talking in the scene: the friends take turns, like a ping-pong in the yard.
const speaker = ref(0);
const demoShown = ref(0);
let sceneTimer: ReturnType<typeof setInterval> | undefined;
let demoTimer: ReturnType<typeof setTimeout> | undefined;
const poses = ['wave', 'jump', 'done', 'idle'];
let turn = 0;
const rotate = () => {
  turn++;
  speaker.value = turn % 3;
  sceneStates.value = [0, 1, 2].map(i => (i === turn % 3 ? poses[Math.floor(turn / 3) % poses.length] : 'idle'));
};
// A clicked friend jumps, then goes back to whatever it was doing.
const poke = (i: number) => {
  const before = sceneStates.value[i];
  sceneStates.value = sceneStates.value.map((v, k) => (k === i ? 'jump' : v));
  setTimeout(() => {
    if (sceneStates.value[i] === 'jump') sceneStates.value = sceneStates.value.map((v, k) => (k === i ? before : v));
  }, 1700);
};
// The demo: lines appear one by one, the friend's state follows; it loops, slowly.
const step = () => {
  demoShown.value = demoShown.value >= t.value.demo.length ? 1 : demoShown.value + 1;
  demoTimer = setTimeout(step, demoShown.value === t.value.demo.length ? 3600 : 1400);
};
onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    demoShown.value = t.value.demo.length;
    return;
  }
  sceneTimer = setInterval(rotate, 2600);
  demoTimer = setTimeout(step, 800);
});
onBeforeUnmount(() => {
  clearInterval(sceneTimer);
  clearTimeout(demoTimer);
});
const current = computed(() => t.value.demo[Math.max(0, demoShown.value - 1)] ?? t.value.demo[0]);
</script>

<template>
  <main class="landing">
    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">{{ t.eyebrow }}</p>
        <h1>
          <span>{{ t.title[0] }}</span>
          <span>{{ t.title[1] }}</span>
        </h1>
        <p class="lead">{{ t.lead }}</p>
        <Downloads>
          <a class="dl-secondary" :href="path('/guide/')">{{ t.guide }}</a>
        </Downloads>
      </div>
      <div class="scene" aria-hidden="true">
        <video
          v-if="videoSrc"
          class="scene-video"
          autoplay
          muted
          loop
          playsinline
          :poster="posterSrc"
        >
          <source :src="`${videoSrc}.webm`" type="video/webm" />
          <source :src="`${videoSrc}.mp4`" type="video/mp4" />
        </video>
        <template v-else>
          <div class="scene-sky">
            <i class="sun" />
            <i class="cloud a" />
            <i class="cloud b" />
          </div>
          <div class="scene-hill back" />
          <div class="scene-hill far" />
          <div class="scene-hill near" />
          <div class="walker"><Sprite pet="mochi" state="right" :scale="0.42" /></div>
          <div class="scene-pets">
            <button
              v-for="([pet, name, ai, line], i) in t.scene"
              :key="pet"
              type="button"
              class="scene-pet"
              :class="[pet, { speaking: speaker === i }]"
              :aria-label="name"
              @click="poke(i)"
            >
              <span class="bubble">{{ line }}</span>
              <Sprite :pet="pet" :state="sceneStates[i]" :scale="i === 0 ? 0.9 : i === 1 ? 0.78 : 0.68" />
              <span class="name-tag">{{ name }}<small>{{ ai }}</small></span>
            </button>
          </div>
        </template>
      </div>
    </section>
    <div class="communities">
      <p>{{ t.sceneNote }}</p>
      <ul>
        <li v-for="c in t.communities" :key="c">{{ c }}</li>
      </ul>
    </div>

    <section class="why">
      <div class="why-story">
        <h2>{{ t.whyTitle }}</h2>
        <p class="section-lead">{{ t.whyLead }}</p>
      </div>
      <figure class="why-figure" aria-hidden="true">
        <div class="why-panel before">
          <span class="why-label">{{ t.whyFrom }}</span>
          <Sprite pet="smoky" state="working" :scale="0.42" />
        </div>
        <span class="why-arrow">→</span>
        <div class="why-panel after">
          <span class="why-label">{{ t.whyTo }}</span>
          <span class="why-friends">
            <Sprite pet="mochi" state="jump" :scale="0.34" />
            <Sprite pet="tabby" state="wave" :scale="0.42" />
            <Sprite pet="smoky" state="done" :scale="0.36" />
          </span>
        </div>
      </figure>
      <ul class="why-grid">
        <li v-for="[title, body] in t.why" :key="title" class="clay">
          <h3>{{ title }}</h3>
          <p>{{ body }}</p>
        </li>
      </ul>
      <p class="why-thanks">{{ t.whyThanks }}</p>
    </section>

    <section class="diff">
      <h2>{{ t.diffTitle }}</h2>
      <p class="section-lead">{{ t.diffLead }}</p>
      <div class="clay diff-table-wrap">
        <table class="diff-table">
          <thead>
            <tr>
              <th v-for="(h, i) in t.diffHead" :key="i" :class="{ us: i === 3 }">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[what, codex, others, us] in t.diff" :key="what">
              <th scope="row">{{ what }}</th>
              <td :data-label="t.diffHead[1]" :class="{ none: codex === t.diffNone }">{{ codex }}</td>
              <td :data-label="t.diffHead[2]" :class="{ none: others === t.diffNone }">{{ others }}</td>
              <td :data-label="t.diffHead[3]" class="us">{{ us }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="diff-note">{{ t.diffNote }}</p>
    </section>

    <section class="demo-section">
      <div class="demo-text">
        <h2>{{ t.demoTitle }}</h2>
        <p class="section-lead">{{ t.demoLead }}</p>
        <ul class="state-grid">
          <li v-for="[state, label] in t.states" :key="state" class="clay">
            <Sprite :state="state" :scale="0.5" />
            <span>{{ label }}</span>
          </li>
        </ul>
      </div>
      <div class="demo" :aria-label="t.demoTitle">
        <div class="demo-perch">
          <Sprite pet="smoky" :state="current.state" :scale="0.74" />
          <span class="demo-tag" :class="{ on: current.tag }">{{ current.tag || ' ' }}</span>
        </div>
        <div class="terminal" aria-hidden="true">
          <div class="terminal-bar"><i /><i /><i /><span>claude — zsh</span></div>
          <ol class="terminal-lines">
            <li v-for="(d, i) in t.demo" :key="i" :class="{ shown: i < demoShown }" :data-state="d.state">{{ d.line }}</li>
          </ol>
        </div>
      </div>
    </section>

    <section class="features">
      <article v-for="f in t.features" :key="f.shot" class="feature">
        <div class="feature-text">
          <h2>{{ f.title }}</h2>
          <p>{{ f.body }}</p>
          <a :href="path(f.link)" class="more">{{ t.more }} →</a>
        </div>
        <figure class="feature-shot">
          <img :src="shotUrl(f.shot)" :alt="f.title" loading="lazy" decoding="async" />
        </figure>
      </article>
    </section>

    <section class="how">
      <h2>{{ t.howTitle }}</h2>
      <ol class="steps">
        <li v-for="[title, body] in t.how" :key="title" class="clay">
          <h3>{{ title }}</h3>
          <p>{{ body }}</p>
        </li>
      </ol>
      <table class="agents">
        <thead>
          <tr>
            <th v-for="h in t.agentsHead" :key="h">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[a, where, what] in t.agents" :key="a">
            <td>{{ a }}</td>
            <td :data-label="t.agentsHead[1]"><code>{{ where }}</code></td>
            <td :data-label="t.agentsHead[2]">{{ what }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="trust">
      <h2>{{ t.trustTitle }}</h2>
      <ul class="trust-grid">
        <li v-for="[title, body] in t.trust" :key="title">
          <b>{{ title }}</b>
          <span>{{ body }}</span>
        </li>
      </ul>
    </section>

    <section class="release-card">
      <div>
        <h2>{{ t.releaseTitle(generated.version) }}</h2>
        <p>{{ t.releaseBody }}</p>
      </div>
      <a :href="path(`/releases/${generated.version}`)" class="more">{{ t.releaseLink(generated.version) }} →</a>
    </section>

    <section class="final" id="download">
      <div class="final-pets">
        <Sprite pet="mochi" state="jump" :scale="0.55" />
        <Sprite pet="tabby" state="wave" :scale="0.7" />
        <Sprite pet="smoky" state="done" :scale="0.6" />
      </div>
      <h2>{{ t.finalTitle }}</h2>
      <Downloads compact />
      <p class="final-links">
        <a href="https://github.com/gaerae/playpets">{{ t.github }}</a>
        <a :href="path('/guide/')">{{ t.guide }}</a>
      </p>
    </section>
  </main>
</template>
