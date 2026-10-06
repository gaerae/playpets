// The developer-docs sidebar is read from the generated copy of docs/ (website/dev) so new
// files appear without touching this config. Titles come from each file's first heading.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DefaultTheme } from 'vitepress';

const root = path.join(import.meta.dirname, '../dev');

const titleOf = (file: string) => {
  const text = readFileSync(file, 'utf8');
  const heading = text.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file, '.md');
  const title = heading
    .replace(/^(Standard|Architecture|Proposal|Decision|\[Research\]):?\s*/, '')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}\)$/, '');
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const pages = (folder: string): DefaultTheme.SidebarItem[] => {
  const dir = path.join(root, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .sort()
    .map(f => ({
      text: titleOf(path.join(dir, f)),
      link: `/dev/${folder ? `${folder}/` : ''}${f.replace(/\.md$/, '')}`,
    }));
};

export function devSidebar(): DefaultTheme.SidebarItem[] {
  const top = Object.fromEntries(pages('').map(p => [path.basename(p.link ?? ''), p]));
  const pick = (...names: string[]) => names.map(n => top[n]).filter(Boolean);
  return [
    { text: 'Developer guide', link: '/dev/' },
    { text: 'Start here', items: pick('getting-started', 'architecture', 'agent-integration', 'troubleshooting') },
    { text: 'How-to', items: pages('how-to') },
    { text: 'Standards', items: pages('standards') },
    { text: 'Runbooks', items: pages('runbooks') },
    { text: 'Reference', items: pages('reference') },
    { text: 'Decisions', collapsed: true, items: pages('decisions') },
    { text: 'Design records', collapsed: true, items: pages('design') },
  ].filter(g => !('items' in g) || g.items.length > 0);
}
