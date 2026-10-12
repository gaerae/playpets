// The few sentences the site's components say, per language.
import { useData } from 'vitepress';
import { computed } from 'vue';

const table = {
  ko: {
    since: v => `${v}부터`,
    downloadFor: os => `${os}용 다운로드`,
    otherPlatforms: '다른 환경',
    allFiles: '모든 파일 보기',
    releases: '릴리스 페이지',
    unreleased: '아직 릴리스 전이에요. 첫 릴리스가 나오면 여기에 파일이 생겨요.',
    lookupFailed: '지금은 최신 버전을 불러오지 못했어요. 파일은 ',
    lookupFailedEnd: '에서 받을 수 있어요.',
    missingShot: '이 화면은 아직 찍지 않았어요.',
    released: '릴리스 날짜',
    github: 'GitHub 릴리스에서 보기',
    changelog: '변경 기록 전체',
    preparing: '준비 중',
    retry: '다시 불러오기',
    free: '무료 앱 · MIT 라이선스 · PlayPets 가입 없이',
    files: {
      'macos-universal.dmg': 'macOS (Apple Silicon, Intel)',
      'windows-x64-setup.exe': 'Windows x64 설치 파일',
      'windows-arm64-setup.exe': 'Windows arm64 설치 파일',
      'windows-x64-portable.zip': 'Windows x64 포터블',
      'windows-arm64-portable.zip': 'Windows arm64 포터블',
      'linux-x64.deb': 'Linux x64 deb',
      'linux-x64.AppImage': 'Linux x64 AppImage',
      'linux-arm64.deb': 'Linux arm64 deb',
      'linux-arm64.AppImage': 'Linux arm64 AppImage',
    },
  },
  ja: {
    since: v => `${v}から`,
    downloadFor: os => `${os}版をダウンロード`,
    otherPlatforms: 'ほかのOS',
    allFiles: 'すべてのファイル',
    releases: 'リリース',
    unreleased: 'まだリリースされていません。最初のリリースでファイルを公開します。',
    lookupFailed: '最新バージョンを取得できませんでした。ファイルは',
    lookupFailedEnd: 'から入手できます。',
    missingShot: 'この画面はまだ撮影していません。',
    released: '公開日',
    github: 'GitHubリリースを見る',
    changelog: '変更履歴の全文',
    preparing: '準備中',
    retry: 'もう一度試す',
    free: '無料アプリ · MITライセンス · PlayPetsへの登録不要',
    files: {
      'macos-universal.dmg': 'macOS（Apple Silicon、Intel）',
      'windows-x64-setup.exe': 'Windows x64 インストーラー',
      'windows-arm64-setup.exe': 'Windows arm64 インストーラー',
      'windows-x64-portable.zip': 'Windows x64 ポータブル版',
      'windows-arm64-portable.zip': 'Windows arm64 ポータブル版',
      'linux-x64.deb': 'Linux x64 deb',
      'linux-x64.AppImage': 'Linux x64 AppImage',
      'linux-arm64.deb': 'Linux arm64 deb',
      'linux-arm64.AppImage': 'Linux arm64 AppImage',
    },
  },
  en: {
    since: v => `since ${v}`,
    downloadFor: os => `Download for ${os}`,
    otherPlatforms: 'Other platforms',
    allFiles: 'All files',
    releases: 'Releases',
    unreleased: 'Not released yet. Files appear here with the first release.',
    lookupFailed: 'Could not look up the latest version just now. See ',
    lookupFailedEnd: ' for the files.',
    missingShot: 'This screen has not been captured yet.',
    released: 'Released',
    github: 'View on GitHub releases',
    changelog: 'Full changelog',
    preparing: 'In preparation',
    retry: 'Try again',
    free: 'Free app · MIT license · No PlayPets account',
    files: {
      'macos-universal.dmg': 'macOS (Apple Silicon, Intel)',
      'windows-x64-setup.exe': 'Windows x64 installer',
      'windows-arm64-setup.exe': 'Windows arm64 installer',
      'windows-x64-portable.zip': 'Windows x64 portable',
      'windows-arm64-portable.zip': 'Windows arm64 portable',
      'linux-x64.deb': 'Linux x64 deb',
      'linux-x64.AppImage': 'Linux x64 AppImage',
      'linux-arm64.deb': 'Linux arm64 deb',
      'linux-arm64.AppImage': 'Linux arm64 AppImage',
    },
  },
  'zh-hans': {
    since: v => `${v} 起`,
    downloadFor: os => `下载 ${os} 版`,
    otherPlatforms: '其他平台',
    allFiles: '查看所有文件',
    releases: '发布页面',
    unreleased: '尚未发布。第一个版本发布后，文件会出现在这里。',
    lookupFailed: '暂时无法获取最新版本。文件可以在',
    lookupFailedEnd: '下载。',
    missingShot: '这个画面还没有截图。',
    released: '发布日期',
    github: '在 GitHub Releases 查看',
    changelog: '完整更新记录',
    preparing: '准备中',
    retry: '重试',
    free: '免费应用 · MIT 许可 · 无需 PlayPets 账号',
    files: {
      'macos-universal.dmg': 'macOS（Apple Silicon、Intel）',
      'windows-x64-setup.exe': 'Windows x64 安装程序',
      'windows-arm64-setup.exe': 'Windows arm64 安装程序',
      'windows-x64-portable.zip': 'Windows x64 便携版',
      'windows-arm64-portable.zip': 'Windows arm64 便携版',
      'linux-x64.deb': 'Linux x64 deb',
      'linux-x64.AppImage': 'Linux x64 AppImage',
      'linux-arm64.deb': 'Linux arm64 deb',
      'linux-arm64.AppImage': 'Linux arm64 AppImage',
    },
  },
} as const;

export type Lang = keyof typeof table;
export const FILES = Object.keys(table.ko.files) as (keyof typeof table.ko.files)[];

/** The site's language code (the folder under website/) from the page's language tag. */
export const codeOf = (tag: string): Lang =>
  tag.startsWith('ko') ? 'ko' : tag.startsWith('ja') ? 'ja' : tag.startsWith('zh') ? 'zh-hans' : 'en';

export function useWords() {
  const { lang } = useData();
  const code = computed<Lang>(() => codeOf(lang.value));
  return { lang: code, words: computed(() => table[code.value]) };
}
