import { defineConfig } from 'vitepress';
import { devSidebar } from './sidebar-dev.mts';

const repo = 'https://github.com/gaerae/playpets';
// "Edit this page" opens the file in the repository: the developer docs live in docs/ (the site
// has a generated copy under en/dev/), every other page in website/. VitePress sends this function
// to the browser as source text, so it names the repository itself instead of using `repo`.
const editLink = (text: string) => ({
  pattern: ({ filePath }: { filePath: string }) =>
    filePath.startsWith('en/dev/')
      ? `https://github.com/gaerae/playpets/edit/main/docs/${filePath.slice(7).replace(/^index\.md$/, 'README.md')}`
      : `https://github.com/gaerae/playpets/edit/main/website/${filePath}`,
  text,
});

export default defineConfig({
  title: 'PlayPets',
  base: '/playpets/',
  cleanUrls: true,
  lastUpdated: false,
  sitemap: { hostname: 'https://gaerae.github.io/playpets/' },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/playpets/icon.svg' }],
    ['meta', { name: 'theme-color', content: '#f9ae55' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'PlayPets' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=JetBrains+Mono:wght@400;600&display=swap',
      },
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
      },
    ],
  ],
  locales: {
    root: {
      label: '한국어',
      lang: 'ko-KR',
      description:
        '서로 이야기하는 펫들의 놀이터. Codex 펫 1만 마리를 그대로 데려와 친구마다 다른 AI로 말하고, 친구들끼리 이어서 이야기하고, 어느 코딩 에이전트든 곁에서 함께 일하는 오픈소스 데스크톱 펫이에요.',
      themeConfig: {
        nav: [
          { text: '사용 안내', link: '/guide/', activeMatch: '^/guide/' },
          { text: '버전', link: '/releases/', activeMatch: '^/releases/' },
          { text: '개발(영어)', link: '/en/dev/' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: '사용 안내',
              items: [
                { text: '시작하기', link: '/guide/' },
                { text: '설치하기', link: '/guide/install' },
                { text: '첫 친구 초대하기', link: '/guide/first-friend' },
                { text: '친구와 대화하기', link: '/guide/chat' },
                { text: '코딩 에이전트 연동', link: '/guide/agents' },
                { text: '바탕화면 모드', link: '/guide/desktop' },
                { text: '놀이터와 놀이', link: '/guide/play' },
                { text: '펫 가져오기', link: '/guide/import' },
                { text: '설정', link: '/guide/settings' },
                { text: '자주 묻는 질문', link: '/guide/faq' },
              ],
            },
          ],
          '/releases/': [{ text: '버전', items: [{ text: '모든 버전', link: '/releases/' }] }],
        },
        outline: { label: '이 페이지', level: [2, 3] },
        docFooter: { prev: '이전', next: '다음' },
        returnToTopLabel: '맨 위로',
        sidebarMenuLabel: '목차',
        darkModeSwitchLabel: '화면 모드',
        langMenuLabel: '언어',
        editLink: editLink('이 페이지 고치기'),
        footer: {
          message: 'MIT 라이선스로 공개된 오픈소스예요. OpenAI와 관계가 없고, Codex는 OpenAI의 상표예요.',
          copyright: '© 2026 gaerae',
        },
        notFound: {
          title: '이런 페이지는 없어요',
          quote: '친구들이 숨바꼭질을 하다 길을 잃었나 봐요. 주소를 다시 확인해 주세요.',
          linkLabel: '첫 페이지로',
          linkText: '첫 페이지로 가기',
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description:
        'A yard where your pets talk to each other. An open-source desktop pet that brings the ten thousand Codex pets as they are, gives each friend its own AI, lets friends talk among themselves, and keeps any coding agent company.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/', activeMatch: '^/en/guide/' },
          { text: 'Releases', link: '/en/releases/', activeMatch: '^/en/releases/' },
          { text: 'Developers', link: '/en/dev/', activeMatch: '^/en/dev/' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Start here', link: '/en/guide/' },
                { text: 'Install', link: '/en/guide/install' },
                { text: 'Your first friend', link: '/en/guide/first-friend' },
                { text: 'Talking with friends', link: '/en/guide/chat' },
                { text: 'Coding agents', link: '/en/guide/agents' },
                { text: 'Desktop mode', link: '/en/guide/desktop' },
                { text: 'The yard and games', link: '/en/guide/play' },
                { text: 'Importing pets', link: '/en/guide/import' },
                { text: 'Settings', link: '/en/guide/settings' },
                { text: 'FAQ', link: '/en/guide/faq' },
              ],
            },
          ],
          '/en/releases/': [{ text: 'Releases', items: [{ text: 'All releases', link: '/en/releases/' }] }],
          '/en/dev/': devSidebar(),
        },
        editLink: editLink('Edit this page'),
        footer: {
          message:
            'Free and open source under the MIT license. Not affiliated with OpenAI; Codex is a trademark of OpenAI.',
          copyright: '© 2026 gaerae',
        },
      },
    },
    'zh-hans': {
      label: '简体中文',
      lang: 'zh-Hans',
      link: '/zh-hans/',
      description:
        '宠物们互相聊天的乐园。把一万只 Codex 宠物原样带来，每位伙伴用不同的 AI 说话，伙伴之间接着聊，任何编码代理工作时都有它们陪着。开源桌面宠物应用。',
      themeConfig: {
        nav: [
          { text: '使用指南', link: '/zh-hans/guide/', activeMatch: '^/zh-hans/guide/' },
          { text: '版本', link: '/zh-hans/releases/', activeMatch: '^/zh-hans/releases/' },
          { text: '开发者（英文）', link: '/en/dev/' },
        ],
        sidebar: {
          '/zh-hans/guide/': [
            {
              text: '使用指南',
              items: [
                { text: '从这里开始', link: '/zh-hans/guide/' },
                { text: '安装', link: '/zh-hans/guide/install' },
                { text: '邀请第一位伙伴', link: '/zh-hans/guide/first-friend' },
                { text: '和伙伴聊天', link: '/zh-hans/guide/chat' },
                { text: '编码代理联动', link: '/zh-hans/guide/agents' },
                { text: '桌面模式', link: '/zh-hans/guide/desktop' },
                { text: '乐园和游戏', link: '/zh-hans/guide/play' },
                { text: '导入宠物', link: '/zh-hans/guide/import' },
                { text: '设置', link: '/zh-hans/guide/settings' },
                { text: '常见问题', link: '/zh-hans/guide/faq' },
              ],
            },
          ],
          '/zh-hans/releases/': [{ text: '版本', items: [{ text: '所有版本', link: '/zh-hans/releases/' }] }],
        },
        outline: { label: '本页内容', level: [2, 3] },
        docFooter: { prev: '上一页', next: '下一页' },
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '目录',
        darkModeSwitchLabel: '外观',
        langMenuLabel: '语言',
        editLink: editLink('修改这一页'),
        footer: {
          message: '以 MIT 许可证开源。与 OpenAI 无关，Codex 是 OpenAI 的商标。',
          copyright: '© 2026 gaerae',
        },
        notFound: {
          title: '没有这一页',
          quote: '伙伴们玩捉迷藏时大概迷路了。请再检查一下地址。',
          linkLabel: '回到首页',
          linkText: '回到首页',
        },
      },
    },
  },
  themeConfig: {
    logo: '/icon.svg',
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '검색', buttonAriaLabel: '검색' },
              modal: {
                displayDetails: '자세히 보기',
                resetButtonTitle: '지우기',
                backButtonTitle: '닫기',
                noResultsText: '찾은 것이 없어요:',
                footer: { selectText: '열기', navigateText: '이동', closeText: '닫기' },
              },
            },
          },
          'zh-hans': {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除',
                backButtonTitle: '关闭',
                noResultsText: '没有找到：',
                footer: { selectText: '打开', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: repo }],
  },
  // The share card in the page's language: og.png for Korean, og-<language>.png for the others.
  transformHead({ pageData }) {
    const lang = pageData.relativePath.match(/^(en|zh-hans)\//)?.[1];
    const image = `https://gaerae.github.io/playpets/og${lang ? `-${lang}` : ''}.png`;
    return [
      ['meta', { property: 'og:image', content: image }],
      ['meta', { name: 'twitter:image', content: image }],
    ];
  },
  markdown: {
    lineNumbers: false,
    // ```mermaid becomes a component that draws the diagram in the browser.
    config(md) {
      const fence = md.renderer.rules.fence;
      if (!fence) return;
      let n = 0;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() !== 'mermaid') return fence(tokens, idx, options, env, self);
        return `<Mermaid id="${++n}" code="${encodeURIComponent(token.content)}" />`;
      };
    },
  },
});
