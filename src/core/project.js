// The app's own pages, built from the two addresses the backend reports (data.project: the site and
// the repository). The site has English at its root and Korean, Japanese and Simplified Chinese in folders;
// any other app language reads the English pages.
const SITE_FOLDERS = { ko: 'ko/', ja: 'ja/', 'zh-hans': 'zh-hans/' };

export function projectLinks({ site, repository }, lang) {
  const root = `${site.replace(/\/$/, '')}/${SITE_FOLDERS[lang] ?? ''}`;
  const repo = repository.replace(/\/$/, '');
  return {
    site: root,
    privacy: `${root}privacy`,
    guide: `${root}guide/`,
    releases: `${root}releases/`,
    notes: version => `${root}releases/${version}`,
    github: repo,
    report: `${repo}/issues/new/choose`,
    // Store policy 11.16: a person can report an AI reply straight from the app.
    aiReport: `${repo}/issues/new?template=ai-reply.yml`,
    license: `${repo}/blob/main/LICENSE`,
  };
}
