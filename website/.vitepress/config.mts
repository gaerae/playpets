import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';
import { websiteNotices } from '../../scripts/licenses-lib.mjs';
import { alternateLinks, appStructuredData } from './locale-head.mjs';
import { devSidebar } from './sidebar-dev.mts';

const repo = 'https://github.com/gaerae/playpets';
// The site's address is package.json "homepage"; the base path follows from it, so moving the site
// to its own domain is one edit there (docs/how-to/site-address.md).
const { homepage: site, version }: { homepage: string; version: string } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const base = new URL(site).pathname;
// Browsers can retain a tab icon independently of the page's normal image cache.
const iconRevision = createHash('sha256')
  .update(readFileSync(new URL('../../assets/icon.svg', import.meta.url)))
  .digest('hex')
  .slice(0, 12);
// "Edit this page" opens the file in the repository: the developer docs live in docs/ (the site
// has a generated copy under dev/), every other page in website/. VitePress sends this function
// to the browser as source text, so it names the repository itself instead of using `repo`.
const editLink = (text: string) => ({
  pattern: ({ filePath }: { filePath: string }) =>
    filePath.startsWith('dev/')
      ? `https://github.com/gaerae/playpets/edit/main/docs/${filePath.slice(4).replace(/^index\.md$/, 'README.md')}`
      : `https://github.com/gaerae/playpets/edit/main/website/${filePath}`,
  text,
});

export default defineConfig({
  title: 'PlayPets',
  vite: { plugins: [websiteNotices()] },
  base,
  cleanUrls: true,
  lastUpdated: false,
  sitemap: { hostname: site },
  head: [
    ['link', { rel: 'shortcut icon', type: 'image/x-icon', href: `${base}favicon.ico?v=${iconRevision}` }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${base}favicon.png?v=${iconRevision}` }],
    ['link', { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: `${base}icon.svg?v=${iconRevision}` }],
    ['meta', { name: 'theme-color', content: '#244d43' }],
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
      label: 'English',
      lang: 'en-US',
      description:
        'Free, open-source desktop pet app for your Codex pets: up to 12 at once, chatting with each other and reacting to Claude Code, Codex, Gemini CLI and Cursor.',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/', activeMatch: '^/$' },
          { text: 'Download', link: '/#download', activeMatch: '^/#download' },
          { text: 'Studio', link: '/guide/creator-kit', activeMatch: '^/guide/(creator-kit|background-kit)' },
          { text: 'Guide', link: '/guide/', activeMatch: '^/guide/(?!creator-kit|background-kit)' },
          { text: 'Developers', link: '/dev/', activeMatch: '^/dev/' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Start here', link: '/guide/' },
                { text: 'Install', link: '/guide/install' },
                { text: 'Your first friend', link: '/guide/first-friend' },
                { text: 'Talking with friends', link: '/guide/chat' },
                { text: 'Coding agents', link: '/guide/agents' },
                { text: 'Desktop mode', link: '/guide/desktop' },
                { text: 'The yard and games', link: '/guide/play' },
                { text: 'Importing pets', link: '/guide/import' },
                { text: 'Creator kit', link: '/guide/creator-kit' },
                { text: 'Background studio', link: '/guide/background-kit' },
                { text: 'Settings', link: '/guide/settings' },
                { text: 'FAQ', link: '/guide/faq' },
              ],
            },
          ],
          '/releases/': [{ text: 'Releases', items: [{ text: 'All releases', link: '/releases/' }] }],
          '/dev/': devSidebar(),
        },
        editLink: editLink('Edit this page'),
        outline: { level: [2, 3] },
        footer: {
          message:
            'Free and open source under the MIT license. Not affiliated with OpenAI; Codex is a trademark of OpenAI.',
          copyright: `© 2026 gaerae · <a href="${base}THIRD-PARTY-NOTICES.txt">Third-party notices</a> · <a href="${base}privacy">Privacy</a>`,
        },
      },
    },
    ko: {
      label: '한국어',
      lang: 'ko-KR',
      link: '/ko/',
      description:
        '내 Codex 펫을 바탕화면 놀이터로 데려오는 무료 데스크톱 펫 앱이에요. 12명까지 함께 놀고, 서로 이야기하고, Claude Code, Codex, Gemini CLI, Cursor에 반응해요.',
      themeConfig: {
        nav: [
          { text: '홈', link: '/ko/', activeMatch: '^/ko/$' },
          { text: '다운로드', link: '/ko/#download', activeMatch: '^/ko/#download' },
          { text: '제작실', link: '/ko/guide/creator-kit', activeMatch: '^/ko/guide/(creator-kit|background-kit)' },
          { text: '사용 안내', link: '/ko/guide/', activeMatch: '^/ko/guide/(?!creator-kit|background-kit)' },
          { text: '개발(영어)', link: '/dev/' },
        ],
        sidebar: {
          '/ko/guide/': [
            {
              text: '사용 안내',
              items: [
                { text: '시작하기', link: '/ko/guide/' },
                { text: '설치하기', link: '/ko/guide/install' },
                { text: '첫 친구 초대하기', link: '/ko/guide/first-friend' },
                { text: '친구와 대화하기', link: '/ko/guide/chat' },
                { text: '코딩 에이전트 연동', link: '/ko/guide/agents' },
                { text: '바탕화면 모드', link: '/ko/guide/desktop' },
                { text: '놀이터와 놀이', link: '/ko/guide/play' },
                { text: '펫 가져오기', link: '/ko/guide/import' },
                { text: '제작 키트', link: '/ko/guide/creator-kit' },
                { text: '배경 제작실', link: '/ko/guide/background-kit' },
                { text: '설정', link: '/ko/guide/settings' },
                { text: '자주 묻는 질문', link: '/ko/guide/faq' },
              ],
            },
          ],
          '/ko/releases/': [{ text: '버전', items: [{ text: '모든 버전', link: '/ko/releases/' }] }],
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
          copyright: `© 2026 gaerae · <a href="${base}THIRD-PARTY-NOTICES.txt">타사 라이선스</a> · <a href="${base}ko/privacy">개인정보처리방침</a>`,
        },
        notFound: {
          title: '이런 페이지는 없어요',
          quote: '친구들이 숨바꼭질을 하다 길을 잃었나 봐요. 주소를 다시 확인해 주세요.',
          linkLabel: '첫 페이지로',
          linkText: '첫 페이지로 가기',
        },
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      description:
        '手もとのCodexペットをデスクトップの庭へ迎える無料アプリ。12人まで一緒に遊び、友だち同士で話し、Claude Code、Codex、Gemini CLI、Cursorに反応します。',
      themeConfig: {
        nav: [
          { text: 'ホーム', link: '/ja/', activeMatch: '^/ja/$' },
          { text: 'ダウンロード', link: '/ja/#download', activeMatch: '^/ja/#download' },
          { text: '制作室', link: '/ja/guide/creator-kit', activeMatch: '^/ja/guide/(creator-kit|background-kit)' },
          { text: '使い方', link: '/ja/guide/', activeMatch: '^/ja/guide/(?!creator-kit|background-kit)' },
          { text: '開発（英語）', link: '/dev/' },
        ],
        sidebar: {
          '/ja/guide/': [
            {
              text: '使い方',
              items: [
                { text: 'ここから始める', link: '/ja/guide/' },
                { text: 'インストール', link: '/ja/guide/install' },
                { text: '最初の友だち', link: '/ja/guide/first-friend' },
                { text: '友だちと話す', link: '/ja/guide/chat' },
                { text: 'コーディングエージェント', link: '/ja/guide/agents' },
                { text: 'デスクトップモード', link: '/ja/guide/desktop' },
                { text: '庭と遊び', link: '/ja/guide/play' },
                { text: 'ペットを取り込む', link: '/ja/guide/import' },
                { text: '制作キット', link: '/ja/guide/creator-kit' },
                { text: '背景制作室', link: '/ja/guide/background-kit' },
                { text: '設定', link: '/ja/guide/settings' },
                { text: 'よくある質問', link: '/ja/guide/faq' },
              ],
            },
          ],
          '/ja/releases/': [{ text: 'リリース', items: [{ text: 'すべてのリリース', link: '/ja/releases/' }] }],
        },
        outline: { label: 'このページ', level: [2, 3] },
        docFooter: { prev: '前のページ', next: '次のページ' },
        returnToTopLabel: '先頭へ戻る',
        sidebarMenuLabel: '目次',
        darkModeSwitchLabel: '画面モード',
        lightModeSwitchTitle: '明るい画面に切り替える',
        darkModeSwitchTitle: '暗い画面に切り替える',
        langMenuLabel: '言語',
        editLink: editLink('このページを編集'),
        footer: {
          message: 'MITライセンスの無料オープンソースです。OpenAIとは関係がありません。CodexはOpenAIの商標です。',
          copyright: `© 2026 gaerae · <a href="${base}THIRD-PARTY-NOTICES.txt">第三者ライセンス</a> · <a href="${base}ja/privacy">プライバシー</a>`,
        },
        notFound: {
          title: 'ページが見つかりません',
          quote: '友だちがかくれんぼで道に迷ったようです。アドレスを確認してください。',
          linkLabel: 'ホームへ',
          linkText: 'ホームへ戻る',
        },
      },
    },
    'zh-hans': {
      label: '简体中文',
      lang: 'zh-Hans',
      link: '/zh-hans/',
      description:
        '把你的 Codex 宠物带到桌面乐园的免费桌宠应用：最多 12 位一起玩、互相聊天，还会对 Claude Code、Codex、Gemini CLI、Cursor 做出反应。',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh-hans/', activeMatch: '^/zh-hans/$' },
          { text: '下载', link: '/zh-hans/#download', activeMatch: '^/zh-hans/#download' },
          {
            text: '制作室',
            link: '/zh-hans/guide/creator-kit',
            activeMatch: '^/zh-hans/guide/(creator-kit|background-kit)',
          },
          { text: '使用指南', link: '/zh-hans/guide/', activeMatch: '^/zh-hans/guide/(?!creator-kit|background-kit)' },
          { text: '开发者（英文）', link: '/dev/' },
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
                { text: '创作套件', link: '/zh-hans/guide/creator-kit' },
                { text: '背景制作室', link: '/zh-hans/guide/background-kit' },
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
          copyright: `© 2026 gaerae · <a href="${base}THIRD-PARTY-NOTICES.txt">第三方许可</a> · <a href="${base}zh-hans/privacy">隐私政策</a>`,
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
          ko: {
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
          ja: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                displayDetails: '詳細を表示',
                resetButtonTitle: '消去',
                backButtonTitle: '閉じる',
                noResultsText: '見つかりません：',
                footer: { selectText: '開く', navigateText: '移動', closeText: '閉じる' },
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
  // The share card in the page's language: og.png for English, og-<language>.png for the others,
  // with the page's own title, description, address (clean URLs: no .html, index → the folder)
  // and locale.
  transformHead({ pageData, title, description }) {
    const lang = pageData.relativePath.match(/^(ko|ja|zh-hans)\//)?.[1];
    const image = `${site}og${lang ? `-${lang}` : ''}.png`;
    const url = site + pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const locale = lang === 'ko' ? 'ko_KR' : lang === 'ja' ? 'ja_JP' : lang === 'zh-hans' ? 'zh_CN' : 'en_US';
    return [
      ['link', { rel: 'canonical', href: url }],
      ...alternateLinks(pageData.relativePath, site, path => existsSync(new URL(`../${path}`, import.meta.url))),
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:locale', content: locale }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { name: 'twitter:image', content: image }],
      ...appStructuredData(pageData.relativePath, site, { description, version }),
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
